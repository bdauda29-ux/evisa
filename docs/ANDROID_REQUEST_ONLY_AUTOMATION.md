# Android v1.7 — Request-only portal automation

The embedded eVisa browser no longer starts automation because a page loaded, DOM changed, or the portal changed tabs.

- **FILL**: fills only the current step and never navigates.
- **FILL + NEXT**: fills only the current step and, if validation passes, presses Continue/Next once.
- Loading/reloading a portal page is passive.
- Selecting **Run Selected Applicant** opens/reuses the embedded portal and loads applicant data, but does not fill or navigate until a toolbar action is pressed.
- MutationObserver/background auto-run behavior has been removed.
- Final submit/payment/biometric actions remain excluded from automatic navigation.
