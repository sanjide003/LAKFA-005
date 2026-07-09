# Final Production Release Hardening

Use this handover document before publishing the Lakfa ERP PWA to Vercel or packaging the Android WebView build. The app is Firebase-only: all production data must come from Firebase Auth, Firestore, and the committed Firebase web config.

## 1. Vercel PWA deployment checklist

- Confirm `vercel.json` is at repository root and points `/lakfa-erp/service-worker.js` to no-cache headers.
- Deploy the repository root as a static project; no build command is required for the PWA shell.
- Open `/` and verify it loads the root login page.
- Open `/lakfa-erp/manager.html` and `/lakfa-erp/investor.html`; both must redirect unauthenticated users to login.
- In browser DevTools → Application, verify service worker cache name and cached assets include `js/firebase-db.js`, `js/company-profile.js`, `js/manager.js`, `js/investor.js`, and `css/style.css`.
- Hard refresh after deployment and confirm company profile branding reloads from Firestore.

## 2. Firebase rules publish checklist

- Firebase Auth: create at least one admin user and one investor user.
- Firestore: create `users/{uid}` documents with `role` (`admin` / `investor`) and `status: active`.
- Publish `docs/firestore.rules` to the production Firebase project.
- If Storage is not used for company images, do not enable public Storage writes; company logo/signature are stored as Firestore Data URLs.
- Verify admin can create/update/delete production records.
- Verify investor can read allowed data but cannot write through UI or direct Firestore attempts.

## 3. Android release checklist

- Use JDK 17 or 21 for Gradle/Kotlin builds.
- Run `node scripts/qa-audit.mjs` before release.
- Run `./gradlew :app:assembleRelease` with `KEYSTORE_PATH`, `STORE_PASSWORD`, and `KEY_PASSWORD` configured.
- Install the APK/AAB on a device and verify Firebase login, role redirects, image upload file chooser, Android back button behavior, reports, invoices, and WhatsApp actions.
- Confirm `lakfa-erp/` and `app/src/main/assets/lakfa-erp/` are synced before release.

## 4. Staging QA result template

Use `docs/FINAL_LIVE_RELEASE_QA_RESULTS.md` to record the actual live/staging execution results and failed item fixes.


| Field | Value |
| --- | --- |
| QA date | |
| Firebase project ID | fest-21d67 |
| Vercel URL | |
| Android build version | 1.0.8 |
| Admin test user | |
| Investor test user | |
| Firestore rules publish date | |
| Tester | |
| Overall result | Pass / Fail / Blocked |

## 5. Final smoke-test matrix

| Area | Admin expected result | Investor expected result | Status |
| --- | --- | --- | --- |
| Login/RBAC | Admin lands on manager dashboard. | Investor lands on investor dashboard. | ☐ |
| Company profile | Admin can save company details and Firestore text images. | Investor sees updated branding only. | ☐ |
| Master data | Admin can create/update/delete products, customers, suppliers, investors. | Investor cannot edit/delete. | ☐ |
| Operations | Admin can manage purchase, inventory, sales, orders, delivery, expense, income, cash/bank. | Investor sees read-only operational summaries. | ☐ |
| Stock/ledger | Stock and ledger side effects reconcile after create/edit/delete. | Investor sees read-only summaries. | ☐ |
| Invoices/GST | Admin can print/download invoice, purchase invoice, delivery note, GST summary. | No admin export/write controls. | ☐ |
| WhatsApp messages | Admin can copy/open WhatsApp messages from order/sales/delivery rows. | No message action controls. | ☐ |
| Reports/export | Admin can CSV/PDF export reports. | Investor sees read-only report summary. | ☐ |
| PWA cache | Latest assets load after hard refresh. | Latest assets load after hard refresh. | ☐ |
| Android wrapper | WebView loads Firebase app; back button/file chooser work. | Same, read-only. | ☐ |

## 6. Known limitations

- Live Firebase QA must be executed manually in the target Firebase project because this repository cannot create production Firebase Auth users or publish rules by itself.
- Android Gradle builds require a supported JDK (17 or 21 recommended); Java 25 may fail with current Kotlin/Gradle tooling.
- Browser print-to-PDF depends on the user's browser/WebView print support.
- WhatsApp actions open `wa.me` links and require a device/browser with WhatsApp support.
- Firestore Data URL images keep the free-plan setup simple, but very large logos/signatures should be compressed before upload.

## 7. Operator handover guide

1. Keep Firebase Console access limited to trusted admins.
2. Add Auth users first, then create matching `users/{uid}` role documents.
3. Publish Firestore rules before sharing the production URL.
4. Enter company profile details before creating invoices/reports.
5. Use admin forms for production records; avoid direct Firestore edits except controlled import/restore tasks.
6. Run the smoke-test matrix after every release.
7. Keep backup exports outside the public repository.
