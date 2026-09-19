# Android external-browser mode

Default portal: https://evisa.immigration.gov.ng/

## First run
1. Install/run the app from Android Studio.
2. In eVisa Assistant, open Settings and tap **Enable External Browser Automation**.
3. Android opens Accessibility settings. Enable **eVisa Assistant** and confirm the warning.
4. Return to eVisa Assistant.
5. Import/add an applicant, select it, and tap **Run Selected Applicant**.
6. Chrome opens on the same phone. A small eVisa status overlay shows automation progress.
7. CAPTCHA, login challenges, protected uploads, payment, biometrics and final submission remain manual.

## CSV import
The manager WebView now uses Android's native file chooser. Tap **Import CSV**, choose a .csv file from Files/Drive/Downloads, and the app imports matching headers into local applicant storage.

## Dropdowns and dates
The external Chrome engine uses Android Accessibility nodes. It supports editable text/date nodes and attempts clickable dropdown selection by visible option text. Site-specific custom widgets may still require selector/accessibility tuning after a live test.

## 0.4 manager fixes
- Official portal remains preset to https://evisa.immigration.gov.ng/.
- Applicant editor now uses real dropdowns for configured values and Android-native date picker buttons.
- Quick Fill / Autofill textarea restored in applicant editor.
- Seven visible document assignment positions added, using Android document picker and persisted URI permission.
- Import supports CSV and the desktop `eVisa_Applicants.sqlite` format through Android's native picker.
- `Open Browser` opens the portal; `Run Selected Applicant` reuses/brings forward the existing Chrome task instead of opening the portal URL again.
