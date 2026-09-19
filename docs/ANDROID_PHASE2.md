# Android Phase 2 — Same-device automation

This phase adds a standalone Android Studio project in `android-app/`.

## What works in this phase

- Applicant records are created, edited, deleted, and stored locally inside the Android app.
- CSV applicant import is supported in the Android manager.
- The eVisa portal opens inside a second WebView on the same Android device.
- The selected applicant payload is injected into the portal WebView.
- The first generic field-filling engine matches inputs/selects using `name`, `id`, `formcontrolname`, placeholder, aria-label, and associated labels.
- Native Android file selection is wired for `<input type="file">` requests.
- Login, CAPTCHA, biometrics, and final submission remain user-controlled/manual.
- The Windows Playwright version remains unchanged and available in `backend/`.

## Important limitation

The Android field engine is not yet a 1:1 port of the eight Playwright page scripts. The exact portal selectors and Angular Material behavior must be tested on a real Android device against the live portal. This phase deliberately does not auto-click the final Continue/Submit button after filling; review the page before proceeding.

## Open in Android Studio

1. Install current Android Studio with Android SDK 36.
2. Open the `android-app` folder as a project.
3. Allow Gradle sync to complete.
4. Connect an Android phone with USB debugging enabled, or create an emulator.
5. Run the `app` configuration.
6. In the app, open Settings and enter the official eVisa HTTPS portal URL.
7. Create/import an applicant, tap Open eVisa Portal, complete any login/CAPTCHA, return to the manager if needed, then tap Run Applicant.

## Security model

The app only accepts an HTTPS portal URL. Applicant data is stored in the Android WebView local storage on that device in this phase. Do not put passwords, OTPs, CAPTCHA answers, payment-card details, or other authentication secrets into applicant fields.

## Next implementation

Test Page 1 on a real Android phone, capture any selectors that fail, then replace the generic matcher with page-specific Android scripts derived from the working Playwright Page 1–8 logic.

## Build compatibility fix (0.2.1)
This package pins Android Gradle Plugin 8.7.3, Kotlin 2.0.21, Gradle 8.9, JDK 17, and Android API 35. It includes Gradle wrapper launch files so Android Studio does not reuse an incompatible Gradle daemon/version from an earlier import.

## Windows-style document folder assignment
Android now uses the Storage Access Framework folder picker for document assignment. In Edit Applicant & Documents, tap **Choose Folder…**, select the folder containing that applicant's supporting documents, then map each file to the visa-specific upload position. The app persists read access to the selected folder/file URIs and saves each selected URI plus its display name with the applicant record.
