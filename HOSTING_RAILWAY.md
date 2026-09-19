# Railway + Device Browser architecture

Railway is now the central eVisa Assistant server. It stores the dashboard, SQLite database, applicant documents, assignments and a persistent device-job queue under `/data`.

The hosted server DOES NOT launch Chromium. Windows Chrome/Edge runs the automation on the user's own device through the `windows-extension` folder. This is lighter on Railway and keeps login/CAPTCHA/manual intervention visible on the device.

## Railway settings
- Volume mount: `/data`
- `HOSTED_MODE=true`
- `EVISA_DATA_DIR=/data`
- `APP_USERNAME=admin` (or your chosen username)
- `APP_PASSWORD=<your private password>`

Keep the Railway project private. Public Networking can expose the app domain; HTTP Basic auth protects the dashboard/API.

## Update an existing Railway deployment
Replace/update the files in the same private GitHub repository with this build and commit/push. Railway will redeploy from the Dockerfile. The `/data` volume is not replaced by a redeploy.

This Dockerfile intentionally does not install a Playwright browser. The backend still contains the old local Playwright modules for local compatibility, but hosted automation is queued for the device extension.

## Windows device browser
See `windows-extension/INSTALL_WINDOWS_EXTENSION.md`.
