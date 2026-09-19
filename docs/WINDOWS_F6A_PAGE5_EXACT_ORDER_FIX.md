# Windows F6A Page 5 exact-order upload fix

The live F6A portal page shows seven upload controls in this order:

1. Invitation letter from family/friend in Nigeria accepting immigration responsibility
2. Copy of Nigerian Passport of the Host or Residency Permit (Non-Nigerian)
3. Valid Passport (not less than 6 months validity)
4. Passport Photo
5. Evidence of Return Ticket
6. Evidence of Hotel Reservations or host address in Nigeria
7. Evidence of sufficient funds (180 days Bank Statement)

For F6A only, the Windows automation now maps upload positions 1-7 directly to those seven visible portal controls in DOM order. Passport Photo is no longer skipped on Page 5.

Other visa categories continue using the existing label-based mapping, so the working F4A behavior is unchanged.
