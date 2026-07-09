# Final Live Release QA Results

This file is the release QA execution record for the Lakfa ERP Firebase-backed PWA and Android wrapper. Repository-level automated checks can be executed in this environment; live Vercel/Firebase/Android device checks must be completed by the release operator with access to the deployed URL, Firebase Console, and Android build device.

## Execution summary

| Field | Result |
| --- | --- |
| Repository QA audit | Pending in current run |
| Vercel PWA live URL | Pending operator input |
| Firebase project | fest-21d67 |
| Firebase rules publish verification | Pending operator input |
| Admin user tested | Pending operator input |
| Investor user tested | Pending operator input |
| Android build/device tested | Pending operator input |
| Overall live release result | Pending live QA |

## Smoke-test matrix result log

| Area | Admin expected result | Investor expected result | Live result | Evidence/notes |
| --- | --- | --- | --- | --- |
| Vercel PWA | `/` opens login; manager route redirects when unauthenticated. | Investor route redirects when unauthenticated. | Pending | Requires deployed Vercel URL. |
| Firebase Auth/RBAC | Admin login lands on manager dashboard. | Investor login lands on investor dashboard. | Pending | Requires live Auth users and `users/{uid}` docs. |
| Firestore rules | Admin can write allowed collections. | Investor read-only; direct writes denied. | Pending | Requires rules published in Firebase Console. |
| Company profile | Admin saves company fields and text-image logo/signature. | Investor sees updated branding only. | Pending | Requires live browser session. |
| Admin CRUD | Admin can create/update/delete master and operational records. | No edit/delete controls. | Pending | Requires live Firestore test records. |
| Stock/ledger reconciliation | Purchase/sale/expense/income edits reconcile stock and cash/bank ledger. | Read-only summaries only. | Pending | Requires live transaction test. |
| Invoice/GST/PDF | Admin can print/download sales invoice, purchase invoice, delivery note, GST report. | No admin export controls. | Pending | Requires browser print support. |
| WhatsApp notifications | Admin can copy/open order/sales/delivery messages. | No message action controls. | Pending | Requires browser/device WhatsApp support. |
| Reports/export | Admin can export CSV/PDF reports. | Investor sees read-only report summary. | Pending | Requires live data. |
| Android WebView | WebView loads Firebase app; back button and file chooser work. | Same app, read-only flow. | Pending | Requires Android build/device with JDK 17/21 build. |

## Operator sign-off

| Role | Name | Date | Sign-off |
| --- | --- | --- | --- |
| Release operator | | | Pending |
| Firebase admin | | | Pending |
| Business owner | | | Pending |

## Failed item capture

Use this section for any failures found during live QA.

| ID | Area | Steps | Expected | Actual | Severity | Fix commit/PR |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
