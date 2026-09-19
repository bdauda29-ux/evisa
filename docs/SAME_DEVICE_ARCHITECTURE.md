# Same-device automation architecture

## Requirement

The device used to manage an applicant must also perform the portal automation:

- Windows -> local Playwright + local Chrome
- Android -> installed native app + local Android WebView
- iPhone/iPad -> installed native app + local WKWebView

No VPS and no remote PC automation.

## Why the old web-only design cannot meet this

The old responsive dashboard can be opened from a phone, but its Express/Playwright process runs on the PC. A normal mobile webpage cannot control another Chrome/Safari tab, inject arbitrary automation into it, or silently populate protected file inputs.

## New adapter boundary

`backend/automation/engineFactory.js` is now the platform boundary. Desktop uses `DesktopPlaywrightEngine`. Mobile uses the `EVisaNative` bridge contract from `mobile/shared/bridge-contract.js` and must be packaged as an installed native application.

## Mobile automation flow

1. Management UI selects applicant(s).
2. Native app opens the visa portal in an embedded WebView on the same phone.
3. Native code injects the page automation script into that WebView.
4. Text, radio and dropdown fields are filled locally.
5. CAPTCHA/login/biometric/manual security checkpoints pause for the user.
6. At a document upload field, the native layer opens the device file/photo picker pre-labeled with the assigned document requirement. The user confirms the protected OS picker selection; automation resumes afterward.
7. Progress is returned to the management UI through the native bridge.

## Security/OS limitation

Mobile operating systems intentionally prevent websites/scripts from silently assigning arbitrary local files to `<input type=file>`. The mobile version therefore uses a native file-picker handoff. This still satisfies same-device operation, but it cannot be fully unattended at protected upload/CAPTCHA/biometric steps.

## Implementation status in this package

- Desktop adapter: implemented and keeps existing Playwright behavior.
- Platform/capability API: implemented.
- Browser UI: updated to describe the active local engine and prevent misleading mobile remote-control behavior.
- Shared native bridge contract: added.
- Android native WebView host: next build target.
- iOS WKWebView host: next build target; Apple restrictions require explicit user interaction for protected operations.
