/* Lakfa ERP Role Guard & Auth Session Manager */
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFirebaseErrorMessage, showToast } from "./utils.js";

const getLoginUrl = () => new URL("../../index.html", import.meta.url).href;

/**
 * Protects a page by checking Auth state and Firestore user roles.
 * Redirects to index.html if the user is unauthorized.
 * @param {string} requiredRole - 'admin' or 'investor'
 */
export function protectPage(requiredRole) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.log("No authenticated user. Redirecting to login page...");
      window.location.href = getLoginUrl();
      return;
    }

    try {
      // Fetch Firestore user doc
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        showToast("Your account role is not assigned. Please contact admin.", "error");
        setTimeout(() => logoutUser(), 3000);
        return;
      }

      const userData = userSnap.data();

      if (userData.status !== "active") {
        showToast("Your account is inactive. Please contact admin.", "error");
        setTimeout(() => logoutUser(), 3000);
        return;
      }

      if (userData.role !== requiredRole) {
        showToast("Access denied: unauthorized role.", "error");
        window.location.href = getLoginUrl();
        return;
      }

      // Successful validation - update header
      updateUIHeader(userData.name || user.email, user.email, userData.role);

    } catch (err) {
      console.error("Error verifying user role: ", err);
      showToast(getFirebaseErrorMessage(err, "Unable to verify your Firebase role."), "error");
    }
  });
}

/**
 * Update UI headers dynamically with user name, email, and role badge
 */
function updateUIHeader(name, email, role) {
  const nameEl = document.getElementById("header-user-name");
  const emailEl = document.getElementById("header-user-email");
  const roleEl = document.getElementById("header-user-role");
  
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (roleEl) {
    roleEl.textContent = role === "admin" ? "Admin / Manager" : "Investor";
    roleEl.className = `badge ${role === "admin" ? "badge-success" : "badge-info"}`;
  }
}

/**
 * Handle user logout across both Demo and Real Firebase configurations
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = getLoginUrl();
  } catch (err) {
    console.error("Error signing out: ", err);
    showToast(getFirebaseErrorMessage(err, "Logout failed."), "error");
  }
}

/**
 * Check and get current user role
 * @returns {string|null}
 */
export function getCurrentUserRole() {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return null; // For async Firestore queries, use full login guard
}
