# Web Perfect v10 — Delete + SQLite Immediate Autosave

- Added a **Delete** button to every application row in the Queue.
- Delete asks for confirmation, removes the applicant from SQLite, removes its uploaded-document folder, clears selection, and refreshes the queue.
- When an applicant is added or edited, the currently active/loaded SQLite database is now written to disk immediately, before document assignment opens.
- Existing SQLite load/save/export features remain unchanged.
- All v9 features are retained.
