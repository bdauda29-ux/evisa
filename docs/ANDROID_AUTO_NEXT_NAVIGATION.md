# Android Auto Next Navigation (v1.6)

The embedded WebView automation now automatically presses the current eVisa page **Continue/Next** button after autofill completes.

Safety behavior:
- waits for current page filling to finish before navigation;
- checks HTML-required controls before pressing Continue;
- pauses on CAPTCHA/security checks;
- pauses when a saved applicant field could not be located;
- waits for the next step to load before continuing automation;
- reports portal validation errors when a page does not advance;
- never auto-clicks final application submission, payment, finish, or biometric confirmation buttons.

The feature applies automatically in the in-app Automation Browser.
