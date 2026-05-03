## 2025-03-09 - [DOM-based XSS in map description stripping]
**Vulnerability:** Creating a disconnected DOM node (`document.createElement('div')`) and setting `innerHTML` directly from untrusted map data (e.g., `mapInfo.summary` or `mapInfo.blurb`) allows execution of malicious scripts via event handlers like `<img src=x onerror=...>`.
**Learning:** Even if the node is not appended to the DOM, setting `innerHTML` on an element immediately evaluates attributes like `onerror` on images when they fail to load, triggering script execution.
**Prevention:** Use DOMParser with `text/html` (which prevents script execution) instead of creating a standard DOM element, or strip HTML using DOMParser.
