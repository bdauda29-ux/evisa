# Web Perfect v5 — 40-file Folder Upload

- Document folder upload backend limit increased from 10 to 40 files per request.
- Frontend now uploads in automatic batches of 40.
- A folder with up to 40 valid files uploads in one request.
- Folders containing more than 40 files are also supported by additional batches.
- Existing per-file size validation, duplicate skipping, document assignment, and passport-photo crop workflow are retained.
