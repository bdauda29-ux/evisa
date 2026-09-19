# Android external Chrome automation attach fix

This build fixes the external Chrome automation trigger in split-screen and already-open-browser scenarios.

Changes:
- Accessibility service now polls every ~700 ms while a run is active instead of relying only on new Chrome accessibility events.
- It searches all interactive accessibility windows for the Chrome window, so the eVisa manager can remain focused in split-screen.
- Run Selected Applicant no longer relaunches or reorders Chrome.
- The service is kicked immediately when Run is tapped and keeps polling afterward.
- HTML controls whose label and input/select are exposed as sibling accessibility nodes can now be associated by proximity.
- Dropdown option matching can click a clickable ancestor when Chrome exposes option text on a non-clickable child node.

Accessibility must still be enabled for eVisa Assistant in Android Settings.
