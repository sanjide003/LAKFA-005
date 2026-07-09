# Live Firebase Staging Runbook

Use this runbook to execute Stage 3 against the deployed Vercel URL and the Firebase project `fest-21d67`.

## 1. Environment record

| Field | Value |
| --- | --- |
| QA date | |
| Tester | |
| Firebase project ID | `fest-21d67` |
| Vercel deployment URL | |
| Browser / device | |
| Admin test email | |
| Investor test email | |

## 2. Firebase Console setup verification

### Authentication users

- [ ] Admin user exists in Firebase Authentication.
- [ ] Investor user exists in Firebase Authentication.
- [ ] Both users can sign in with known staging credentials.

### `users/{uid}` role documents

Create/verify these Firestore documents using each Authentication UID:

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "role": "admin",
  "status": "active"
}
```

```json
{
  "name": "Investor User",
  "email": "investor@example.com",
  "role": "investor",
  "status": "active",
  "investorId": "REPLACE_INVESTOR_DOCUMENT_ID"
}
```

- [ ] Missing role document blocks login with a clear message.
- [ ] `status: inactive` blocks access.
- [ ] Wrong role cannot open the other role page.

### Firestore rules

- [ ] Publish `docs/firestore.rules`.
- [ ] Admin can write ERP records.
- [ ] Investor can read allowed reports.
- [ ] Investor direct write attempt is denied.

## 3. Company profile with Firestore text images

- [ ] Open Admin → Company Profile.
- [ ] Save company name, GST, address, phone, email, website, business type/category, state, pincode, social links.
- [ ] Upload company logo image smaller than 2 MB.
- [ ] Upload signature logo image smaller than 2 MB.
- [ ] Firestore `settings/companyProfile.logoDataUrl` is populated.
- [ ] Firestore `settings/companyProfile.signatureDataUrl` is populated.
- [ ] Logo/signature preview reloads after refresh.
- [ ] Login page and manager/investor headers show company branding.
- [ ] Oversized image shows validation error and does not save.

## 4. Admin CRUD matrix execution

For each module, create one test record, refresh, edit it, refresh, delete it, and confirm table state:

- [ ] Products
- [ ] Customers
- [ ] Suppliers
- [ ] Investors
- [ ] Purchases
- [ ] Inventory
- [ ] Production
- [ ] Sales
- [ ] Orders
- [ ] Delivery
- [ ] Expenses
- [ ] Income
- [ ] Cashbook
- [ ] Bankbook
- [ ] Profit Sharing

Validation checks:

- [ ] Required fields block empty saves.
- [ ] Numeric fields save as numbers.
- [ ] Created records include `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.
- [ ] Edited records update `updatedAt`, `updatedBy`.
- [ ] Delete removes the Firestore document and table row.

## 5. Stock and ledger reconciliation execution

- [ ] Create inventory item with exact name `QA Stock Item` and current stock `100`.
- [ ] Create paid purchase for `QA Stock Item`, qty `10`; stock becomes `110`.
- [ ] Edit purchase qty to `15`; stock reconciles to `115`.
- [ ] Delete purchase; stock returns to `100`.
- [ ] Create paid sale for `QA Stock Item`, qty `5`; stock becomes `95`.
- [ ] Edit sale qty to `8`; stock reconciles to `92`.
- [ ] Delete sale; stock returns to `100`.
- [ ] Create production batch for `QA Stock Item`, qty `20`; stock becomes `120`.
- [ ] Paid purchase/expense/profit sharing creates cash/bank outflow.
- [ ] Paid sale/order/income creates cash/bank inflow.
- [ ] Cashbook and bankbook rolling balances recalculate after edit/delete.

## 6. Investor read-only execution

- [ ] Investor login opens `investor.html`.
- [ ] Investor dashboard renders Firestore data.
- [ ] No edit/save/delete controls are visible.
- [ ] Investor browser console shows no blocking JS errors.
- [ ] Direct Firestore write attempt is denied by rules.
- [ ] Sign out returns to root login.

## 7. Invoice / GST / PDF foundation verification

| Check | Steps | Expected result | Status |
|---|---|---|---|
| Sales invoice print/PDF | Admin → Sales → choose a Firestore sales row → Print and choose Save as PDF. | A4 tax invoice opens with company logo, GSTIN, address, contact, customer GST if available, invoice prefix from `settings/appSettings`, taxable value, CGST/SGST/IGST, grand total in words, and signature. | ☐ |
| Purchase invoice print/PDF | Admin → Purchase → choose a Firestore purchase row → Print and choose Save as PDF. | A4 purchase invoice opens with supplier GST if available, voucher prefix from `settings/appSettings`, taxable value, CGST/SGST/IGST, grand total in words, company branding, and signature. | ☐ |
| Delivery note print/PDF | Admin → Delivery / Courier → choose a Firestore delivery row → Print and choose Save as PDF. | A4 delivery note opens with delivery prefix from `settings/appSettings`, order reference, customer, courier partner, tracking, dispatch/delivery dates, charge, company branding, and signature. | ☐ |
| Download action | Use Download on sales, purchase, and delivery rows. | Browser downloads a print-ready A4 document file generated from current Firestore record data without writing browser storage. | ☐ |
| Company identity source | Update `settings/companyProfile`, refresh, then print again. | Printable documents use latest Firestore `companyName`, `gst`, `address`, `phone`, `email`, `website`, `logoDataUrl`, and `signatureDataUrl`. | ☐ |
| Investor restriction | Login as investor and inspect investor screens. | Investor can read data but cannot see admin print/download/edit/delete controls. | ☐ |

## 8. WhatsApp / customer notification foundation verification

| Check | Steps | Expected result | Status |
|---|---|---|---|
| Order confirmation template | Admin → Orders settings gear → edit `orderConfirmation=...`, save, then use Copy Msg / WhatsApp on an order row. | Message uses Firestore order data and replaces `{{customer}}`, `{{orderId}}`, `{{product}}`, `{{amount}}`, and `{{companyName}}`. | ☐ |
| Sales invoice/payment template | Admin → Sales settings gear → edit `invoiceShare=...` or `paymentReminder=...`, save, then use Copy Msg / WhatsApp on a sales row. | Message uses Firestore sales data, invoice number prefix, payment status, amount, invoice link, and company name. | ☐ |
| Delivery tracking template | Admin → Delivery settings gear → edit `deliveryTracking=...`, save, then use Copy Msg / WhatsApp on a delivery row. | Message uses Firestore delivery data, courier partner, tracking ID, delivery status, and customer phone fallback. | ☐ |
| Investor restriction | Login as investor and inspect investor screens. | Investor can read data but cannot see admin copy/open WhatsApp actions. | ☐ |
| No browser data persistence | Copy/open WhatsApp actions, refresh browser, inspect Application storage. | Notification templates are read from Firestore `settings/appSettings`; no browser storage is used. | ☐ |

## 9. Advanced reports / export / backup verification

| Check | Steps | Expected result | Status |
|---|---|---|---|
| Profit/loss report | Admin → Reports. | Report cards and table summarize Firestore sales, income, purchases, expenses, and estimated profit. | ☐ |
| Investor report | Admin → Reports → Investor CSV. | CSV exports investor capital, share, paid profit, and pending profit from Firestore. | ☐ |
| Stock valuation | Admin → Reports → Stock CSV/PDF. | Export uses current Firestore inventory and available cost/rate fields. | ☐ |
| Sales/purchase summary | Admin → Reports → Sales/Purchase PDF. | Browser print dialog opens an A4 report generated from Firestore sales and purchases. | ☐ |
| GST summary | Admin → GST Reports → CSV/PDF. | GST cards/table include taxable sales, output GST, taxable purchases, input GST, and estimated payable. | ☐ |
| Investor read-only report | Login as investor. | Investor sees read-only report summary and no export/write actions. | ☐ |
| Backup runbook | Review `docs/FIRESTORE_BACKUP_RESTORE.md`. | Backup/restore checklist and seed/import guidance are present before production import. | ☐ |

## 10. Android packaging verification

| Check | Steps | Expected result | Status |
|---|---|---|---|
| Gradle package config | Review `app/build.gradle.kts`. | `applicationId` is `com.lakfa.erp`, version is `1.0.8`, and web assets copy before build. | ☐ |
| WebView Firebase loading | Install Android build and login. | Bundled `lakfa-erp/index.html` loads Firebase Auth/Firestore successfully. | ☐ |
| Back button behavior | Navigate between app pages/tabs, then press Android back. | WebView goes back before closing the app. | ☐ |
| File chooser | Admin → Company Profile → upload logo/signature. | Android image picker opens and Firestore `logoDataUrl` / `signatureDataUrl` save correctly. | ☐ |
| Offline shell | Disable network after first app open. | Bundled shell still opens; Firebase data shows network/auth errors rather than local fallback data. | ☐ |
| Release checklist | Review `docs/ANDROID_PACKAGING.md`. | App icon/splash/versioning/release checklist are documented before release. | ☐ |

## 11. Vercel PWA cache verification

- [ ] `/` opens the login page.
- [ ] `/lakfa-erp/service-worker.js` returns `Cache-Control: public, max-age=0, must-revalidate`.
- [ ] Browser DevTools Application → Cache Storage shows `lakfa-erp-cache-v8`.
- [ ] Cached assets include `js/firebase-db.js`, `js/company-profile.js`, `js/manager.js`, `js/investor.js`, and `css/style.css`.
- [ ] Hard refresh loads latest company profile image behavior.
- [ ] PWA install prompt works in Chrome or Edge.

## 12. Final production release hardening verification

| Check | Steps | Expected result | Status |
|---|---|---|---|
| Release hardening guide | Review `docs/PRODUCTION_RELEASE_HARDENING.md`. | Vercel, Firebase rules, Android release, QA result template, known limitations, and handover guide are complete. | ☐ |
| Final smoke matrix | Execute the smoke-test matrix in the hardening guide. | Admin and investor flows pass with Firestore-backed production data only. | ☐ |

## 13. Bug report template

| Field | Value |
| --- | --- |
| Module | |
| User role | admin / investor |
| Steps to reproduce | |
| Expected result | |
| Actual result | |
| Firestore document path | |
| Browser console error | |
| Screenshot/evidence | |
| Severity | blocker / high / medium / low |
| Fix owner | |
| Retest result | |
