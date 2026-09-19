# Android WebView Native Control Fix — v1.5

This build changes portal interaction from synthetic JavaScript clicks to native Android touch events injected into the app's own WebView.

## Page 1 dropdowns
Custom dropdowns are activated with a real Android MotionEvent at the DOM element's screen position. The option is then selected using another native WebView touch. This is intended for controls that ignore untrusted JavaScript click events.

## Page 2
- Date of Birth and other date fields use native input value setters plus input/change/blur events.
- "Do you have a Nigerian passport?" is handled as a Yes/No radio/checkbox group rather than a normal text field.
- When Passport Photo is assigned in Document Assignment, the app arms the WebView file chooser and returns the assigned photo URI directly when the photo upload control is activated. The Android file picker is skipped for that automatic photo upload.

## Notes
CAPTCHA, biometric/security checks, and other protected portal actions remain manual.
