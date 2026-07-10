## 2026-06-21 - O(1) Allocations in Array Transformations (map-editor)
**Learning:** Using `Set` to deduplicate an array of parsed tags in `map-editor.js` incurs object allocation and iteration overhead compared to using a null-prototype hash map.
**Action:** Replace `Set` with `Object.create(null)` when deduplicating tags to eliminate `Set` construction overhead.

## 2026-06-21 - Optimize map-editor DOM insertions with DocumentFragment
**Learning:** Individually appending items directly to `dom.unifiedFeatureList` inside a loop in `renderFeatureLists` triggers costly layout thrashing and reflows.
**Action:** Always batch DOM insertions using `DocumentFragment` to minimize repaints and reflows, especially in features list renderings like `map-editor.js`.
