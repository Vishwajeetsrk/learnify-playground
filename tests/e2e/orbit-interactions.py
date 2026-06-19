"""End-to-end smoke for the Polyglot Orbit interactions.

Runs against the local dev server (http://localhost:8080) and verifies:
  1. Tapping an orbit logo navigates to the matching playground route.
  2. A horizontal drag does NOT navigate (gesture is treated as a spin).
  3. Every orbit logo renders a visible image (no broken/empty tiles).

Usage:
    python3 tests/e2e/orbit-interactions.py
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"

async def pause_orbit(page):
    # Dispatch a mouse pointerenter on the orbit wrap so the autoplay rotation pauses.
    # (Real users get the same effect just by moving the mouse over it.)
    await page.evaluate(
        """() => {
            const w = document.querySelector('[data-testid="polyglot-orbit"]');
            if (!w) return;
            const r = w.getBoundingClientRect();
            const ev = (type) => new PointerEvent(type, {
                bubbles: true, pointerType: 'mouse', pointerId: 1,
                clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
            });
            w.dispatchEvent(ev('pointerenter'));
            w.dispatchEvent(ev('pointermove'));
        }"""
    )
    await page.wait_for_timeout(400)

async def test_tap_navigates(page):
    await page.goto(BASE + "/", wait_until="networkidle")
    await page.wait_for_timeout(800)
    link = page.locator('[data-testid="orbit-logo-python"]').first
    href = await link.get_attribute("href")
    assert href and "/playground" in href, f"unexpected href {href!r}"
    await pause_orbit(page)
    # Use evaluate-click to avoid Playwright's stability check on a still-easing element.
    await link.evaluate("el => el.click()")
    await page.wait_for_url("**/playground**", timeout=5000)
    assert "lang=python" in page.url, f"missing lang param: {page.url}"
    print("[ok] tap navigates →", page.url)

async def test_drag_does_not_navigate(page):
    await page.goto(BASE + "/", wait_until="networkidle")
    await page.wait_for_timeout(800)
    link = page.locator('[data-testid="orbit-logo-javascript"]').first
    box = await link.bounding_box()
    assert box, "no bounding box for orbit logo"
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    # Drag 120px horizontally — well past the 6px mouse threshold.
    for x in range(0, 121, 20):
        await page.mouse.move(cx + x, cy, steps=2)
        await page.wait_for_timeout(20)
    await page.mouse.up()
    await page.wait_for_timeout(600)
    assert page.url.rstrip("/") == BASE, f"drag should NOT navigate; got {page.url}"
    print("[ok] drag does not navigate")

async def test_every_logo_loads(page):
    await page.goto(BASE + "/", wait_until="networkidle")
    await page.wait_for_timeout(1500)  # let lazy images load
    info = await page.evaluate(
        """() => {
            const tiles = Array.from(document.querySelectorAll('[data-testid^="orbit-logo-"]'));
            return tiles.map(t => {
              const img = t.querySelector('img');
              const fallback = t.querySelector('[role="img"]'); // InitialsBadge
              return {
                slug: t.getAttribute('data-testid'),
                hasImg: !!img,
                loaded: img ? (img.complete && img.naturalWidth > 0) : false,
                fallback: !!fallback,
              };
            });
        }"""
    )
    bad = [t for t in info if not (t["loaded"] or t["fallback"])]
    print(f"orbit tiles: {len(info)} · bad: {len(bad)}")
    assert not bad, f"tiles missing a visible logo: {bad}"
    print("[ok] every orbit logo renders")

async def main():
    failed = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        for fn in (test_tap_navigates, test_drag_does_not_navigate, test_every_logo_loads):
            try:
                await fn(page)
            except AssertionError as exc:
                failed.append((fn.__name__, str(exc)))
                print(f"[FAIL] {fn.__name__}: {exc}")
        await browser.close()
    if failed:
        print(f"\n{len(failed)} test(s) failed")
        sys.exit(1)
    print("\nall orbit interaction tests passed ✓")

if __name__ == "__main__":
    asyncio.run(main())
