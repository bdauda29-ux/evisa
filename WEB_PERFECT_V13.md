# Web Perfect v13

## Application ID sequencing fix
- New applications now explicitly identify themselves to the backend as new records.
- Every new application always receives a `-001`, `-002`, `-003` suffix.
- Sequence matching is case-insensitive: `ASA`, `asa`, and `AsA` share the same sequence.
- Example: new `ASA` -> `ASA-001`; new `asa` -> `asa-002`; new `AsA` -> `AsA-003`.
- Editing an existing application keeps its existing ID and does not create a new sequence number.
- Legacy unsuffixed records do not prevent a newly added application from receiving `-001`.

All v12 features are retained, including Railway hosting, SQLite persistence, hotel/host saving, document assignment clearing, host.pdf/bank.pdf detection, and compact queue actions.
