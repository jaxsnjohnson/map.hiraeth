## 2024-05-23 - Debouncing Search Input
**Learning:** The search input triggered a DOM-heavy filter function on every single keystroke. This causes UI lag, especially with large datasets (many markers).
**Action:** Always debounce input handlers that trigger expensive operations (DOM manipulation, network requests, or heavy filtering). A 300ms delay is usually a sweet spot for user responsiveness vs. performance.

## 2024-05-23 - Frontend Verification of Dynamic Lists
**Learning:** Generic selectors (like `.map-item`) in Playwright are flaky when content loads dynamically or hierarchically.
**Action:** Always target specific text content of a known leaf node (from `maps.json`) to ensure interactivity.

## 2024-05-25 - Debouncing Search Input In Map Editor
**Learning:** Similar to the search bar in the main application (`app.js`), the map editor (`map-editor.js`) had DOM-heavy render functions (`renderAtlasTree` and `renderFeatureLists`) running on every keystroke in search inputs. This creates severe UI lag when interacting with complex maps.
**Action:** Always identify search and text input fields that trigger render or filtering functions, and proactively apply a `debounce` wrapper (e.g., 300ms) to their event handlers to batch execution.
