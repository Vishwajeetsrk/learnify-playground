import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SS = Path(__file__).parent / "screenshots"
SS.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("PAGEERROR", str(e)[:200]))

        # 1. Mobile route loads
        await page.goto("http://localhost:8080/playground/mobile", wait_until="networkidle")
        await page.wait_for_timeout(4000)
        assert await page.locator('iframe[data-testid="mobile-preview"]').count() == 1, "mobile preview iframe missing"
        await page.screenshot(path=str(SS / "1_mobile_initial.png"))
        print("PASS: /playground/mobile renders with device frame")

        # 2. Rotate (portrait -> landscape) and device switch
        await page.get_by_role("button", name="Portrait").click()
        await page.wait_for_timeout(400)
        assert await page.get_by_role("button", name="Landscape").count() == 1
        await page.screenshot(path=str(SS / "2_landscape.png"))
        print("PASS: rotate to landscape")

        # 3. Inject a runtime error inside the phone iframe and confirm debug helper captures
        await page.get_by_role("tab", name="JS").click()
        await page.wait_for_timeout(500)
        ok = await page.evaluate("""() => {
          const m = window.monaco; if (!m) return false;
          const js = m.editor.getModels().find(x => x.getLanguageId() === 'javascript');
          if (!js) return false;
          js.setValue("throw new Error('Mobile runtime error');");
          return true;
        }""")
        assert ok, "could not set JS via monaco"
        await page.wait_for_timeout(2500)
        text = await page.locator("pre.text-destructive").text_content(timeout=8000)
        print("CAPTURED:", repr(text))
        assert text and "Mobile runtime error" in text
        print("PASS: AI debug helper captured the mobile runtime error")
        await page.screenshot(path=str(SS / "3_error_captured.png"))

        # 4. Hide AI toggle works on mobile route too
        await page.get_by_role("button", name="Hide AI debug helper").click()
        await page.wait_for_timeout(300)
        assert await page.locator("pre.text-destructive").count() == 0
        print("PASS: AI helper toggle hides panel")

        # 5. Existing routes still healthy
        for path in ("/", "/playground", "/playground/web", "/tools"):
            r = await page.goto(f"http://localhost:8080{path}", wait_until="domcontentloaded")
            assert r and r.status == 200, f"{path} -> {r and r.status}"
            print(f"PASS: {path} -> 200")

        await b.close()

asyncio.run(main())
