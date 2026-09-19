# eVisa Assistant — Same-Device Edition

This package begins the migration from the old "phone remotely controls a PC" model to a **same-device automation architecture**.

## Target behavior

- Windows: manage applicants and run Playwright/Chrome automation on that Windows PC.
- Android: manage applicants and run automation inside an installed Android app on that Android device.
- iPhone/iPad: manage applicants and run automation inside an installed iOS app on that iOS device.
- No VPS is required for automation.

## What is implemented in this revision

1. The existing desktop Playwright flow is preserved behind `backend/automation/engines/desktopPlaywright.js`.
2. `backend/automation/engineFactory.js` is the new platform boundary.
3. `/api/platform` reports the selected engine and capabilities.
4. The dashboard detects desktop / Android / iOS. A mobile browser is no longer allowed to misleadingly launch automation on the backend machine.
5. `mobile/shared/bridge-contract.js` defines the native same-device interface for Android and iOS.
6. Protected mobile file uploads are explicitly modeled as a native user handoff instead of pretending JavaScript can silently attach arbitrary phone files.

See `docs/SAME_DEVICE_ARCHITECTURE.md` for the mobile architecture and limitations.

## Desktop run

Requires Node.js 18+.

```bash
cd backend
npm install
npm start
```

Open `http://localhost:4000`. Desktop automation still uses the existing visible persistent Chrome session and Page 1–8 Playwright scripts.

## Mobile status

The web dashboard is responsive, but **a normal Android Chrome or iPhone Safari tab cannot satisfy same-device portal control**. The mobile target is therefore an installed native app with an embedded WebView/WKWebView and the `EVisaNative` bridge.

The next implementation target is the Android native host, followed by the iOS WKWebView host. CAPTCHA, biometrics, login challenges, and protected OS file-picker operations remain user-confirmed steps.

## Existing data

The desktop backend continues to store data in `backend/data/`:

- `eVisa_Applicants.sqlite`
- `documents/<APPLICATION-ID>/`
- `screenshots/`

## Android same-device Phase 2

A standalone Android Studio project is now included under `android-app/`. See `docs/ANDROID_PHASE2.md` for build/test instructions and current limitations. It stores applicant data locally on Android and runs the controlled portal WebView on the same phone; it does not send Android automation jobs to the Windows Playwright backend.
