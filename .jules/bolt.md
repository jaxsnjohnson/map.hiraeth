## 2024-05-18 - Optimize nested DOM queries in map-editor.js
**Learning:** Repetitive DOM querying (`document.getElementById`) inside frequently invoked functions like `readMapSettingsForm` or `renderMapSettingsForm` causes measurable overhead (~60-80% slower execution).
**Action:** When a static set of UI elements needs to be frequently read from or written to, cache these DOM references during initialization (e.g., in a central `dom` object like `dom.mapSettingsInputs`) and use the cached references in the hot path.
