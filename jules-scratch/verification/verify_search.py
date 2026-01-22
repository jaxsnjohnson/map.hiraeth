from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 720})
    page = context.new_page()

    try:
        # 1. Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:8000")

        # 2. Wait for map container
        print("Waiting for map...")
        page.wait_for_selector("#map")

        # 3. Wait for sidebar to populate (map list)
        print("Waiting for sidebar...")
        page.wait_for_selector(".map-item", timeout=10000)

        # 4. Click the first map item to load it
        print("Loading a map...")
        # Find the "Content Map" or any visible map item
        map_item = page.locator(".map-item").first
        map_item.click()

        # 5. Wait for the loading indicator to disappear
        print("Waiting for map load...")
        page.wait_for_selector("#loading-indicator", state="hidden", timeout=15000)

        # 6. Wait for markers to appear (marker pane) or search box
        # Search box is hidden until markers are loaded.
        print("Waiting for search box...")
        search_box = page.locator("#poi-search-input")
        expect(search_box).to_be_visible(timeout=10000)

        # 7. Type in search box (this triggers the debounced function)
        print("Typing in search box...")
        search_box.fill("City")

        # 8. Wait a bit to ensure debounce passes and UI updates (though we can't easily assert debounce timing in screenshot)
        page.wait_for_timeout(1000)

        # 9. Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="jules-scratch/verification/search_verification.png")
        print("Screenshot saved.")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
        raise e
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
