## 2025-03-09 - [DOM-based XSS in map description stripping]
**Vulnerability:** Creating a disconnected DOM node (`document.createElement('div')`) and setting `innerHTML` directly from untrusted map data (e.g., `mapInfo.summary` or `mapInfo.blurb`) allows execution of malicious scripts via event handlers like `<img src=x onerror=...>`.
**Learning:** Even if the node is not appended to the DOM, setting `innerHTML` on an element immediately evaluates attributes like `onerror` on images when they fail to load, triggering script execution.
**Prevention:** Use DOMParser with `text/html` (which prevents script execution) instead of creating a standard DOM element, or strip HTML using DOMParser.
## 2025-03-09 - [Stored XSS in Map Blurb Rendering]
**Vulnerability:** Setting `innerHTML` directly from untrusted map data (`mapInfo.blurb`) without sanitization allowed arbitrary HTML and malicious scripts to be executed, resulting in a Stored XSS vulnerability.
**Learning:** Even intentionally formatted HTML data from external configurations or definitions must be sanitized before being injected into the DOM via `innerHTML` or template literals.
**Prevention:** Use a mature sanitization library like `DOMPurify.sanitize()` when inserting rich text or formatted HTML that originates from user or external file input into the DOM to strip dangerous event handlers and script tags while preserving safe markup.
## 2025-05-04 - Unsanitized Help Modal Tabs
**Vulnerability:** DOM-based XSS via `tab.html` assignment directly to `innerHTML` in `hydrateHelpModal`.
**Learning:** Configurable or injected HTML content was not passed through a sanitizer before rendering, allowing arbitrary script execution if configuration data is tampered with.
**Prevention:** Always use `DOMPurify.sanitize()` when injecting untrusted or external HTML. Implement an inline `escapeHtml()` fallback when `DOMPurify` is conditionally loaded to ensure a "fail-closed" security posture.
## 2025-05-04 - Unsanitized WIP Notice Popup
**Vulnerability:** DOM-based XSS via `wipPopup.innerHTML` where configurable strings from `copy.wipNotice` are directly injected without escaping.
**Learning:** Configurable HTML elements or strings that bypass rendering methods using innerHTML directly are prone to script injections, particularly when they map from arrays.
**Prevention:** Always use `DOMPurify.sanitize()` or an explicit `escapeHtml` fallback before rendering arrays of configured strings or content into `.innerHTML`.
