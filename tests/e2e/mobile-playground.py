"""End-to-end tests for the Android Mobile Playground + CI reporting.

CI-friendly reporting:
- Every test is wrapped in `step(name, coro)`. On failure we capture a labelled
  screenshot, dump the page console log, and continue running the remaining
  tests so one device's failure does not mask others.
- Failures across each device preset are captured separately.
- A JSON summary is written to /tmp/browser/mobile-e2e-report/report.json and
  the process exits with status 1 if anything failed.
"""

import asyncio
import json
import os
import re
import sys
import time
import traceback
from pathlib import Path
from playwright.async_api import async_playwright

REPORT_DIR = Path("/tmp/browser/mobile-e2e-report")
REPORT_DIR.mkdir(parents=True, exist_ok=True)
SS = REPORT_DIR / "screenshots"
SS.mkdir(exist_ok=True)
LOG_PATH = REPORT_DIR / "run.log"
SUMMARY_PATH = REPORT_DIR / "report.json"

BASE = "http://localhost:8080"

DEVICES = [
    ("pixel8",    "Pixel 8",     412, 915),
    ("galaxyS24", "Galaxy S24",  384, 854),
    ("iphone15",  "iPhone 15",   393, 852),
    ("iphoneSE",  "iPhone SE",   375, 667),
    ("ipadMini",  "iPad mini",   744, 1133),
]
ZOOMS = [0.4, 0.6, 0.8, 1.0]


# ---------------------------------------------------------------------------
# CI reporter
# ---------------------------------------------------------------------------

class Reporter:
    def __init__(self):
        self.results: list[dict] = []
        self.log_lines: list[str] = []
        self.console_buffer: list[str] = []
        self.start = time.time()

    def log(self, msg: str):
        line = f"[{time.time() - self.start:7.2f}s] {msg}"
        print(line, flush=True)
        self.log_lines.append(line)

    def attach_console(self, page):
        page.on("console", lambda m: self.console_buffer.append(f"[{m.type}] {m.text[:300]}"))
        page.on("pageerror", lambda e: self.console_buffer.append(f"[pageerror] {str(e)[:300]}"))

    async def step(self, page, name: str, coro_factory):
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80]
        self.console_buffer.clear()
        self.log(f"▶ {name}")
        t0 = time.time()
        try:
            await coro_factory()
        except BaseException as e:  # noqa: BLE001 — capture everything
            elapsed = time.time() - t0
            tb = traceback.format_exc()
            # Failure artifacts: screenshot + per-step log file.
            shot = SS / f"FAIL-{slug}.png"
            try:
                await page.screenshot(path=str(shot))
            except Exception as shot_err:
                shot = None
                self.log(f"  ! screenshot failed: {shot_err}")
            step_log = SS / f"FAIL-{slug}.log"
            step_log.write_text(
                f"FAILED: {name}\n\n{tb}\n\n=== console ===\n"
                + "\n".join(self.console_buffer[-100:]),
            )
            self.results.append({
                "name": name,
                "status": "fail",
                "elapsed_s": round(elapsed, 2),
                "error": f"{type(e).__name__}: {e}".splitlines()[0][:240],
                "screenshot": str(shot) if shot else None,
                "log": str(step_log),
            })
            self.log(f"✗ FAIL {name} ({elapsed:.1f}s) → {shot}")
            return False
        elapsed = time.time() - t0
        self.results.append({
            "name": name,
            "status": "pass",
            "elapsed_s": round(elapsed, 2),
        })
        self.log(f"✓ PASS {name} ({elapsed:.1f}s)")
        return True

    def finalize(self) -> int:
        failed = [r for r in self.results if r["status"] == "fail"]
        summary = {
            "total": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "pass"),
            "failed": len(failed),
            "elapsed_s": round(time.time() - self.start, 2),
            "results": self.results,
        }
        SUMMARY_PATH.write_text(json.dumps(summary, indent=2))
        LOG_PATH.write_text("\n".join(self.log_lines))
        print("\n" + "=" * 60)
        print(f"REPORT  total={summary['total']}  passed={summary['passed']}  failed={summary['failed']}")
        print(f"        log     = {LOG_PATH}")
        print(f"        summary = {SUMMARY_PATH}")
        if failed:
            print("\nFailed steps:")
            for r in failed:
                print(f"  - {r['name']}: {r['error']}")
                if r.get("screenshot"):
                    print(f"      shot: {r['screenshot']}")
        return 1 if failed else 0


# ---------------------------------------------------------------------------
# Page helpers
# ---------------------------------------------------------------------------

async def select_device(page, label: str):
    await page.locator('[data-testid="device-select"]').click()
    await page.get_by_role("option", name=re.compile("^" + re.escape(label))).first.click()
    await page.wait_for_timeout(200)


async def set_zoom(page, value: float):
    await page.evaluate(
        """(v) => {
            const el = document.querySelector('[data-testid=\"zoom-range\"]');
            const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            proto.set.call(el, String(v));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }""",
        value,
    )
    await page.wait_for_timeout(100)


async def set_monaco_value(page, language: str, value: str) -> bool:
    return await page.evaluate(
        """({lang, value}) => {
          const m = window.monaco; if (!m) return false;
          const model = m.editor.getModels().find(x => x.getLanguageId() === lang);
          if (!model) return false;
          model.setValue(value);
          return true;
        }""",
        {"lang": language, "value": value},
    )


async def restore_supabase_session(page) -> bool:
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not key or not sess:
        return False
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )
    return True


async def goto_mobile(page):
    await page.goto(f"{BASE}/playground/mobile", wait_until="networkidle")
    await page.wait_for_function("() => !!window.monaco", timeout=15000)
    await page.wait_for_timeout(800)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def assert_device_matrix(page):
    for key, label, w, h in DEVICES:
        await select_device(page, label)
        info = page.locator('[data-testid="device-info"]')
        for landscape in (False, True):
            current = (await info.text_content() or "")
            is_landscape = f"{h}×{w}" in current
            if is_landscape != landscape:
                await page.get_by_role(
                    "button", name="Portrait" if not is_landscape else "Landscape"
                ).click()
                await page.wait_for_timeout(150)
            for z in ZOOMS:
                await set_zoom(page, z)
                lbl = await page.locator('[data-testid="zoom-label"]').text_content()
                assert f"{int(round(z*100))}%" == (lbl or "").strip(), \
                    f"zoom mismatch {key} landscape={landscape} z={z}: {lbl}"
                box = await page.locator('[data-testid="mobile-preview"]').bounding_box()
                assert box and box["width"] > 10 and box["height"] > 10, \
                    f"preview collapsed {key} landscape={landscape} z={z}"
            expected = f"{h}×{w}" if landscape else f"{w}×{h}"
            assert expected in (await info.text_content() or ""), \
                f"device info wrong {key} landscape={landscape}"


async def assert_run_java(page):
    """Click the in-screen ▶ Run app button and verify logcat shows stdout."""
    # Replace code with something with a deterministic marker.
    marker = f"E2E-RUN-{int(time.time())}"
    src = (
        "public class MainActivity {\n"
        "  public static void main(String[] args) {\n"
        f'    System.out.println("{marker}");\n'
        '    System.err.println("warn-line");\n'
        "  }\n"
        "}\n"
    )
    assert await set_monaco_value(page, "java", src), "no java monaco model"
    # Click the big in-screen run button — that's the headline UX.
    await page.locator('[data-testid="screen-run"]').click()
    # Wait up to 90s for compile+run (Wandbox can be slow on first call).
    deadline = time.time() + 90
    while time.time() < deadline:
        text = await page.locator('[data-testid="logcat"]').text_content() or ""
        if marker in text and "exit" in text:
            break
        await page.wait_for_timeout(800)
    else:
        raise AssertionError(f"logcat never received marker after 90s: {text[:300]}")
    assert "warn-line" in text, f"stderr missing in logcat: {text[:300]}"
    assert "exit 0" in text, f"exit code missing or wrong: {text[:300]}"


async def assert_persistence(page):
    await select_device(page, "Galaxy S24")
    info = page.locator('[data-testid="device-info"]')
    if "854×384" not in (await info.text_content() or ""):
        await page.get_by_role("button", name="Portrait").click()
    await set_zoom(page, 0.55)
    await page.wait_for_timeout(300)
    await page.reload(wait_until="networkidle")
    await page.wait_for_function("() => !!window.monaco", timeout=15000)
    await page.wait_for_timeout(1000)
    info_text = await page.locator('[data-testid="device-info"]').text_content()
    assert info_text and "854×384" in info_text, f"persistence lost: {info_text}"
    zoom_text = await page.locator('[data-testid="zoom-label"]').text_content()
    assert zoom_text and "55%" in zoom_text, f"zoom lost: {zoom_text}"


async def assert_projects_menu(page):
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(500)
    for item in ("New project", "Save as…"):
        assert await page.get_by_role("menuitem", name=item).count() >= 1, f"missing {item}"
    await page.keyboard.press("Escape")


async def assert_routes_healthy(page):
    for path in ("/", "/playground", "/playground/web", "/playground/mobile", "/tools"):
        r = await page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        assert r and r.status == 200, f"{path} -> {r and r.status}"


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

async def main():
    reporter = Reporter()
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        reporter.attach_console(page)

        signed_in = await restore_supabase_session(page)
        reporter.log(f"auth restored: {signed_in}")

        await reporter.step(page, "goto mobile playground", lambda: goto_mobile(page))

        # Per-device matrix steps so failures point at the broken device.
        async def per_device(key, label, w, h):
            await select_device(page, label)
            info = page.locator('[data-testid="device-info"]')
            for landscape in (False, True):
                current = (await info.text_content() or "")
                is_landscape = f"{h}×{w}" in current
                if is_landscape != landscape:
                    await page.get_by_role(
                        "button",
                        name="Portrait" if not is_landscape else "Landscape",
                    ).click()
                    await page.wait_for_timeout(150)
                for z in ZOOMS:
                    await set_zoom(page, z)
                    lbl = await page.locator('[data-testid="zoom-label"]').text_content()
                    assert f"{int(round(z*100))}%" == (lbl or "").strip(), \
                        f"zoom mismatch {key} {landscape} {z}: {lbl}"
                    box = await page.locator('[data-testid="mobile-preview"]').bounding_box()
                    assert box and box["width"] > 10 and box["height"] > 10, \
                        f"preview collapsed {key} landscape={landscape} z={z}"
                expected = f"{h}×{w}" if landscape else f"{w}×{h}"
                assert expected in (await info.text_content() or ""), \
                    f"device info wrong {key} landscape={landscape}"

        for key, label, w, h in DEVICES:
            await reporter.step(
                page, f"matrix · {label}",
                lambda k=key, l=label, ww=w, hh=h: per_device(k, l, ww, hh),
            )

        await reporter.step(page, "persistence across reload", lambda: assert_persistence(page))
        await reporter.step(page, "run Java app from phone screen", lambda: assert_run_java(page))
        await reporter.step(page, "projects menu renders", lambda: assert_projects_menu(page))
        await reporter.step(page, "all routes 200", lambda: assert_routes_healthy(page))

        await b.close()

    return reporter.finalize()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
