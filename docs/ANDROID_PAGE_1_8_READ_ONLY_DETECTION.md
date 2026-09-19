# Android v1.8 — Read-only eVisa Page 1–8 detection

The embedded browser continuously detects eVisa Pages 1 through 8 and reports the current page in the native toolbar.

Detection is read-only: it does not autofill, click Continue/Next, switch portal tabs, or navigate. Automation runs only when the user presses FILL or FILL + NEXT.

Detection prioritizes the visible form heading such as `Step 2: Biodata`, then active/current progress markers, then unique controls as a fallback. It intentionally does not scan the whole progress bar for `Step 1` because all eight step labels can be present in the page at the same time.
