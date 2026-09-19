# Android v1.9 — Strict Page 1 Fill

Page 1 automation is hard-scoped to these three fields only:

1. Nationality
2. Class of Visa
3. Passport Type

Changes:
- FILL never performs navigation.
- Page 1 dropdown taps are hit-tested before Android sends a MotionEvent.
- A tap is blocked if the hit point is outside the intended dropdown or resolves to Previous/Back/Cancel.
- Native HTML select elements are activated with DOM pointer/mouse events first and assigned directly.
- A physical WebView touch is only used as a guarded fallback.
- FILL + NEXT can navigate only after all three Page 1 values are confirmed.
- Forward navigation uses the identified Next/Continue DOM element, not a screen-coordinate tap.
- Pages 5–8 remain detection-only until field maps are implemented; FILL will not click unknown controls on them.
