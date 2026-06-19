import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SS = Path(__file__).parent / "screenshots"
SS.mkdir(exist_ok=True)

DEVICES = [
    ("iphone15",  "iPhone 15",   393, 852),
    ("iphoneSE",  "iPhone SE",   375, 667),
    ("pixel8",    "Pixel 8",     412, 915),
    ("galaxyS24", "Galaxy S24",  384, 854),
    ("ipadMini",  "iPad mini",   744, 1133),
]
ZOOMS = [0.4, 0.6, 0.8, 1.0]


async def select_device(page, label: str):
    # Open shadcn Select and pick the option whose visible text starts with the device label.
    await page.locator('[data-testid="device-select"]').click()
    await page.get_by_role("option", name=lambda n: n and n.startswith(label)).first.click()
    await page.wait_for_timeout(200)


async def set_zoom(page, value: float):
    # Set the range slider via fill, then dispatch input so React updates.
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


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))

        await page.goto("http://localhost:8080/playground/mobile", wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # 1. Matrix: rotate × zoom × every device preset
        for key, label, w, h in DEVICES:
            await select_device(page, label)
            info = page.locator('[data-testid="device-info"]')

            for landscape in (False, True):
                # Read current orientation and toggle if it doesn't match the target.
                current = (await info.text_content() or "")
                is_landscape = f"{h}×{w}" in current
                if is_landscape != landscape:
                    await page.get_by_role("button", name="Portrait" if not is_landscape else "Landscape").click()
                    await page.wait_for_timeout(150)

                for z in ZOOMS:
                    await set_zoom(page, z)
                    label_text = await page.locator('[data-testid="zoom-label"]').text_content()
                    assert f"{int(round(z*100))}%" == (label_text or "").strip(), \
                        f"zoom label mismatch for {key} {landscape} {z}: got {label_text}"

                    # Debug panel must remain mounted (pre.text-destructive may not exist
                    # without errors, but the panel itself is identifiable by its label).
                    panel = page.get_by_text("AI debug helper", exact=False)
                    assert await panel.count() >= 1, f"debug panel missing for {key}"

                    # Preview iframe must still be in the DOM and sized.
                    box = await page.locator('[data-testid="mobile-preview"]').bounding_box()
                    assert box and box["width"] > 10 and box["height"] > 10, \
                        f"preview iframe collapsed for {key} landscape={landscape} zoom={z}"

                expected = f"{h}×{w}" if landscape else f"{w}×{h}"
                assert expected in (await info.text_content() or ""), \
                    f"device info wrong for {key} landscape={landscape}"

            print(f"PASS matrix: {label}")

        await page.screenshot(path=str(SS / "matrix_final.png"))

        # 2. Persistence: reload and confirm device/landscape/zoom restored.
        await select_device(page, "Pixel 8")
        await page.get_by_role("button", name="Portrait").click()
        await set_zoom(page, 0.55)
        await page.wait_for_timeout(300)
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1500)
        info_text = await page.locator('[data-testid="device-info"]').text_content()
        assert info_text and "915×412" in info_text, f"persistence lost: {info_text}"
        zoom_text = await page.locator('[data-testid="zoom-label"]').text_content()
        assert zoom_text and "55%" in zoom_text, f"zoom not restored: {zoom_text}"
        print("PASS: device/landscape/zoom persisted across reload")

        # 3. Runtime error capture still works after the matrix run.
        await page.get_by_role("tab", name="JS").click()
        await page.wait_for_timeout(400)
        ok = await page.evaluate("""() => {
          const m = window.monaco; if (!m) return false;
          const js = m.editor.getModels().find(x => x.getLanguageId() === 'javascript');
          if (!js) return false;
          js.setValue("throw new Error('Mobile runtime error');");
          return true;
        }""")
        assert ok
        await page.wait_for_timeout(3000)
        text = await page.locator("pre.text-destructive").text_content(timeout=8000)
        assert text and "Mobile runtime error" in text
        print("PASS: runtime error captured after matrix")

        # 4. Projects menu opens and shows expected items (auth optional).
        await page.locator('[data-testid="projects-menu"]').click()
        await page.wait_for_timeout(500)
        for item in ("New project", "Save as…"):
            assert await page.get_by_role("menuitem", name=item).count() >= 1, f"missing {item}"
        await page.keyboard.press("Escape")
        print("PASS: projects menu renders Save/Open actions")

        # 5. All routes still healthy.
        for path in ("/", "/playground", "/playground/web", "/playground/mobile", "/tools"):
            r = await page.goto(f"http://localhost:8080{path}", wait_until="domcontentloaded")
            assert r and r.status == 200, f"{path} -> {r and r.status}"
        print("PASS: all routes 200")

        assert not errors, f"page errors: {errors}"
        await b.close()


asyncio.run(main())
