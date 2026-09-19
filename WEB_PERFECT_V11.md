# Web Perfect v11 — Clear Documents, Host/Bank Auto-Assign, Sequential IDs

- Added **Clear Documents** on the Document Assignment page. It removes all loaded document files and clears all seven saved assignment positions for that applicant after confirmation.
- Added automatic filename mapping:
  - `host.pdf` -> Copy of Nigerian Passport of the Host / Residency Permit / Host Document
  - `bank.pdf` -> Evidence of sufficient funds / Bank Statement
- Existing filename auto-detection remains in place for `ppt.pdf`, `cac.pdf`, passport photo images, `app.pdf`, `tk.pdf`, and `hotel.pdf`.
- New application IDs are automatically sequenced. Saving `asa` creates `asa-001`; saving another new `asa` creates `asa-002`, then `asa-003`, etc.
- Editing an existing suffixed application keeps its existing ID.
- The active SQLite database continues to save immediately when an applicant is added/edited, and document clearing also persists immediately.
