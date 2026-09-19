# Web Perfect v14 — Saved Clients

- Added a dedicated Clients page.
- Add a reusable Client Code such as `ASA` and optional client name.
- New Applicant Application ID is now a dropdown populated only from saved clients.
- Selecting `ASA` and saving creates `ASA-001`; selecting it again creates `ASA-002`, then `ASA-003`.
- Sequence matching remains case-insensitive.
- Existing applications keep their IDs when edited.
- Clients are stored in the active SQLite database, so Save/Load SQLite includes the client list.
- Saved clients can be deleted without deleting existing applications.
