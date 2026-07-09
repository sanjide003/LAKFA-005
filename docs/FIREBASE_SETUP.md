# Google Firebase Setup Guide for Lakfa ERP

Lakfa ERP is already configured to use the Firebase project `fest-21d67` in `lakfa-erp/js/firebase-config.js`. Use this guide to finish the Firebase Console setup that cannot be committed to the repository: Authentication users, Firestore role documents, and Firestore Security Rules.

---

## Current Firebase Web App Configuration
The committed app uses this Firebase web configuration:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyCOT73k7YWxlh0qYFYGKa1W_NW29LjwsgQ",
  authDomain: "fest-21d67.firebaseapp.com",
  projectId: "fest-21d67",
  storageBucket: "fest-21d67.firebasestorage.app",
  messagingSenderId: "476270819694",
  appId: "1:476270819694:web:2689cf709656cfde1d697f",
  measurementId: "G-93HHHL4H2P"
};
```

---

## Step 1: Enable Email/Password Authentication
1.  In the Firebase left-hand sidebar, select **"Build"** → **"Authentication"**.
2.  Click **"Get Started"**.
3.  Select the **"Sign-in method"** tab.
4.  Click **"Email/Password"** under native providers.
5.  Toggle **"Enable"** and click **"Save"**.

---

## Step 2: Provision Users in Authentication
Now, create login entries for your team and investors.
1.  Go to the **"Users"** tab inside the Authentication dashboard.
2.  Click **"Add User"**.
3.  **For Admin:**
    *   **Email:** `admin@lakfa.com`
    *   **Password:** Set a strong password (e.g. `LakfaAdmin2026`).
    *   Copy down the generated **User UID** (e.g. `uQg9SjX...`).
4.  **For Investor:**
    *   **Email:** `investor@lakfa.com`
    *   **Password:** Set a strong password (e.g. `LakfaInv2026`).
    *   Copy down the generated **User UID** (e.g. `pL8tKyR...`).

---

## Step 3: Create Firestore Users Collection
The system uses Firestore to verify what role each authenticated UID is assigned to.
1.  In the left sidebar, click **"Build"** → **"Firestore Database"**.
2.  Click **"Create Database"**.
3.  Choose your database location (e.g., `asia-south1` or `us-central`) and start in **Test Mode** (or Production Mode).
4.  Click **"Start Collection"**.
5.  Name the collection: `users`
6.  **Create the Admin Document:**
    *   **Document ID:** Paste the exact **User UID** of your admin user from Step 2.
    *   Add fields:
        *   `name` (string): `Admin User`
        *   `email` (string): `admin@lakfa.com`
        *   `role` (string): `admin`
        *   `status` (string): `active`
7.  **Create the Investor Document:**
    *   Click **"Add Document"** inside the `users` collection.
    *   **Document ID:** Paste the exact **User UID** of your investor user from Step 2.
    *   Add fields:
        *   `name` (string): `Investor User`
        *   `email` (string): `investor@lakfa.com`
        *   `role` (string): `investor`
        *   `investorId` (string): `INV001`
        *   `status` (string): `active`

---

## Step 4: Publish Firestore Security Rules
1. In the Firebase left-hand sidebar, select **"Build"** → **"Firestore Database"**.
2. Open the **"Rules"** tab.
3. Copy the contents of `docs/firestore.rules`.
4. Paste the rules into the Firebase Console rules editor.
5. Click **"Publish"**.

---

## Step 5: Company Logo and Signature Storage
Company logos and signature logos are compressed in the browser and saved as text fields in `settings/companyProfile` (`logoDataUrl` and `signatureDataUrl`). Firebase Storage is not required for company profile images.

---

## Step 6: Test Live Login
Once authentication accounts, Firestore role records, Firestore rules are created, refresh your Lakfa ERP login page. The app will connect directly to Google Firebase and direct your staff to their respective dashboards based on their role metadata.

### Production Verification Checklist
- Login screen should show Firebase-backed sign-in only.
- Admin credentials should open `manager.html`.
- Investor credentials should open `investor.html`.
- Investor users should not be able to write Firestore data.
- Admin users should be able to manage operational Firestore data.
- Use `docs/firebase-seed-template.json` for safe starter collection shapes.
- Use `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` before publishing through Vercel.
