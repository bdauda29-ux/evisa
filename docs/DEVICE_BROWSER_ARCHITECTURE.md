# Hosted dashboard + local device browser

Flow:

Railway dashboard -> `/api/device/jobs` -> Chrome/Edge extension polls queue -> visible `www.evisa.immigration.gov.ng` tab -> automation -> progress events back to Railway -> dashboard updates over Socket.IO.

Documents remain in Railway `/data`. When Page 2 or Page 5 needs a file, the extension downloads only the assigned file through the authenticated API, creates a browser `File`, places it into the portal's real `<input type=file>`, and fires the normal input/change events.

Page 5 uses fixed document card positions. It never loops over a shrinking list of Upload file buttons, avoiding the previous one-upload/skip-one bug.
