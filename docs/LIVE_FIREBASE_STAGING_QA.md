# Live Firebase Staging QA Matrix

Use this matrix after deploying to Vercel and publishing Firebase rules. Record tester name, date, Firebase project, deployed URL, and browser for each run.

## Required setup before testing

- Firebase Auth has at least one active admin and one active investor.
- Firestore has matching `users/{uid}` role documents for both testers.
- Firestore rules from `docs/firestore.rules` are published.
- `settings/companyProfile` exists or is created through the admin Company Profile screen.
- At least one inventory item exists for stock reconciliation tests.

## Admin CRUD test matrix

| Module | Create | Read/Table | Update | Delete | Required validation | Expected side effect |
| --- | --- | --- | --- | --- | --- | --- |
| Company Profile | Save all company fields and upload logo/signature | Login/sidebar branding updates | Change phone/email/logo | Not applicable | Required business identity fields | Compressed image text saved in `settings/companyProfile` |
| Products | Create active product | Product appears in table | Change price/stock alert | Delete test product | Name, SKU, unit | Product removed from table after delete |
| Customers | Create customer | Customer appears in table | Change phone/place | Delete test customer | Name, phone, place | No ledger side effect |
| Suppliers | Create supplier | Supplier appears in table | Change GST/item supplied | Delete test supplier | Name, phone, place | No ledger side effect |
| Investors | Create investor | Investor appears in table | Change amount/share/status | Delete test investor | Name, email, amount | Investor page can map by `investorId` when configured |
| Purchases | Create paid and pending purchase | Purchase appears in table | Change qty/status | Delete purchase | Date, invoice, supplier, item, qty, rate | Paid purchase creates cash/bank outflow; stock increases for matching item |
| Inventory | Create stock item | Stock card appears | Change current/min stock | Delete test item | Name, category, unit, current stock | Used by stock reconciliation tests |
| Production | Create batch | Batch appears | Change produced qty/cost | Delete batch | Batch, date, product, qty, cost | Produced qty increases matching inventory item |
| Sales | Create paid and pending sale | Sale appears | Change discount/status | Delete sale | Date, customer, product, qty, rate | Paid sale creates cash/bank inflow; stock decreases for matching item |
| Orders | Create paid and pending order | Order appears | Change status/payment | Delete order | Date, customer, phone, product, qty | Paid order creates cash/bank inflow |
| Delivery | Create dispatch | Dispatch appears | Change status/tracking | Delete dispatch | Order ID, customer, charge, dispatch date | No ledger side effect |
| Expenses | Create expense | Expense appears | Change amount/mode | Delete expense | Date, description, amount, paid to | Creates cash/bank outflow |
| Income | Create income | Income appears | Change amount/mode | Delete income | Date, description, amount, received from | Creates cash/bank inflow |
| Cashbook | Create cash in/out | Balance appears | Change amount/type | Delete entry | Date, description, amount | Rolling balance recalculates |
| Bankbook | Create amount in/out | Balance appears | Change amount/type | Delete entry | Date, bank, description, amount, ref | Rolling balance recalculates |
| Profit Sharing | Create paid/pending payout | Payout appears | Change share/status | Delete payout | Period, investor, share, total profit | Paid payout creates cash outflow |

## Investor read-only test matrix

| Area | Expected result |
| --- | --- |
| Login | Active investor reaches `investor.html`; inactive investor is blocked. |
| Dashboard | Investor sees only Firestore records relevant to investor reports. |
| Tables | No edit, save, delete, or form submission controls are available. |
| Direct Firestore write attempt | Firestore rules deny writes for investor role. |
| Company branding | Company name/logo loads from `settings/companyProfile`. |
| Sign out | User returns to the root login page. |

## Firestore data validation checklist

- Every created record has `createdAt`, `createdBy`, `updatedAt`, and `updatedBy` where created through app helpers.
- Required numeric fields are stored as numbers, not formatted strings.
- Payment statuses use only `Paid`, `Pending`, or `Partial` where applicable.
- Order statuses use only the statuses available in the UI.
- Matching inventory item names are exact for purchase, sales, and production reconciliation.
- Linked ledger rows include `sourceModule`, `sourceId`, and `sourceRef` when created from another module.

## Stock and ledger reconciliation checklist

1. Create inventory item with known current stock.
2. Create purchase for exact item name and verify stock increases.
3. Edit purchase quantity and verify stock is reversed and reapplied.
4. Delete purchase and verify stock is reversed.
5. Create sale for exact item name and verify stock decreases.
6. Edit sale quantity and verify stock is reversed and reapplied.
7. Delete sale and verify stock is restored.
8. Create production batch for exact item name and verify stock increases.
9. Create paid income/expense/profit sharing and verify cashbook or bankbook linked entries.
10. Edit/delete cashbook and bankbook entries and verify rolling balances recalculate.

## Vercel deployment verification checklist

- `/` opens the Firebase login page.
- `/lakfa-erp/manager.html` redirects unauthenticated users to login.
- `/lakfa-erp/investor.html` redirects unauthenticated users to login.
- `/lakfa-erp/service-worker.js` returns `Cache-Control: public, max-age=0, must-revalidate`.
- Browser DevTools shows service worker cache name `lakfa-erp-cache-v2`.
- PWA install prompt works in Chrome/Edge after first load.
- Hard refresh after deployment loads the latest JS assets.

## QA evidence to capture

- Screenshot of successful admin dashboard load.
- Screenshot of successful investor read-only dashboard load.
- Firestore screenshots for `users/{uid}`, one operational collection, one ledger collection, and `settings/companyProfile`.
- Vercel deployment URL and deployment timestamp.
- Browser console screenshot showing no blocking JavaScript errors.


## Stage 3 execution runbook

Use `docs/LIVE_FIREBASE_STAGING_RUNBOOK.md` to record the live Firebase/Vercel execution results and bug reports.
