# Android Guided Dropdown Mode

The Nigeria eVisa portal uses custom dropdown widgets that do not reliably open from Android Accessibility actions in external Chrome.

Version 1.2 uses a guided mode:

1. Automation detects the current eVisa page and the next dropdown.
2. The overlay tells the user exactly which dropdown to tap and which value is needed.
3. The user taps the dropdown once.
4. The Accessibility service detects the opened option list and automatically taps the correct option.
5. Automation continues to the next field/dropdown.

This keeps external Chrome visible while avoiding unreliable synthetic dropdown-opening gestures.
