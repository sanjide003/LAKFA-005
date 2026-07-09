# Lakfa ERP — Food Business Operations Ledger

Lakfa ERP is a simple, clean, and highly professional web-based Enterprise Resource Planning (ERP) application designed specifically for **Lakfa Foods** to streamline operations, track logistics, manage double-entry accounting cash books, and provide transparent view-only reports to venture capital investors.

This application is built as a static client-side Progressive Web App (PWA) that requires **no compilation, bundlers, or build environments**, making it 100% compatible for instant deployment on platforms like Vercel.

---

## 🛠️ Technology Stack
*   **Frontend UI:** Vanilla HTML5, CSS3 Custom Properties (modern Material-style light theme with green/teal branding), and ES6 JavaScript Modules.
*   **Database & Core Auth:** Firebase Web SDK (v10.8.0) imported dynamically via CDN.
*   **Offline Support:** PWA Cache Shell with Service Worker registration for offline resilience.
*   **Deployment:** Static JSON configurations ready for Vercel edge delivery.

---

## 📁 System Architecture
```text
lakfa-erp/
  ├── index.html            # Public authentication portal (Login)
  ├── manager.html          # Protected Admin / Manager workspace (21 ERP modules)
  ├── investor.html         # Protected Investor ledger (View-only financial stream)
  ├── manifest.json         # PWA Manifest properties
  ├── service-worker.js     # Resource caching thread
  ├── vercel.json           # Vercel CDN routing config
  ├── css/
  │   └── style.css         # Responsive CSS variables layout
  └── js/
      ├── firebase-config.js# SDK Config & exports
      ├── auth.js           # Auth handlers & Demo flow limits
      ├── role-guard.js     # Protected page redirects
      ├── manager.js        # Form validation, Firestore CRUD, auto-calc
      ├── investor.js       # View-only investor calculations
      └── utils.js          # Shared date, currency, phone formatters
```

---

## 🔐 Access Roles
The system is protected by a strict **Role-Based Access Control (RBAC)** guard:

1.  **Admin / Manager (`role: "admin"`):** Full access to log raw material purchases, supervise production batches, dispatch orders, log operational expenses, balance ledger sheets, and allocate profit payouts to investors.
2.  **Investor (`role: "investor"`):** Secure, read-only view of their personal capital accounts, profit share allocations, company press releases, and general financial metrics.

---

## ⚠️ Production Readiness

The web app is now wired to the Firebase project `fest-21d67`. Before entering real customer, accounting, investor, or company data, make sure the Firebase Console has:

1. Email/password authentication enabled.
2. Admin and investor accounts created.
3. Matching `users/{uid}` Firestore role documents created.
4. The rules in `docs/firestore.rules` published to Firestore.

### Firestore Security Rules
The production rules are stored in `docs/firestore.rules`. Apply the same rules in your Firebase Console under the **Firestore Rules** tab:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function currentUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function hasActiveRole(role) {
      return isSignedIn()
        && currentUserDoc().data.status == 'active'
        && currentUserDoc().data.role == role;
    }

    function isAdmin() {
      return hasActiveRole('admin');
    }

    function isInvestor() {
      return hasActiveRole('investor');
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create, update, delete: if isAdmin();
    }

    match /{document=**} {
      allow read: if isAdmin() || isInvestor();
      allow write: if isAdmin();
    }
  }
}
```

---

## ⚡ Firebase-only Data Mode
Lakfa ERP no longer ships trial credentials, placeholder records, or browser-local business storage. Dashboards, ledgers, company profile, logo, and signature branding render records/text images from Firebase only. If a Firestore collection is empty, the related module shows an empty state until an admin creates records in Firebase.

---

## 🚀 Deployment Instructions

### 1. Vercel Hosting
Deploying this project to Vercel takes less than a minute and requires no command line tools:
1.  Push the project repository to your **GitHub** account.
2.  Log in to the [Vercel Dashboard](https://vercel.com).
3.  Click **"Add New"** → **"Project"**.
4.  Import your repository.
5.  Keep the Root Directory as the repository root so Vercel serves the top-level `index.html` login page.
6.  Click **"Deploy"**. Vercel will serve the root `index.html` login page and load the app assets from `lakfa-erp/`.

### 2. Installing PWA
1.  Open the deployed URL in Google Chrome, Edge, or Apple Safari.
2.  Click the **"Install App"** icon in the address bar (or select "Add to Home Screen" on iOS Safari).
3.  Lakfa ERP will run inside a standalone window with its own application frame, accessible offline.

---

## 🔮 Future Roadmap (Phase 2 Development)
*   **Firestore Write Workflows:** All primary ERP modules now support Firestore-backed admin create/update/delete with audit fields, including production batches and profit sharing. Purchase, sales, production, profit sharing, cashbook, and bankbook workflows use batched reconciliation helpers for inventory/ledger side effects while investor access remains read-only.
*   **Invoicing & GST Forms:** Automatically generate professional PDFs and compile GSTR-1 summaries.
*   **WhatsApp CRM:** Trigger automated dispatch alerts, delivery trackers, and confirmation messages directly to customer phone numbers.
