# Android v1.10 — Page 1 DOM-only dropdown engine

Page 1 no longer uses the Android native coordinate-tap bridge at all.

- Targets only Nationality, Class of Visa, and Passport Type inside the Step 1 form.
- Resolves each control from its own label group and prefers the underlying native `<select>`, even when a styled dropdown hides it.
- Uses direct form-value updates plus input/change events for Angular/React-style frameworks.
- Never searches or taps Back, Previous, Continue, or other navigation controls while FILL is running.
- FILL + NEXT remains blocked until all three dropdown values are confirmed.
- Adds target diagnostics (field name, tag, option count) to the app status/activity feed.
