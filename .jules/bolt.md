## 2024-05-19 - Optimize feature coordinate update
**Learning:** In highly frequent event callbacks like form `input` or `change` events, querying the global `document` using `document.querySelector` can cause significant UI thread blockage.
**Action:** Always prefer using `event.target` to retrieve the changed value immediately. For related sibling inputs, scope the search to the nearest cached parent form container (e.g., `form.querySelector`) instead of the global document.
