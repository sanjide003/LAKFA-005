# Firestore Backup / Restore Foundation

This project is Firebase-only. Use this document to prepare safe exports/imports for the live Firestore project before large production changes.

## Collections included in operational backup

- `settings/companyProfile` and `settings/appSettings`
- `users/{uid}` role documents
- `products`, `customers`, `suppliers`, `investors`
- `purchases`, `inventory`, `production`, `sales`, `orders`, `deliveries`
- `expenses`, `income`, `cashbook`, `bankbook`, `profitSharing`

## Recommended backup workflow

1. Open Firebase Console → Firestore Database.
2. Export each collection as JSON/CSV using an approved admin tool or the Firebase CLI in a trusted environment.
3. Store the export outside the public web app repository.
4. Record export date, Firebase project ID, admin UID, and collection counts.
5. Verify exported records include `createdAt`, `createdBy`, `updatedAt`, and `updatedBy` where applicable.

## Restore/import validation checklist

- Import to a staging Firebase project first.
- Publish `docs/firestore.rules` before testing users.
- Create Firebase Auth users and `users/{uid}` role documents before app login tests.
- Restore `settings/companyProfile` before validating invoice/report branding.
- Recalculate stock, ledger, GST, and investor reports from the restored Firestore data.
- Run `node scripts/qa-audit.mjs` after syncing repository changes.

## Seed/import template guidance

Use `docs/firebase-seed-template.json` as the minimum shape for first-time setup. Add real production records only through admin-approved import tooling or the app's admin forms.
