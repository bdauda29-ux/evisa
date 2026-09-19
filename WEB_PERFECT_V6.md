# Web Perfect v6 — Automatic Document Assignment

When documents are loaded, the assignment screen now automatically matches these filenames to visa-specific document labels:

- Valid Passport -> `ppt.pdf`
- CAC Certificate -> `cac.pdf`
- Passport Photo -> `photo.jpg`, `photo.jpeg`, or `photo.png`
- Invitation Letter -> `app.pdf`
- Return Ticket -> `tk.pdf`
- Hotel Reservation / Host Address -> `hotel.pdf`

Rules:
- Matching is case-insensitive.
- Existing/manual assignments are not overwritten.
- Any unmatched document remains available in the dropdowns.
- After saving assignment, the existing passport-photo crop step still opens automatically.
- 40+ file folder batching from v5 is retained.
