## 2026-05-26 - Precompute Atlas Search Content
**Learning:** The atlas index loader already normalized names, but atlas search still routed entries through generic matching that rebuilt and normalized secondary text (`mapName`, `typeLabel`, `summary`, `description`) for every visible entry on each query. On the current 300-entry atlas index, precomputed content matching was about 47% faster in repeated search benchmarks with about 162 KB of extra normalized text.
**Action:** When atlas/search-index data is immutable after load, precompute both primary and secondary normalized fields during hydration and use `computePrecomputedSearchMatch` in hot search loops; keep `computeSearchMatch` for dynamic or unprepared data.

## 2024-05-20 - [Cache live HTMLCollection for O(1) iteration]
**Learning:** Live `HTMLCollection`s (like those returned by `getElementsByTagName`) trigger an O(N) recalculation of the collection every time their `.length` or elements are accessed. When iterated over in performance-sensitive logic (such as UI filtering loops in `app.js`), this causes significant performance degradation.
**Action:** When iterating over a live `HTMLCollection`, cache the collection into a static array using `Array.from()` immediately before the loop. This changes element access inside the loop from O(N) to O(1) and removes the live recalculation penalty.
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
## 2023-11-15 - O(1) Bypassing of Filter Collection Iteration
**Learning:** Even with a pre-cached live `HTMLCollection`, iterating over all filter checkboxes to build an active `Set` is an $O(n)$ operation. When a "Toggle All" or "Master" checkbox state implicitly overrides all individual filter selections (acting as a wildcard), this iteration is wasted CPU time during frequent filtering operations.
**Action:** In frontend filtering logic, when a "Toggle All" overriding state exists, compute the `allChecked` boolean *before* iterating over the individual filters. Bypass the entire DOM iteration and `Set` allocation using `if (!allChecked) { ... }` to achieve an O(1) early return and avoid redundant calculations.

## 2024-05-30 - O(1) Bypassing of Hidden Filter Validation Iteration
**Learning:** Checking for hidden or unchecked filter states by iterating over the live `HTMLCollection` of all filter checkboxes is an unnecessary $O(N)$ hit during UI updates when the "Toggle All" state already confirms nothing is hidden.
**Action:** When evaluating secondary UI states derived from filters (like "Hidden Filter Chips"), explicitly check the master "Toggle All" validation first and return early, bypassing completely any redundant DOM list iteration.

## 2025-06-03 - O(1) HTMLCollection Length Access via Precaching
**Learning:** Iterating directly over a live `HTMLCollection` is slow because the browser may re-evaluate the DOM state on each property access, especially when accessing the `.length` property and accessing elements by index during each iteration.
**Action:** When performing intense iterative filtering across dynamic collections (like `poiFilterCheckboxesLive`), convert the live collection into a static array using `Array.from()` immediately before the iteration loop to achieve O(1) length and index access, dramatically improving performance (up to 63%).

## 2024-05-27 - Lazy Initialization of Search Context Strings
**Learning:** In the `searchMapMarkers` function, map marker objects were unconditionally executing expensive operations like string concatenation (`${poi.summary} ${poi.description}`) and normalization (`normalizeSearchValue()`) to populate `marker._searchContext` on the first iteration of the filter loop, even when the user was only toggling a category filter and had not entered a search term. This caused thousands of unnecessary string allocations and CPU cycles on complex maps.
**Action:** Defer the initialization of expensive search strings (like normalized titles and concatenated descriptions) until they are actually required by the matching algorithm. Use a lazy-loading pattern by setting them to `null` initially and computing them on-demand inside the search condition (e.g., `if (hasSearchTerm && searchContext.normalizedPrimary === null) { ... }`).

## 2024-05-30 - O(N) Array Searches Replaced with O(1) Map Lookups
**Learning:** `allMapMarkers` array is frequently searched using `find` by POI ID and Name during route step focus (`focusRouteStep`) and map marker focus operations (`focusPOI`), which are linear O(N) operations. By caching this array into an O(1) ES6 `Map` by POI Name and ID whenever it is updated in `populatePOIsOnMap`, we can avoid the linear performance penalty.
**Action:** Implemented caching Maps for `allMapMarkers` populated during map render to be used for O(1) fetching. Avoid overwriting first instance by checking `!Map.has()` first.
## 2024-05-18 - Optimize DOM active state class removal
**Learning:** In vanilla JS apps, resetting state across a large list (like a sidebar navigation or map list) by querying all possible items (e.g., `#map-list .map-item, #map-list .folder-header`) and unconditionally calling `classList.remove('active')` leads to unnecessary O(N) iteration overhead.
**Action:** When clearing a single "active" state or similar class from a list, query only the elements currently holding that state (e.g., `.active`) to reduce the operation to O(1) or O(K) where K is the small number of active elements.

## 2024-05-24 - Active Selection DOM State Toggling Bottleneck
**Learning:** In interactive lists (like search results) where a single item holds an "active" state, iterating over the entire list (`Array.from(document.querySelectorAll(...)).forEach(...)`) to ensure the active class is toggled properly creates severe performance bottlenecks as the list size grows. This results in an O(N) mutation cascade that forces layout thrashing and string allocations.
**Action:** When updating a singular active state within a collection, query specifically for the currently active items (`querySelectorAll('.active')`) to deactivate them, and use a direct index lookup (`getElementsByClassName(...)[index]`) for O(1) activation. This specific pattern reduced latency by ~9.8x for lists of 100 items.
## 2024-05-23 - Fast Map Traversals
**Learning:** Leaflet's `eachLayer` on LayerGroups is significantly slower (by ~70%) than iterating over a native JavaScript array, even for basic properties/method calls. This performance delta becomes meaningful during high-frequency operations like search filtering across hundreds of line/region items.
**Action:** Always maintain a parallel static array of layers (like `allMapRegions`, `allMapLines`) and use native `.forEach` when iterating over elements instead of relying on Leaflet's internal `currentRoadGroup.eachLayer()`. O(1) map caches by name/ID also help targeted lookups.

## 2024-06-04 - O(1) Bypassing of Layer Iteration and Caching for Lines
**Learning:** Leaflet's internal `.eachLayer()` layer iteration for lines (roads) is slow during frequent search loops, taking 189ms per 10k iterations. Replacing this with iteration over native parallel static arrays and O(1) Map lookups for focus operations reduces the time to 46.8ms, a ~75% performance improvement.
**Action:** When filtering or focusing on features in Leaflet LayerGroups, maintain parallel static arrays (e.g., `allMapLines`) and Maps (e.g., `allMapLinesByName`) to iterate and fetch features in O(N) Array and O(1) Map operations instead of relying on `.eachLayer()`.

## 2024-05-30 - O(1) Map Lookups for Focus Operations
**Learning:** Functions like `focusLine` and `focusRegion` that iterate over Leaflet `LayerGroup` instances (e.g., using `currentRoadGroup.eachLayer()`) to find a specific layer by name perform O(N) operations. While fast for small datasets, this iteration is completely unnecessary and scales poorly for maps with hundreds or thousands of features.
**Action:** When a specific feature needs to be retrieved by a unique identifier (like a name or ID), maintain a parallel O(1) ES6 `Map` (e.g., `allMapLinesByName`) that is populated when the layers are instantiated and cleared when the map resets.

## 2025-06-09 - Use DocumentFragment for map chooser DOM insertions
**Learning:** For bulk DOM updates, micro-benchmarks of `appendChild` vs `DocumentFragment` can often show negligible differences (or even slight regressions for Fragment) because raw memory structures do not trigger layout recalculations. However, when appending to an active, connected DOM in the live app, `appendChild` in a loop creates multiple reflows, whereas a DocumentFragment aggregates children offline and appends them in one layout step.
**Action:** When updating a connected DOM element inside a loop with multiple children, prefer using a `DocumentFragment` to batch insertions and prevent reflow/repaint penalties.

## 2026-06-09 - Optimize populatePOIFilters with DocumentFragment
**Learning:** When generating multiple elements in a loop and appending them to the live DOM, utilizing a `DocumentFragment` batches the DOM insertions, substantially mitigating costly layout thrashing and reflows.
**Action:** When a function requires creating and appending multiple elements dynamically in a loop, always instantiate a `document.createDocumentFragment()`, append children to it during iterations, and perform a single `appendChild` to the target container once outside the loop.
## 2026-06-17 - Optimize Region Filter Group Generation
**Learning:** When repeatedly deriving distinct values from arrays (e.g., generating filter options), repeatedly allocating `Set` instances and iterating with `.forEach()` causes noticeable O(N) overhead.
**Action:** Cache the derived results using a `WeakMap` keyed by the stable array reference, and optimize the initial O(N) extraction by replacing `Set` with null-prototype objects (`Object.create(null)`) and using standard `for` loops. Ensure values are properly checked for truthiness before object assignment to prevent string coercion bugs.

## 2026-06-10 - Optimize populateRegionFilters and populateLineFilters with DocumentFragment
**Learning:** When dynamically generating regions and lines filter elements and appending them individually to the live `dynamicFiltersContainer` DOM node, it triggered multiple costly repaints and layout thrashing, severely degrading performance during initial render and re-renders.
**Action:** When a function creates and appends multiple DOM elements dynamically in a loop, always instantiate a `document.createDocumentFragment()`, perform append operations within the fragment, and append the fragment in a single operation outside the loop to optimize layout recalculations.

## 2025-06-10 - O(1) Allocations in Array Transformations
**Learning:** Creating `Set` objects to extract distinct values followed by `Array.from().sort()` triggers substantial object allocation and iteration overhead compared to using native primitive loops on a null-prototype hash map. Creating Sets from Arrays via `[...new Set(array.map(...))]` takes 6-7x longer than populating `Object.create(null)` keys with a traditional `for` loop.
**Action:** When filtering or accumulating unique distinct string items (like map feature categories or types) to build the UI, explicitly use `Object.create(null)` map lookups via simple `for` loops, then extract the values using `Object.keys()`. Eliminate `Set` construction overhead.

## 2025-06-16 - O(1) Unique Array Extractions via Object Map
**Learning:** Converting an array of strings into unique values by doing `[...new Set(array.map(..).filter(..))]` executes three redundant O(N) allocations. Using `new Set()` involves significant overhead compared to plain object key assignment.
**Action:** When extracting unique values from a string array in a hot path, replace the `Set` allocation and chained array methods with a single loop and an `Object.create(null)` map to eliminate unnecessary object instantiation.
## 2025-06-16 - O(1) Derivation Cache via WeakMap
**Learning:** When deriving arrays (like a unique list of line types) from a larger reference dataset (like an array of lines), repeating the extraction logic on every UI update wastes CPU cycles if the source dataset hasn't changed.
**Action:** Cache the derived results in a `WeakMap` keyed by the immutable source reference dataset. This guarantees O(1) retrieval on subsequent renders and prevents memory leaks since the cache allows the reference data to be garbage collected.

## 2025-06-10 - Optimize search results DOM insertions with DocumentFragment
**Learning:** When evaluating DOM optimization techniques like `DocumentFragment` vs `appendChild`, micro-benchmarks on isolated containers (e.g., via jsdom or basic HTML pages) often show negligible differences or even slight regressions (like the -4.09% observed). The real performance benefit of `DocumentFragment` minimizing repaints and reflows is best observed when appending to an active, connected DOM with complex CSS rendering rules in a real browser.
**Action:** Always write the DocumentFragment optimization for batch UI updates, but recognize when to benchmark. If a micro-benchmark using JSDOM regressions, document the rationale explaining that the actual win happens in the connected rendering pipeline.

## 2024-06-25 - Cache Region Filter Groups
**Learning:** Automatically generating region filter groups involves iterating through potentially thousands of region entries, sorting, and array manipulation. Re-running this multiple times when the regions data pointer is stable causes performance degradation on render paths.
**Action:** Use a `WeakMap` to cache the derived filter groups object by using the `regions` array as the key, guaranteeing stable cache hits without memory leaks. Furthermore, tracking unique values initially into a plain object `Object.create(null)` bypasses the `Set` conversion overhead (`Array.from(set).sort()`).

## 2024-05-10 - Mocking DocumentFragment in legacy node:vm tests
**Learning:** When using `DocumentFragment` to optimize DOM insertions in codebases tested with legacy custom mock DOM objects (e.g., `createMockElement` mimicking browser APIs), simple mocks don't natively "dissolve" fragments upon `appendChild` like real browsers do. If `document.createDocumentFragment` is unmocked, it causes `TypeError`. If it's mocked as a regular node, it stays in the mock DOM tree, breaking assertions that look for direct children.
**Action:** When introducing `DocumentFragment`, verify the test suite's `document` mock. Ensure `createDocumentFragment` is mocked to return a mock fragment node, and proactively update any `childNodes` test assertions that check elements appended from the fragment to account for the fragment acting as a wrapper node in the simplistic mock implementation.
## 2024-05-15 - Array Chaining Optimization
**Learning:** Replaced chained array methods (`.map().filter()`) and array spreading (`[...roads, ...linesList]`) with single `for` loops in visibility extraction functions (`getVisiblePoints`, `getVisibleRegions`, `getVisibleLines`, `getVisibleRoutes`, `getVisibleEncounterTables`) to eliminate redundant intermediate array allocations. Microbenchmarking on table loops resulted in an improvement from ~441ms to ~88ms.
**Action:** Always prefer single `for` loops over chained array methods for hot paths where performance is a concern.
## 2024-05-24 - Optimize Single Active Element Toggling
**Learning:** Using `querySelectorAll` to find a single element that just had a class added to it is an O(N) operation over the container.
**Action:** Cache a direct reference to the active element. When the active element changes, use the cached reference to remove the class (O(1)), instead of searching the DOM tree.

## 2024-02-14 - Optimize modal querySelectorAll on keydown
**Learning:** querySelectorAll can be expensive when called inside high-frequency event listeners like keydown.
**Action:** When focusable content in a container is static while the container is open, cache the result of querySelectorAll lazily on the first execution to eliminate query overhead on subsequent keystrokes.

## 2024-05-24 - Cache repeated static DOM queries
**Learning:** Using `querySelectorAll` repeatedly on static DOM structures is an O(N) operation that impacts performance, especially in sync functions like `syncSidebarTabButtons` that are called frequently.
**Action:** Cache the resulting NodeList in a top-level module variable to achieve O(1) retrieval after the first query.

## 2024-05-24 - Live HTMLCollection Layout Thrashing via getElementsByClassName
**Learning:** Calling `getElementsByClassName` inside a hot loop or frequently called function forces the browser to traverse the DOM tree dynamically. If the DOM was just mutated (e.g., classes were changed immediately prior), accessing the live collection may force internal layout and style re-calculations that are exceptionally slow.
**Action:** When iterating over a set of elements whose active states update frequently, cache a static NodeList using `querySelectorAll` instead of `getElementsByClassName` if you don't actually need a live updating list.
