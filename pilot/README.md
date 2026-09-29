# BargaiNest Wallet — Pilot Build

An API-backed pilot customer experience for BargaiNest. The frontend remains a static HTML/CSS/JS application suitable for cPanel hosting, while authenticated customer and loyalty data is provided by the BargaiNest backend on Google Cloud Run.

## Pilot behaviour

- Users register and sign in with their own account.
- Authentication uses the backend session cookie; the frontend does not store or supply a user UUID.
- `/api/v1/auth/me` establishes the authenticated customer session.
- `/api/v1/me/loyalty-accounts` is the source of truth for the customer's loyalty accounts and cards.
- Active loyalty programmes are loaded from `/api/v1/catalog/loyalty-programmes`.
- Adding a card creates a loyalty account when the customer does not already have one for that programme, then attaches the card to that account.
- Loyalty data is not persisted in localStorage. Only non-sensitive UI preferences such as favourites may be stored locally.
- Photo capture is available, but the pilot does not pretend to perform OCR/barcode extraction. The user confirms or enters the membership number before submission.
- AI Assistant remains a Release 2 preview.

## Deployment

Upload the contents of this folder to the pilot directory on cPanel. Keep the existing demo deployment untouched while the pilot is tested.

## Backend

The pilot currently targets the BargaiNest Cloud Run API at the configured `CLOUD_API_BASE` in `js/state.js`.

## Pilot test flow

1. Register a new account.
2. Confirm the wallet starts empty.
3. Add an active loyalty programme.
4. Enter/scan a synthetic or real membership number.
5. Confirm the card.
6. Refresh the page and confirm the card is loaded from the backend.
7. Sign out and sign back in.
8. Confirm the same customer's wallet is restored.
