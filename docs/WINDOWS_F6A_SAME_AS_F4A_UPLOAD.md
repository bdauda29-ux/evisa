# Windows F6A Page 5 — same upload behavior as F4A

F6A no longer uses any special overlay/container resolver or two-stage modal code.

For every F6A Page 5 document, Windows now runs the same upload implementation used by the working F4A flow:

1. Click the document row's `Upload file` button.
2. Wait for the portal file input using the existing F4A selectors.
3. Set the assigned file with Playwright `setInputFiles()`.
4. Click the existing portal `OK` button selector.
5. Wait for the upload window to close.
6. Re-detect the live F6A document row before the next file.

Only the F6A seven-document order remains visa-specific.
