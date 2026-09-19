# Web Perfect v12

- Hotel/host contacts are explicitly persisted immediately in the active SQLite database.
- Application ID lookup, editing and deletion are case-insensitive. Sequential families were already matched case-insensitively, so `asa`, `ASA`, and `Asa` share the same numbering family.
- Add Applicant is positioned to the right and displays the Unicode plus sign `＋`.
- Queue Delete action is compact and displays only the trash Unicode `🗑`, with tooltip/accessibility label retained.
- All v11 features are retained.
