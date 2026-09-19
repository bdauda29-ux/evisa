# Windows F6A Page 5 upload fix

Page 5 no longer assumes that the nth visible `Upload file` button is always the nth configured document.

For F6A the automation now maps visible upload controls to the configured document labels using the text surrounding each portal control:

1. Invitation Letter
2. Host Document
3. Valid Passport
4. Passport Photo
5. Return Ticket
6. Hotel Reservation / Host Address
7. Bank Statement

The Nigeria eVisa portal may omit Passport Photo from Page 5 because the photograph is already uploaded on Biodata (Page 2). When that happens, Page 5 skips only Passport Photo and continues mapping the remaining F6A files by label, preventing later assignments from shifting into the wrong controls.

The upload input selector is also more tolerant of portal variants, while retaining the existing 1.5 MB PDF / 1 MB image size checks.
