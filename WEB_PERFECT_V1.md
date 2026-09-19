# eVisa Web Assistant — Web Perfect v1

This build makes the Railway web dashboard the main controller.

## Added
- Import Excel / CSV.
- Save/export current applicants as CSV.
- Load an existing `.sqlite`, `.sqlite3`, or `.db` database into the web app.
- Save/download the live SQLite database.
- Applicant edits continue to autosave to SQLite through the existing database layer.
- **Run Selected Applicants** queues the selected applicant(s) and automatically opens `https://evisa.immigration.gov.ng/`.
- The Chrome/Edge Device Browser helper automatically claims the queued job and attaches automation to the portal.
- Corrected the helper's default portal URL to the non-`www` official URL.
- Faster job pickup while the helper is running.
- Integrated the latest Page 1 exact Angular Material selectors.
- Integrated the Page 2 three-part Date of Birth fix.
- Integrated the Page 2 camera/modal passport-photo upload flow.

## Railway update
Deploy this entire project to Railway. Keep `EVISA_DATA_DIR=/data` so SQLite and documents persist on the Railway volume.

## Browser helper — one-time setup
1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the `windows-extension` folder from this build.
4. Open its side panel once and save the Railway URL and Basic Auth credentials.
5. Keep **Device worker enabled**.

After that, normal use is from the web dashboard: select applicant(s) -> **Run Selected Applicants**. The dashboard opens the official portal automatically and the helper picks up the queued applicant.

## CSV / SQLite
- **Import Excel / CSV** merges/upserts applicant records.
- **Save CSV** downloads the current applicant table.
- **Load SQLite** replaces the active Railway applicant database after confirmation.
- **Save SQLite** downloads the live database.

Loading SQLite changes applicant data only. Existing document folders remain on the Railway data volume and continue to be associated by application ID.
