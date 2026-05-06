## 2023-10-27 - Map Chooser Screen Reader Metadata
**Learning:** Using a single overriding `aria-label` on complex map cards masks rich internal content (like edit dates, descriptions, and regions) from screen readers.
**Action:** When a UI component contains rich inner metadata, use dynamically generated IDs bound via `aria-labelledby` and `aria-describedby` to safely expose its full context.

## 2023-10-27 - Archive <summary> Focus and Hover States
**Learning:** Native HTML `<summary>` tags often lack visual feedback (focus rings, hover colors) in custom design systems, severely degrading keyboard accessibility and mouse discoverability.
**Action:** Always ensure custom-styled summary elements receive the global `:focus-visible` ring and a subtle hover transition state.

## 2026-04-29 - Map Chooser Image Accessibility
**Learning:** Images inside interactive components like buttons that already provide rich text context via `aria-labelledby` cause redundant and noisy screen reader announcements if they retain their descriptive `alt` text.
**Action:** Set the image `alt` attribute to an empty string (`alt=''`) and add `aria-hidden='true'` to explicitly hide decorative or redundant images from the accessibility tree when the parent component already provides the necessary context.

## 2026-05-01 - Hidden Input Keyboard Accessibility
**Learning:** Custom UI components (like toggles) that use a visually hidden `<input>` element with `opacity: 0` alongside a custom surrogate element (like a `.slider` div) lose default browser focus rings. The invisible input still receives focus via Tab navigation, but no visual indicator is shown to the user.
**Action:** When hiding native inputs for custom styling, always apply a `:focus-visible` ring on the custom surrogate element using the adjacent sibling combinator (e.g., `input:focus-visible + .slider`).
## 2023-10-24 - Make filter group headers keyboard accessible
**Learning:** Adding `tabindex="0"` and `role="button"` makes custom group headers keyboard focusable, but requires an explicit `keydown` listener for 'Enter' and 'Space'. The default 'Space' behavior scrolls the page, requiring `e.preventDefault()`. Custom focus outlines via `:focus-visible` can cause layout shifts if not balanced with equal positive padding and negative margin (e.g., `padding: 2px 4px; margin: -2px -4px;`).
**Action:** When implementing custom toggle elements, always add the `keydown` event listener, suppress default spacebar scrolling, and use the padding/margin trick to safely add focus rings without breaking the layout.
