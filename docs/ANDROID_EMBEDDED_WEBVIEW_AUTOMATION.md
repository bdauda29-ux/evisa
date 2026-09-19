# Android Embedded Automation Browser (v1.3)

Android automation now uses the app's own WebView as the primary browser instead of external Chrome Accessibility.

## Why
Chrome Accessibility could see fields but the eVisa custom dropdowns did not reliably open from accessibility clicks/gestures. Inside WebView, the app can interact with the loaded page DOM directly.

## Behaviour
- **Open App Browser** opens the official eVisa portal inside the Android app.
- **Run Selected Applicant** opens/reuses the app browser and injects the selected applicant into the current eVisa page.
- Native HTML selects are assigned directly; they do not have to visibly open.
- Angular/React/custom dropdowns are activated through DOM pointer/mouse events and their visible option is selected automatically.
- A native toolbar above the portal provides **Manager**, **Autofill**, and **Refresh**.
- A DOM MutationObserver retries autofill when the portal changes to another step without a full page reload.
- CAPTCHA/login/security verification and protected file-picking prompts remain manual.

The old Accessibility service remains in the project only as an optional external-Chrome fallback; it is no longer required for normal in-app automation.
