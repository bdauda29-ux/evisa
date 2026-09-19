# Windows Document Folder + Tab Workflow

## Changes

- Choosing a document folder now immediately imports every valid new file from that folder.
- Removed the intermediate checkbox / per-file assignment picker and the `Add Selected Files` step.
- Imported files immediately appear in `Available files` and in the document-position dropdowns.
- Duplicate filenames are skipped; files over the configured upload size are skipped and reported.
- Assignment dropdowns have deterministic keyboard order by document position.
- After changing an assignment, focus is restored to that document dropdown, so pressing `Tab` moves to the next position.
- Crop/Remove action buttons are removed from the normal Tab sequence to keep keyboard navigation focused on assignment fields.
- Assigned files disappear from `Available files` as before and become unavailable in other position dropdowns.

Assignment changes are still committed with `Save Assignment`.
