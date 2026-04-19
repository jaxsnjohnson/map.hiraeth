import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto('http://127.0.0.1:8000/map-editor.html')

        # Wait for the shell to be ready
        await page.wait_for_selector('.map-editor-shell', state='visible')

        # Ensure we are in "select" mode so the inspector is visible
        await page.evaluate("document.querySelector('.map-editor-shell').setAttribute('data-mode', 'select')")

        # Wait for the features section to be rendered
        await page.wait_for_selector('#editor-feature-type-select', state='visible')

        # Expand the Features details block if it's not already
        await page.evaluate('''() => {
            const details = document.querySelectorAll('details.map-editor-section');
            details.forEach(d => {
                if (d.querySelector('summary').textContent.includes('Features')) {
                    d.open = true;
                }
            });
        }''')

        # Take a screenshot of the features section
        section = await page.wait_for_selector('details.map-editor-section:has-text("Features")')
        await section.screenshot(path='/home/jules/verification/features_section.png')

        print("Screenshot saved to /home/jules/verification/features_section.png")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
