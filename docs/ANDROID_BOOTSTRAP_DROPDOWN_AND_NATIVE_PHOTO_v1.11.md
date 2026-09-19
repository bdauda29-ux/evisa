# Android v1.11 — Bootstrap dropdown + native photo upload

## Page 1
The eVisa Page 1 controls are Bootstrap-style searchable selects (live-search). The Android WebView automation now:

- Finds the real select associated with Nationality, Class of Visa and Passport Type.
- Matches the saved applicant value against the real option list.
- Uses the page's bootstrap-select API when available (`selectpicker('val')`, render/refresh).
- Synchronizes the visible dropdown caption with the backing select.
- Fires native input/change events so dependent portal logic runs.
- Waits after Nationality so Class of Visa can rebuild before the next field is filled.
- Does not require the user to manually open Page 1 dropdowns.

## Page 2 photograph
The WebChromeClient now intercepts the Page 2 image chooser. When an assigned Passport Photo exists it:

- Copies the assigned/cloud/provider image into the app cache.
- Exposes that copy through the app FileProvider.
- Returns the URI directly to WebView's file chooser callback.
- Avoids opening Android Photo Picker for the automated passport-photo upload.

If the WebView version requires a trusted gesture to invoke the chooser, automation taps only the visible upload activator and the same native callback supplies the photo.

## Automation mode
Page detection remains read-only and request-only. Filling/navigation only occurs when the user presses FILL or FILL + NEXT.
