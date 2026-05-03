## 2024-05-23 - Debouncing Search Input
**Learning:** The search input triggered a DOM-heavy filter function on every single keystroke. This causes UI lag, especially with large datasets (many markers).
**Action:** Always debounce input handlers that trigger expensive operations (DOM manipulation, network requests, or heavy filtering). A 300ms delay is usually a sweet spot for user responsiveness vs. performance.

## 2024-05-23 - Frontend Verification of Dynamic Lists
**Learning:** Generic selectors (like `.map-item`) in Playwright are flaky when content loads dynamically or hierarchically.
**Action:** Always target specific text content of a known leaf node (from `maps.json`) to ensure interactivity.

## 2024-05-25 - Debouncing Search Input In Map Editor
**Learning:** Similar to the search bar in the main application (`app.js`), the map editor (`map-editor.js`) had DOM-heavy render functions (`renderAtlasTree` and `renderFeatureLists`) running on every keystroke in search inputs. This creates severe UI lag when interacting with complex maps.
**Action:** Always identify search and text input fields that trigger render or filtering functions, and proactively apply a `debounce` wrapper (e.g., 300ms) to their event handlers to batch execution.

## 2024-05-26 - Skipping Redundant Calculations in Filter Loops
**Learning:** During filter state changes, the `updateVisibleMarkersAndSearch` function iterated over all markers, regions, and lines to re-evaluate their visibility. For every item, it performed expensive operations like string concatenation (e.g., `${poi.summary || ''} ${poi.description || ''}`) and fuzzy matching (`computeSearchMatch`) even when the search term was empty. On complex maps with hundreds of features, this resulted in significant UI lag when checking/unchecking a simple category filter.
**Action:** When a combined filter/search loop operates, always check if the search term exists or if search is active *before* executing expensive string processing or matching logic. Implement an early return or conditional bypass for the search aspect when only filtering is required.

## 2025-05-27 - Debouncing Feature Form Input in Map Editor
**Learning:** Similar to search inputs in `app.js` and `map-editor.js`, the `featureForm` in the map editor called `updateSelectedFeatureFromForm` on every keystroke (`input` event). This caused a full re-render of feature lists (`renderFeatureLists`) and map layers (`renderMapLayers(false)`) on each character typed in properties like `coordY`, `coordX`, `color`, `weight`, etc., causing noticeable UI lag on complex maps.
**Action:** Identify forms or specific input fields that trigger synchronous DOM-heavy re-renders and proactively apply a `debounce` wrapper (e.g., 300ms) to their `input` event handlers to batch execution while maintaining the immediate `change` event for final confirmation (e.g., on blur).

## 2024-05-28 - Deferring Expensive String Operations
**Learning:** In hot loops, eagerly preparing data that might not be used is a common performance trap. The `computeSearchMatch` function normalized the `secondaryText` (which can be a large combined summary + description string) up front. But since many searches match early on the `primaryText` (e.g. name), the expensive `normalizeSearchValue` on `secondaryText` was wasted allocation and processing time.
**Action:** Always defer expensive string manipulation (`toLowerCase()`, `trim()`, concatenations) or memory allocation until immediately before it's needed, especially in functions called within heavy iteration loops (like filtering logic). Implement fast-path early returns *before* preparing secondary data.
**Learning:** During iterative filtering across large datasets (like map features and searches), standardizing parameters upfront (e.g., calling `normalizeSearchValue` on `secondaryText`) is unnecessary if early matching logic correctly evaluates the primary criteria. Aggregating summary strings for hundreds of POIs before confirming they're required resulted in a heavy DOM string-processing overhead.
**Action:** When working in tight application loops such as fuzzy search routines (`computeSearchMatch`), defer operations on potentially large strings (like descriptions or concatenated summaries) until initial early-returns for exact or primary-field matches are fully evaluated.

## 2024-05-27 - Skipping Unnecessary Layer Iteration
**Learning:** In combined filter-and-search loops (like `updateVisibleMarkersAndSearch`), iterating over entire layer collections (like regions and lines) and extracting properties for search evaluation is extremely expensive on large maps, even if the fuzzy matching string manipulation itself is conditionally skipped.
**Action:** When evaluating search results, hoist the conditional check for whether search is active (`if (searchFiltersCurrentMap)`) completely *outside* the `.eachLayer()` loops for map features whose visibility is handled elsewhere (like regions and lines). This turns an O(N) operation into an O(1) bypass when the user is only toggling filters.
