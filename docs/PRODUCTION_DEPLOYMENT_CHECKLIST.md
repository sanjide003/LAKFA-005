# Lakfa ERP Production Deployment Checklist

Use this checklist before publishing the Firebase-backed PWA to Vercel.

## 1. Firebase Auth and Roles

- Create each admin and investor in **Firebase Console → Authentication**.
- Copy every created user UID.
- Create `users/{uid}` documents in Firestore with:
  - `name`
  - `email`
  - `role`: `admin` or `investor`
  - `status`: `active`
  - `investorId` for investor accounts when the investor page must link to a specific investor record.
- Keep disabled or former staff as `status: inactive` instead of deleting the audit trail.

## 2. Rules and Firestore image storage

- Publish `docs/firestore.rules` in Firestore Rules.
- Confirm admin can write company profile, master data, operational records, and Firestore image text fields.
- Confirm investor can sign in and read their page without edit/delete controls.

## 3. Seed / Import Template

- Use `docs/firebase-seed-template.json` as a safe starter shape for required collections.
- Replace every `REPLACE_*` value before import.
- Do not import placeholder values into production.

## 4. Admin QA

- Login as admin.
- Save company profile and upload logo/signature.
- Create, edit, and delete one record in each module.
- Verify purchase, sales, and production records update matching inventory items.
- Verify paid sales/income create cash or bank inflow entries.
- Verify paid purchases/expenses/profit sharing create cash or bank outflow entries.
- Verify cashbook/bankbook balances recalculate after edit/delete.

## 5. Investor QA

- Login as investor.
- Confirm only read-only investor-relevant data is visible.
- Confirm edit/save/delete buttons are not available.
- Confirm Firestore write attempts fail under investor role.

## 6. Vercel Publish

- Deploy the repository root to Vercel.
- Keep the static output path as repository root; no build command is required.
- Confirm `/` opens the root login page.
- Confirm `/lakfa-erp/manager.html` and `/lakfa-erp/investor.html` redirect unauthenticated users to login.
- Confirm service worker loads from `/lakfa-erp/service-worker.js`.

## 7. Step 7 Audit Notes

- Review `docs/PRODUCTION_QA_AUDIT.md` for repository-level audit findings and remaining product stages.

- Use `docs/LIVE_FIREBASE_STAGING_QA.md` as the detailed live staging execution matrix.

## Final release hardening

Before production handover, complete `docs/PRODUCTION_RELEASE_HARDENING.md` and attach the filled staging QA result template to the release record.
