# Windows F6A Page 5 two-stage upload fix

The F6A portal requires a strict two-click upload sequence for every document:

1. Click **Upload file** on the Page 5 document card.
2. Wait for the **Upload File** overlay.
3. Click **Upload** inside that overlay.
4. Catch Chromium's file chooser and provide the assigned document.
5. Click **OK** inside the same overlay.
6. Wait for the overlay to close before processing the next document.

This F6A-specific path does not replace the working F4A uploader. A direct hidden-file-input assignment is used only as a fallback *after* the modal's Upload button has been clicked.
