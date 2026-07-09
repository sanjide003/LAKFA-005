/* Lakfa ERP Manager Controller */
import { logoutUser } from "./role-guard.js";
import { formatCurrency, formatDate, getFirebaseErrorMessage, showToast } from "./utils.js";
import { COLLECTIONS, commitBatchOperations, createCollectionRecord, deleteCollectionRecord, getDocument, saveDocument, subscribeCollections, updateCollectionRecord } from "./firebase-db.js";
import { initCompanyProfileForm, loadCompanyProfile } from "./company-profile.js";

// Keys mapped to Firestore collections
const KEYS = {
  products: "lakfa_products",
  customers: "lakfa_customers",
  suppliers: "lakfa_suppliers",
  purchases: "lakfa_purchases",
  inventory: "lakfa_inventory",
  production: "lakfa_production",
  sales: "lakfa_sales",
  orders: "lakfa_orders",
  delivery: "lakfa_delivery",
  expenses: "lakfa_expenses",
  income: "lakfa_income",
  cashBook: "lakfa_cashbook",
  bankBook: "lakfa_bankbook",
  investors: "lakfa_investors",
  sharing: "lakfa_sharing"
};

// Global state tracker for read-only Firestore data
let currentEditId = null;
let firestoreState = {};
let realtimeSubscription = null;
let realtimeDataReady = false;
let activeSectionId = "dashboard";
let activeOrderView = "pending";
let activeDueFilter = "all";
let appSettings = { modules: {} };
const APP_SETTINGS_COLLECTION = "settings";
const APP_SETTINGS_DOCUMENT = "appSettings";
const PRINTABLE_DOCUMENT_KEYS = new Set([KEYS.purchases, KEYS.sales, KEYS.orders, KEYS.delivery]);
const NOTIFICATION_DOCUMENT_KEYS = new Set([KEYS.orders, KEYS.sales, KEYS.delivery]);
const READ_ONLY_MESSAGE = "This module is read-only until its Firestore write workflow is enabled.";
const WRITABLE_FORM_IDS = new Set([
  "product-form", "customer-form", "supplier-form", "investors-form",
  "purchase-form", "inventory-form", "sales-form", "orders-form", "delivery-form",
  "expenses-form", "income-form", "cashbook-form", "bankbook-form", "production-form", "sharing-form"
]);
const WRITABLE_KEYS = new Set([
  KEYS.products, KEYS.customers, KEYS.suppliers, KEYS.investors,
  KEYS.purchases, KEYS.inventory, KEYS.sales, KEYS.orders, KEYS.delivery,
  KEYS.expenses, KEYS.income, KEYS.cashBook, KEYS.bankBook, KEYS.production, KEYS.sharing
]);

const COLLECTION_BY_KEY = {
  [KEYS.products]: COLLECTIONS.products,
  [KEYS.customers]: COLLECTIONS.customers,
  [KEYS.suppliers]: COLLECTIONS.suppliers,
  [KEYS.purchases]: COLLECTIONS.purchases,
  [KEYS.inventory]: COLLECTIONS.inventory,
  [KEYS.production]: COLLECTIONS.production,
  [KEYS.sales]: COLLECTIONS.sales,
  [KEYS.orders]: COLLECTIONS.orders,
  [KEYS.delivery]: COLLECTIONS.delivery,
  [KEYS.expenses]: COLLECTIONS.expenses,
  [KEYS.income]: COLLECTIONS.income,
  [KEYS.cashBook]: COLLECTIONS.cashBook,
  [KEYS.bankBook]: COLLECTIONS.bankBook,
  [KEYS.investors]: COLLECTIONS.investors,
  [KEYS.sharing]: COLLECTIONS.sharing
};

function getStoredRecords(key) {
  return firestoreState[key] || [];
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Keep manager workspace read-only until Firestore write flows are implemented
  setFormsReadOnly();
  await initCompanyProfileForm();

  // 2. Load Firestore data for all dashboard and table renderers
  await loadFirestoreData();

  // 3. Load Firebase-backed module settings foundation
  await loadAppSettings();
  initModuleSettingsPanel();

  // 4. Enable Firestore writes for approved modules
  initWritableFormListeners();

  // 5. Set up event listeners for sidebar routing (tab switching + history)
  initSidebarAccordion();
  hydrateSvgIcons();
  initSidebarRouting();
  initOrderManagementUi();

  // 6. Initialize report export actions
  initReportExportActions();

  // 7. Render and initialize active dashboard metrics
  updateDashboardMetrics();

  // 7. Handle Logout Button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  // 8. Handle Sidebar Responsive Toggle
  initSidebarMobileToggle();
});

async function loadFirestoreData() {
  if (realtimeSubscription) return realtimeSubscription.initialLoad;

  try {
    setGlobalLoading(true, "Connecting to live Firebase ERP data...");
    realtimeSubscription = subscribeCollections(
      COLLECTION_BY_KEY,
      (key, records) => {
        firestoreState[key] = records;
        if (realtimeDataReady) {
          renderModule(activeSectionId);
          updateDashboardMetrics();
        }
      },
      (err, key, collectionName) => {
        console.error(`Realtime listener failed for ${collectionName || key}`, err);
        showToast(getFirebaseErrorMessage(err, `Unable to sync ${collectionName || key}.`), "error");
      }
    );

    await realtimeSubscription.initialLoad;
    realtimeDataReady = true;
  } catch (err) {
    console.error("Error loading Firestore data", err);
    showToast(getFirebaseErrorMessage(err, "Unable to load Firebase ERP data."), "error");
    firestoreState = {};
  } finally {
    setGlobalLoading(false);
  }
}

function setGlobalLoading(isLoading, message = "Loading...") {
  document.querySelectorAll(".table-responsive tbody").forEach((tbody) => {
    if (isLoading) {
      tbody.innerHTML = `<tr><td colspan="20" class="text-center" style="color: var(--primary);">${message}</td></tr>`;
    }
  });
}

async function loadAppSettings() {
  try {
    appSettings = (await getDocument(APP_SETTINGS_COLLECTION, APP_SETTINGS_DOCUMENT)) || { modules: {} };
    appSettings.modules = appSettings.modules || {};
  } catch (err) {
    console.error("Unable to load app settings", err);
    showToast(getFirebaseErrorMessage(err, "Unable to load app settings."), "error");
    appSettings = { modules: {} };
  }
}

async function saveAppSettings() {
  await saveDocument(APP_SETTINGS_COLLECTION, APP_SETTINGS_DOCUMENT, appSettings);
}

const SVG_ICONS = {
  orders: '<svg viewBox="0 0 24 24"><path d="M6 3h12l2 4v14H4V7l2-4z"></path><path d="M4 7h16"></path><path d="M9 11h6"></path><path d="M9 15h6"></path></svg>',
  payment: '<svg viewBox="0 0 24 24"><path d="M6 5h12"></path><path d="M7 9h10"></path><path d="M9 5c4 0 5 6 0 7l6 7"></path></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M20 13 11 22l-9-9V4h9l9 9z"></path><circle cx="7.5" cy="8.5" r="1.5"></circle></svg>',
  return: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"></path><path d="M4 9h10a6 6 0 1 1 0 12h-2"></path></svg>',
  cancel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6"></path><path d="m15 9-6 6"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path><path d="M10 10v7"></path><path d="M14 10v7"></path></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M3 21a6 6 0 0 1 12 0"></path><path d="M14 18a5 5 0 0 1 7 3"></path></svg>',
  store: '<svg viewBox="0 0 24 24"><path d="M4 10h16l-1-6H5l-1 6z"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z"></path><path d="m4 7.5 8 4.5 8-4.5"></path><path d="M12 12v9"></path></svg>',
  inventory: '<svg viewBox="0 0 24 24"><path d="M4 4h16v4H4z"></path><path d="M4 10h16v10H4z"></path><path d="M8 14h8"></path></svg>',
  production: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M2 12h4"></path><path d="M18 12h4"></path></svg>',
  invoice: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
  delivery: '<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"></path><path d="M14 11h4l3 3v3h-7z"></path><circle cx="7" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle></svg>',
  purchase: '<svg viewBox="0 0 24 24"><path d="M6 6h15l-2 8H8L6 3H3"></path><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle></svg>',
  expense: '<svg viewBox="0 0 24 24"><path d="M12 3v18"></path><path d="M17 7H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  bank: '<svg viewBox="0 0 24 24"><path d="m3 9 9-6 9 6"></path><path d="M4 10h16"></path><path d="M6 10v8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path><path d="M18 10v8"></path><path d="M4 20h16"></path></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>',
  accounting: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"></path><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path></svg>',
  report: '<svg viewBox="0 0 24 24"><path d="M5 20V10"></path><path d="M12 20V4"></path><path d="M19 20v-7"></path></svg>',
  gst: '<svg viewBox="0 0 24 24"><path d="M19 5 5 19"></path><circle cx="7" cy="7" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.5 10.5 7-4"></path><path d="m8.5 13.5 7 4"></path></svg>',
  company: '<svg viewBox="0 0 24 24"><path d="M4 21V5h10v16"></path><path d="M14 9h6v12"></path><path d="M8 9h2"></path><path d="M8 13h2"></path><path d="M8 17h2"></path></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6H10a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1-2.9-2.9.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14v-4a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.9-2.9.1.1A1.7 1.7 0 0 0 9 3.6 1.7 1.7 0 0 0 10 2h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0-.3 1.8A1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1z"></path></svg>'
};

function hydrateSvgIcons() {
  document.querySelectorAll(".icon[data-icon]").forEach((icon) => {
    icon.innerHTML = SVG_ICONS[icon.dataset.icon] || SVG_ICONS.settings;
  });
}

function setFormsReadOnly() {
  document.querySelectorAll("form").forEach((form) => {
    if (form.dataset.firestoreWrite === "companyProfile" || WRITABLE_FORM_IDS.has(form.id)) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast(READ_ONLY_MESSAGE, "info");
    });

    form.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = true;
      if (control.tagName === "BUTTON") {
        control.textContent = "Read Only";
      }
    });
  });
}

/**
 * Tab/Section navigation via sidebar links
 */
function initSidebarAccordion() {
  document.querySelectorAll(".sidebar-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".sidebar-group")?.classList.toggle("expanded");
    });
  });
}

function initSidebarRouting() {
  const sidebarItems = document.querySelectorAll(".sidebar-item[data-section]");
  const sections = document.querySelectorAll(".app-section");
  const headerPageTitle = document.getElementById("header-page-title");

  const activateSection = (targetSection, pushHistory = true, preferredItem = null) => {
    const item = preferredItem || (
      targetSection === "orders"
        ? document.querySelector(`.sidebar-item[data-section="orders"][data-order-view="${activeOrderView}"]`) || document.querySelector(`.sidebar-item[data-section="orders"][data-order-view="pending"]`)
        : document.querySelector(`.sidebar-item[data-section="${targetSection}"]`)
    );
    if (!item) return;
    if (targetSection === "orders") {
      activeOrderView = item.dataset.orderView || activeOrderView || "pending";
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
    }

    // Toggle active states on menu
    sidebarItems.forEach(si => si.classList.remove("active"));
    item.classList.add("active");

    // Toggle active states on pages
    sections.forEach(sec => sec.classList.remove("active"));
    const activeSec = document.getElementById(`section-${targetSection}`);
    if (activeSec) {
      activeSec.classList.add("active");

      // Update Title
      if (headerPageTitle) {
        headerPageTitle.textContent = item.textContent.trim();
      }

      item.closest(".sidebar-group")?.classList.add("expanded");

      if (pushHistory) {
        const hash = targetSection === "orders" && activeOrderView !== "pending"
          ? `#orders-${activeOrderView}`
          : `#${targetSection}`;
        history.pushState({ section: targetSection, orderView: activeOrderView }, "", hash);
      }

      scrollActiveSectionToTop(activeSec);
      renderModule(targetSection);
    }
  };
  
  sidebarItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = item.getAttribute("data-section");
      activateSection(targetSection, true, item);
    });
  });

  window.addEventListener("popstate", (event) => {
    const hashTarget = normalizeHashSection(location.hash.replace("#", ""));
    const targetSection = event.state?.section || hashTarget.section || "dashboard";
    if (targetSection === "orders") activeOrderView = event.state?.orderView || hashTarget.orderView || "pending";
    activateSection(targetSection, false);
  });

  // Default initial render of active section, supporting direct hashes such as manager.html#sales
  const hashTarget = normalizeHashSection(location.hash.replace("#", ""));
  const requestedSection = hashTarget.section;
  if (hashTarget.orderView) activeOrderView = hashTarget.orderView;
  const activeItem = requestedSection
    ? document.querySelector(`.sidebar-item[data-section="${requestedSection}"][data-order-view="${activeOrderView}"]`) || document.querySelector(`.sidebar-item[data-section="${requestedSection}"]`)
    : document.querySelector(".sidebar-item.active");

  if (activeItem) {
    const defaultSec = activeItem.getAttribute("data-section");
    const initialHash = defaultSec === "orders" && activeOrderView !== "pending"
      ? `#orders-${activeOrderView}`
      : `#${defaultSec}`;
    history.replaceState({ section: defaultSec, orderView: activeOrderView }, "", initialHash);
    activateSection(defaultSec, false);
  }
}

function normalizeHashSection(hash) {
  if (!hash) return { section: "" };
  if (hash.startsWith("orders-")) {
    return { section: "orders", orderView: hash.replace("orders-", "") };
  }
  return { section: hash };
}

function scrollActiveSectionToTop(activeSection) {
  const workspace = document.querySelector(".workspace");
  if (workspace) workspace.scrollTo({ top: 0, behavior: "auto" });
  if (document.scrollingElement) document.scrollingElement.scrollTo({ top: 0, behavior: "auto" });
  activeSection.scrollIntoView({ block: "start" });
}

/**
 * Responsive Hamburger Menu controls
 */
function initSidebarMobileToggle() {
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.add("open");
      if (backdrop) backdrop.classList.add("open");
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("open");
    });
  }
}

function initModuleSettingsPanel() {
  const settingsButton = document.getElementById("module-settings-btn");
  const modal = document.getElementById("module-settings-modal");
  const form = document.getElementById("module-settings-form");
  if (!settingsButton || !modal || !form) return;

  settingsButton.addEventListener("click", () => openModuleSettings(activeSectionId));
  modal.querySelectorAll("[data-settings-close]").forEach((closeEl) => {
    closeEl.addEventListener("click", closeModuleSettings);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const sectionKey = document.getElementById("settings-section-key")?.value || activeSectionId;
    appSettings.modules = appSettings.modules || {};
    appSettings.modules[sectionKey] = {
      numberingPrefix: getValue("settings-numbering-prefix"),
      gstRate: getNumber("settings-gst-rate"),
      taxMode: getValue("settings-tax-mode") || "inclusive",
      requiredFields: getLines("settings-required-fields"),
      dropdownOptions: getLines("settings-dropdown-options"),
      visibleColumns: getLines("settings-visible-columns"),
      notes: getValue("settings-module-notes"),
      notificationTemplates: getValue("settings-notification-templates")
    };

    const saveButton = document.getElementById("module-settings-save-btn");
    if (saveButton) saveButton.disabled = true;
    try {
      await saveAppSettings();
      showToast("Module settings saved to Firebase.", "success");
      closeModuleSettings();
    } catch (err) {
      console.error("Unable to save module settings", err);
      showToast(getFirebaseErrorMessage(err, "Unable to save module settings."), "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

function openModuleSettings(sectionKey) {
  const modal = document.getElementById("module-settings-modal");
  if (!modal) return;

  const sectionTitle = document.getElementById("header-page-title")?.textContent?.trim() || "Current Tab";
  const settings = appSettings.modules?.[sectionKey] || getDefaultModuleSettings(sectionKey);
  setValue("settings-section-key", sectionKey);
  setValue("settings-numbering-prefix", settings.numberingPrefix);
  setValue("settings-gst-rate", settings.gstRate);
  setValue("settings-tax-mode", settings.taxMode);
  setTextareaLines("settings-required-fields", settings.requiredFields);
  setTextareaLines("settings-dropdown-options", settings.dropdownOptions);
  setTextareaLines("settings-visible-columns", settings.visibleColumns);
  setValue("settings-module-notes", settings.notes);
  setValue("settings-notification-templates", settings.notificationTemplates || getDefaultNotificationTemplates(sectionKey));

  const title = document.getElementById("module-settings-title");
  const subtitle = document.getElementById("module-settings-subtitle");
  if (title) title.textContent = `${sectionTitle} Settings`;
  if (subtitle) subtitle.textContent = `Saved in settings/appSettings.modules.${sectionKey}`;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModuleSettings() {
  const modal = document.getElementById("module-settings-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

function getDefaultModuleSettings(sectionKey) {
  const readableKey = sectionKey.replace(/-/g, " ").toUpperCase();
  return {
    numberingPrefix: readableKey.slice(0, 3),
    gstRate: ["sales", "purchase"].includes(sectionKey) ? 18 : 0,
    taxMode: "inclusive",
    requiredFields: [],
    dropdownOptions: [],
    visibleColumns: [],
    notes: "",
    notificationTemplates: getDefaultNotificationTemplates(sectionKey)
  };
}

function getLines(id) {
  return (document.getElementById(id)?.value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getDefaultNotificationTemplates(sectionKey) {
  const templates = {
    orders: "orderConfirmation=Hi {{customer}}, your order {{orderId}} is {{status}}. Items: {{product}}. Total: {{amount}}. Paid: {{paidAmount}}. Balance due: {{balanceDue}}. - {{companyName}}",
    sales: "paymentReminder=Hi {{customer}}, payment status for invoice {{invoiceNumber}} is {{paymentStatus}}. Amount: {{amount}}. Please contact {{companyName}} for support.\ninvoiceShare=Hi {{customer}}, your invoice {{invoiceNumber}} for {{product}} is ready. Amount: {{amount}}. {{invoiceLink}} - {{companyName}}",
    delivery: "deliveryTracking=Hi {{customer}}, your order {{orderId}} is {{status}} via {{courier}}. Tracking ID: {{trackingId}}. - {{companyName}}"
  };
  return templates[sectionKey] || "";
}


function setTextareaLines(id, lines = []) {
  const input = document.getElementById(id);
  if (input) input.value = Array.isArray(lines) ? lines.join("\n") : "";
}

/**
 * Switch and load tables/data for the loaded module
 */
function renderModule(sectionId) {
  activeSectionId = sectionId;
  currentEditId = null; // Clear edit states
  
  // Dynamic form overrides and resets
  const forms = document.querySelectorAll(`form`);
  forms.forEach(f => f.reset());
  
  const submitBtns = document.querySelectorAll(".submit-btn");
  submitBtns.forEach(btn => {
    if (WRITABLE_FORM_IDS.has(btn.closest("form")?.id)) {
      btn.textContent = "Save Record";
    } else {
      btn.textContent = "Read Only";
    }
  });

  // Load specific renderers
  switch (sectionId) {
    case "dashboard":
      updateDashboardMetrics();
      break;
    case "products":
      renderTable(KEYS.products, "products-table-body");
      setupProductSearch();
      break;
    case "customers":
      renderTable(KEYS.customers, "customers-table-body");
      setupCustomerSearch();
      break;
    case "suppliers":
      renderTable(KEYS.suppliers, "suppliers-table-body");
      break;
    case "purchase":
      renderTable(KEYS.purchases, "purchase-table-body");
      break;
    case "inventory":
      renderTable(KEYS.inventory, "inventory-table-body");
      break;
    case "production":
      renderTable(KEYS.production, "production-table-body");
      break;
    case "sales":
      renderTable(KEYS.sales, "sales-table-body");
      break;
    case "orders":
      renderOrdersManagement();
      break;
    case "delivery":
      renderTable(KEYS.delivery, "delivery-table-body");
      break;
    case "expenses":
      renderTable(KEYS.expenses, "expenses-table-body");
      break;
    case "income":
      renderTable(KEYS.income, "income-table-body");
      break;
    case "cashbook":
      renderCashBookTable();
      break;
    case "bankbook":
      renderBankBookTable();
      break;
    case "accounting":
      renderAccountingSummary();
      break;
    case "investors":
      renderTable(KEYS.investors, "investors-table-body");
      break;
    case "investment-sharing":
      renderTable(KEYS.sharing, "sharing-table-body");
      break;
    case "reports":
      renderAdvancedReports();
      break;
    case "gstreports":
      renderGstReports();
      break;
  }
}

/**
 * Recalculate metrics card displays from local db
 */
function updateDashboardMetrics() {
  const sales = getStoredRecords(KEYS.sales);
  const expenses = getStoredRecords(KEYS.expenses);
  const cash = getStoredRecords(KEYS.cashBook);
  const bank = getStoredRecords(KEYS.bankBook);
  const orders = getStoredRecords(KEYS.orders);
  const products = getStoredRecords(KEYS.products);
  const production = getStoredRecords(KEYS.production);
  const investors = getStoredRecords(KEYS.investors);

  // 1. Today's date in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Sum sales and expenses for today
  const todaySalesVal = sales
    .filter(s => s.date === todayStr)
    .reduce((sum, s) => sum + parseFloat(s.finalAmount || 0), 0);

  const todayExpensesVal = expenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  // 3. Compute final Cash and Bank balances (from last transaction row or aggregate)
  const cashBal = cash.length > 0 ? parseFloat(cash[cash.length - 1].balance || 0) : 0;
  const bankBal = bank.length > 0 ? parseFloat(bank[bank.length - 1].balance || 0) : 0;

  // 4. Pending orders count
  const pendingOrds = orders.filter(o => o.orderStatus !== "Delivered" && o.orderStatus !== "Cancelled").length;

  // 5. Stock Alerts (Current stock is less than or equal to minimum stock)
  const stockAlerts = products.filter(p => parseFloat(p.currentStock || 0) <= parseFloat(p.minimumStock || 0)).length;

  // 6. Production batches
  const prodBatchesCount = production.length;

  // 7. Investors capital summary
  const investorCap = investors.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

  // Update DOM elements
  document.getElementById("dash-sales").textContent = formatCurrency(todaySalesVal);
  document.getElementById("dash-expenses").textContent = formatCurrency(todayExpensesVal);
  document.getElementById("dash-cash").textContent = formatCurrency(cashBal);
  document.getElementById("dash-bank").textContent = formatCurrency(bankBal);
  document.getElementById("dash-orders").textContent = pendingOrds;
  document.getElementById("dash-alerts").textContent = stockAlerts;
  document.getElementById("dash-production").textContent = prodBatchesCount;
  document.getElementById("dash-investor").textContent = formatCurrency(investorCap);
}

/**
 * Universal table renderer using Firestore-backed in-memory arrays
 */
function renderTable(key, tableBodyId) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  const records = getStoredRecords(key);
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="20" class="text-center" style="color: var(--text-muted);">No Firebase records found for this module yet. Admin users can create the first record from the form.</td></tr>`;
    return;
  }

  records.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    // Custom row styling cells according to collection keys
    let cellsHTML = "";

    if (key === KEYS.products) {
      cellsHTML = `
        <td><strong>${row.name}</strong><br><small style="color: var(--text-muted);">${row.id}</small></td>
        <td>${row.sku}</td>
        <td>${row.category}</td>
        <td>${row.unit}</td>
        <td>${formatCurrency(row.mrp)}</td>
        <td>${formatCurrency(row.salePrice)}</td>
        <td>${formatCurrency(row.costPrice)}</td>
        <td>${row.currentStock} / ${row.minimumStock}</td>
        <td><span class="badge ${row.status === 'Active' ? 'badge-success' : 'badge-danger'}">${row.status}</span></td>
      `;
    } else if (key === KEYS.customers) {
      cellsHTML = `
        <td><strong>${row.name}</strong><br><small style="color: var(--text-muted);">${row.id}</small></td>
        <td>${row.phone}<br><small style="color: #25d366;">WA: ${row.whatsapp || row.phone}</small></td>
        <td>${row.place}</td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.address}</td>
        <td>${row.pin}</td>
        <td><span class="badge badge-info">${row.type}</span></td>
      `;
    } else if (key === KEYS.suppliers) {
      cellsHTML = `
        <td><strong>${row.name}</strong><br><small style="color: var(--text-muted);">${row.id}</small></td>
        <td>${row.phone}</td>
        <td>${row.place}</td>
        <td>${row.gst || 'No GST'}</td>
        <td>${row.itemSupplied}</td>
        <td>${row.terms}</td>
      `;
    } else if (key === KEYS.purchases) {
      cellsHTML = `
        <td>${formatDate(row.date)}</td>
        <td><strong>${row.supplier}</strong><br><small>${row.invoice}</small></td>
        <td>${row.itemName}</td>
        <td>${row.qty} ${row.unit}</td>
        <td>${formatCurrency(row.rate)}</td>
        <td><strong>${formatCurrency(row.totalAmount)}</strong></td>
        <td><span class="badge badge-info">${row.paymentMode}</span></td>
        <td><span class="badge ${row.paymentStatus === 'Paid' ? 'badge-success' : row.paymentStatus === 'Pending' ? 'badge-danger' : 'badge-warning'}">${row.paymentStatus}</span></td>
      `;
    } else if (key === KEYS.inventory) {
      cellsHTML = `
        <td><strong>${row.name}</strong><br><small>${row.id}</small></td>
        <td><span class="badge badge-info">${row.stockType}</span></td>
        <td>${row.openingStock}</td>
        <td style="color: var(--success);">+${row.stockIn}</td>
        <td style="color: var(--danger);">${row.stockOut > 0 ? '-' + row.stockOut : '0'}</td>
        <td><strong>${row.currentStock}</strong> ${row.unit}</td>
        <td>${row.minStock}</td>
        <td>${formatDate(row.lastUpdated)}</td>
      `;
    } else if (key === KEYS.production) {
      cellsHTML = `
        <td><strong>${row.batchNumber}</strong><br><small>${formatDate(row.date)}</small></td>
        <td>${row.productName}</td>
        <td>${row.rawMaterial}</td>
        <td>${row.qtyProduced}</td>
        <td>${row.packingQty}</td>
        <td style="color: var(--danger);">${row.wastage}</td>
        <td>${formatCurrency(row.cost)}</td>
        <td>${row.staff}</td>
      `;
    } else if (key === KEYS.sales) {
      cellsHTML = `
        <td>${formatDate(row.date)}</td>
        <td><strong>${row.customer}</strong></td>
        <td>${row.product}</td>
        <td>${row.qty} × ${formatCurrency(row.rate)}</td>
        <td>${formatCurrency(row.totalAmount)}</td>
        <td style="color: var(--danger);">${formatCurrency(row.discount)}</td>
        <td><strong>${formatCurrency(row.finalAmount)}</strong></td>
        <td><span class="badge ${row.paymentStatus === 'Paid' ? 'badge-success' : 'badge-danger'}">${row.paymentStatus}</span></td>
      `;
    } else if (key === KEYS.orders) {
      cellsHTML = `
        <td>${formatDate(row.date)}<br><span class="badge badge-info">${row.source}</span></td>
        <td><strong>${row.customerName}</strong><br>${row.phone}</td>
        <td>${row.product} (${row.qty})</td>
        <td>${formatCurrency(row.totalPayable)}</td>
        <td><span class="badge ${row.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}">${row.paymentStatus}</span></td>
        <td><span class="badge ${
          row.orderStatus === 'Delivered' ? 'badge-success' : 
          row.orderStatus === 'Cancelled' ? 'badge-danger' : 
          'badge-warning'
        }">${row.orderStatus}</span></td>
      `;
    } else if (key === KEYS.delivery) {
      cellsHTML = `
        <td><strong>${row.orderId}</strong></td>
        <td>${row.customer}</td>
        <td>${row.partner} (${row.trackingId || 'N/A'})</td>
        <td>${formatCurrency(row.charge)}</td>
        <td>${formatDate(row.dispatchDate)}</td>
        <td><span class="badge ${
          row.status === 'Delivered' ? 'badge-success' : 
          row.status === 'Cancelled' ? 'badge-danger' : 
          'badge-info'
        }">${row.status}</span></td>
        <td>${row.deliveredDate ? formatDate(row.deliveredDate) : '-'}</td>
      `;
    } else if (key === KEYS.expenses) {
      cellsHTML = `
        <td>${formatDate(row.date)}</td>
        <td><span class="badge badge-danger">${row.category}</span></td>
        <td>${row.desc}</td>
        <td><strong>${formatCurrency(row.amount)}</strong></td>
        <td>${row.mode}</td>
        <td>${row.paidTo}</td>
        <td>${row.receipt || '-'}</td>
      `;
    } else if (key === KEYS.income) {
      cellsHTML = `
        <td>${formatDate(row.date)}</td>
        <td><span class="badge badge-success">${row.source}</span></td>
        <td>${row.desc}</td>
        <td><strong>${formatCurrency(row.amount)}</strong></td>
        <td>${row.mode}</td>
        <td>${row.receivedFrom}</td>
      `;
    } else if (key === KEYS.investors) {
      cellsHTML = `
        <td><strong>${row.name}</strong><br><small>${row.id}</small></td>
        <td>${row.phone}<br><small>${row.email}</small></td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.address}</td>
        <td><strong>${formatCurrency(row.amount)}</strong></td>
        <td><strong>${row.share}%</strong></td>
        <td>${formatDate(row.date)}</td>
        <td><span class="badge ${row.status === 'Active' ? 'badge-success' : 'badge-danger'}">${row.status}</span></td>
      `;
    } else if (key === KEYS.sharing) {
      cellsHTML = `
        <td><strong>${row.period}</strong></td>
        <td>${formatCurrency(row.totalProfit)}</td>
        <td><strong>${row.investor}</strong></td>
        <td>${row.share}%</td>
        <td><strong>${formatCurrency(row.amount)}</strong></td>
        <td><span class="badge ${row.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${row.status}</span></td>
        <td>${row.date ? formatDate(row.date) : '-'}</td>
      `;
    }

    if (isWritableKey(key)) {
      const documentButtons = PRINTABLE_DOCUMENT_KEYS.has(key)
        ? `<button class="btn-secondary btn-sm print-doc-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Print</button>
           <button class="btn-secondary btn-sm download-doc-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Download</button>`
        : "";
      const notificationButtons = NOTIFICATION_DOCUMENT_KEYS.has(key)
        ? `<button class="btn-secondary btn-sm copy-notification-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Copy Msg</button>
           <button class="btn-secondary btn-sm whatsapp-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">WhatsApp</button>`
        : "";
      tr.innerHTML = `
        ${cellsHTML}
        <td class="text-right" style="white-space: nowrap;">
          ${documentButtons}
          ${notificationButtons}
          <button class="btn-secondary btn-sm edit-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Edit</button>
          <button class="btn-danger btn-sm delete-btn" style="padding: 0.25rem 0.5rem;">Delete</button>
        </td>
      `;
      tr.querySelector(".edit-btn").addEventListener("click", () => loadRecordForEdit(key, row.id));
      tr.querySelector(".delete-btn").addEventListener("click", () => deleteRecord(key, row.id));
      tr.querySelector(".print-doc-btn")?.addEventListener("click", () => printDocument(key, row.id));
      tr.querySelector(".download-doc-btn")?.addEventListener("click", () => downloadDocumentHtml(key, row.id));
      tr.querySelector(".copy-notification-btn")?.addEventListener("click", () => copyNotificationMessage(key, row.id));
      tr.querySelector(".whatsapp-btn")?.addEventListener("click", () => openWhatsAppNotification(key, row.id));
    } else {
      tr.innerHTML = `
        ${cellsHTML}
        <td class="text-right" style="white-space: nowrap; color: var(--text-muted);">Read only</td>
      `;
    }

    tbody.appendChild(tr);
  });
}

function initOrderManagementUi() {
  const openBtn = document.getElementById("open-order-modal-btn");
  const modal = document.getElementById("order-modal");
  const closeButtons = ["close-order-modal-btn", "cancel-order-modal-btn"].map((id) => document.getElementById(id)).filter(Boolean);
  openBtn?.addEventListener("click", () => openOrderModal());
  closeButtons.forEach((button) => button.addEventListener("click", closeOrderModal));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeOrderModal();
  });

  document.querySelectorAll(".order-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeOrderView = button.dataset.orderTab || "pending";
      activeDueFilter = "all";
      history.pushState({ section: "orders", orderView: activeOrderView }, "", `#orders-${activeOrderView}`);
      renderOrdersManagement();
    });
  });
  document.querySelectorAll(".due-filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeDueFilter = button.dataset.dueFilter || "all";
      renderOrdersManagement();
    });
  });
  document.getElementById("orders-select-all")?.addEventListener("change", (event) => {
    document.querySelectorAll("#orders-table-body .order-row-select").forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
    updateOrderBulkActions();
  });
  document.getElementById("orders-table-body")?.addEventListener("change", (event) => {
    if (event.target.matches(".order-row-select")) updateOrderBulkActions();
  });
  document.getElementById("bulk-restore-orders")?.addEventListener("click", () => bulkRecycleOrders("restore"));
  document.getElementById("bulk-permanent-delete-orders")?.addEventListener("click", () => bulkRecycleOrders("permanent-delete"));
  ["orders-search", "orders-from-date", "orders-to-date"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderOrdersManagement);
  });
  document.getElementById("add-order-item-btn")?.addEventListener("click", () => {
    addOrderItemRow();
    updateOrderTotals();
  });
  document.getElementById("order-items-container")?.addEventListener("input", handleOrderItemChange);
  document.getElementById("order-items-container")?.addEventListener("change", handleOrderItemChange);
  document.getElementById("order-items-container")?.addEventListener("click", (event) => {
    if (!event.target.closest(".remove-order-item-btn")) return;
    const rows = getOrderItemRows();
    if (rows.length <= 1) {
      showToast("At least one order item is required.", "info");
      return;
    }
    event.target.closest("[data-order-item-row]")?.remove();
    updateOrderTotals();
  });
  document.getElementById("orders-table-body")?.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const id = target.dataset.orderEdit || target.dataset.orderDelete || target.dataset.orderLabel || target.dataset.orderBill || target.dataset.orderCopy || target.dataset.orderWhatsapp || target.dataset.orderPayment || target.dataset.orderStatusUpdate || target.dataset.orderRestore || target.dataset.orderPermanentDelete || target.dataset.orderHistory;
    if (!id) return;
    if (target.dataset.orderEdit) {
      openOrderModal();
      loadRecordForEdit(KEYS.orders, id);
    }
    if (target.dataset.orderDelete) softDeleteOrder(id);
    if (target.dataset.orderLabel) printOrderLabel(id);
    if (target.dataset.orderBill) printDocument(KEYS.orders, id);
    if (target.dataset.orderCopy) copyNotificationMessage(KEYS.orders, id);
    if (target.dataset.orderWhatsapp) openWhatsAppNotification(KEYS.orders, id);
    if (target.dataset.orderPayment) {
      openOrderPaymentModal(id);
    }
    if (target.dataset.orderStatusUpdate) updateOrderStatusQuick(id);
    if (target.dataset.orderRestore) restoreOrder(id);
    if (target.dataset.orderPermanentDelete) permanentDeleteOrder(id);
    if (target.dataset.orderHistory) showOrderHistory(id);
  });

  ["ord-delivery", "ord-paid"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateOrderTotals);
    document.getElementById(id)?.addEventListener("change", updateOrderTotals);
  });
  ["ord-phone", "ord-customer"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", autofillOrderCustomer);
  });
  initOrderPaymentModal();
}

function openOrderModal() {
  const modal = document.getElementById("order-modal");
  const form = document.getElementById("orders-form");
  if (!modal) return;
  form?.reset();
  currentEditId = null;
  setValue("ord-date", new Date().toISOString().slice(0, 10));
  setOrderItems([{ qty: 1, priceType: "with-gst" }]);
  updateOrderTotals();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

function initOrderPaymentModal() {
  const modal = document.getElementById("order-payment-modal");
  ["close-order-payment-modal-btn", "cancel-order-payment-modal-btn"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", closeOrderPaymentModal);
  });
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeOrderPaymentModal();
  });
  ["pay-paid-amount", "pay-total"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updatePaymentModalTotals);
  });
  document.getElementById("order-payment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = getValue("pay-order-id");
    const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
    if (!order) return;
    const paidAmount = getNumber("pay-paid-amount");
    const totalPayable = getNumberFromValue(order.totalPayable);
    const updatedOrder = {
      ...order,
      paidAmount,
      balanceDue: Math.max(totalPayable - paidAmount, 0),
      advanceCredit: Math.max(paidAmount - totalPayable, 0),
      paymentMode: getValue("pay-mode"),
      paymentStatus: getValue("pay-status")
    };
    await saveOrderWorkflowUpdate(id, updatedOrder, order, "Payment updated.");
    closeOrderPaymentModal();
  });
}

function openOrderPaymentModal(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  const modal = document.getElementById("order-payment-modal");
  if (!order || !modal) return;
  setValue("pay-order-id", id);
  setValue("pay-total", getNumberFromValue(order.totalPayable).toFixed(2));
  setValue("pay-current-paid", getNumberFromValue(order.paidAmount).toFixed(2));
  setValue("pay-paid-amount", getNumberFromValue(order.paidAmount).toFixed(2));
  setValue("pay-mode", order.paymentMode || "Cash");
  setValue("pay-status", order.paymentStatus || "Pending");
  updatePaymentModalTotals();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeOrderPaymentModal() {
  const modal = document.getElementById("order-payment-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

function updatePaymentModalTotals() {
  const total = getNumber("pay-total");
  const paid = getNumber("pay-paid-amount");
  const balance = Math.max(total - paid, 0);
  const credit = Math.max(paid - total, 0);
  setValue("pay-balance", balance.toFixed(2));
  const status = document.getElementById("pay-status");
  if (status) status.value = credit > 0 ? "Advance Credit" : paid <= 0 ? "Pending" : balance <= 0 ? "Paid" : "Partial";
  const note = document.getElementById("pay-credit-note");
  if (note) {
    note.hidden = credit <= 0;
    note.textContent = credit > 0 ? `Extra payment ${formatCurrency(credit)} will be saved as party advance credit.` : "";
  }
}

function handleOrderItemChange(event) {
  const row = event.target.closest("[data-order-item-row]");
  if (!row) return;
  if (event.target.matches(".order-product, .order-price-type, .order-qty")) {
    calculateOrderItemAmount(row);
  }
  updateOrderStockAvailability(row);
  updateOrderTotals();
}

function getOrderItemRows() {
  return [...document.querySelectorAll("#order-items-container [data-order-item-row]")];
}

function addOrderItemRow(item = {}) {
  const container = document.getElementById("order-items-container");
  const template = document.getElementById("order-item-template");
  if (!container || !template) return null;

  const row = template.content.firstElementChild.cloneNode(true);
  container.appendChild(row);
  populateOrderProductOptions(row.querySelector(".order-product"), item.name || item.product || "");
  row.querySelector(".order-price-type").value = item.priceType || "with-gst";
  row.querySelector(".order-qty").value = item.qty || item.quantity || 1;
  row.querySelector(".order-amount").value = getNumberFromValue(item.amount).toFixed(2);
  calculateOrderItemAmount(row, Boolean(item.amount));
  updateOrderStockAvailability(row);
  return row;
}

function setOrderItems(items = []) {
  const container = document.getElementById("order-items-container");
  if (!container) return;
  container.innerHTML = "";
  const normalizedItems = items.length ? items : [{ qty: 1, priceType: "with-gst" }];
  normalizedItems.forEach((item) => addOrderItemRow(item));
}

function populateOrderProductOptions(select, selectedValue = "") {
  if (!select) return;
  const products = getStoredRecords(KEYS.products);
  select.innerHTML = `<option value="">-- Select Product --</option>`;
  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.name || product.id;
    option.textContent = product.name || product.id;
    option.dataset.salePrice = product.salePrice || product.mrp || 0;
    option.dataset.mrp = product.mrp || product.salePrice || 0;
    option.dataset.gstRate = product.gstRate || appSettings.modules?.orders?.gstRate || 0;
    option.dataset.stock = product.availableStock ?? Math.max(getNumberFromValue(product.currentStock || product.stock) - getNumberFromValue(product.reservedStock), 0);
    option.dataset.reservedStock = product.reservedStock || 0;
    option.dataset.unit = product.unit || "";
    select.appendChild(option);
  });
  if (selectedValue && ![...select.options].some((option) => option.value === selectedValue)) {
    const option = document.createElement("option");
    option.value = selectedValue;
    option.textContent = selectedValue;
    select.appendChild(option);
  }
  select.value = selectedValue;
}

function calculateOrderItemAmount(row, preserveCustomAmount = false) {
  const productSelect = row.querySelector(".order-product");
  const selectedOption = productSelect?.selectedOptions?.[0];
  const priceType = row.querySelector(".order-price-type")?.value || "with-gst";
  const qty = Math.max(getNumberFromValue(row.querySelector(".order-qty")?.value), 1);
  const basePrice = getNumberFromValue(selectedOption?.dataset.salePrice);
  const gstRate = getNumberFromValue(selectedOption?.dataset.gstRate);
  const amountInput = row.querySelector(".order-amount");

  if (priceType !== "custom" && !preserveCustomAmount) {
    let unitAmount = basePrice;
    if (priceType === "promotion") unitAmount = 0;
    if (priceType === "without-gst") unitAmount = gstRate ? basePrice / (1 + gstRate / 100) : basePrice;
    if (amountInput) amountInput.value = (unitAmount * qty).toFixed(2);
  }
}

function updateOrderStockAvailability(row) {
  const selectedOption = row.querySelector(".order-product")?.selectedOptions?.[0];
  const stockEl = row.querySelector(".stock-availability");
  const qty = Math.max(getNumberFromValue(row.querySelector(".order-qty")?.value), 0);
  const stock = getNumberFromValue(selectedOption?.dataset.stock);
  const reservedStock = getNumberFromValue(selectedOption?.dataset.reservedStock);
  const unit = selectedOption?.dataset.unit || "";
  if (!stockEl) return;
  stockEl.textContent = selectedOption?.value ? `Available: ${stock} ${unit}${reservedStock ? ` • Reserved: ${reservedStock}` : ""}` : "Stock: -";
  stockEl.classList.toggle("low-stock", Boolean(selectedOption?.value) && qty > stock);
}

function getOrderItemsFromForm() {
  return getOrderItemRows()
    .map((row) => {
      const productSelect = row.querySelector(".order-product");
      const selectedOption = productSelect?.selectedOptions?.[0];
      const qty = Math.max(getNumberFromValue(row.querySelector(".order-qty")?.value), 0);
      const amount = getNumberFromValue(row.querySelector(".order-amount")?.value);
      return {
        name: productSelect?.value || "",
        product: productSelect?.value || "",
        priceType: row.querySelector(".order-price-type")?.value || "with-gst",
        qty,
        amount,
        stockAvailable: getNumberFromValue(selectedOption?.dataset.stock),
        unit: selectedOption?.dataset.unit || ""
      };
    })
    .filter((item) => item.name && item.qty > 0);
}

function updateOrderTotals() {
  const amount = getOrderItemsFromForm().reduce((sum, item) => sum + getNumberFromValue(item.amount), 0);

  const delivery = getNumber("ord-delivery");
  const paid = getNumber("ord-paid");
  const total = Math.max(amount + delivery, 0);
  const balance = Math.max(total - paid, 0);
  const credit = Math.max(paid - total, 0);
  setValue("ord-payable", total.toFixed(2));
  const paymentStatus = document.getElementById("ord-pstatus");
  if (paymentStatus) {
    paymentStatus.value = credit > 0 ? "Advance Credit" : paid <= 0 ? "Pending" : balance <= 0 ? "Paid" : "Partial";
  }
  const creditNote = document.getElementById("order-credit-note");
  if (creditNote) {
    creditNote.hidden = credit <= 0;
    creditNote.textContent = credit > 0 ? `Extra payment ${formatCurrency(credit)} will be saved as this party/customer advance credit.` : "";
  }
}

function autofillOrderCustomer(event) {
  const value = (event.target.value || "").trim().toLowerCase();
  if (value.length < 3) return;
  const customers = getStoredRecords(KEYS.customers);
  const orders = getStoredRecords(KEYS.orders);
  const match = customers.find((customer) =>
    [customer.phone, customer.whatsapp, customer.name].some((field) => String(field || "").toLowerCase().includes(value))
  ) || orders.find((order) =>
    [order.phone, order.customer, order.customerName].some((field) => String(field || "").toLowerCase().includes(value))
  );
  if (!match) return;
  setValue("ord-customer", match.name || match.customer || match.customerName);
  setValue("ord-phone", match.phone || match.whatsapp);
  setValue("ord-gst", match.gst || match.gstNumber);
  setValue("ord-shop", match.shopName || match.place || "");
  setValue("ord-pin", match.pin || match.pincode || "");
  setValue("ord-address", match.address || "");
}

function renderOrdersManagement() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  document.querySelectorAll(".order-tab").forEach((button) => button.classList.toggle("active", button.dataset.orderTab === activeOrderView));
  document.querySelectorAll(".due-filter").forEach((button) => button.classList.toggle("active", button.dataset.dueFilter === activeDueFilter));
  const dueFilters = document.getElementById("order-payment-due-filters");
  if (dueFilters) dueFilters.hidden = activeOrderView !== "payment-due";
  const orderTabs = document.querySelector(".order-status-tabs");
  const standaloneViews = ["payment-due", "returns", "cancelled", "recycle-bin"];
  if (orderTabs) orderTabs.hidden = standaloneViews.includes(activeOrderView);
  const selectAll = document.getElementById("orders-select-all");
  if (selectAll) selectAll.checked = false;
  updateOrderBulkActions();

  const search = getValue("orders-search").toLowerCase();
  const fromDate = getValue("orders-from-date");
  const toDate = getValue("orders-to-date");
  const records = getStoredRecords(KEYS.orders).filter((order) => {
    const status = normalizeOrderStatus(order.orderStatus);
    const balance = getOrderBalance(order);
    const haystack = [order.customer, order.customerName, order.phone, order.product, order.shopName, renderOrderItems(order)].join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (fromDate && (order.date || "") < fromDate) return false;
    if (toDate && (order.date || "") > toDate) return false;
    if (activeOrderView === "pending" && status !== "pending") return false;
    if (activeOrderView === "processing" && status !== "processing") return false;
    if (activeOrderView === "shipped" && status !== "shipped") return false;
    if (activeOrderView === "delivered" && status !== "delivered") return false;
    if (activeOrderView === "payment-due") {
      if (balance <= 0) return false;
      if (activeDueFilter !== "all" && status !== activeDueFilter) return false;
    }
    if (activeOrderView === "promotions" && !isPromotionOrder(order)) return false;
    if (activeOrderView === "returns" && status !== "returned" && !order.isReturned) return false;
    if (activeOrderView === "cancelled" && status !== "cancelled" && !order.isCancelled) return false;
    if (activeOrderView === "recycle-bin" && !order.deletedAt) return false;
    if (activeOrderView !== "recycle-bin" && order.deletedAt) return false;
    return true;
  });

  tbody.innerHTML = "";
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--text-muted);">No Firebase orders found for this filter.</td></tr>`;
    return;
  }

  records.forEach((order) => {
    const paid = getNumberFromValue(order.paidAmount);
    const balance = getOrderBalance(order);
    const expense = getNumberFromValue(order.deliveryCharge || order.expenseTotal);
    const total = getNumberFromValue(order.totalPayable);
    const tr = document.createElement("tr");
    tr.dataset.id = order.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="order-row-select" value="${order.id}" aria-label="Select order ${escapeHtml(order.id)}"></td>
      <td><strong>${formatDate(order.date)}</strong><br><small>${order.source || "Direct"}</small></td>
      <td class="order-contact"><strong>${order.customer || order.customerName || "-"}</strong>${order.phone || ""}<br><small>PIN: ${order.pincode || order.pin || "-"}</small></td>
      <td>${renderOrderItems(order)}</td>
      <td><span class="badge ${getOrderStatusBadge(order.orderStatus)}">${order.orderStatus || "Pending"}</span></td>
      <td><div class="order-money-lines"><div><span>Total</span><strong>${formatCurrency(expense)}</strong></div><div class="paid"><span>Paid</span><strong>${formatCurrency(0)}</strong></div><div class="balance"><span>Balance</span><strong>${formatCurrency(expense)}</strong></div></div></td>
      <td><div class="order-money-lines"><div><span>Total</span><strong>${formatCurrency(total)}</strong></div><div class="paid"><span>Paid</span><strong>${formatCurrency(paid)}</strong></div><div class="balance"><span>Balance</span><strong>${formatCurrency(balance)}</strong></div></div></td>
      <td>${renderOrderActions(order)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderOrderItems(order) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.map((item) => `${item.name || item.product || "Item"} (${item.qty || item.quantity || 1})`).join("<br>");
  }
  return `${order.product || "-"} (${order.qty || 1})`;
}

function renderOrderActions(order) {
  if (!isWritableKey(KEYS.orders)) return `<span style="color: var(--text-muted);">Read only</span>`;
  if (order.deletedAt) {
    return `<div class="order-recycle-actions">
      <button class="btn-secondary btn-sm icon-action" type="button" data-order-restore="${order.id}" title="Restore">${SVG_ICONS.return}<span>Restore</span></button>
      <button class="btn-danger btn-sm icon-action" type="button" data-order-permanent-delete="${order.id}" title="Permanent Delete">${SVG_ICONS.trash}<span>Delete</span></button>
    </div>`;
  }
  const historyButton = ["returned", "cancelled"].includes(normalizeOrderStatus(order.orderStatus))
    ? `<button class="btn-secondary btn-sm icon-action" type="button" data-order-history="${order.id}" title="History">${SVG_ICONS.report}<span>History</span></button>`
    : "";
  return `<div class="order-actions">
    <div class="order-status-control">
      <select class="form-control" data-order-status-select="${order.id}">
        ${["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"].map((status) => `<option value="${status}" ${normalizeOrderStatus(order.orderStatus) === normalizeOrderStatus(status) ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <button class="btn-secondary btn-sm icon-action" type="button" data-order-status-update="${order.id}" title="Set Status">${SVG_ICONS.settings}<span>Set</span></button>
    </div>
    <button class="btn-secondary btn-sm icon-action" type="button" data-order-label="${order.id}" title="Label">${SVG_ICONS.tag}<span>Label</span></button>
    <button class="btn-secondary btn-sm icon-action print-doc-btn" type="button" data-order-bill="${order.id}" title="Bill">${SVG_ICONS.invoice}<span>Bill</span></button>
    <button class="btn-secondary btn-sm icon-action copy-notification-btn" type="button" data-order-copy="${order.id}" title="Copy Message">${SVG_ICONS.orders}<span>Copy</span></button>
    <button class="btn-secondary btn-sm icon-action whatsapp-btn" type="button" data-order-whatsapp="${order.id}" title="WhatsApp">${SVG_ICONS.delivery}<span>WhatsApp</span></button>
    ${historyButton}
    <button class="btn-secondary btn-sm icon-action edit-btn" type="button" data-order-edit="${order.id}" title="Update">${SVG_ICONS.plus}<span>Update</span></button>
    <button class="btn-primary btn-sm icon-action" type="button" data-order-payment="${order.id}" title="Payment">${SVG_ICONS.payment}<span>Pay</span></button>
    <button class="btn-danger btn-sm icon-action delete-btn" type="button" data-order-delete="${order.id}" title="Delete">${SVG_ICONS.trash}<span>Delete</span></button>
  </div>`;
}

async function updateOrderStatusQuick(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  const statusSelect = document.querySelector(`[data-order-status-select="${id}"]`);
  if (!order || !statusSelect) return;
  const updatedOrder = {
    ...order,
    orderStatus: statusSelect.value,
    isCancelled: normalizeOrderStatus(statusSelect.value) === "cancelled",
    isReturned: normalizeOrderStatus(statusSelect.value) === "returned"
  };
  await saveOrderWorkflowUpdate(id, updatedOrder, order, "Order status updated.");
}

async function softDeleteOrder(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  if (!order || !confirm("Move this order to Recycle Bin? Stock reservations/deductions will be reversed.")) return;
  const deletedOrder = {
    ...order,
    deletedAt: new Date().toISOString(),
    deletedReason: "Moved to recycle bin"
  };
  await saveOrderWorkflowUpdate(id, deletedOrder, order, "Order moved to Recycle Bin.", { skipApply: true });
}

async function restoreOrder(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  if (!order) return;
  const restoredOrder = {
    ...order,
    deletedAt: null,
    deletedReason: null
  };
  await saveOrderWorkflowUpdate(id, restoredOrder, null, "Order restored from Recycle Bin.");
}

async function permanentDeleteOrder(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  if (!order || !confirm("Permanently delete this order? This cannot be undone.")) return;
  try {
    if (!order.deletedAt) {
      await reconcileOrderInventoryAndLedger(null, { id, previous: order });
    }
    await deleteCollectionRecord(COLLECTIONS.orders, id);
    showToast("Order permanently deleted.", "success");
    await refreshActiveData();
  } catch (err) {
    console.error("Permanent order delete failed", err);
    showToast(getFirebaseErrorMessage(err, "Unable to permanently delete order."), "error");
  }
}

function getSelectedOrderIds() {
  return [...document.querySelectorAll("#orders-table-body .order-row-select:checked")].map((checkbox) => checkbox.value).filter(Boolean);
}

function updateOrderBulkActions() {
  const bar = document.getElementById("order-bulk-actions");
  const countEl = document.getElementById("selected-orders-count");
  const ids = getSelectedOrderIds();
  if (countEl) countEl.textContent = String(ids.length);
  if (bar) bar.hidden = !(activeOrderView === "recycle-bin" && ids.length > 0);
}

async function bulkRecycleOrders(action) {
  const ids = getSelectedOrderIds();
  if (!ids.length) return;
  const label = action === "restore" ? "restore" : "permanently delete";
  if (!confirm(`Do you want to ${label} ${ids.length} selected order(s)?`)) return;
  for (const id of ids) {
    if (action === "restore") {
      const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
      if (order) {
        const restoredOrder = { ...order, deletedAt: null, deletedReason: null };
        await saveOrderWorkflowUpdate(id, restoredOrder, null, "Order restored from Recycle Bin.");
      }
    } else {
      const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
      if (order?.deletedAt) await deleteCollectionRecord(COLLECTIONS.orders, id);
    }
  }
  showToast(`Bulk ${label} completed.`, "success");
  await refreshActiveData();
}

function showOrderHistory(id) {
  const order = getStoredRecords(KEYS.orders).find((record) => record.id === id);
  if (!order) return;
  const history = Array.isArray(order.history) ? order.history : [];
  const derived = [
    order.createdAt ? `Created: ${formatDate(order.createdAt)} by ${order.createdBy || "admin"}` : "",
    order.updatedAt ? `Updated: ${formatDate(order.updatedAt)} by ${order.updatedBy || "admin"}` : "",
    order.orderStatus ? `Current status: ${order.orderStatus}` : "",
    order.paymentStatus ? `Payment: ${order.paymentStatus} / Due ${formatCurrency(getOrderBalance(order))}` : "",
    order.deletedAt ? `Moved to Recycle Bin: ${formatDate(order.deletedAt)}` : ""
  ].filter(Boolean);
  const lines = history.length
    ? history.map((item, index) => `${index + 1}. ${item.date || item.createdAt || ""} ${item.action || item.status || ""} ${item.note || ""}`.trim())
    : derived;
  alert(lines.length ? lines.join("\n") : "No order history has been recorded yet.");
}

async function saveOrderWorkflowUpdate(id, updatedOrder, previousOrder, successMessage, options = {}) {
  try {
    const payload = {
      ...updatedOrder,
      history: appendOrderHistory(previousOrder, updatedOrder, successMessage)
    };
    delete payload.id;
    await updateCollectionRecord(COLLECTIONS.orders, id, payload);
    await reconcileOrderInventoryAndLedger(options.skipApply ? null : updatedOrder, {
      id,
      previous: previousOrder,
      moduleName: "Order",
      amount: updatedOrder.paidAmount,
      direction: "in",
      reference: updatedOrder.customer
    });
    showToast(successMessage, "success");
    await refreshActiveData();
  } catch (err) {
    console.error("Order workflow update failed", err);
    showToast(getFirebaseErrorMessage(err, "Unable to update order workflow."), "error");
  }
}

function appendOrderHistory(previousOrder, updatedOrder, message) {
  const history = Array.isArray(previousOrder?.history) ? [...previousOrder.history] : Array.isArray(updatedOrder?.history) ? [...updatedOrder.history] : [];
  const previousStatus = previousOrder?.orderStatus || "";
  const nextStatus = updatedOrder?.orderStatus || "";
  const previousPaid = getNumberFromValue(previousOrder?.paidAmount);
  const nextPaid = getNumberFromValue(updatedOrder?.paidAmount);
  history.push({
    at: new Date().toISOString(),
    action: message,
    fromStatus: previousStatus,
    toStatus: nextStatus,
    paidAmount: nextPaid,
    note: previousStatus !== nextStatus
      ? `Status changed from ${previousStatus || "new"} to ${nextStatus || "unknown"}`
      : previousPaid !== nextPaid
        ? `Payment changed from ${formatCurrency(previousPaid)} to ${formatCurrency(nextPaid)}`
        : message
  });
  return history;
}

function getOrderStatusBadge(status) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return "badge-success";
  if (["cancelled", "returned"].includes(normalized)) return "badge-danger";
  if (normalized === "shipped") return "badge-info";
  return "badge-warning";
}

function normalizeOrderStatus(status = "") {
  const normalized = String(status || "pending").toLowerCase().replace(/\s+/g, "-");
  if (["new", "confirmed"].includes(normalized)) return "pending";
  if (["packed", "in-transit"].includes(normalized)) return "processing";
  if (normalized === "returned") return "returned";
  return normalized;
}

function isPromotionOrder(order) {
  return order.priceType === "promotion" || order.promotionApplied || getNumberFromValue(order.amount) === 0;
}

function getOrderBalance(order) {
  return Math.max(getNumberFromValue(order.totalPayable) - getNumberFromValue(order.paidAmount), 0);
}

async function ensureCustomerFromOrder(order) {
  const name = (order.customer || order.customerName || "").trim();
  const phone = (order.phone || "").trim();
  if (!name && !phone) return;
  const existing = getStoredRecords(KEYS.customers).find((customer) =>
    (phone && [customer.phone, customer.whatsapp].includes(phone)) ||
    (name && String(customer.name || "").toLowerCase() === name.toLowerCase())
  );
  const payload = {
    name: name || phone,
    phone,
    whatsapp: phone,
    place: order.shopName || order.landmark || "Order Customer",
    pin: order.pincode || order.pin || "",
    address: order.address || "",
    type: "Customer",
    gst: order.gstNumber || "",
    notes: `Auto-created/updated from order ${order.id || order.orderNumber || ""}`.trim()
  };
  if (existing) {
    await updateCollectionRecord(COLLECTIONS.customers, existing.id, { ...existing, ...payload });
  } else {
    await createCollectionRecord(COLLECTIONS.customers, payload);
  }
}


function initReportExportActions() {
  document.querySelectorAll("[data-report-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const reportType = button.dataset.reportExport;
      const format = button.dataset.exportFormat;
      if (format === "csv") exportReportCsv(reportType);
      if (format === "pdf") printReportPdf(reportType);
    });
  });
}

function getReportRows(reportType) {
  const sales = getStoredRecords(KEYS.sales);
  const purchases = getStoredRecords(KEYS.purchases);
  const expenses = getStoredRecords(KEYS.expenses);
  const income = getStoredRecords(KEYS.income);
  const inventory = getStoredRecords(KEYS.inventory);
  const investors = getStoredRecords(KEYS.investors);
  const sharing = getStoredRecords(KEYS.sharing);

  if (reportType === "profitLoss") {
    return [
      { metric: "Sales Revenue", amount: sumRecords(sales, "finalAmount") },
      { metric: "Other Income", amount: sumRecords(income, "amount") },
      { metric: "Purchases", amount: sumRecords(purchases, "totalAmount") },
      { metric: "Expenses", amount: sumRecords(expenses, "amount") },
      { metric: "Estimated Profit", amount: sumRecords(sales, "finalAmount") + sumRecords(income, "amount") - sumRecords(purchases, "totalAmount") - sumRecords(expenses, "amount") }
    ];
  }

  if (reportType === "investor") {
    return investors.map((investor) => ({
      investor: investor.name || investor.email || investor.id,
      capital: parseFloat(investor.amount || 0),
      share: parseFloat(investor.share || 0),
      paid: sharing.filter((row) => row.investor === investor.name || row.investorId === investor.id).filter((row) => row.status === "Paid").reduce((sum, row) => sum + parseFloat(row.amount || 0), 0),
      pending: sharing.filter((row) => row.investor === investor.name || row.investorId === investor.id).filter((row) => row.status !== "Paid").reduce((sum, row) => sum + parseFloat(row.amount || 0), 0)
    }));
  }

  if (reportType === "stock") {
    return inventory.map((item) => {
      const currentStock = parseFloat(item.currentStock ?? item.stockIn ?? 0);
      const rate = parseFloat(item.costPrice || item.rate || item.avgCost || 0);
      return { item: item.name || item.itemName || item.id, type: item.stockType || item.category || "-", stock: currentStock, unit: item.unit || "", valuation: currentStock * rate };
    });
  }

  if (reportType === "salesPurchase") {
    return [
      { metric: "Sales Count", value: sales.length },
      { metric: "Sales Total", value: sumRecords(sales, "finalAmount") },
      { metric: "Purchase Count", value: purchases.length },
      { metric: "Purchase Total", value: sumRecords(purchases, "totalAmount") },
      { metric: "Net Sales-Purchase", value: sumRecords(sales, "finalAmount") - sumRecords(purchases, "totalAmount") }
    ];
  }

  if (reportType === "gst") {
    const salesTaxable = sumTaxableEstimate(sales, "finalAmount");
    const purchaseTaxable = sumTaxableEstimate(purchases, "totalAmount");
    const outputGst = sumRecords(sales, "finalAmount") - salesTaxable;
    const inputGst = sumRecords(purchases, "totalAmount") - purchaseTaxable;
    return [
      { metric: "Sales Taxable Value", amount: salesTaxable },
      { metric: "Output GST", amount: outputGst },
      { metric: "Purchase Taxable Value", amount: purchaseTaxable },
      { metric: "Input GST", amount: inputGst },
      { metric: "Estimated GST Payable", amount: outputGst - inputGst }
    ];
  }

  return [];
}

function renderAdvancedReports() {
  const cards = document.getElementById("advanced-report-cards");
  if (cards) {
    const profit = getReportRows("profitLoss").find((row) => row.metric === "Estimated Profit")?.amount || 0;
    const stockValue = getReportRows("stock").reduce((sum, row) => sum + row.valuation, 0);
    const salesPurchase = getReportRows("salesPurchase");
    cards.innerHTML = reportCard("Profit / Loss", formatCurrency(profit), "Sales + income - purchases - expenses")
      + reportCard("Stock Valuation", formatCurrency(stockValue), "Current stock × available cost")
      + reportCard("Sales Total", formatCurrency(salesPurchase.find((row) => row.metric === "Sales Total")?.value || 0), "Firestore sales summary")
      + reportCard("Purchase Total", formatCurrency(salesPurchase.find((row) => row.metric === "Purchase Total")?.value || 0), "Firestore purchase summary");
  }
  renderReportTable("advanced-report-table", "profitLoss");
}

function renderGstReports() {
  const cards = document.getElementById("gst-report-cards");
  const rows = getReportRows("gst");
  if (cards) {
    cards.innerHTML = rows.map((row) => reportCard(row.metric, formatCurrency(row.amount), "Estimated from Firestore invoice totals")).join("");
  }
  renderReportTable("gst-report-table", "gst");
}

function renderReportTable(containerId, reportType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = getReportRows(reportType);
  if (!rows.length) {
    container.innerHTML = `<table><tbody><tr><td class="text-center">No Firestore report records found.</td></tr></tbody></table>`;
    return;
  }
  const headers = Object.keys(rows[0]);
  container.innerHTML = `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${formatReportCell(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function reportCard(title, value, footer) {
  return `<div class="dashboard-card"><div class="card-header">${escapeHtml(title)}</div><div class="card-value">${escapeHtml(value)}</div><div class="card-footer">${escapeHtml(footer)}</div></div>`;
}

function exportReportCsv(reportType) {
  const rows = getReportRows(reportType);
  if (!rows.length) {
    showToast("No Firestore report data available for export.", "info");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `${reportType}-firestore-report.csv`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function printReportPdf(reportType) {
  const rows = getReportRows(reportType);
  if (!rows.length) {
    showToast("No Firestore report data available for PDF.", "info");
    return;
  }
  const headers = Object.keys(rows[0]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${reportType} report</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#0f172a}h1{color:#0f766e}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f8fafc}</style></head><body><h1>${escapeHtml(reportType)} Firestore Report</h1><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${formatReportCell(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    showToast("Popup blocked. Please allow popups to print this report.", "error");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function formatReportCell(value) {
  if (typeof value === "number") return escapeHtml(Number.isInteger(value) ? value : value.toFixed(2));
  return escapeHtml(value ?? "-");
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function sumRecords(records, field) {
  return records.reduce((sum, row) => sum + parseFloat(row[field] || 0), 0);
}

function sumTaxableEstimate(records, amountField) {
  return records.reduce((sum, row) => {
    const amount = parseFloat(row[amountField] || 0);
    const gstRate = parseFloat(row.gstRate || row.taxRate || 18);
    return sum + (gstRate > 0 ? amount / (1 + gstRate / 100) : amount);
  }, 0);
}

async function getCompanyProfileForDocument() {
  try {
    return await loadCompanyProfile();
  } catch (err) {
    console.error("Unable to load company profile for printable document", err);
    showToast(getFirebaseErrorMessage(err, "Unable to load company profile for printable document."), "error");
    return {};
  }
}

function getNotificationTypeForKey(key) {
  if (key === KEYS.orders) return "orderConfirmation";
  if (key === KEYS.sales) return "invoiceShare";
  if (key === KEYS.delivery) return "deliveryTracking";
  return "message";
}

function getNotificationSectionForKey(key) {
  if (key === KEYS.orders) return "orders";
  if (key === KEYS.sales) return "sales";
  if (key === KEYS.delivery) return "delivery";
  return activeSectionId;
}

function getNotificationTemplate(sectionKey, templateType) {
  const rawTemplates = appSettings.modules?.[sectionKey]?.notificationTemplates || getDefaultNotificationTemplates(sectionKey);
  const templates = Object.fromEntries(rawTemplates
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      return separatorIndex === -1 ? ["message", line] : [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
    }));
  return templates[templateType] || templates.message || rawTemplates;
}

function getNotificationContext(key, record, profile = {}) {
  const meta = PRINTABLE_DOCUMENT_KEYS.has(key) ? getPrintableDocumentMeta(key) : null;
  const customer = getDocumentParty(key === KEYS.orders ? KEYS.delivery : key, record);
  const order = key === KEYS.delivery
    ? getStoredRecords(KEYS.orders).find((item) => item.id === record.orderId || item.orderId === record.orderId || item.customerName === record.customer)
    : null;
  const amount = record.totalPayable || record.finalAmount || record.charge || record.totalAmount || record.amount || 0;
  return {
    companyName: profile.companyName || "Lakfa ERP",
    customer: record.customerName || record.customer || customer.name || "Customer",
    phone: record.phone || record.customerPhone || customer.phone || order?.phone || "",
    product: record.product || order?.product || record.itemName || "",
    amount: formatCurrency(amount),
    paidAmount: formatCurrency(record.paidAmount || 0),
    balanceDue: formatCurrency(record.balanceDue ?? Math.max((record.totalPayable || 0) - (record.paidAmount || 0), 0)),
    status: record.orderStatus || record.paymentStatus || record.status || "",
    paymentStatus: record.paymentStatus || "",
    trackingId: record.trackingId || "",
    courier: record.partner || "",
    orderId: record.orderId || record.id || "",
    invoiceNumber: meta ? formatDocumentNumber(meta, record) : (record.invoice || record.id || ""),
    invoiceLink: window.location.href.split("#")[0] + (key === KEYS.sales ? "#sales" : key === KEYS.delivery ? "#delivery" : "#orders"),
    deliveryDate: record.deliveredDate || record.dispatchDate || ""
  };
}

function renderNotificationMessage(template, context) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token) => context[token] ?? "");
}

async function buildNotificationMessage(key, id) {
  const record = getStoredRecords(key).find((item) => item.id === id);
  if (!record) throw new Error("Unable to find this Firestore record for notification.");
  const profile = await getCompanyProfileForDocument();
  const sectionKey = getNotificationSectionForKey(key);
  const templateType = getNotificationTypeForKey(key);
  const template = getNotificationTemplate(sectionKey, templateType);
  return { message: renderNotificationMessage(template, getNotificationContext(key, record, profile)), context: getNotificationContext(key, record, profile) };
}

async function copyNotificationMessage(key, id) {
  try {
    const { message } = await buildNotificationMessage(key, id);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast("Notification message copied.", "success");
  } catch (err) {
    console.error("Unable to copy notification", err);
    showToast(err.message || "Unable to copy notification message.", "error");
  }
}

async function openWhatsAppNotification(key, id) {
  try {
    const { message, context } = await buildNotificationMessage(key, id);
    const phone = String(context.phone || "").replace(/\D/g, "");
    const baseUrl = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    window.open(`${baseUrl}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.error("Unable to open WhatsApp notification", err);
    showToast(err.message || "Unable to open WhatsApp message.", "error");
  }
}

function getPrintableDocumentMeta(key) {
  if (key === KEYS.sales) {
    return {
      title: "Tax Invoice",
      documentType: "Sales Invoice",
      moduleName: "sales",
      prefixFallback: "INV",
      numberLabel: "Invoice No",
      recordNumber: (record) => record.invoice || record.invoiceNumber || record.id,
      partyLabel: "Bill To",
      amountLabel: "Grand Total",
      amountField: "finalAmount",
      defaultGstRate: 18
    };
  }

  if (key === KEYS.purchases) {
    return {
      title: "Purchase Invoice",
      documentType: "Purchase Invoice",
      moduleName: "purchase",
      prefixFallback: "PUR",
      numberLabel: "Voucher No",
      recordNumber: (record) => record.invoice || record.invoiceNumber || record.id,
      partyLabel: "Supplier",
      amountLabel: "Grand Total",
      amountField: "totalAmount",
      defaultGstRate: 18
    };
  }

  if (key === KEYS.orders) {
    return {
      title: "Order Bill",
      documentType: "Customer Order Bill",
      moduleName: "orders",
      prefixFallback: "ORD",
      numberLabel: "Order No",
      recordNumber: (record) => record.orderNumber || record.id,
      partyLabel: "Bill / Ship To",
      amountLabel: "Total Payable",
      amountField: "totalPayable",
      defaultGstRate: 18
    };
  }

  return {
    title: "Delivery Note",
    documentType: "Delivery Note",
    moduleName: "delivery",
    prefixFallback: "DLV",
    numberLabel: "Delivery Note No",
    recordNumber: (record) => record.orderId || record.deliveryNumber || record.id,
    partyLabel: "Ship To",
    amountLabel: "Shipping Charge",
    amountField: "charge",
    defaultGstRate: 0
  };
}

function getPrintableLineItems(key, record, totals) {
  if (key === KEYS.sales) {
    return [{ item: record.product, hsn: record.hsn || record.hsnCode || "-", qty: record.qty, rate: record.rate, taxable: totals.taxableValue, total: totals.grandTotal }];
  }

  if (key === KEYS.purchases) {
    return [{ item: record.itemName || record.item, hsn: record.hsn || record.hsnCode || "-", qty: record.qty, rate: record.rate, taxable: totals.taxableValue, total: totals.grandTotal }];
  }

  if (key === KEYS.orders) {
    const items = Array.isArray(record.items) && record.items.length
      ? record.items
      : [{ name: record.product, qty: record.qty, amount: record.amount }];
    return items.map((item) => ({
      item: item.name || item.product || "-",
      hsn: item.hsn || item.hsnCode || "-",
      qty: item.qty || item.quantity || 1,
      rate: getNumberFromValue(item.qty || item.quantity) ? getNumberFromValue(item.amount) / getNumberFromValue(item.qty || item.quantity) : getNumberFromValue(item.amount),
      taxable: getNumberFromValue(item.amount),
      total: getNumberFromValue(item.amount)
    })).concat(getNumberFromValue(record.deliveryCharge) ? [{
      item: "Delivery / Packing Charge",
      hsn: "-",
      qty: 1,
      rate: getNumberFromValue(record.deliveryCharge),
      taxable: getNumberFromValue(record.deliveryCharge),
      total: getNumberFromValue(record.deliveryCharge)
    }] : []);
  }

  return [{ item: `Courier: ${record.partner || "-"}`, hsn: record.hsn || "-", qty: 1, rate: record.charge, taxable: totals.taxableValue, total: totals.grandTotal }];
}

function getPartyDetails(key, record) {
  const party = getDocumentParty(key, record);
  const details = [
    party.name,
    party.address,
    party.phone ? `Phone: ${party.phone}` : "",
    party.pincode ? `PIN: ${party.pincode}` : "",
    party.gst ? `GSTIN: ${party.gst}` : "",
    key === KEYS.orders && record.locationLink ? `Location: ${record.locationLink}` : "",
    key === KEYS.orders ? `Payment Due: ${formatCurrency(record.balanceDue ?? Math.max((record.totalPayable || 0) - (record.paidAmount || 0), 0))}` : "",
    key === KEYS.delivery && record.trackingId ? `Tracking: ${record.trackingId}` : "",
    key === KEYS.delivery && record.status ? `Status: ${record.status}` : "",
    key === KEYS.sales && record.notes ? `Notes: ${record.notes}` : "",
    key === KEYS.purchases && record.paymentMode ? `Payment: ${record.paymentMode}` : ""
  ];
  return details.filter(Boolean).map(escapeHtml).join("<br>");
}

function getDocumentParty(key, record) {
  if (key === KEYS.sales) {
    const customer = getStoredRecords(KEYS.customers).find((item) => item.name === record.customer || item.id === record.customerId) || {};
    return {
      name: record.customer || customer.name || "-",
      address: record.customerAddress || customer.address || customer.place || "",
      phone: record.customerPhone || customer.phone || "",
      gst: record.customerGst || record.customerGST || customer.gst || ""
    };
  }

  if (key === KEYS.purchases) {
    const supplier = getStoredRecords(KEYS.suppliers).find((item) => item.name === record.supplier || item.id === record.supplierId) || {};
    return {
      name: record.supplier || supplier.name || "-",
      address: record.supplierAddress || supplier.address || supplier.place || "",
      phone: record.supplierPhone || supplier.phone || "",
      gst: record.supplierGst || record.supplierGST || supplier.gst || ""
    };
  }

  return {
    name: record.customer || record.customerName || "-",
    address: record.address || record.deliveryAddress || "",
    phone: record.phone || record.customerPhone || "",
    gst: record.gstNumber || record.customerGst || record.customerGST || "",
    pincode: record.pincode || record.pin || ""
  };
}

function getModulePrintSettings(meta) {
  const moduleSettings = appSettings.modules?.[meta.moduleName] || appSettings.modules?.[meta.moduleName.replace("purchase", "purchases")] || {};
  return {
    prefix: moduleSettings.numberingPrefix || meta.prefixFallback,
    gstRate: parseFloat(moduleSettings.gstRate ?? moduleSettings.taxRate ?? meta.defaultGstRate),
    taxMode: moduleSettings.taxMode || "inclusive"
  };
}

function formatDocumentNumber(meta, record) {
  const settings = getModulePrintSettings(meta);
  const rawNumber = String(meta.recordNumber(record) || record.id || "document");
  if (rawNumber.toLowerCase().startsWith(settings.prefix.toLowerCase())) return rawNumber;
  return `${settings.prefix}-${rawNumber}`;
}

function calculateDocumentTotals(key, record, meta, profile = {}) {
  const settings = getModulePrintSettings(meta);
  const amount = parseFloat(record[meta.amountField] || 0);
  const discount = key === KEYS.sales ? parseFloat(record.discount || 0) : 0;
  const gstRate = Number.isFinite(settings.gstRate) ? Math.max(0, settings.gstRate) : 0;
  const taxMode = settings.taxMode;
  const taxableValue = gstRate > 0 && taxMode === "inclusive" ? amount / (1 + gstRate / 100) : amount;
  const taxAmount = gstRate > 0 ? (taxMode === "inclusive" ? amount - taxableValue : taxableValue * (gstRate / 100)) : 0;
  const interstate = isInterstateTransaction(record, profile);
  const cgst = interstate ? 0 : taxAmount / 2;
  const sgst = interstate ? 0 : taxAmount / 2;
  const igst = interstate ? taxAmount : 0;
  const grandTotal = taxMode === "exclusive" ? taxableValue + taxAmount : amount;

  return {
    discount,
    gstRate,
    taxableValue,
    cgst,
    sgst,
    igst,
    taxAmount,
    grandTotal,
    totalInWords: amountToIndianWords(Math.round(grandTotal))
  };
}

function isInterstateTransaction(record, profile = {}) {
  const placeOfSupply = String(record.placeOfSupply || record.supplyState || record.customerState || record.supplierState || "").trim().toLowerCase();
  if (!placeOfSupply) return false;
  const companyState = String(profile.state || appSettings.companyState || "").trim().toLowerCase();
  return Boolean(companyState && placeOfSupply !== companyState);
}

function buildPrintableDocumentHtml(key, record, profile = {}) {
  const meta = getPrintableDocumentMeta(key);
  const totals = calculateDocumentTotals(key, record, meta, profile);
  const lineItems = getPrintableLineItems(key, record, totals);
  const documentNumber = formatDocumentNumber(meta, record);
  const logo = profile.logoDataUrl ? `<img src="${profile.logoDataUrl}" alt="Company logo" class="brand-logo">` : "";
  const signature = profile.signatureDataUrl ? `<img src="${profile.signatureDataUrl}" alt="Signature" class="signature-img">` : "";
  const website = profile.website ? `<span>${escapeHtml(profile.website)}</span>` : "";
  const email = profile.email ? `<span>${escapeHtml(profile.email)}</span>` : "";
  const phone = profile.phone ? `<span>${escapeHtml(profile.phone)}</span>` : "";
  const gst = profile.gst ? `<span><strong>GSTIN:</strong> ${escapeHtml(profile.gst)}</span>` : "";
  const companyAddress = [profile.address, profile.state, profile.pincode].filter(Boolean).map(escapeHtml).join(", ");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(meta.title)} - ${escapeHtml(documentNumber)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 14mm; border: 1px solid #d1d5db; }
    .topbar { display: grid; grid-template-columns: 1fr auto; gap: 18px; border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
    .brand { display: flex; gap: 14px; align-items: flex-start; }
    .brand-logo { width: 90px; max-height: 72px; object-fit: contain; }
    .company-name { margin: 0; color: #0f766e; font-size: 25px; letter-spacing: 0.2px; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 6px; }
    .muted { color: #475569; font-size: 12px; line-height: 1.45; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0 0 8px; color: #0f172a; font-size: 22px; text-transform: uppercase; }
    .pill { display: inline-block; padding: 4px 9px; border-radius: 999px; background: #ccfbf1; color: #115e59; font-weight: 700; font-size: 11px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; min-height: 86px; }
    .box h2 { margin: 0 0 6px; font-size: 13px; color: #0f766e; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
    th { background: #f8fafc; color: #334155; text-transform: uppercase; font-size: 11px; }
    .text-right { text-align: right; }
    .summary { width: 42%; margin-left: auto; margin-top: 12px; }
    .summary td { padding: 7px 8px; }
    .grand td { background: #ecfdf5; color: #065f46; font-size: 13px; font-weight: 800; }
    .amount-words { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 12px; }
    .footer { display: grid; grid-template-columns: 1fr 180px; gap: 20px; margin-top: 28px; align-items: end; }
    .signature-img { max-width: 150px; max-height: 70px; object-fit: contain; display: block; margin: 0 0 8px auto; }
    .signature-box { text-align: right; min-height: 90px; }
    .terms { font-size: 11px; color: #64748b; }
    .print-actions-note { display: none; }
    @media print { body { background: #fff; } .sheet { width: auto; min-height: auto; border: 0; padding: 0; } }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="topbar">
      <div class="brand">
        ${logo}
        <div>
          <h1 class="company-name">${escapeHtml(profile.companyName || "Lakfa ERP")}</h1>
          <div class="muted">${companyAddress || "Company address"}</div>
          <div class="contact-row muted">${phone}${email}${website}${gst}</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>${escapeHtml(meta.title)}</h1>
        <span class="pill">${escapeHtml(meta.documentType)}</span>
        <div class="muted" style="margin-top: 8px;"><strong>${escapeHtml(meta.numberLabel)}:</strong> ${escapeHtml(documentNumber)}</div>
        <div class="muted"><strong>Date:</strong> ${escapeHtml(formatDate(record.date || record.dispatchDate || new Date().toISOString()))}</div>
      </div>
    </section>

    <section class="meta-grid">
      <div class="box">
        <h2>${escapeHtml(meta.partyLabel)}</h2>
        <div class="muted">${getPartyDetails(key, record) || "-"}</div>
      </div>
      <div class="box">
        <h2>Supply / Payment</h2>
        <div class="muted"><strong>Status:</strong> ${escapeHtml(record.paymentStatus || record.status || "-")}</div>
        <div class="muted"><strong>Mode:</strong> ${escapeHtml(record.paymentMode || record.partner || "-")}</div>
        <div class="muted"><strong>GST Rate:</strong> ${totals.gstRate}%</div>
      </div>
    </section>

    <table>
      <thead><tr><th>#</th><th>Item / Description</th><th>HSN/SAC</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Taxable Value</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${lineItems.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.item || "-")}</td><td>${escapeHtml(item.hsn || "-")}</td><td class="text-right">${escapeHtml(item.qty ?? "-")}</td><td class="text-right">${formatCurrency(item.rate || 0)}</td><td class="text-right">${formatCurrency(item.taxable || 0)}</td><td class="text-right">${formatCurrency(item.total || 0)}</td></tr>`).join("")}
      </tbody>
    </table>

    <table class="summary">
      <tbody>
        ${key === KEYS.sales ? `<tr><td>Discount</td><td class="text-right">${formatCurrency(totals.discount)}</td></tr>` : ""}
        <tr><td>Taxable Value</td><td class="text-right">${formatCurrency(totals.taxableValue)}</td></tr>
        <tr><td>CGST</td><td class="text-right">${formatCurrency(totals.cgst)}</td></tr>
        <tr><td>SGST</td><td class="text-right">${formatCurrency(totals.sgst)}</td></tr>
        <tr><td>IGST</td><td class="text-right">${formatCurrency(totals.igst)}</td></tr>
        <tr class="grand"><td>${escapeHtml(meta.amountLabel)}</td><td class="text-right">${formatCurrency(totals.grandTotal)}</td></tr>
      </tbody>
    </table>

    <div class="amount-words"><strong>Amount in words:</strong> ${escapeHtml(totals.totalInWords)}</div>

    <section class="footer">
      <div class="terms">
        <strong>Declaration:</strong> This document is generated from Firestore record ${escapeHtml(record.id || "-")} using the active company profile and app settings.
      </div>
      <div class="signature-box">${signature}<strong>Authorized Signatory</strong></div>
    </section>
  </main>
</body>
</html>`;
}

const INDIAN_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const INDIAN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function amountToIndianWords(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return "Zero Rupees Only";
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const hundred = Math.floor((amount % 1000) / 100);
  const rest = amount % 100;
  const parts = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(`${INDIAN_ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitWords(rest));
  return `${parts.join(" ")} Rupees Only`;
}

function twoDigitWords(value) {
  if (value < 20) return INDIAN_ONES[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return [INDIAN_TENS[tens], INDIAN_ONES[ones]].filter(Boolean).join(" ");
}

async function printDocument(key, id) {
  const record = getStoredRecords(key).find((item) => item.id === id);
  if (!record) {
    showToast("Unable to find this Firestore record for printing.", "error");
    return;
  }

  const profile = await getCompanyProfileForDocument();
  const html = buildPrintableDocumentHtml(key, record, profile);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    showToast("Popup blocked. Please allow popups to print this document.", "error");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function printOrderLabel(id) {
  const record = getStoredRecords(KEYS.orders).find((item) => item.id === id);
  if (!record) {
    showToast("Unable to find this Firestore order for label printing.", "error");
    return;
  }

  const profile = await getCompanyProfileForDocument();
  const items = getPrintableLineItems(KEYS.orders, record, { taxableValue: record.amount || 0, grandTotal: record.totalPayable || 0 })
    .filter((item) => item.item !== "Delivery / Packing Charge")
    .map((item) => `${item.item} (${item.qty})`)
    .join(", ");
  const logo = profile.logoDataUrl ? `<img src="${profile.logoDataUrl}" alt="Company logo">` : "";
  const paymentDue = getNumberFromValue(record.balanceDue ?? Math.max((record.totalPayable || 0) - (record.paidAmount || 0), 0));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Courier Label - ${escapeHtml(record.id || "Order")}</title>
  <style>
    @page { size: 100mm 150mm; margin: 6mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #0f172a; }
    .label { width: 100mm; min-height: 140mm; padding: 8mm; border: 2px solid #111827; }
    .brand { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; }
    .brand img { width: 44px; height: 44px; object-fit: contain; }
    .brand h1 { margin: 0; font-size: 17px; color: #0f766e; }
    .muted { color: #475569; font-size: 10px; }
    .block { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
    .block h2 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #475569; }
    .name { font-size: 18px; font-weight: 800; }
    .line { margin: 3px 0; font-size: 12px; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #fef3c7; color: #92400e; font-weight: 700; font-size: 11px; }
    .due { color: #b91c1c; font-weight: 800; }
    @media print { .label { border: 2px solid #111827; } }
  </style>
</head>
<body>
  <main class="label">
    <section class="brand">${logo}<div><h1>${escapeHtml(profile.companyName || "Lakfa ERP")}</h1><div class="muted">${escapeHtml(profile.phone || "")} ${profile.gst ? ` • GSTIN: ${escapeHtml(profile.gst)}` : ""}</div></div></section>
    <section class="block">
      <h2>Ship To</h2>
      <div class="name">${escapeHtml(record.customer || record.customerName || "Customer")}</div>
      <div class="line">Phone: ${escapeHtml(record.phone || "-")}</div>
      <div class="line">PIN: ${escapeHtml(record.pincode || record.pin || "-")}</div>
      <div class="line">${escapeHtml(record.address || "-")}</div>
      ${record.landmark ? `<div class="line">Landmark: ${escapeHtml(record.landmark)}</div>` : ""}
    </section>
    <section class="block">
      <h2>Order</h2>
      <div class="line"><strong>Order:</strong> ${escapeHtml(formatDocumentNumber(getPrintableDocumentMeta(KEYS.orders), record))}</div>
      <div class="line"><strong>Items:</strong> ${escapeHtml(items || record.product || "-")}</div>
      <div class="line"><strong>Total:</strong> ${formatCurrency(record.totalPayable || 0)}</div>
      <div class="line due"><strong>Payment Due:</strong> ${formatCurrency(paymentDue)}</div>
      <div class="line"><span class="status">${escapeHtml(record.orderStatus || "Pending")}</span></div>
    </section>
    <section class="block">
      <h2>From</h2>
      <div class="line"><strong>${escapeHtml(profile.companyName || "Lakfa ERP")}</strong></div>
      <div class="line">${escapeHtml([profile.address, profile.state, profile.pincode].filter(Boolean).join(", "))}</div>
      <div class="line">${escapeHtml(profile.email || "")}</div>
    </section>
  </main>
</body>
</html>`;
  const printWindow = window.open("", "_blank", "width=480,height=720");
  if (!printWindow) {
    showToast("Popup blocked. Please allow popups to print this label.", "error");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function downloadDocumentHtml(key, id) {
  const record = getStoredRecords(key).find((item) => item.id === id);
  if (!record) {
    showToast("Unable to find this Firestore record for download.", "error");
    return;
  }

  const profile = await getCompanyProfileForDocument();
  const html = buildPrintableDocumentHtml(key, record, profile);
  const meta = getPrintableDocumentMeta(key);
  const fileName = `${meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${formatDocumentNumber(meta, record).replace(/[^a-z0-9-]+/gi, "-")}.html`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Handle custom table loader for Cash Book (dynamic balance aggregation)
 */
function renderCashBookTable() {
  const tbody = document.getElementById("cashbook-table-body");
  if (!tbody) return;

  const records = getStoredRecords(KEYS.cashBook);
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No cash entries recorded.</td></tr>`;
    return;
  }

  records.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(row.date)}</td>
      <td><span class="badge ${row.type === 'Cash In' ? 'badge-success' : 'badge-danger'}">${row.type}</span></td>
      <td>${row.desc}</td>
      <td style="color: var(--success); font-weight: 500;">${row.cashIn > 0 ? '+' + formatCurrency(row.cashIn) : '-'}</td>
      <td style="color: var(--danger); font-weight: 500;">${row.cashOut > 0 ? '-' + formatCurrency(row.cashOut) : '-'}</td>
      <td><strong>${formatCurrency(row.balance)}</strong></td>
      <td>${row.ref || '-'}</td>
      <td class="text-right" style="white-space: nowrap;">
        <button class="btn-secondary btn-sm edit-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Edit</button>
        <button class="btn-danger btn-sm delete-btn" style="padding: 0.25rem 0.5rem;">Delete</button>
      </td>
    `;
    tr.querySelector(".edit-btn").addEventListener("click", () => loadRecordForEdit(KEYS.cashBook, row.id));
    tr.querySelector(".delete-btn").addEventListener("click", () => deleteRecord(KEYS.cashBook, row.id));

    tbody.appendChild(tr);
  });
}

/**
 * Handle custom table loader for Bank Book
 */
function renderBankBookTable() {
  const tbody = document.getElementById("bankbook-table-body");
  if (!tbody) return;

  const records = getStoredRecords(KEYS.bankBook);
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No bank entries recorded.</td></tr>`;
    return;
  }

  records.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(row.date)}</td>
      <td><strong>${row.bankName}</strong></td>
      <td><span class="badge ${row.type === 'Amount In' ? 'badge-success' : 'badge-danger'}">${row.type}</span></td>
      <td>${row.desc}</td>
      <td style="color: var(--success);">${row.amountIn > 0 ? '+' + formatCurrency(row.amountIn) : '-'}</td>
      <td style="color: var(--danger);">${row.amountOut > 0 ? '-' + formatCurrency(row.amountOut) : '-'}</td>
      <td><strong>${formatCurrency(row.balance)}</strong></td>
      <td>${row.refNum || '-'}</td>
      <td class="text-right" style="white-space: nowrap;">
        <button class="btn-secondary btn-sm edit-btn" style="padding: 0.25rem 0.5rem; margin-right: 4px;">Edit</button>
        <button class="btn-danger btn-sm delete-btn" style="padding: 0.25rem 0.5rem;">Delete</button>
      </td>
    `;
    tr.querySelector(".edit-btn").addEventListener("click", () => loadRecordForEdit(KEYS.bankBook, row.id));
    tr.querySelector(".delete-btn").addEventListener("click", () => deleteRecord(KEYS.bankBook, row.id));

    tbody.appendChild(tr);
  });
}

/**
 * Dynamic aggregates for simple Accounting summary card block
 */
function renderAccountingSummary() {
  const sales = getStoredRecords(KEYS.sales);
  const purchases = getStoredRecords(KEYS.purchases);
  const expenses = getStoredRecords(KEYS.expenses);
  const income = getStoredRecords(KEYS.income);
  const cash = getStoredRecords(KEYS.cashBook);
  const bank = getStoredRecords(KEYS.bankBook);

  const totIncome = income.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totExpense = expenses.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totSales = sales.reduce((sum, item) => sum + parseFloat(item.finalAmount || 0), 0);
  const totPurchase = purchases.reduce((sum, item) => sum + parseFloat(item.totalAmount || 0), 0);
  
  const cashBal = cash.length > 0 ? parseFloat(cash[cash.length - 1].balance || 0) : 0;
  const bankBal = bank.length > 0 ? parseFloat(bank[bank.length - 1].balance || 0) : 0;

  // Simple Profit Estimate: Income - Expenses (or Sales - Cost of Goods Sold / Purchases - Expenses)
  // For the simple mockup version, we'll use: Total Income - Total Expense
  const profitEstimate = totIncome - totExpense;
  
  // Pending sales and purchase payments
  const pendingSales = sales.filter(s => s.paymentStatus !== "Paid").reduce((sum, s) => sum + parseFloat(s.finalAmount || 0), 0);
  const pendingPurchases = purchases.filter(p => p.paymentStatus !== "Paid").reduce((sum, p) => sum + parseFloat(p.totalAmount || 0), 0);

  document.getElementById("acc-tot-income").textContent = formatCurrency(totIncome);
  document.getElementById("acc-tot-expense").textContent = formatCurrency(totExpense);
  document.getElementById("acc-tot-sales").textContent = formatCurrency(totSales);
  document.getElementById("acc-tot-purchase").textContent = formatCurrency(totPurchase);
  document.getElementById("acc-cash-bal").textContent = formatCurrency(cashBal);
  document.getElementById("acc-bank-bal").textContent = formatCurrency(bankBal);
  
  const profitEl = document.getElementById("acc-profit");
  profitEl.textContent = formatCurrency(profitEstimate);
  profitEl.style.color = profitEstimate >= 0 ? "var(--success)" : "var(--danger)";

  document.getElementById("acc-pending-in").textContent = formatCurrency(pendingSales);
  document.getElementById("acc-pending-out").textContent = formatCurrency(pendingPurchases);
}

/**
 * Handle form editing states
 */
function isWritableKey(key) {
  return WRITABLE_KEYS.has(key);
}

function initWritableFormListeners() {
  setupFirestoreForm({
    formId: "product-form",
    key: KEYS.products,
    submitButtonId: "product-submit-btn",
    validate: (data) => data.name && data.sku && data.unit,
    getData: () => ({
      name: getValue("prod-name"),
      sku: getValue("prod-sku"),
      category: getValue("prod-category"),
      unit: getValue("prod-unit"),
      mrp: getNumber("prod-mrp"),
      salePrice: getNumber("prod-saleprice"),
      costPrice: getNumber("prod-costprice"),
      openingStock: getNumber("prod-opening"),
      currentStock: getNumber("prod-current"),
      minimumStock: getNumber("prod-minimum"),
      status: getValue("prod-status")
    }),
    populate: (record) => {
      setValue("prod-name", record.name);
      setValue("prod-sku", record.sku);
      setValue("prod-category", record.category);
      setValue("prod-unit", record.unit);
      setValue("prod-mrp", record.mrp);
      setValue("prod-saleprice", record.salePrice);
      setValue("prod-costprice", record.costPrice);
      setValue("prod-opening", record.openingStock);
      setValue("prod-current", record.currentStock);
      setValue("prod-minimum", record.minimumStock);
      setValue("prod-status", record.status);
    }
  });

  setupFirestoreForm({
    formId: "customer-form",
    key: KEYS.customers,
    submitButtonId: "customer-submit-btn",
    validate: (data) => data.name && data.phone && data.place,
    getData: () => ({
      name: getValue("cust-name"),
      phone: getValue("cust-phone"),
      whatsapp: getValue("cust-whatsapp"),
      place: getValue("cust-place"),
      pin: getValue("cust-pin"),
      address: getValue("cust-address"),
      type: getValue("cust-type"),
      notes: getValue("cust-notes")
    }),
    populate: (record) => {
      setValue("cust-name", record.name);
      setValue("cust-phone", record.phone);
      setValue("cust-whatsapp", record.whatsapp);
      setValue("cust-place", record.place);
      setValue("cust-pin", record.pin);
      setValue("cust-address", record.address);
      setValue("cust-type", record.type);
      setValue("cust-notes", record.notes);
    }
  });

  setupFirestoreForm({
    formId: "supplier-form",
    key: KEYS.suppliers,
    submitButtonId: "supplier-submit-btn",
    validate: (data) => data.name && data.phone && data.place,
    getData: () => ({
      name: getValue("supp-name"),
      phone: getValue("supp-phone"),
      place: getValue("supp-place"),
      address: getValue("supp-address"),
      gst: getValue("supp-gst"),
      itemSupplied: getValue("supp-item"),
      terms: getValue("supp-terms"),
      notes: getValue("supp-notes")
    }),
    populate: (record) => {
      setValue("supp-name", record.name);
      setValue("supp-phone", record.phone);
      setValue("supp-place", record.place);
      setValue("supp-address", record.address);
      setValue("supp-gst", record.gst);
      setValue("supp-item", record.itemSupplied);
      setValue("supp-terms", record.terms);
      setValue("supp-notes", record.notes);
    }
  });

  setupFirestoreForm({
    formId: "investors-form",
    key: KEYS.investors,
    submitButtonId: "investors-submit-btn",
    validate: (data) => data.name && data.email && data.amount > 0,
    getData: () => ({
      name: getValue("inv-name"),
      phone: getValue("inv-phone"),
      email: getValue("inv-email"),
      address: getValue("inv-address"),
      amount: getNumber("inv-amount"),
      share: getNumber("inv-share"),
      date: getValue("inv-date"),
      status: getValue("inv-status"),
      notes: getValue("inv-notes")
    }),
    populate: (record) => {
      setValue("inv-name", record.name);
      setValue("inv-phone", record.phone);
      setValue("inv-email", record.email);
      setValue("inv-address", record.address);
      setValue("inv-amount", record.amount);
      setValue("inv-share", record.share);
      setValue("inv-date", record.date);
      setValue("inv-status", record.status);
      setValue("inv-notes", record.notes);
    }
  });

  setupFirestoreForm({
    formId: "purchase-form",
    key: KEYS.purchases,
    submitButtonId: "purchase-submit-btn",
    validate: (data) => data.date && data.invoice && data.supplier && data.item && data.qty > 0 && data.rate >= 0,
    getData: () => {
      const qty = getNumber("pur-qty");
      const rate = getNumber("pur-rate");
      return {
        date: getValue("pur-date"),
        invoice: getValue("pur-invoice"),
        supplier: getValue("pur-supplier"),
        item: getValue("pur-item"),
        qty,
        unit: getValue("pur-unit"),
        rate,
        totalAmount: qty * rate,
        paymentMode: getValue("pur-mode"),
        paymentStatus: getValue("pur-status"),
        notes: getValue("pur-notes")
      };
    },
    populate: populatePurchase,
    afterSave: async (data, meta) => {
      await reconcileStockAndLedger(data, { ...meta, moduleName: "Purchase", stockName: data.item, stockDelta: data.qty, amount: data.totalAmount, direction: "out", reference: data.invoice });
    }
  });

  setupFirestoreForm({
    formId: "inventory-form",
    key: KEYS.inventory,
    submitButtonId: "inventory-submit-btn",
    validate: (data) => data.name && data.category && data.unit && data.currentStock >= 0,
    getData: () => ({
      name: getValue("stk-name"),
      category: getValue("stk-category"),
      type: getValue("stk-type"),
      openingStock: getNumber("stk-opening"),
      stockIn: getNumber("stk-in"),
      stockOut: getNumber("stk-out"),
      currentStock: getNumber("stk-current"),
      unit: getValue("stk-unit"),
      minAlert: getNumber("stk-min"),
      lastUpdated: getValue("stk-date")
    }),
    populate: populateInventory
  });

  setupFirestoreForm({
    formId: "sales-form",
    key: KEYS.sales,
    submitButtonId: "sales-submit-btn",
    validate: (data) => data.date && data.customer && data.product && data.qty > 0 && data.rate >= 0,
    getData: () => {
      const qty = getNumber("sale-qty");
      const rate = getNumber("sale-rate");
      const totalAmount = qty * rate;
      const discount = getNumber("sale-discount");
      return {
        date: getValue("sale-date"),
        customer: getValue("sale-customer"),
        product: getValue("sale-product"),
        qty,
        rate,
        totalAmount,
        discount,
        finalAmount: Math.max(totalAmount - discount, 0),
        paymentMode: getValue("sale-mode"),
        paymentStatus: getValue("sale-status"),
        notes: getValue("sale-notes")
      };
    },
    populate: populateSales,
    afterSave: async (data, meta) => {
      await reconcileStockAndLedger(data, { ...meta, moduleName: "Sales", stockName: data.product, stockDelta: -data.qty, amount: data.finalAmount, direction: "in", reference: data.customer });
    }
  });

  setupFirestoreForm({
    formId: "orders-form",
    key: KEYS.orders,
    submitButtonId: "orders-submit-btn",
    validate: (data) => data.date && data.customer && data.phone && data.items.length > 0 && data.totalPayable >= 0,
    getData: () => {
      const items = getOrderItemsFromForm();
      const amount = items.reduce((sum, item) => sum + getNumberFromValue(item.amount), 0);
      const deliveryCharge = getNumber("ord-delivery");
      const paidAmount = getNumber("ord-paid");
      const totalPayable = amount + deliveryCharge;
      const balanceDue = Math.max(totalPayable - paidAmount, 0);
      const advanceCredit = Math.max(paidAmount - totalPayable, 0);
      return {
        date: getValue("ord-date"),
        source: getValue("ord-source"),
        customer: getValue("ord-customer"),
        customerName: getValue("ord-customer"),
        phone: getValue("ord-phone"),
        gstNumber: getValue("ord-gst"),
        shopName: getValue("ord-shop"),
        landmark: getValue("ord-landmark"),
        pincode: getValue("ord-pin"),
        locationLink: getValue("ord-location"),
        product: items.map((item) => item.name).join(", "),
        priceType: items.some((item) => item.priceType === "promotion") ? "promotion" : items[0]?.priceType || "with-gst",
        qty: items.reduce((sum, item) => sum + getNumberFromValue(item.qty), 0),
        amount,
        deliveryCharge,
        expenseTotal: deliveryCharge,
        totalPayable,
        paidAmount,
        balanceDue,
        advanceCredit,
        paymentStatus: getValue("ord-pstatus"),
        paymentMode: getValue("ord-payment-mode"),
        orderStatus: getValue("ord-ostatus"),
        address: getValue("ord-address"),
        notes: getValue("ord-notes"),
        items
      };
    },
    populate: populateOrders,
    afterSave: async (data, meta) => {
      await reconcileOrderInventoryAndLedger(data, { ...meta, moduleName: "Order", amount: data.paidAmount, direction: "in", reference: data.customer });
      await ensureCustomerFromOrder(data);
      if (data.advanceCredit > 0) {
        showToast(`Extra payment saved as party advance credit: ${formatCurrency(data.advanceCredit)}`, "info");
      }
      closeOrderModal();
    }
  });

  setupFirestoreForm({
    formId: "delivery-form",
    key: KEYS.delivery,
    submitButtonId: "delivery-submit-btn",
    validate: (data) => data.orderId && data.customer && data.charge >= 0 && data.dispatchDate,
    getData: () => ({
      orderId: getValue("dlv-order"),
      customer: getValue("dlv-customer"),
      partner: getValue("dlv-partner"),
      trackingId: getValue("dlv-tracking"),
      charge: getNumber("dlv-charge"),
      dispatchDate: getValue("dlv-dispatch"),
      status: getValue("dlv-status"),
      deliveredDate: getValue("dlv-delivered"),
      notes: getValue("dlv-notes")
    }),
    populate: populateDelivery
  });

  setupFirestoreForm({
    formId: "expenses-form",
    key: KEYS.expenses,
    submitButtonId: "expenses-submit-btn",
    validate: (data) => data.date && data.desc && data.amount > 0 && data.paidTo,
    getData: () => ({
      date: getValue("exp-date"),
      category: getValue("exp-cat"),
      desc: getValue("exp-desc"),
      amount: getNumber("exp-amount"),
      mode: getValue("exp-mode"),
      paidTo: getValue("exp-paid"),
      receipt: getValue("exp-receipt"),
      notes: getValue("exp-notes")
    }),
    populate: populateExpenses,
    afterSave: async (data, meta) => {
      await reconcileLedgerOnly(data, { ...meta, moduleName: "Expense", amount: data.amount, direction: "out", reference: data.receipt || data.paidTo });
    }
  });

  setupFirestoreForm({
    formId: "income-form",
    key: KEYS.income,
    submitButtonId: "income-submit-btn",
    validate: (data) => data.date && data.desc && data.amount > 0 && data.receivedFrom,
    getData: () => ({
      date: getValue("inc-date"),
      source: getValue("inc-source"),
      desc: getValue("inc-desc"),
      amount: getNumber("inc-amount"),
      mode: getValue("inc-mode"),
      receivedFrom: getValue("inc-received"),
      notes: getValue("inc-notes")
    }),
    populate: populateIncome,
    afterSave: async (data, meta) => {
      await reconcileLedgerOnly(data, { ...meta, moduleName: "Income", amount: data.amount, direction: "in", reference: data.receivedFrom });
    }
  });

  setupFirestoreForm({
    formId: "cashbook-form",
    key: KEYS.cashBook,
    submitButtonId: "cashbook-submit-btn",
    validate: (data) => data.date && data.desc && (data.cashIn > 0 || data.cashOut > 0),
    getData: () => {
      const type = getValue("cb-type");
      const amount = getNumber("cb-amount");
      return {
        date: getValue("cb-date"),
        type,
        desc: getValue("cb-desc"),
        cashIn: type === "Cash In" ? amount : 0,
        cashOut: type === "Cash Out" ? amount : 0,
        balance: getProjectedCashBalance(type === "Cash In" ? amount : -amount),
        ref: getValue("cb-ref")
      };
    },
    populate: populateCashBook,
    afterSave: async (data, meta) => {
      await reconcileLedgerBalances(KEYS.cashBook, data, meta);
    }
  });

  setupFirestoreForm({
    formId: "bankbook-form",
    key: KEYS.bankBook,
    submitButtonId: "bankbook-submit-btn",
    validate: (data) => data.date && data.bankName && data.desc && data.refNum && (data.amountIn > 0 || data.amountOut > 0),
    getData: () => {
      const type = getValue("bb-type");
      const amount = getNumber("bb-amount");
      return {
        date: getValue("bb-date"),
        bankName: getValue("bb-bank"),
        type,
        desc: getValue("bb-desc"),
        amountIn: type === "Amount In" ? amount : 0,
        amountOut: type === "Amount Out" ? amount : 0,
        balance: getProjectedBankBalance(type === "Amount In" ? amount : -amount),
        refNum: getValue("bb-ref")
      };
    },
    populate: populateBankBook,
    afterSave: async (data, meta) => {
      await reconcileLedgerBalances(KEYS.bankBook, data, meta);
    }
  });

  setupFirestoreForm({
    formId: "production-form",
    key: KEYS.production,
    submitButtonId: "production-submit-btn",
    validate: (data) => data.batch && data.date && data.productName && data.quantityProduced > 0 && data.batchCost >= 0,
    getData: () => ({
      batch: getValue("prod-batch"),
      date: getValue("prod-date"),
      productName: getValue("prod-pname"),
      rawMaterial: getValue("prod-raw"),
      quantityProduced: getNumber("prod-qty"),
      packingQty: getValue("prod-pack"),
      wastage: getValue("prod-waste"),
      batchCost: getNumber("prod-cost"),
      staff: getValue("prod-staff"),
      notes: getValue("prod-notes")
    }),
    populate: populateProduction,
    afterSave: async (data, meta) => {
      await reconcileProductionStock(data, meta);
    },
    beforeDelete: async (record) => {
      await reconcileProductionStock(null, { isDelete: true, previous: record });
    }
  });

  setupFirestoreForm({
    formId: "sharing-form",
    key: KEYS.sharing,
    submitButtonId: "sharing-submit-btn",
    validate: (data) => data.period && data.investor && data.share > 0 && data.totalProfit >= 0,
    getData: () => {
      const totalProfit = getNumber("shr-profit");
      const share = getNumber("shr-percentage");
      return {
        period: getValue("shr-period"),
        totalProfit,
        investor: getValue("shr-investor"),
        share,
        amount: (totalProfit * share) / 100,
        status: getValue("shr-status"),
        date: getValue("shr-date"),
        notes: getValue("shr-notes")
      };
    },
    populate: populateSharing,
    afterSave: async (data, meta) => {
      await reconcileProfitSharingLedger(data, meta);
    },
    beforeDelete: async (record) => {
      await reconcileProfitSharingLedger(null, { isDelete: true, previous: record });
    }
  });
}

function setupFirestoreForm(config) {
  const form = document.getElementById(config.formId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = config.getData();
    if (!config.validate(data)) {
      showToast("Please fill all required fields correctly.", "error");
      return;
    }

    const button = document.getElementById(config.submitButtonId);
    if (button) button.disabled = true;

    try {
      let savedId = currentEditId;
      const isUpdate = Boolean(currentEditId && activeSectionKey() === config.key);
      const previous = isUpdate ? getStoredRecords(config.key).find((item) => item.id === currentEditId) : null;
      if (isUpdate) {
        await updateCollectionRecord(COLLECTION_BY_KEY[config.key], currentEditId, data);
        showToast("Record updated in Firebase.", "success");
      } else {
        savedId = await createCollectionRecord(COLLECTION_BY_KEY[config.key], data);
        showToast("Record created in Firebase.", "success");
      }
      if (config.afterSave) {
        await config.afterSave(data, { id: savedId, isUpdate, previous });
      }
      currentEditId = null;
      form.reset();
      if (button) button.textContent = "Save Record";
      await refreshActiveData();
    } catch (err) {
      console.error("Firestore write failed", err);
      showToast(getFirebaseErrorMessage(err, "Firebase write failed."), "error");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function loadRecordForEdit(key, id) {
  if (!isWritableKey(key)) {
    showToast(READ_ONLY_MESSAGE, "info");
    return;
  }

  const record = getStoredRecords(key).find((item) => item.id === id);
  const config = getFormConfigForKey(key);
  if (!record || !config) return;

  currentEditId = id;
  config.populate(record);
  const button = document.getElementById(config.submitButtonId);
  if (button) button.textContent = "Update Record";
  showToast("Record loaded for editing.", "info");
}

async function deleteRecord(key, id) {
  if (!isWritableKey(key)) {
    showToast(READ_ONLY_MESSAGE, "info");
    return;
  }

  if (!confirm("Delete this Firebase record?")) return;

  try {
    const config = getFormConfigForKey(key);
    const record = getStoredRecords(key).find((item) => item.id === id);
    if (config?.beforeDelete && record) {
      await config.beforeDelete(record);
    }
    await deleteCollectionRecord(COLLECTION_BY_KEY[key], id);
    showToast("Record deleted from Firebase.", "success");
    await refreshActiveData();
  } catch (err) {
    console.error("Firestore delete failed", err);
    showToast(getFirebaseErrorMessage(err, "Firebase delete failed."), "error");
  }
}

async function adjustInventoryStock(itemName, quantityDelta, sourceType, sourceRef) {
  if (!itemName || !quantityDelta) return;

  const inventoryRecord = getStoredRecords(KEYS.inventory).find((item) =>
    (item.name || "").toLowerCase() === itemName.toLowerCase()
  );

  if (!inventoryRecord?.id) return;

  const currentStock = getNumberFromValue(inventoryRecord.currentStock);
  const stockIn = Math.max(quantityDelta, 0);
  const stockOut = Math.max(-quantityDelta, 0);
  await updateCollectionRecord(COLLECTIONS.inventory, inventoryRecord.id, {
    currentStock: Math.max(currentStock + quantityDelta, 0),
    stockIn: getNumberFromValue(inventoryRecord.stockIn) + stockIn,
    stockOut: getNumberFromValue(inventoryRecord.stockOut) + stockOut,
    lastUpdated: new Date().toISOString().slice(0, 10),
    lastStockSource: sourceType,
    lastStockRef: sourceRef || ""
  });
}

async function createLedgerEntryFromPayment(data, moduleName, amount, direction, reference) {
  if (!amount || data.paymentStatus === "Pending") return;

  const paymentMode = data.paymentMode || data.mode || "Cash";
  const desc = `${moduleName}: ${data.desc || data.item || data.product || data.customer || reference || "Record"}`;
  const isIn = direction === "in";

  if (paymentMode === "Cash") {
    await createCollectionRecord(COLLECTIONS.cashBook, {
      date: data.date || new Date().toISOString().slice(0, 10),
      type: isIn ? "Cash In" : "Cash Out",
      desc,
      cashIn: isIn ? amount : 0,
      cashOut: isIn ? 0 : amount,
      balance: getProjectedCashBalance(isIn ? amount : -amount),
      ref: reference || moduleName,
      sourceModule: moduleName
    });
    return;
  }

  if (["Bank", "UPI", "Card"].includes(paymentMode)) {
    await createCollectionRecord(COLLECTIONS.bankBook, {
      date: data.date || new Date().toISOString().slice(0, 10),
      bankName: paymentMode,
      type: isIn ? "Amount In" : "Amount Out",
      desc,
      amountIn: isIn ? amount : 0,
      amountOut: isIn ? 0 : amount,
      balance: getProjectedBankBalance(isIn ? amount : -amount),
      refNum: reference || moduleName,
      sourceModule: moduleName
    });
  }
}

async function reconcileStockAndLedger(data, meta) {
  const operations = [];
  addStockReversalOperations(operations, meta.previous, meta.moduleName);
  if (data) addStockApplyOperations(operations, meta.stockName, meta.stockDelta, meta.moduleName, meta.reference);
  addLinkedLedgerDeleteOperations(operations, meta.id);
  if (data) addLinkedLedgerCreateOperation(operations, data, meta);
  if (operations.length) await commitBatchOperations(operations);
}

async function reconcileLedgerOnly(data, meta) {
  const operations = [];
  addLinkedLedgerDeleteOperations(operations, meta.id);
  if (data) addLinkedLedgerCreateOperation(operations, data, meta);
  if (operations.length) await commitBatchOperations(operations);
}

async function reconcileOrderInventoryAndLedger(data, meta) {
  const operations = [];
  addOrderInventoryReversalOperations(operations, meta.previous);
  if (data) addOrderInventoryApplyOperations(operations, data, meta);
  addLinkedLedgerDeleteOperations(operations, meta.id);
  if (data) addLinkedLedgerCreateOperation(operations, data, meta);
  if (operations.length) await commitBatchOperations(operations);
}

async function reconcileProductionStock(data, meta) {
  const operations = [];
  addStockReversalOperations(operations, meta.previous, "Production");
  if (!meta.isDelete && data) {
    addStockApplyOperations(operations, data.productName, data.quantityProduced, "Production", data.batch);
  }
  if (operations.length) await commitBatchOperations(operations);
}

async function reconcileProfitSharingLedger(data, meta) {
  const operations = [];
  addLinkedLedgerDeleteOperations(operations, meta.id || meta.previous?.id);
  if (!meta.isDelete && data) {
    addLinkedLedgerCreateOperation(operations, data, {
      ...meta,
      moduleName: "Profit Sharing",
      amount: data.amount,
      direction: "out",
      reference: `${data.period} - ${data.investor}`
    });
  }
  if (operations.length) await commitBatchOperations(operations);
}

function addStockReversalOperations(operations, previous, moduleName) {
  if (!previous) return;

  const stockName = previous.item || previous.product || previous.productName;
  const delta = getStockDelta(previous, moduleName);
  if (!stockName || !delta) return;
  addStockApplyOperations(operations, stockName, -delta, `${moduleName} reversal`, previous.invoice || previous.customer || previous.batch);
}

function getStockDelta(record, moduleName) {
  if (moduleName === "Purchase") return getNumberFromValue(record.qty);
  if (moduleName === "Sales") return -getNumberFromValue(record.qty);
  if (moduleName === "Production") return getNumberFromValue(record.quantityProduced);
  return 0;
}

function getOrderInventoryMode(order) {
  const status = normalizeOrderStatus(order?.orderStatus);
  if (["pending", "processing"].includes(status)) return "reserved";
  if (["shipped", "delivered"].includes(status)) return "deducted";
  return "none";
}

function addOrderInventoryReversalOperations(operations, previous) {
  const mode = getOrderInventoryMode(previous);
  if (!previous || mode === "none") return;
  getOrderInventoryItems(previous).forEach((item) => {
    if (mode === "reserved") {
      addInventoryReservationOperation(operations, item.name, -item.qty, "Order reservation release", previous.id || previous.customer);
    }
    if (mode === "deducted") {
      addInventoryDeductionOperation(operations, item.name, -item.qty, "Order stock reversal", previous.id || previous.customer);
    }
  });
}

function addOrderInventoryApplyOperations(operations, order, meta) {
  const mode = getOrderInventoryMode(order);
  if (mode === "none") return;
  getOrderInventoryItems(order).forEach((item) => {
    if (mode === "reserved") {
      addInventoryReservationOperation(operations, item.name, item.qty, "Order reserved", meta.id || order.customer);
    }
    if (mode === "deducted") {
      addInventoryDeductionOperation(operations, item.name, item.qty, "Order shipped/delivered", meta.id || order.customer);
    }
  });
}

function getOrderInventoryItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items
      .map((item) => ({ name: item.name || item.product, qty: getNumberFromValue(item.qty || item.quantity) }))
      .filter((item) => item.name && item.qty > 0);
  }
  return [{ name: order?.product, qty: getNumberFromValue(order?.qty) }].filter((item) => item.name && item.qty > 0);
}

function addInventoryReservationOperation(operations, itemName, reservedDelta, sourceType, sourceRef) {
  if (!itemName || !reservedDelta) return;
  const inventoryRecord = findInventoryRecordByName(itemName);
  if (!inventoryRecord?.id) return;
  const existingOperation = findInventoryUpdateOperation(operations, inventoryRecord.id);
  const baseReserved = existingOperation
    ? getNumberFromValue(existingOperation.payload.reservedStock)
    : getNumberFromValue(inventoryRecord.reservedStock);

  const payload = existingOperation?.payload || {
    currentStock: getNumberFromValue(inventoryRecord.currentStock),
    stockIn: getNumberFromValue(inventoryRecord.stockIn),
    stockOut: getNumberFromValue(inventoryRecord.stockOut)
  };

  payload.reservedStock = Math.max(baseReserved + reservedDelta, 0);
  payload.availableStock = Math.max(getNumberFromValue(payload.currentStock) - payload.reservedStock, 0);
  payload.lastUpdated = new Date().toISOString().slice(0, 10);
  payload.lastStockSource = sourceType;
  payload.lastStockRef = sourceRef || "";

  if (existingOperation) return;
  operations.push({ type: "update", collectionName: COLLECTIONS.inventory, id: inventoryRecord.id, payload });
}

function addInventoryDeductionOperation(operations, itemName, quantity, sourceType, sourceRef) {
  if (!itemName || !quantity) return;
  const inventoryRecord = findInventoryRecordByName(itemName);
  if (!inventoryRecord?.id) return;
  const existingOperation = findInventoryUpdateOperation(operations, inventoryRecord.id);
  const payload = existingOperation?.payload || {
    currentStock: getNumberFromValue(inventoryRecord.currentStock),
    reservedStock: getNumberFromValue(inventoryRecord.reservedStock),
    stockIn: getNumberFromValue(inventoryRecord.stockIn),
    stockOut: getNumberFromValue(inventoryRecord.stockOut)
  };

  payload.currentStock = Math.max(getNumberFromValue(payload.currentStock) - quantity, 0);
  payload.stockOut = Math.max(getNumberFromValue(payload.stockOut) + quantity, 0);
  payload.availableStock = Math.max(payload.currentStock - getNumberFromValue(payload.reservedStock), 0);
  payload.lastUpdated = new Date().toISOString().slice(0, 10);
  payload.lastStockSource = sourceType;
  payload.lastStockRef = sourceRef || "";

  if (existingOperation) return;
  operations.push({ type: "update", collectionName: COLLECTIONS.inventory, id: inventoryRecord.id, payload });
}

function findInventoryRecordByName(itemName) {
  return getStoredRecords(KEYS.inventory).find((item) =>
    (item.name || "").toLowerCase() === String(itemName || "").toLowerCase()
  );
}

function findInventoryUpdateOperation(operations, inventoryId) {
  return operations.find((operation) =>
    operation.type === "update"
    && operation.collectionName === COLLECTIONS.inventory
    && operation.id === inventoryId
  );
}

function addStockApplyOperations(operations, itemName, quantityDelta, sourceType, sourceRef) {
  if (!itemName || !quantityDelta) return;

  const inventoryRecord = getStoredRecords(KEYS.inventory).find((item) =>
    (item.name || "").toLowerCase() === itemName.toLowerCase()
  );
  if (!inventoryRecord?.id) return;

  const currentStock = getNumberFromValue(inventoryRecord.currentStock);
  const stockIn = Math.max(quantityDelta, 0);
  const stockOut = Math.max(-quantityDelta, 0);
  const existingOperation = operations.find((operation) =>
    operation.type === "update"
    && operation.collectionName === COLLECTIONS.inventory
    && operation.id === inventoryRecord.id
  );

  if (existingOperation) {
    existingOperation.payload.currentStock = Math.max(getNumberFromValue(existingOperation.payload.currentStock) + quantityDelta, 0);
    existingOperation.payload.stockIn = Math.max(getNumberFromValue(existingOperation.payload.stockIn) + stockIn, 0);
    existingOperation.payload.stockOut = Math.max(getNumberFromValue(existingOperation.payload.stockOut) + stockOut, 0);
    existingOperation.payload.lastStockSource = sourceType;
    existingOperation.payload.lastStockRef = sourceRef || "";
    return;
  }

  operations.push({
    type: "update",
    collectionName: COLLECTIONS.inventory,
    id: inventoryRecord.id,
    payload: {
      currentStock: Math.max(currentStock + quantityDelta, 0),
      stockIn: Math.max(getNumberFromValue(inventoryRecord.stockIn) + stockIn, 0),
      stockOut: Math.max(getNumberFromValue(inventoryRecord.stockOut) + stockOut, 0),
      lastUpdated: new Date().toISOString().slice(0, 10),
      lastStockSource: sourceType,
      lastStockRef: sourceRef || ""
    }
  });
}

function addLinkedLedgerDeleteOperations(operations, sourceId) {
  if (!sourceId) return;
  [KEYS.cashBook, KEYS.bankBook].forEach((key) => {
    getStoredRecords(key)
      .filter((record) => record.sourceId === sourceId)
      .forEach((record) => {
        operations.push({
          type: "delete",
          collectionName: COLLECTION_BY_KEY[key],
          id: record.id
        });
      });
  });
}

function addLinkedLedgerCreateOperation(operations, data, meta) {
  if (!meta.amount || data.paymentStatus === "Pending" || data.status === "Pending") return;

  const paymentMode = data.paymentMode || data.mode || "Cash";
  const isIn = meta.direction === "in";
  const desc = `${meta.moduleName}: ${data.desc || data.item || data.product || data.customer || data.investor || meta.reference || "Record"}`;
  const common = {
    date: data.date || new Date().toISOString().slice(0, 10),
    desc,
    sourceModule: meta.moduleName,
    sourceId: meta.id || "",
    sourceRef: meta.reference || ""
  };

  if (paymentMode === "Cash") {
    operations.push({
      type: "set",
      collectionName: COLLECTIONS.cashBook,
      payload: {
        ...common,
        type: isIn ? "Cash In" : "Cash Out",
        cashIn: isIn ? meta.amount : 0,
        cashOut: isIn ? 0 : meta.amount,
        balance: getProjectedCashBalance(isIn ? meta.amount : -meta.amount),
        ref: meta.reference || meta.moduleName
      }
    });
    return;
  }

  if (["Bank", "UPI", "Card"].includes(paymentMode)) {
    operations.push({
      type: "set",
      collectionName: COLLECTIONS.bankBook,
      payload: {
        ...common,
        bankName: paymentMode,
        type: isIn ? "Amount In" : "Amount Out",
        amountIn: isIn ? meta.amount : 0,
        amountOut: isIn ? 0 : meta.amount,
        balance: getProjectedBankBalance(isIn ? meta.amount : -meta.amount),
        refNum: meta.reference || meta.moduleName
      }
    });
  }
}

async function reconcileLedgerBalances(key, data, meta) {
  const records = [...getStoredRecords(key)];
  const amountFieldIn = key === KEYS.cashBook ? "cashIn" : "amountIn";
  const amountFieldOut = key === KEYS.cashBook ? "cashOut" : "amountOut";
  const balanceField = "balance";
  const changedIndex = records.findIndex((record) => record.id === meta.id);
  if (changedIndex === -1) return;

  records[changedIndex] = { ...records[changedIndex], ...data };
  let runningBalance = changedIndex > 0 ? getNumberFromValue(records[changedIndex - 1][balanceField]) : 0;
  const operations = records.slice(changedIndex).map((record) => {
    runningBalance += getNumberFromValue(record[amountFieldIn]) - getNumberFromValue(record[amountFieldOut]);
    return {
      type: "update",
      collectionName: COLLECTION_BY_KEY[key],
      id: record.id,
      payload: { balance: runningBalance }
    };
  });

  if (operations.length) await commitBatchOperations(operations);
}

async function reconcileLedgerBalancesAfterDelete(key, deletedRecord) {
  const records = getStoredRecords(key).filter((record) => record.id !== deletedRecord.id);
  const amountFieldIn = key === KEYS.cashBook ? "cashIn" : "amountIn";
  const amountFieldOut = key === KEYS.cashBook ? "cashOut" : "amountOut";
  let runningBalance = 0;
  const operations = records.map((record) => {
    runningBalance += getNumberFromValue(record[amountFieldIn]) - getNumberFromValue(record[amountFieldOut]);
    return {
      type: "update",
      collectionName: COLLECTION_BY_KEY[key],
      id: record.id,
      payload: { balance: runningBalance }
    };
  });
  if (operations.length) await commitBatchOperations(operations);
}

function getProjectedCashBalance(delta) {
  const records = getStoredRecords(KEYS.cashBook);
  const current = records.length ? getNumberFromValue(records[records.length - 1].balance) : 0;
  const existing = currentEditId ? records.find((record) => record.id === currentEditId) : null;
  const oldDelta = existing ? getNumberFromValue(existing.cashIn) - getNumberFromValue(existing.cashOut) : 0;
  return current - oldDelta + delta;
}

function getProjectedBankBalance(delta) {
  const records = getStoredRecords(KEYS.bankBook);
  const current = records.length ? getNumberFromValue(records[records.length - 1].balance) : 0;
  const existing = currentEditId ? records.find((record) => record.id === currentEditId) : null;
  const oldDelta = existing ? getNumberFromValue(existing.amountIn) - getNumberFromValue(existing.amountOut) : 0;
  return current - oldDelta + delta;
}

function getFormConfigForKey(key) {
  const formMap = {
    [KEYS.products]: {
      submitButtonId: "product-submit-btn",
      populate: (record) => {
        setValue("prod-name", record.name);
        setValue("prod-sku", record.sku);
        setValue("prod-category", record.category);
        setValue("prod-unit", record.unit);
        setValue("prod-mrp", record.mrp);
        setValue("prod-saleprice", record.salePrice);
        setValue("prod-costprice", record.costPrice);
        setValue("prod-opening", record.openingStock);
        setValue("prod-current", record.currentStock);
        setValue("prod-minimum", record.minimumStock);
        setValue("prod-status", record.status);
      }
    },
    [KEYS.customers]: {
      submitButtonId: "customer-submit-btn",
      populate: (record) => {
        setValue("cust-name", record.name);
        setValue("cust-phone", record.phone);
        setValue("cust-whatsapp", record.whatsapp);
        setValue("cust-place", record.place);
        setValue("cust-pin", record.pin);
        setValue("cust-address", record.address);
        setValue("cust-type", record.type);
        setValue("cust-notes", record.notes);
      }
    },
    [KEYS.suppliers]: {
      submitButtonId: "supplier-submit-btn",
      populate: (record) => {
        setValue("supp-name", record.name);
        setValue("supp-phone", record.phone);
        setValue("supp-place", record.place);
        setValue("supp-address", record.address);
        setValue("supp-gst", record.gst);
        setValue("supp-item", record.itemSupplied);
        setValue("supp-terms", record.terms);
        setValue("supp-notes", record.notes);
      }
    },
    [KEYS.investors]: {
      submitButtonId: "investors-submit-btn",
      populate: (record) => {
        setValue("inv-name", record.name);
        setValue("inv-phone", record.phone);
        setValue("inv-email", record.email);
        setValue("inv-address", record.address);
        setValue("inv-amount", record.amount);
        setValue("inv-share", record.share);
        setValue("inv-date", record.date);
        setValue("inv-status", record.status);
        setValue("inv-notes", record.notes);
      }
    },
    [KEYS.purchases]: {
      submitButtonId: "purchase-submit-btn",
      populate: populatePurchase,
      beforeDelete: (record) => reconcileStockAndLedger(null, { id: record.id, previous: record, moduleName: "Purchase" })
    },
    [KEYS.inventory]: { submitButtonId: "inventory-submit-btn", populate: populateInventory },
    [KEYS.sales]: {
      submitButtonId: "sales-submit-btn",
      populate: populateSales,
      beforeDelete: (record) => reconcileStockAndLedger(null, { id: record.id, previous: record, moduleName: "Sales" })
    },
    [KEYS.orders]: {
      submitButtonId: "orders-submit-btn",
      populate: populateOrders,
      beforeDelete: (record) => reconcileOrderInventoryAndLedger(null, { id: record.id, previous: record })
    },
    [KEYS.delivery]: { submitButtonId: "delivery-submit-btn", populate: populateDelivery },
    [KEYS.expenses]: {
      submitButtonId: "expenses-submit-btn",
      populate: populateExpenses,
      beforeDelete: (record) => reconcileLedgerOnly(null, { id: record.id })
    },
    [KEYS.income]: {
      submitButtonId: "income-submit-btn",
      populate: populateIncome,
      beforeDelete: (record) => reconcileLedgerOnly(null, { id: record.id })
    },
    [KEYS.cashBook]: {
      submitButtonId: "cashbook-submit-btn",
      populate: populateCashBook,
      beforeDelete: (record) => reconcileLedgerBalancesAfterDelete(KEYS.cashBook, record)
    },
    [KEYS.bankBook]: {
      submitButtonId: "bankbook-submit-btn",
      populate: populateBankBook,
      beforeDelete: (record) => reconcileLedgerBalancesAfterDelete(KEYS.bankBook, record)
    },
    [KEYS.production]: {
      submitButtonId: "production-submit-btn",
      populate: populateProduction,
      beforeDelete: (record) => reconcileProductionStock(null, { isDelete: true, previous: record })
    },
    [KEYS.sharing]: {
      submitButtonId: "sharing-submit-btn",
      populate: populateSharing,
      beforeDelete: (record) => reconcileProfitSharingLedger(null, { isDelete: true, previous: record })
    }
  };
  return formMap[key];
}

function populatePurchase(record) {
  setValue("pur-date", record.date);
  setValue("pur-invoice", record.invoice);
  setValue("pur-supplier", record.supplier);
  setValue("pur-item", record.item);
  setValue("pur-qty", record.qty);
  setValue("pur-unit", record.unit);
  setValue("pur-rate", record.rate);
  setValue("pur-total", record.totalAmount);
  setValue("pur-mode", record.paymentMode);
  setValue("pur-status", record.paymentStatus);
  setValue("pur-notes", record.notes);
}

function populateInventory(record) {
  setValue("stk-name", record.name);
  setValue("stk-category", record.category);
  setValue("stk-type", record.type);
  setValue("stk-opening", record.openingStock);
  setValue("stk-in", record.stockIn);
  setValue("stk-out", record.stockOut);
  setValue("stk-current", record.currentStock);
  setValue("stk-unit", record.unit);
  setValue("stk-min", record.minAlert);
  setValue("stk-date", record.lastUpdated);
}

function populateSales(record) {
  setValue("sale-date", record.date);
  setValue("sale-customer", record.customer);
  setValue("sale-product", record.product);
  setValue("sale-qty", record.qty);
  setValue("sale-rate", record.rate);
  setValue("sale-total", record.totalAmount);
  setValue("sale-discount", record.discount);
  setValue("sale-final", record.finalAmount);
  setValue("sale-mode", record.paymentMode);
  setValue("sale-status", record.paymentStatus);
  setValue("sale-notes", record.notes);
}

function populateOrders(record) {
  setValue("ord-date", record.date);
  setValue("ord-source", record.source);
  setValue("ord-customer", record.customer);
  setValue("ord-phone", record.phone);
  setValue("ord-gst", record.gstNumber);
  setValue("ord-shop", record.shopName);
  setValue("ord-landmark", record.landmark);
  setValue("ord-pin", record.pincode || record.pin);
  setValue("ord-location", record.locationLink);
  setOrderItems(Array.isArray(record.items) && record.items.length ? record.items : [{
    name: record.product,
    product: record.product,
    priceType: record.priceType || "with-gst",
    qty: record.qty || 1,
    amount: record.amount || 0
  }]);
  setValue("ord-delivery", record.deliveryCharge);
  setValue("ord-payable", record.totalPayable);
  setValue("ord-paid", record.paidAmount);
  setValue("ord-payment-mode", record.paymentMode);
  setValue("ord-pstatus", record.paymentStatus);
  setValue("ord-ostatus", record.orderStatus);
  setValue("ord-address", record.address);
  setValue("ord-notes", record.notes);
  updateOrderTotals();
}

function populateDelivery(record) {
  setValue("dlv-order", record.orderId);
  setValue("dlv-customer", record.customer);
  setValue("dlv-partner", record.partner);
  setValue("dlv-tracking", record.trackingId);
  setValue("dlv-charge", record.charge);
  setValue("dlv-dispatch", record.dispatchDate);
  setValue("dlv-status", record.status);
  setValue("dlv-delivered", record.deliveredDate);
  setValue("dlv-notes", record.notes);
}

function populateExpenses(record) {
  setValue("exp-date", record.date);
  setValue("exp-cat", record.category);
  setValue("exp-desc", record.desc);
  setValue("exp-amount", record.amount);
  setValue("exp-mode", record.mode);
  setValue("exp-paid", record.paidTo);
  setValue("exp-receipt", record.receipt);
  setValue("exp-notes", record.notes);
}

function populateIncome(record) {
  setValue("inc-date", record.date);
  setValue("inc-source", record.source);
  setValue("inc-desc", record.desc);
  setValue("inc-amount", record.amount);
  setValue("inc-mode", record.mode);
  setValue("inc-received", record.receivedFrom);
  setValue("inc-notes", record.notes);
}

function populateCashBook(record) {
  setValue("cb-date", record.date);
  setValue("cb-type", record.type);
  setValue("cb-desc", record.desc);
  setValue("cb-amount", record.cashIn > 0 ? record.cashIn : record.cashOut);
  setValue("cb-ref", record.ref);
}

function populateBankBook(record) {
  setValue("bb-date", record.date);
  setValue("bb-bank", record.bankName);
  setValue("bb-type", record.type);
  setValue("bb-desc", record.desc);
  setValue("bb-amount", record.amountIn > 0 ? record.amountIn : record.amountOut);
  setValue("bb-ref", record.refNum);
}

function populateProduction(record) {
  setValue("prod-batch", record.batch);
  setValue("prod-date", record.date);
  setValue("prod-pname", record.productName);
  setValue("prod-raw", record.rawMaterial);
  setValue("prod-qty", record.quantityProduced);
  setValue("prod-pack", record.packingQty);
  setValue("prod-waste", record.wastage);
  setValue("prod-cost", record.batchCost);
  setValue("prod-staff", record.staff);
  setValue("prod-notes", record.notes);
}

function populateSharing(record) {
  setValue("shr-period", record.period);
  setValue("shr-profit", record.totalProfit);
  setValue("shr-investor", record.investor);
  setValue("shr-percentage", record.share);
  setValue("shr-amount", record.amount);
  setValue("shr-status", record.status);
  setValue("shr-date", record.date);
  setValue("shr-notes", record.notes);
}

function activeSectionKey() {
  return {
    products: KEYS.products,
    customers: KEYS.customers,
    suppliers: KEYS.suppliers,
    investors: KEYS.investors,
    purchase: KEYS.purchases,
    inventory: KEYS.inventory,
    sales: KEYS.sales,
    orders: KEYS.orders,
    delivery: KEYS.delivery,
    expenses: KEYS.expenses,
    income: KEYS.income,
    cashbook: KEYS.cashBook,
    bankbook: KEYS.bankBook,
    production: KEYS.production,
    "investment-sharing": KEYS.sharing
  }[activeSectionId];
}

async function refreshActiveData() {
  await loadFirestoreData();
  renderModule(activeSectionId);
  updateDashboardMetrics();
}

window.addEventListener("beforeunload", () => {
  realtimeSubscription?.unsubscribe();
});

function getValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function getNumber(id) {
  return getNumberFromValue(document.getElementById(id)?.value);
}

function getNumberFromValue(rawValue) {
  const value = parseFloat(rawValue || "0");
  return Number.isFinite(value) ? value : 0;
}

function setValue(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value ?? "";
}

function initFormListeners() {
  showToast(READ_ONLY_MESSAGE, "info");
}

function deleteTransactionRecord() {
  showToast(READ_ONLY_MESSAGE, "info");
}

function setupProductSearch() {
  const searchInput = document.getElementById("search-products");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.toLowerCase().trim();
    const rows = document.querySelectorAll("#products-table-body tr");
    rows.forEach(row => {
      const name = row.cells[0]?.textContent.toLowerCase() || "";
      const sku = row.cells[1]?.textContent.toLowerCase() || "";
      const cat = row.cells[2]?.textContent.toLowerCase() || "";
      
      if (name.includes(val) || sku.includes(val) || cat.includes(val)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });
}

/**
 * Customers Module local search filter
 */
function setupCustomerSearch() {
  const searchInput = document.getElementById("search-customers");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.toLowerCase().trim();
    const rows = document.querySelectorAll("#customers-table-body tr");
    rows.forEach(row => {
      const name = row.cells[0]?.textContent.toLowerCase() || "";
      const phone = row.cells[1]?.textContent.toLowerCase() || "";
      const place = row.cells[2]?.textContent.toLowerCase() || "";
      
      if (name.includes(val) || phone.includes(val) || place.includes(val)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });
}
