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
        await page.goto("http://localhost:8080/playground/web", wait_until="networkidle")
        await page.wait_for_timeout(4000)
        print("HAS testid:", await page.locator('iframe[data-testid="web-preview"]').count())
        await page.screenshot(path=str(SS / "1_initial.png"))

        # Switch to JS tab
        await page.get_by_role("tab", name="JS").click()
        await page.wait_for_timeout(800)

        # Use Monaco API directly: get last editor (JS) and set value
        ok = await page.evaluate("""
          () => {
            // monaco isn't on window here unless loader exposed it; use editor instance via DOM
            const editors = document.querySelectorAll('.monaco-editor');
            // Use the Monaco global from @monaco-editor/react
            const m = window.monaco;
            if (!m) return false;
            const models = m.editor.getModels();
            // JS model is the JavaScript one
            const jsModel = models.find(x => x.getLanguageId() === 'javascript');
            if (!jsModel) return false;
            jsModel.setValue("throw new Error('Test runtime error from e2e');");
            return true;
          }
        """)
        print("Set JS via monaco API:", ok)
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(SS / "2_after_inject.png"))

        text = await page.locator("pre.text-destructive").text_content(timeout=8000)
        print("CAPTURED:", repr(text))
        assert text and "Test runtime error" in text, f"Expected captured error, got: {text!r}"
        print("PASS: capture works")

        # Toggle hide
        await page.get_by_role("button", name="Hide AI debug helper").click()
        await page.wait_for_timeout(400)
        assert await page.locator("pre.text-destructive").count() == 0
        print("PASS: toggle hide works")
        await page.screenshot(path=str(SS / "3_hidden.png"))

        # Spoof test: postMessage from page context (no source match) should be rejected
        spoof_ok = await page.evaluate("""
          () => new Promise((resolve) => {
            const before = document.querySelector('pre.text-destructive')?.textContent || '';
            window.postMessage({ __webpg: true, nonce: 'fake', type: 'error', msg: 'SPOOFED' }, '*');
            setTimeout(() => resolve(document.body.innerText.includes('SPOOFED')), 500);
          })
        """)
        print("Spoofed error visible (should be False):", spoof_ok)
        assert spoof_ok is False, "Spoofed message should be rejected"
        print("PASS: spoof rejected")

        await b.close()

asyncio.run(main())
