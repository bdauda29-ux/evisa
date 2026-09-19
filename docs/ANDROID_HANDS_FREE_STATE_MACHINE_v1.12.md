# Android Hands-Free State Machine v1.12

- Applicant selection enables hands-free automation.
- The embedded WebView continuously detects eVisa Pages 1-8.
- Pages 1-4 run their mapped automation automatically when detected.
- Successful pages press only a positively identified Continue/Next control and wait for the next page.
- Page 1 uses a hybrid dropdown routine: direct select/plugin update first; if the portal does not visually commit the value, a trusted native WebView tap is sent only to the exact field trigger, then the live-search option is selected and verified.
- Page 1 never advances unless Nationality, Class of Visa, and Passport Type are all confirmed.
- Page 2 automatically attempts the assigned/cropped Passport Photo through the WebView native file chooser.
- Pages 5-8 remain automatically detected but are not blindly answered when there is no safe saved field map; no final submission/payment/biometric confirmation is auto-clicked.
- Manual FILL/FILL+NEXT toolbar buttons remain as diagnostic overrides only; normal operation does not require them.
