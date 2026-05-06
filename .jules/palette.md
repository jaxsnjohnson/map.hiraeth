## 2023-10-27 - Map Chooser Screen Reader Metadata
**Learning:** Using a single overriding `aria-label` on complex map cards masks rich internal content (like edit dates, descriptions, and regions) from screen readers.
**Action:** When a UI component contains rich inner metadata, use dynamically generated IDs bound via `aria-labelledby` and `aria-describedby` to safely expose its full context.

## 2023-10-27 - Archive <summary> Focus and Hover States
**Learning:** Native HTML `<summary>` tags often lack visual feedback (focus rings, hover colors) in custom design systems, severely degrading keyboard accessibility and mouse discoverability.
**Action:** Always ensure custom-styled summary elements receive the global `:focus-visible` ring and a subtle hover transition state.

## 2026-04-29 - Map Chooser Image Accessibility
**Learning:** Images inside interactive components like buttons that already provide rich text context via `aria-labelledby` cause redundant and noisy screen reader announcements if they retain their descriptive `alt` text.
**Action:** Set the image `alt` attribute to an empty string (`alt=''`) and add `aria-hidden='true'` to explicitly hide decorative or redundant images from the accessibility tree when the parent component already provides the necessary context.

## 2026-05-06 - Custom Toggles and Keyboard Accessibility
**Learning:** Custom toggle elements that rely on visually hidden native inputs (`<input type="checkbox" opacity="0">`) often lack default keyboard action triggers for keys like 'Enter', breaking accessibility for users trying to intuitively switch themes.
**Action:** Attach an explicit `keydown` event listener to handle 'Enter' to trigger the change action (native `<input>` handles 'Space' automatically). Manually toggle the checked property and dispatch a `change` event so other listeners react accordingly. Ensure `e.preventDefault()` is called to prevent form submissions.
