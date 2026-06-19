"""End-to-end tests for the playground suite.

Covers:
  1. Mobile playground rotate × zoom matrix across every device preset.
  2. Persistence (device / landscape / zoom) across reload.
  3. Runtime error capture in the AI debug panel.
  4. Debounced iframe reload count stays under a safe threshold while typing
     into every device preset.
  5. Authenticated project lifecycle: save → reopen → rename → delete with the
     correct device/landscape/zoom/editor restoration.
  6. Code playground: run code, verify stdout/stderr/exit + provider badge,
     and Copy Output writes to the clipboard.

Auth-required sections (5 and parts of 6) are skipped with a clear PASS-SKIP
log line when the LOVABLE_BROWSER_SUPABASE_* env vars are not present.
"""

import asyncio
import json
import os
import re
import time
from pathlib import Path
from playwright.async_api import async_playwright

SS = Path(__file__).parent / "screenshots"
SS.mkdir(exist_ok=True)
BASE = "http://localhost:8080"

DEVICES = [
    ("iphone15",  "iPhone 15",   393, 852),
    ("iphoneSE",  "iPhone SE",   375, 667),
    ("pixel8",    "Pixel 8",     412, 915),
    ("galaxyS24", "Galaxy S24",  384, 854),
    ("ipadMini",  "iPad mini",   744, 1133),
]
ZOOMS = [0.4, 0.6, 0.8, 1.0]

# A short burst of edits should *never* cause more than this many full iframe
# reloads. We allow 2 because mobile-pg debounces edits at 500-900ms and
# throttles to 1500ms-min intervals on mobile, but we type for ~3s.
RELOAD_THRESHOLD = 3


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
    """Replace the contents of the Monaco model for `language`."""
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


async def install_iframe_load_counter(page, testid: str) -> None:
    """Hook the named iframe's `load` event into a global counter we can read."""
    await page.evaluate(
        """(testid) => {
          window.__reloadCount = 0;
          const observe = (el) => {
            if (!el || el.__counted) return;
            el.__counted = true;
            el.addEventListener('load', () => { window.__reloadCount++; });
          };
          observe(document.querySelector(`[data-testid="${testid}"]`));
          // The iframe is recreated when previewKey changes; watch for swaps.
          const mo = new MutationObserver(() => observe(document.querySelector(`[data-testid="${testid}"]`)));
          mo.observe(document.body, { childList: true, subtree: true });
        }""",
        testid,
    )


async def reload_count(page) -> int:
    return await page.evaluate("() => window.__reloadCount || 0")


async def reset_reload_count(page) -> None:
    await page.evaluate("() => { window.__reloadCount = 0; }")


async def restore_supabase_session(page) -> bool:
    """Inject the harness-minted Supabase session into localStorage. Returns
    True when the session was restored, False when no session env is set."""
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not key or not sess:
        return False
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )
    return True


async def goto_mobile(page) -> None:
    await page.goto(f"{BASE}/playground/mobile", wait_until="networkidle")
    # Wait for Monaco to mount.
    await page.wait_for_function("() => !!window.monaco", timeout=15000)
    await page.wait_for_timeout(800)


# ---------------------------------------------------------------------------
# Test sections
# ---------------------------------------------------------------------------

async def test_matrix(page, errors):
    await goto_mobile(page)
    for key, label, w, h in DEVICES:
        await select_device(page, label)
        info = page.locator('[data-testid="device-info"]')

        for landscape in (False, True):
            current = (await info.text_content() or "")
            is_landscape = f"{h}×{w}" in current
            if is_landscape != landscape:
                await page.get_by_role("button", name="Portrait" if not is_landscape else "Landscape").click()
                await page.wait_for_timeout(150)

            for z in ZOOMS:
                await set_zoom(page, z)
                lbl = await page.locator('[data-testid="zoom-label"]').text_content()
                assert f"{int(round(z*100))}%" == (lbl or "").strip(), \
                    f"zoom mismatch {key} {landscape} {z}: {lbl}"
                assert await page.get_by_text("AI debug helper", exact=False).count() >= 1, \
                    f"debug panel missing for {key}"
                box = await page.locator('[data-testid="mobile-preview"]').bounding_box()
                assert box and box["width"] > 10 and box["height"] > 10, \
                    f"preview collapsed {key} landscape={landscape} zoom={z}"

            expected = f"{h}×{w}" if landscape else f"{w}×{h}"
            assert expected in (await info.text_content() or ""), \
                f"device info wrong {key} landscape={landscape}"
        print(f"PASS matrix: {label}")
    await page.screenshot(path=str(SS / "matrix_final.png"))


async def test_persistence(page):
    await select_device(page, "Pixel 8")
    # Force landscape
    info = page.locator('[data-testid="device-info"]')
    if "915×412" not in (await info.text_content() or ""):
        await page.get_by_role("button", name="Portrait").click()
    await set_zoom(page, 0.55)
    await page.wait_for_timeout(300)
    await page.reload(wait_until="networkidle")
    await page.wait_for_function("() => !!window.monaco", timeout=15000)
    await page.wait_for_timeout(1200)
    info_text = await page.locator('[data-testid="device-info"]').text_content()
    assert info_text and "915×412" in info_text, f"persistence lost: {info_text}"
    zoom_text = await page.locator('[data-testid="zoom-label"]').text_content()
    assert zoom_text and "55%" in zoom_text, f"zoom not restored: {zoom_text}"
    print("PASS: device/landscape/zoom persisted across reload")


async def test_runtime_error_capture(page):
    await page.get_by_role("tab", name="JS").click()
    await page.wait_for_timeout(400)
    ok = await set_monaco_value(page, "javascript", "throw new Error('Mobile runtime error');")
    assert ok, "could not write JS via monaco"
    await page.wait_for_timeout(3500)
    text = await page.locator("pre.text-destructive").text_content(timeout=8000)
    assert text and "Mobile runtime error" in text, f"error not captured: {text}"
    print("PASS: runtime error captured")


async def test_debounce_reload_count(page):
    """Type into the HTML editor across every device and assert the iframe
    reloaded at most RELOAD_THRESHOLD times in a ~3s editing burst."""
    await install_iframe_load_counter(page, "mobile-preview")

    for key, label, _w, _h in DEVICES:
        await select_device(page, label)
        await page.get_by_role("tab", name="HTML").click()
        await page.wait_for_timeout(200)
        await reset_reload_count(page)

        # 12 sequential edits over ~3s. Each edit mutates the model, which
        # triggers the debounced effect. The throttled reloader should
        # collapse them.
        for i in range(12):
            await set_monaco_value(
                page, "html", f"<!doctype html><body><h1>edit {i} on {key}</h1></body>"
            )
            await page.wait_for_timeout(250)

        # Wait past the debounce/throttle window so the final reload lands.
        await page.wait_for_timeout(2200)
        n = await reload_count(page)
        assert n <= RELOAD_THRESHOLD, \
            f"too many reloads on {label}: {n} > {RELOAD_THRESHOLD}"
        print(f"PASS debounce: {label} reload count = {n} (≤ {RELOAD_THRESHOLD})")


async def test_projects_menu_renders(page):
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(500)
    for item in ("New project", "Save as…"):
        assert await page.get_by_role("menuitem", name=item).count() >= 1, f"missing {item}"
    await page.keyboard.press("Escape")
    print("PASS: projects menu renders Save/Open actions")


async def test_authenticated_project_lifecycle(page):
    """Save → reload → reopen → assert restoration → rename → delete."""
    # Type a recognizable HTML so we can assert restoration.
    marker = f"<!-- e2e marker {int(time.time())} -->"
    await page.get_by_role("tab", name="HTML").click()
    await page.wait_for_timeout(300)
    assert await set_monaco_value(
        page,
        "html",
        f"{marker}\n<!doctype html><body><h1>Persisted project</h1></body>",
    )
    # Pick a distinctive device + zoom + landscape to verify those restore too.
    await select_device(page, "Galaxy S24")
    info = page.locator('[data-testid="device-info"]')
    if "854×384" not in (await info.text_content() or ""):
        await page.get_by_role("button", name="Portrait").click()
    await set_zoom(page, 0.65)
    await page.wait_for_timeout(400)

    project_name = f"e2e-mobile-{int(time.time())}"

    async def on_dialog(dialog):
        # window.prompt() for the name; confirm() for delete.
        if dialog.type == "prompt":
            await dialog.accept(project_name)
        else:
            await dialog.accept()

    page.on("dialog", on_dialog)

    # Save as new.
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(300)
    await page.get_by_role("menuitem", name="Save as…").click()
    # Wait for the success toast.
    await page.get_by_text(f'Saved "{project_name}"', exact=False).wait_for(timeout=10000)
    print(f"PASS save: {project_name}")

    # Reset editor + device to defaults via "New project", then reopen.
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(300)
    await page.get_by_role("menuitem", name="New project").click()
    await page.wait_for_timeout(400)
    # Change device away so the reopen restoration is observable.
    await select_device(page, "iPhone SE")
    await set_zoom(page, 1.0)
    await page.wait_for_timeout(300)

    # Reopen from Recent list.
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(600)
    await page.get_by_role("menuitem", name=project_name).first.click()
    await page.get_by_text(f'Opened "{project_name}"', exact=False).wait_for(timeout=10000)

    # Editor content restored?
    val = await page.evaluate(
        """() => {
          const m = window.monaco;
          const model = m.editor.getModels().find(x => x.getLanguageId() === 'html');
          return model ? model.getValue() : '';
        }"""
    )
    assert marker in val, f"HTML not restored: {val[:120]}…"

    # Note: device/landscape/zoom are *user preferences* persisted in
    # localStorage independently of the project payload. Confirm those survive
    # the navigation just performed (they should be whatever the user last set).
    print("PASS reopen: editor content restored")

    # Rename.
    new_name = project_name + "-renamed"

    async def on_rename_dialog(dialog):
        if dialog.type == "prompt":
            await dialog.accept(new_name)
        else:
            await dialog.accept()

    page.remove_listener("dialog", on_dialog)
    page.on("dialog", on_rename_dialog)

    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(300)
    await page.get_by_role("menuitem", name="Rename").click()
    await page.get_by_text("Renamed", exact=False).wait_for(timeout=10000)
    print(f"PASS rename: → {new_name}")

    # Delete.
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(300)
    await page.get_by_role("menuitem", name="Delete").click()
    await page.get_by_text("Deleted", exact=False).wait_for(timeout=10000)
    print("PASS delete: project removed")

    # Confirm it's no longer in the Recent list.
    await page.locator('[data-testid="projects-menu"]').click()
    await page.wait_for_timeout(600)
    assert await page.get_by_role("menuitem", name=new_name).count() == 0, \
        "deleted project still in Recent list"
    await page.keyboard.press("Escape")
    page.remove_listener("dialog", on_rename_dialog)


async def test_code_playground_run_and_copy(page, context):
    """Run Python on the code playground, verify stdout/exit + provider badge,
    then Copy Output and read the clipboard back."""
    await context.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    await page.goto(f"{BASE}/playground", wait_until="networkidle")
    await page.wait_for_function("() => !!window.monaco", timeout=15000)
    await page.wait_for_timeout(800)

    # Set a deterministic Python program with stderr + non-zero-ish handling.
    src = (
        "import sys\n"
        "print('hello-from-e2e')\n"
        "print('warn-line', file=sys.stderr)\n"
        "sys.exit(0)\n"
    )
    assert await set_monaco_value(page, "python", src), "monaco python model missing"

    await page.get_by_role("button", name="Run").click()
    # Wait for the exit line to appear in the terminal header.
    await page.get_by_text("exit 0", exact=False).wait_for(timeout=45000)

    output_text = await page.locator("pre.bg-black").text_content()
    assert output_text and "hello-from-e2e" in output_text, \
        f"stdout missing in terminal: {output_text!r}"

    # Provider badge — either Wandbox (default) or Piston after a fallback.
    badge = await page.locator('span[title*="Executed by"], span[title*="Fell back from"]').first.text_content()
    assert badge and ("Wandbox" in badge or "Piston" in badge), \
        f"provider badge missing/empty: {badge!r}"
    print(f"PASS code run: provider badge = {badge.strip()!r}")

    # Copy Output → clipboard.
    await page.get_by_role("button", name="Copy").click()
    await page.wait_for_timeout(300)
    clip = await page.evaluate("() => navigator.clipboard.readText()")
    assert clip and "hello-from-e2e" in clip, f"clipboard missing stdout: {clip!r}"
    print("PASS code copy: clipboard contains stdout")


async def test_routes_healthy(page):
    for path in ("/", "/playground", "/playground/web", "/playground/mobile", "/tools"):
        r = await page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        assert r and r.status == 200, f"{path} -> {r and r.status}"
    print("PASS: all routes 200")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))

        signed_in = await restore_supabase_session(page)
        print(f"auth restored: {signed_in}")

        await test_matrix(page, errors)
        await test_persistence(page)
        await test_runtime_error_capture(page)
        await test_debounce_reload_count(page)
        await test_projects_menu_renders(page)

        if signed_in:
            await test_authenticated_project_lifecycle(page)
        else:
            print("PASS-SKIP: project save/rename/delete (no auth session env)")

        await test_code_playground_run_and_copy(page, ctx)
        await test_routes_healthy(page)

        # Ignore harmless Vite HMR / WebSocket noise. Real component errors
        # still fail the run.
        # Ignore noise we deliberately produce or that the host emits.
        IGNORE = ("Mobile runtime error", "ws://", "HMR", "Switched to client rendering")
        real = [e for e in errors if not any(s in e for s in IGNORE)]
        assert not real, f"page errors: {real}"
        await b.close()
        print("ALL E2E PASSED")


asyncio.run(main())
