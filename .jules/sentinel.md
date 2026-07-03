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
## 2025-05-24 - [DOM-based XSS in Single-Quoted Event Handlers]
**Vulnerability:** XSS via `escapeForSingleQuotedAttribute` when the output is rendered using `innerHTML`. The function escaped backslashes and single quotes correctly for a JavaScript string context, but failed to escape HTML entities (like `&apos;`). When assigned to `innerHTML`, the browser decodes `&apos;` to `'` *before* evaluating the `onclick` attribute, breaking out of the single quotes and executing arbitrary code.
**Learning:** When sanitizing strings that will be placed inside inline event handlers (like `onclick='...'`) and injected via `innerHTML`, the escaping must handle both JavaScript string boundaries *and* HTML entity decoding.
**Prevention:** Always escape ampersands (`&`) to `&amp;` alongside quotes and backslashes to prevent HTML parsers from decoding entities prematurely when injecting attributes into the DOM via strings.
## 2025-02-28 - Sanitize InnerHTML in configuration module
**Vulnerability:** XSS vulnerability in `setHtml` within `js/app-config.js` due to blind assignment of `element.innerHTML = value`.
**Learning:** Utilities that assign dynamic values to `innerHTML` must validate and sanitize the input, even if the data is assumed to come from a safe configuration source, to maintain defense-in-depth and prevent DOM-based XSS.
**Prevention:** Always use `DOMPurify.sanitize()` when injecting untrusted or external HTML. Implement an inline `escapeHtml()` fallback when `DOMPurify` is conditionally loaded to ensure a "fail-closed" security posture.
## 2025-02-28 - Sanitize InnerHTML in configuration module
**Vulnerability:** XSS vulnerability in `setHtml` within `js/app-config.js` due to blind assignment of `element.innerHTML = value`.
**Learning:** Utilities that assign dynamic values to `innerHTML` must validate and sanitize the input, even if the data is assumed to come from a safe configuration source, to maintain defense-in-depth and prevent DOM-based XSS.
**Prevention:** Always use `DOMPurify.sanitize()` when injecting untrusted or external HTML. Implement an inline fallback using `.textContent = value` instead of `.innerHTML = escapeHtml(value)` when `DOMPurify` is unavailable to eliminate HTML injection vectors entirely.
## 2026-05-25 - [Fix XSS in Popup Content]
**Vulnerability:** User-provided or external data (`data.type`, `data.value`, and `typeString`) in map popups were concatenated into HTML strings via `buildPopupFullContent` and `formatPropertiesForPopup` without proper escaping, leading to Cross-Site Scripting (XSS).
**Learning:** Even within secondary configuration or display helpers like popup formatters, all dynamically injected strings must be properly HTML-escaped. In environments where utility functions like `escapeHtml` exist, they should be used universally over partial manual escaping (e.g., just replacing `&`, `<`, `>`) to avoid overlooking vectors like quotes and backticks.
**Prevention:** Standardize HTML injection pathways across the application to always use a centralized, comprehensive `escapeHtml()` function or native `.textContent` assignments, rather than re-implementing partial sanitization locally.

## 2025-05-28 - [DOM-based XSS in Share Button Restoration]
**Vulnerability:** Unsafe assignment of `dataset.originalInnerHtml` directly back to `innerHTML` in `hideShareRelayPrompt`, `showShareButtonSuccessState`, and `showShareButtonErrorState`.
**Learning:** Even internal element state like `dataset` values must be treated as potentially untrusted if it can be influenced by the environment or attackers. Directly assigning dataset values back to `innerHTML` without sanitization can lead to DOM-based XSS.
**Prevention:** Use `DOMPurify.sanitize()` when restoring HTML content from dataset attributes or other internal state back into the DOM via `innerHTML`, and use a secure fallback like `.textContent` if the sanitizer is unavailable.

## 2024-06-01 - [DOM-based XSS in highlightSearchText]
**Vulnerability:** Constructing HTML strings using `replace` with regular expressions on escaped text, and then injecting the result into the DOM via `innerHTML`, allows for DOM-based XSS. If a malicious user input matches standard HTML tags but bypasses string sanitization due to regex edge cases (e.g., zero-width matches, entities tampering), it renders as executable HTML elements.
**Learning:** Returning constructed raw HTML strings from utility functions meant for textual highlighting introduces critical injection vectors when those strings are consumed via `.innerHTML`.
**Prevention:** Always refactor string-based DOM manipulators to return a `DocumentFragment` dynamically constructed with `document.createTextNode()` and `document.createElement()`, replacing `.innerHTML` sinks with `.appendChild()`. When using `exec` in a `while` loop, always clone the regex to guarantee the `g` flag is present to prevent infinite iteration loops.

## 2026-06-01 - DOM-based XSS via RegExp.exec() in highlightSearchText
**Vulnerability:** DOM-based XSS via unsafe innerHTML usage with dynamically highlighted search terms. The fix replaced innerHTML with document.createElement and textContent, but the initial attempt introduced an infinite loop bug.
**Learning:** When replacing String.prototype.replace() with RegExp.prototype.exec() in a while loop to manually construct DOM nodes, account for non-global regular expressions. If a RegExp lacks the global (`g`) flag, repeated exec calls can return the same match without advancing `lastIndex`.
**Prevention:** Clone highlight regexes with the global flag or otherwise advance the loop explicitly before using `RegExp.prototype.exec()` in a loop.

## 2025-06-25 - [DOM-based XSS in Single-Quoted Attribute Escape]
**Vulnerability:** XSS via `escapeForSingleQuotedAttribute` when the output is rendered in a single-quoted HTML attribute. The function previously escaped single quotes (`'`) as `\'`. However, when this escaped string is injected into an HTML attribute (e.g. `onclick='...'`), the browser's HTML parser interprets `\'` as a literal backslash followed by a quote that terminates the attribute, allowing arbitrary code execution.
**Learning:** Backslash escaping (`\'`) is valid for JavaScript string literals, but it is NOT valid for HTML attributes. HTML parsers do not respect backslash escapes.
**Prevention:** When escaping strings for injection into single-quoted HTML attributes, always encode the single quote as an HTML entity (`&#39;` or `&apos;`).
