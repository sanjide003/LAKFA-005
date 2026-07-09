# Lakfa ERP — Final Production QA + Firebase Deployment Checklist

Use this checklist before publishing the Lakfa ERP PWA to production Firebase Hosting/Firestore. The app is a web-only PWA served from `lakfa-erp/`, with realtime Firestore listeners, role-based access rules, and service-worker caching.

## 1. Full App Smoke Checklist

Run these smoke tests against a staging Firebase project first, then repeat against production after deployment.

### Login and Session
- [ ] Sign in as an active `admin` or `manager` user from Firebase Auth.
- [ ] Confirm inactive users are blocked by Firestore rules and cannot load protected data.
- [ ] Confirm logout clears the session and returns to the login screen.
- [ ] Confirm a hard refresh on `lakfa-erp/manager.html` reloads the active dashboard without console errors.

### Manager Dashboard
- [ ] Dashboard KPI cards render sales, expenses, cash, bank, pending orders, stock alerts, production batches, and investor capital.
- [ ] Order Status Overview cards show Pending, Processing, Shipped, Delivered, Payment Due, and All Active counts.
- [ ] Month-wise Order History accordion groups active orders by `YYYY-MM` and displays customer/status/total/balance.
- [ ] Current Stock Status table shows product stock, minimum stock, and low-stock status.

### Investor Dashboard
- [ ] Sign in as an active investor user whose Auth email matches the investor profile email.
- [ ] Dashboard loads only the investor-scoped data permitted by rules.
- [ ] Investor payment requests show requests targeted to the investor or to all investors.
- [ ] Investor contribution/expense submission creates a pending request owned by that investor.

### Orders
- [ ] Create a new order with multiple product rows.
- [ ] Confirm customer phone/name lookup can prefill repeat customer data.
- [ ] Confirm order payment history records in `orderPayments` and embedded `paymentHistory` display in the orders table.
- [ ] Confirm delivery/order expense notes and rows record in `orderExpenses` and embedded `expenses`.
- [ ] Select active orders and use Print Selected.
- [ ] Soft-delete an order, verify Recycle Bin visibility, restore it, then permanently delete a test order.
- [ ] Print a single label/bill and confirm customer details, totals, and balance are correct.

### Parties / Repeat Customers
- [ ] Open Parties / Repeat Customers from Manager sidebar.
- [ ] Confirm customers are grouped by phone first, then by name when phone is missing.
- [ ] Open a party history and confirm all active orders for that customer appear.
- [ ] Use New Order from a party and confirm name/phone/GST/shop/PIN/address prefill into the order form.
- [ ] Print a customer statement and verify totals, paid amount, and receivable balance.

### Raw Materials
- [ ] Create a raw material with opening stock, current stock, minimum stock, rate, supplier, batch number, and status.
- [ ] Edit the material and confirm realtime updates in the table.
- [ ] Verify low-stock values are reflected in dashboard/reports where applicable.
- [ ] Confirm raw-material stock movements create `rawMaterialLedger` entries.

### Production
- [ ] Create a production batch with multiple raw-material lines.
- [ ] Confirm raw material quantity, unit, rate, line cost, total cost, and cost per unit calculate correctly.
- [ ] Save the batch and verify raw-material stock decreases, finished product stock increases, and ledger records are created.
- [ ] Edit/void a test production batch and verify reversal ledger/stock effects.

### Finance
- [ ] Create finance accounts with opening balances and verify current balances.
- [ ] Create income and expense categories.
- [ ] Record daily income/expense and confirm ledger impact.
- [ ] Create an account-to-account transfer and verify source/destination balances.
- [ ] Edit/delete/void test finance records and verify reversal entries.

### Reports
- [ ] Open Reports and verify selector/cards render.
- [ ] Generate Balance Sheet style report.
- [ ] Generate GST Summary and HSN/Item tax summary.
- [ ] Review reconciliation alerts for negative stock, supplier payable, customer receivable, and ledger mismatch.
- [ ] Preview customer, supplier, stock, raw-material, and unified ledger entries.
- [ ] Export CSV and print/PDF report views.

## 2. Firebase Rules Validation Checklist

Validate rules using the Firebase Emulator Suite or a staging project before production deployment.

- [ ] `users/{uid}` exists for every Auth user before sign-in validation.
- [ ] `users/{uid}.status == "active"` is required for protected reads/writes.
- [ ] Admin/manager roles can read/write all operational collections required by the Manager app.
- [ ] Staff users with permissions can read/write only collections mapped to their enabled permission keys.
- [ ] Investors can read their own investor profile and owner-scoped investor records.
- [ ] Investors can create only their own `investorExpenses` records.
- [ ] Investors can update only allowed fields (`notes`, `status`, `read`, `readAt`, etc.) in owner-scoped workflows.
- [ ] Anonymous users cannot read/write any protected ERP collection.
- [ ] Service worker and public static assets are served by Hosting; Firestore rules only protect Firestore data.

## 3. Required Firestore Collections

Create these collections on demand through the app or seed them before launch if you need initial data. Collection names must match the client data-layer constants.

| Collection | Purpose | Index notes |
| --- | --- | --- |
| `users` | Auth profile, role, active status, module permissions | Document ID should be Auth UID. |
| `settings` | Company profile, print/PDF settings | Single settings document is acceptable. |
| `products` | Finished product master and stock fields | Optional sort/filter by status/name. |
| `customers` | Customer master created from orders | Optional phone/name lookup index. |
| `orders` | Customer orders, statuses, embedded payment/expense snapshots | Add composite indexes if filtering by status/date in future queries. |
| `orderPayments` | Order payment history snapshots | `orderId` / `sourceId` lookup. |
| `orderExpenses` | Order delivery/expense history snapshots | `orderId` / `sourceId` lookup. |
| `deliveries` | Delivery records | `orderId`, status. |
| `sales` | Direct sales records | date/status if querying server-side. |
| `inventory` | Inventory adjustments | product/source references. |
| `stockLedger` | Finished goods stock movement ledger | `sourceId`, item/product. |
| `rawMaterials` | Raw material master | status/category/supplier. |
| `rawMaterialLedger` | Raw material movement ledger | `sourceId`, materialId. |
| `productionBatches` | Production batch records | batch/date/product. |
| `suppliers` | Supplier master and payable fields | name/GSTIN lookup. |
| `purchases` | Purchase invoices | supplier/rawMaterial/date/status. |
| `supplierLedger` | Supplier payable/payment ledger | supplierId/sourceId. |
| `customerLedger` | Customer receivable/statement ledger | customer/phone/sourceId. |
| `financeAccounts` | Cash/bank/account master | status/type. |
| `financeCategories` | Income/expense categories | type/status. |
| `financeTransfers` | Account transfers | from/to account/date. |
| `dailyAccounts` | Daily finance entries | date/account/category/type. |
| `cashbook` | Cash movements | date/sourceId. |
| `bankbook` | Bank movements | date/sourceId. |
| `expenses` | Company expenses | date/category/status. |
| `income` | Company income | date/category/status. |
| `ledgerEntries` | Unified ledger entries | sourceId/module/date. |
| `investors` | Investor master/capital/access | email should match Auth email for investor access. |
| `investorExpenses` | Investor contribution/expense requests and approved shares | investorEmail/status. |
| `investorPaymentRequests` | Manager-to-investor payment requests | targetInvestor/targetInvestorEmail/status. |
| `profitDistributions` | Profit sharing calculations/snapshots | period/status. |
| `notifications` | Investor/manager notifications | investorEmail/read/status. |
| `employees` | Employee master | status/role. |
| `salaryPayments` | Payroll payments | employeeId/period/status. |
| `assets` | Assets and machinery register | status/type. |
| `managerLoans` | Business loans | lender/status. |
| `loanRepayments` | Loan repayment history | loanId/date. |
| `auditLogs` | Audit snapshots for sensitive actions | module/sourceId/action. |

### Suggested Composite Indexes

The current client uses realtime collection listeners and client-side filtering for most screens. Add composite indexes only when you move filters server-side. Recommended future indexes:

- `orders`: `orderStatus ASC, date DESC`
- `orders`: `phone ASC, date DESC`
- `investorExpenses`: `investorEmail ASC, status ASC, createdAt DESC`
- `investorPaymentRequests`: `targetInvestorEmail ASC, status ASC, dueDate ASC`
- `supplierLedger`: `supplierId ASC, date DESC`
- `rawMaterialLedger`: `materialId ASC, date DESC`
- `stockLedger`: `item ASC, date DESC`
- `ledgerEntries`: `module ASC, date DESC`
- `dailyAccounts`: `accountId ASC, date DESC`
- `loanRepayments`: `loanId ASC, date DESC`
- `salaryPayments`: `employeeId ASC, period DESC`

## 4. Production Migration Notes

- [ ] Back up any existing Firestore project before deploying new rules.
- [ ] Create/verify `users/{authUid}` profile documents for every admin, manager, staff, and investor.
- [ ] Assign role values exactly as expected: `admin`, `manager`, `staff`, or `investor`.
- [ ] Set `status: "active"` for users allowed to access the app.
- [ ] For staff, set boolean `permissions` keys: `orders`, `inventory`, `finance`, `reports`, `settings`, `production`, `investors`.
- [ ] Ensure each investor profile has an `email` that matches the Firebase Auth email.
- [ ] Seed company `settings` before first production invoice/print if production branding is required.
- [ ] Deploy Firestore rules before handing out non-admin staff/investor accounts.
- [ ] After deploy, create one disposable test record per critical workflow and then void/delete it to verify reversals.

## 5. PWA Cache / Service Worker Validation

- [ ] Confirm `lakfa-erp/service-worker.js` `CACHE_NAME` has changed for every release that updates cached shell files.
- [ ] Confirm Firebase Hosting serves `/lakfa-erp/service-worker.js` with `Cache-Control: public, max-age=0, must-revalidate`.
- [ ] In browser DevTools, unregister old service workers before first staging QA if stale shell files appear.
- [ ] Load `/lakfa-erp/manager.html`, `/lakfa-erp/investor.html`, `/lakfa-erp/manifest.json`, and `/lakfa-erp/assets/logo.svg` directly and confirm HTTP 200.
- [ ] Install the PWA and verify app name, theme color, and SVG icon.
- [ ] Go offline after first load and verify the shell still opens from cache.

## 6. Role-Based Access Test Plan

| Actor | Expected access | Must be denied |
| --- | --- | --- |
| Anonymous | Static login/PWA shell only | All Firestore reads/writes. |
| Inactive user | No protected collection data | All reads/writes due to inactive `users/{uid}`. |
| Admin/Manager | Full Manager app operational access | None except malformed/invalid client writes. |
| Staff with `orders` | Orders, customers, deliveries, customer/order ledgers | Finance/settings/investor management without permission. |
| Staff with `inventory` | Products, inventory, raw materials, stock ledgers | Finance/settings/investors without permission. |
| Staff with `finance` | Finance, suppliers, purchases, loans, payroll, assets, ledger entries | Settings/users unless also granted. |
| Staff with `reports` | Reports/audit-style data mapped to reports | Operational writes outside report permission. |
| Investor | Own investor profile, targeted payment requests, own expenses, allowed reports | Other investors, admin-only collections, unrelated users. |

## 7. Deployment Commands

Run from the repository root after staging QA passes:

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

Post-deploy verification:

```bash
curl -I https://<hosting-domain>/lakfa-erp/service-worker.js
curl -I https://<hosting-domain>/lakfa-erp/manager.html
curl -I https://<hosting-domain>/lakfa-erp/investor.html
```

## 8. Broken Reference / Static Verification Commands

Run locally before every production deployment:

```bash
for f in lakfa-erp/js/*.js; do node --check "$f"; done
python3 -m json.tool firebase.json >/tmp/firebase.json.valid
python3 -m http.server 4173
```

Then open:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/lakfa-erp/manager.html`
- `http://127.0.0.1:4173/lakfa-erp/investor.html`
- `http://127.0.0.1:4173/lakfa-erp/service-worker.js`
