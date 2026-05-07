## 2023-10-27 - Optimized Filter Checkbox Toggle Iteration
**Learning:** Frequent invocation of `querySelectorAll` with complex CSS selectors inside `change` event listeners causes a severe performance hit due to CSS parsing and DOM traversal overhead, especially when checking many elements.
**Action:** Instead of `querySelectorAll` repeatedly querying dynamically updated DOM elements inside event listeners, cache a live `HTMLCollection` using `container.getElementsByTagName('input')` at the module level. Iterating over this live collection is incredibly fast and safely keeps track of new inputs added dynamically via scripts.
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
## 2024-05-03 - String Operation Costs in Search Loops
**Learning:** Frequent string allocations and normalizations (like `.trim().toLowerCase()`) in functions called within dense loops (like POI filtering/searching on every keystroke) cause measurable CPU overhead and memory churn, even for tiny strings.
**Action:** Always memoize functions mapping small, bounded inputs (like POI types to their respective groups/icons) using a `Map` to completely bypass redundant string operations during render/filter loops.
## 2024-05-03 - Optimize redundant string interpolation in rendering loops
**Learning:** Found loops for `addRegionsToMap` and `addRoadsToMap` interpolating properties and variables into a `let popupContent = ""` local variable, which was never actually used since the code fell back to a shared helper `createPopupContent` just below. This dead code was evaluated multiple times at map init and feature render time.
**Action:** Always verify if a manually generated string layout in a tight loop is actually utilized. Dead interpolations (especially invoking string helpers) can be entirely refactored away to reduce object allocation.
## 2024-05-29 - Bypassing DOM Operations During Search Inactive States
**Learning:** Functions like `searchMapRegions` and `searchMapLines` were unnecessarily executing DOM queries (`querySelectorAll`) and building filter sets even when search was inactive for the current map, just because they were called from the main filter loop.
**Action:** In search sub-routines that are part of a larger filter/render loop, always apply an immediate early return (e.g., `if (!searchActive) return;`) at the very top of the function if its only purpose is to populate search results. This prevents evaluating expensive DOM and layer-iteration logic.
## 2025-05-04 - O(1) Map Lookups for Array Sorting
**Learning:** Calling `Array.indexOf` inside a tight sorting loop causes an unnecessary O(n) scan per invocation, which degrades search performance significantly.
**Action:** When sorting using an explicit static group order array, pre-compute an object map of values to indexes to enable O(1) property access during sorting.
## 2025-05-30 - O(1) HTMLCollection Traversal vs querySelectorAll
**Learning:** Frequent invocation of `querySelectorAll('.some-class')` inside tight search/filter loops triggers the browser's CSS parser and DOM traversal algorithms repeatedly, causing severe lag when a large number of checkboxes or DOM elements exist.
**Action:** Always prefer caching a live `HTMLCollection` using `getElementsByTagName('input')` at the module level. Inside the iterative filter loops, replace `querySelectorAll` with a manual iteration over the cached collection, checking `.classList.contains()` to replicate the selector logic. This avoids CSS parsing entirely and provides immense performance gains.
## 2025-05-31 - Deferring String Operations via Closures
**Learning:** Even when `computeSearchMatch` deferred the normalization of `secondaryText` to be evaluated lazily, the caller was still passing `\`${poi.summary || ''} ${poi.description || ''}\``. This meant string concatenation was still eagerly evaluated for thousands of markers every time a filter changed.
**Action:** Always accept a closure/function in the matching API `computeSearchMatch(term, text, secondaryTextFn)` to prevent evaluating expensive string templates at the callsite.
## 2025-06-01 - O(1) Set Lookups in Layer Filters
**Learning:** Using `Array.includes` inside iterative map layer loops (like `updateVisibleLines`) creates an $O(m \times n)$ overhead when matching features against many active filter options.
**Action:** Always collect user filter selections into a `Set` instead of an `Array` prior to iterating over map elements so checking visibility stays at $O(1)$ per layer.
