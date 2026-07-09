/* Lakfa ERP Investor Controller */
import { logoutUser } from "./role-guard.js";
import { formatCurrency, formatDate } from "./utils.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { COLLECTIONS, subscribeCollections } from "./firebase-db.js";

const INVESTOR_COLLECTIONS = {
  investors: COLLECTIONS.investors,
  sharing: COLLECTIONS.sharing,
  inventory: COLLECTIONS.inventory,
  expenses: COLLECTIONS.expenses,
  income: COLLECTIONS.income,
  investorExpenses: COLLECTIONS.investorExpenses,
  investorPaymentRequests: COLLECTIONS.investorPaymentRequests,
  profitDistributions: COLLECTIONS.profitDistributions,
  notifications: COLLECTIONS.notifications
};

let investorState = Object.fromEntries(Object.keys(INVESTOR_COLLECTIONS).map((key) => [key, []]));
let investorSubscription = null;
let activeInvestorEmail = "";

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      activeInvestorEmail = user.email || "";
      await initInvestorRealtimeDashboard(activeInvestorEmail);
    }
  });
});

async function initInvestorRealtimeDashboard(email) {
  if (investorSubscription) {
    renderInvestorDashboard(email);
    return;
  }

  investorSubscription = subscribeCollections(
    INVESTOR_COLLECTIONS,
    (key, records) => {
      investorState[key] = records;
      if (activeInvestorEmail) renderInvestorDashboard(activeInvestorEmail);
    },
    (err, key, collectionName) => {
      console.error(`Investor realtime listener failed for ${collectionName || key}`, err);
      renderMissingInvestor(email, "Unable to sync Firebase data. Please contact admin.");
    }
  );

  await investorSubscription.initialLoad;
  renderInvestorDashboard(email);
}

function renderInvestorDashboard(email) {
  try {
    const investorsList = investorState.investors || [];
    const sharingHistory = [
      ...(investorState.sharing || []),
      ...(investorState.profitDistributions || [])
    ];
    const inventory = investorState.inventory || [];
    const expenses = investorState.expenses || [];
    const income = investorState.income || [];

    const investorProfile = investorsList.find((inv) => inv.email?.toLowerCase() === email?.toLowerCase());

    if (!investorProfile) {
      renderMissingInvestor(email);
      renderInvestorReportSummary(null, [], inventory, expenses, income);
      renderPayoutTable([]);
      renderInventoryTable(inventory);
      renderExpenseTable(expenses);
      renderIncomeTable(income);
      return;
    }

    document.getElementById("investor-display-name").textContent = investorProfile.name || email;
    document.getElementById("card-company-status").textContent = investorProfile.status || "Active";

    const statusBadge = document.getElementById("card-company-status");
    if (statusBadge) {
      statusBadge.className = `badge ${investorProfile.status === 'Inactive' ? 'badge-danger' : 'badge-success'}`;
    }

    const myShares = sharingHistory.filter((share) => {
      const sameInvestorId = investorProfile.id && share.investorId === investorProfile.id;
      const sameName = share.investor?.toLowerCase() === investorProfile.name?.toLowerCase();
      const sameEmail = share.email?.toLowerCase() === email?.toLowerCase();
      return sameInvestorId || sameName || sameEmail;
    });

    const totalInvestment = parseFloat(investorProfile.amount || 0);
    const sharePercentage = parseFloat(investorProfile.share || 0);

    const totalProfitReceived = myShares
      .filter((share) => share.status === "Paid")
      .reduce((sum, share) => sum + parseFloat(share.amount || 0), 0);

    const pendingProfit = myShares
      .filter((share) => share.status === "Pending")
      .reduce((sum, share) => sum + parseFloat(share.amount || 0), 0);

    const lastPayment = myShares
      .filter((share) => share.status === "Paid" && share.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    document.getElementById("inv-total").textContent = formatCurrency(totalInvestment);
    document.getElementById("inv-share").textContent = `${sharePercentage.toFixed(1)}%`;
    document.getElementById("inv-received").textContent = formatCurrency(totalProfitReceived);
    document.getElementById("inv-pending").textContent = formatCurrency(pendingProfit);
    document.getElementById("inv-last-payout").textContent = lastPayment ? formatDate(lastPayment.date) : "No payout yet";

    renderInvestorReportSummary(investorProfile, myShares, inventory, expenses, income);
    renderPayoutTable(myShares);
    renderInventoryTable(inventory);
    renderExpenseTable(expenses);
    renderIncomeTable(income);
  } catch (err) {
    console.error("Unable to render investor dashboard from Firebase", err);
    renderMissingInvestor(email, "Unable to load Firebase data. Please contact admin.");
  }
}

window.addEventListener("beforeunload", () => {
  investorSubscription?.unsubscribe();
});

function renderMissingInvestor(email, message = "No investor profile is assigned to this login. Please contact admin.") {
  document.getElementById("investor-display-name").textContent = email || "Investor";
  document.getElementById("card-company-status").textContent = "Not Assigned";
  document.getElementById("card-company-status").className = "badge badge-warning";
  document.getElementById("inv-total").textContent = formatCurrency(0);
  document.getElementById("inv-share").textContent = "0.0%";
  document.getElementById("inv-received").textContent = formatCurrency(0);
  document.getElementById("inv-pending").textContent = formatCurrency(0);
  document.getElementById("inv-last-payout").textContent = message;
}


function renderInvestorReportSummary(investorProfile, shares, inventory, expenses, income) {
  const container = document.getElementById("investor-report-summary");
  if (!container) return;

  const stockValuation = inventory.reduce((sum, item) => sum + parseFloat(item.currentStock || 0) * parseFloat(item.costPrice || item.rate || 0), 0);
  const totalExpense = expenses.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
  const totalIncome = income.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
  const investorPaid = shares.filter((row) => row.status === "Paid").reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
  const investorPending = shares.filter((row) => row.status !== "Paid").reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);

  const rows = [
    ["Investor", investorProfile?.name || "Not assigned"],
    ["My Capital", formatCurrency(investorProfile?.amount || 0)],
    ["My Share", `${parseFloat(investorProfile?.share || 0).toFixed(1)}%`],
    ["Paid Profit", formatCurrency(investorPaid)],
    ["Pending Profit", formatCurrency(investorPending)],
    ["Company Income", formatCurrency(totalIncome)],
    ["Company Expenses", formatCurrency(totalExpense)],
    ["Stock Valuation", formatCurrency(stockValuation)]
  ];

  container.innerHTML = `<table><thead><tr><th>Report Metric</th><th>Read-only Value</th></tr></thead><tbody>${rows.map(([metric, value]) => `<tr><td>${metric}</td><td>${value}</td></tr>`).join("")}</tbody></table>`;
}

function renderPayoutTable(shares) {
  const tbody = document.getElementById("payout-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (shares.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">No Firebase profit distribution history found for this investor.</td></tr>`;
    return;
  }

  shares.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${row.period || '-'}</strong></td>
      <td>${formatCurrency(row.totalProfit)}</td>
      <td>${row.share || 0}%</td>
      <td style="font-weight: 600; color: var(--primary);">${formatCurrency(row.amount)}</td>
      <td><span class="badge ${row.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${row.status || 'Pending'}</span></td>
      <td>${row.date ? formatDate(row.date) : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderInventoryTable(records) {
  renderRows("investor-stock-table-body", records, 7, (row) => `
    <td><strong>${row.name || '-'}</strong></td>
    <td>${row.category || '-'}</td>
    <td>${row.stockType || '-'}</td>
    <td>${row.currentStock ?? 0}</td>
    <td>${row.unit || '-'}</td>
    <td>${row.minStock ?? row.minimumStock ?? '-'}</td>
    <td>${row.lastUpdated ? formatDate(row.lastUpdated) : '-'}</td>
  `);
}

function renderExpenseTable(records) {
  renderRows("investor-expense-table-body", records, 6, (row) => `
    <td>${row.date ? formatDate(row.date) : '-'}</td>
    <td>${row.category || '-'}</td>
    <td>${row.desc || '-'}</td>
    <td>${formatCurrency(row.amount)}</td>
    <td>${row.mode || '-'}</td>
    <td>${row.paidTo || '-'}</td>
  `);
}

function renderIncomeTable(records) {
  renderRows("investor-income-table-body", records, 6, (row) => `
    <td>${row.date ? formatDate(row.date) : '-'}</td>
    <td>${row.source || '-'}</td>
    <td>${row.desc || '-'}</td>
    <td>${formatCurrency(row.amount)}</td>
    <td>${row.mode || '-'}</td>
    <td>${row.receivedFrom || '-'}</td>
  `);
}

function renderRows(tableBodyId, records, colspan, rowTemplate) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">No Firebase records found.</td></tr>`;
    return;
  }

  records.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = rowTemplate(row);
    tbody.appendChild(tr);
  });
}
