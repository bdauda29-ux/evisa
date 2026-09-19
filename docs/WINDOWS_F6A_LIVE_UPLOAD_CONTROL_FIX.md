# Windows F6A Page 5 live upload-control fix

F6A Supporting Documents re-renders after uploads. The old automation captured all upload button ElementHandles before uploading, so later handles could point to detached DOM nodes.

The F6A uploader now:

1. Validates all assigned files first.
2. Resolves the live set of Page 5 upload controls before every file.
3. Uses F6A's confirmed seven-slot order only on the fresh live controls.
4. Uploads one file, waits for the modal to close and the Angular component to rebuild, then scans again.
5. Leaves non-F6A matching behavior unchanged.

This specifically addresses cases where F4A works but F6A stalls or repeats after the first/early upload.
