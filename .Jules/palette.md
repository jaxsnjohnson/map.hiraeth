## 2023-10-27 - Map Chooser Screen Reader Metadata
**Learning:** Using a single overriding `aria-label` on complex map cards masks rich internal content (like edit dates, descriptions, and regions) from screen readers.
**Action:** When a UI component contains rich inner metadata, use dynamically generated IDs bound via `aria-labelledby` and `aria-describedby` to safely expose its full context.

## 2023-10-27 - Archive <summary> Focus and Hover States
**Learning:** Native HTML `<summary>` tags often lack visual feedback (focus rings, hover colors) in custom design systems, severely degrading keyboard accessibility and mouse discoverability.
**Action:** Always ensure custom-styled summary elements receive the global `:focus-visible` ring and a subtle hover transition state.
