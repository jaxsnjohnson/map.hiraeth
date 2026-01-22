## 2024-05-23 - Debouncing Search Input
**Learning:** The search input triggered a DOM-heavy filter function on every single keystroke. This causes UI lag, especially with large datasets (many markers).
**Action:** Always debounce input handlers that trigger expensive operations (DOM manipulation, network requests, or heavy filtering). A 300ms delay is usually a sweet spot for user responsiveness vs. performance.

## 2024-05-23 - Frontend Verification of Dynamic Lists
**Learning:** Generic selectors (like `.map-item`) in Playwright are flaky when content loads dynamically or hierarchically.
**Action:** Always target specific text content of a known leaf node (from `maps.json`) to ensure interactivity.
