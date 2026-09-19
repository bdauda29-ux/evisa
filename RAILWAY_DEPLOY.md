# Railway deployment

This build is configured to deploy from the repository root with the root `Dockerfile`.

## Railway service settings
- Root Directory: `/` (or leave blank)
- Builder: Dockerfile / config as code
- Do not set a custom Build Command
- Start Command may be left blank because the Dockerfile has CMD; `railway.json` also declares it.
- Volume mount: `/data`

## Variables
- `HOSTED_MODE=true`
- `EVISA_DATA_DIR=/data`
- `APP_USERNAME=admin` (optional if auth is wanted)
- `APP_PASSWORD=...` (recommended)
- `AUTOMATION_TOKEN=...` (use the token configured in the PC browser helper)

The server binds to Railway's `PORT` automatically.
