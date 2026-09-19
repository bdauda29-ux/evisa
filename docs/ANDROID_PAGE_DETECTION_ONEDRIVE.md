# Android page detection + OneDrive/cloud document access

- External Chrome automation now detects eVisa steps 1-8 from the visible accessibility tree before filling.
- Only fields belonging to the detected page are attempted. This prevents later-page dropdown values from being searched while Step 1 is visible.
- Step 1 recognizes the live portal label `Class Of Visa` in addition to previous visa-category aliases.
- Dropdown matching tries the saved full value plus useful alternatives such as visa code/description.
- Document Assignment now offers both **Choose Folder** (local/storage-provider folder via SAF) and **OneDrive / Cloud Files** (multi-file Android system picker).
- OneDrive access uses Android's Storage Access Framework. The Microsoft OneDrive app/provider must be installed and signed in for OneDrive to appear in the picker. No Microsoft password is stored by eVisa Assistant.
