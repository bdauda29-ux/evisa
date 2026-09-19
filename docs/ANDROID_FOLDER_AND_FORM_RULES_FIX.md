# Android folder + applicant rules fix

This build changes Android folder scanning to AndroidX DocumentFile so folders selected from Google Files / DocumentsUI providers can be enumerated through the Storage Access Framework.

Applicant editor rules mirrored from the Windows UI:
- Title -> Gender (Mr./Master = Male; Mrs./Miss/Ms. = Female)
- Nationality -> Country of Departure
- Departure Date -> Arrival Date (arrival mirrors departure)
- Travel dates enforce the same minimum of UTC today + 3 days
- F4A/F4B -> BUSINESS purpose, F5A -> TOUR, F6A -> VISITING
- Arrival Channel -> Port of Entry list is rebuilt for Air/Land/Sea

The official portal URL remains https://evisa.immigration.gov.ng/.
