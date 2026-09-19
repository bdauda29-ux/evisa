# Android dropdown physical-tap fix

Version 1.1 changes Chrome custom dropdown interaction so the Accessibility service dispatches a real screen-coordinate tap gesture before falling back to ACTION_CLICK. This addresses controls that report ACTION_CLICK success without visually opening.

Page 1 dropdown sequence remains Nationality -> Class of Visa -> Passport Type. Dropdown options are also selected with physical tap gestures.
