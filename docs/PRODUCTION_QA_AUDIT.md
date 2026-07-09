# Step 7 Production QA Audit

Audit date: 2026-07-08

## Verified in repository

- Firebase collection names in `lakfa-erp/js/firebase-db.js` match explicit rules in `docs/firestore.rules` for ERP collections.
- Admin manager routes enable create/update/delete only through Firebase-backed forms.
- Investor controller reads Firestore collections and does not expose save/edit/delete controls.
- Root `index.html` loads the PWA from `lakfa-erp/` and registers `/lakfa-erp/service-worker.js`.
- `vercel.json` targets `/lakfa-erp/service-worker.js` for no-cache service-worker headers.
- Service worker cache list includes Firebase config, data layer, company profile, auth, guards, manager, investor, utils, HTML, CSS, and manifest assets.
- Android asset JS/HTML/service-worker files are synced with the web app copies; the stale Android-only `vercel.json` asset was removed because Vercel config belongs at repository root only.
- Repository runtime code contains no browser-local business-data dependency and no alternate non-Firebase business data mode.

## Manual Firebase QA still required

- Publish `docs/firestore.rules` to the Firebase project.
- Create Firebase Auth users and matching `users/{uid}` role documents.
- Create at least one inventory record before testing purchase/sales/production stock reconciliation.
- Test admin create/update/delete in every module against live Firestore.
- Test investor login and confirm read-only UI plus denied direct writes.
- Test Vercel deployment URL, service worker registration, browser install prompt, and Firestore image reload.

## Remaining product stages

1. Live Firebase staging QA and bug fixes.
2. Invoice/GST document generation and printable PDF templates.
3. WhatsApp/customer notification workflow.
4. Advanced reports, exports, backups, and restore process.
5. Android WebView packaging/signing for Play Store or direct APK distribution.
