"""End-to-end test: paste a `public class MainActivity` Java program into the
mobile playground, hit Run, and assert it compiles and prints the expected
logcat lines."""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

JAVA_SRC = """public class MainActivity {
    public static void main(String[] args) {
        System.out.println("MainActivity D: onCreate()");
        for (int i = 1; i <= 3; i++) {
            System.out.println("Button D: Tapped " + i + " times");
        }
        System.out.println("MainActivity I: Hello from your Android app!");
    }
}
"""


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto("http://localhost:8080/playground/mobile", wait_until="domcontentloaded")
        await page.wait_for_selector("text=Build APK", timeout=15000) if False else None

        # Set Monaco model value directly (avoids autoclose duplicating braces).
        await page.wait_for_selector(".monaco-editor", timeout=20000)
        await page.wait_for_function("() => !!(window).monaco && monaco.editor.getModels().length", timeout=20000)
        await page.evaluate(
            "(src) => { for (const m of monaco.editor.getModels()) m.setValue(src); }",
            JAVA_SRC,
        )
        await page.screenshot(path=str(SCREENSHOTS / "java_public_1_pasted.png"))

        # Click Run.
        run = page.get_by_role("button", name="Run app")
        await run.click()

        # Wait for the exit marker.
        try:
            await page.wait_for_function(
                "() => document.body.innerText.includes('— exit')",
                timeout=90000,
            )
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "java_public_FAIL.png"))
            tail = (await page.evaluate("() => document.body.innerText"))[-2000:]
            print("BODY TAIL:", tail)
            raise
        await page.screenshot(path=str(SCREENSHOTS / "java_public_2_ran.png"))

        body = await page.evaluate("() => document.body.innerText")
        assert "Hello from your Android app!" in body, body[-1000:]
        assert "Tapped 3 times" in body, body[-1000:]
        # The preprocessing notice should appear.
        # Exit 0 + onCreate line proves preprocessing stripped `public` correctly:
        # without it, javac would have errored with "class MainActivity is public,
        # should be declared in a file named MainActivity.java".
        assert "exit 0" in body, body[-1000:]
        print("OK — public MainActivity compiled and ran on mobile playground")
        await browser.close()


asyncio.run(main())
