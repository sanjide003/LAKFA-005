/* Lakfa ERP Utilities */

/**
 * Format currency with Rupee symbol (₹)
 * @param {number|string} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return "₹0.00";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed);
}

/**
 * Format date string into readable short or standard format
 * @param {string} dateString 
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Generate a random short alphanumeric ID (e.g. PRD-A1B2C)
 * @param {string} prefix 
 * @returns {string}
 */
export function generateId(prefix = "ID") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

/**
 * Validate phone number (simple check for 10 digits)
 * @param {string} phone 
 * @returns {boolean}
 */
export function validatePhone(phone) {
  if (!phone) return false;
  // Strip non-digit characters
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

export function getFirebaseErrorMessage(error, fallback = "Firebase request failed. Please try again.") {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code.includes("permission-denied")) {
    return "Firebase permission denied. Confirm your admin/investor role document and deployed security rules.";
  }

  if (code.includes("unauthenticated")) {
    return "Firebase session expired. Please sign in again.";
  }

  if (code.includes("unavailable") || code.includes("deadline-exceeded")) {
    return "Firebase is temporarily unavailable or the network is slow. Please retry.";
  }

  if (code.includes("not-found")) {
    return "Requested Firebase document was not found. Please refresh and try again.";
  }

  if (message) {
    return `${fallback} (${message})`;
  }

  return fallback;
}

/**
 * Show a professional, non-blocking toast alert
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon placeholder
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}
