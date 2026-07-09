/* Lakfa ERP Firestore Data Layer */
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const COLLECTIONS = {
  products: "products",
  customers: "customers",
  suppliers: "suppliers",
  purchases: "purchases",
  inventory: "inventory",
  production: "productionBatches",
  sales: "sales",
  orders: "orders",
  delivery: "deliveries",
  expenses: "expenses",
  income: "income",
  cashBook: "cashbook",
  bankBook: "bankbook",
  investors: "investors",
  sharing: "profitSharing",
  rawMaterials: "rawMaterials",
  rawMaterialLedger: "rawMaterialLedger",
  stockLedger: "stockLedger",
  ledgerEntries: "ledgerEntries",
  auditLogs: "auditLogs",
  investorExpenses: "investorExpenses",
  investorPaymentRequests: "investorPaymentRequests",
  profitDistributions: "profitDistributions",
  employees: "employees",
  salaryPayments: "salaryPayments",
  assets: "assets",
  managerLoans: "managerLoans",
  loanRepayments: "loanRepayments",
  financeAccounts: "financeAccounts",
  financeCategories: "financeCategories",
  financeTransfers: "financeTransfers",
  dailyAccounts: "dailyAccounts",
  supplierLedger: "supplierLedger",
  customerLedger: "customerLedger",
  orderPayments: "orderPayments",
  orderExpenses: "orderExpenses",
  notifications: "notifications"
};

export function mapSnapshotRecords(snapshot) {
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export function subscribeCollectionRecords(collectionName, onRecords, onError = console.error) {
  return onSnapshot(
    query(collection(db, collectionName)),
    (snapshot) => onRecords(mapSnapshotRecords(snapshot)),
    onError
  );
}


export function subscribeCollectionWhere(collectionName, filters, onRecords, onError = console.error) {
  const constraints = filters.map(([field, op, value]) => where(field, op, value));
  return onSnapshot(
    query(collection(db, collectionName), ...constraints),
    (snapshot) => onRecords(mapSnapshotRecords(snapshot)),
    onError
  );
}

export function subscribeCollections(collectionMap, onCollectionRecords, onError = console.error) {
  const entries = Object.entries(collectionMap);
  const initialKeys = new Set(entries.map(([key]) => key));
  let resolveInitialLoad;
  const initialLoad = new Promise((resolve) => {
    resolveInitialLoad = resolve;
  });

  const markLoaded = (key) => {
    initialKeys.delete(key);
    if (initialKeys.size === 0) resolveInitialLoad();
  };

  const unsubscribers = entries.map(([key, collectionName]) => subscribeCollectionRecords(
    collectionName,
    (records) => {
      onCollectionRecords(key, records, collectionName);
      markLoaded(key);
    },
    (error) => {
      markLoaded(key);
      onError(error, key, collectionName);
    }
  ));

  if (entries.length === 0) resolveInitialLoad();

  return {
    initialLoad,
    unsubscribe: () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  };
}

export async function getCollectionRecords(collectionName) {
  const snapshot = await getDocs(query(collection(db, collectionName)));
  return mapSnapshotRecords(snapshot);
}

export async function getAllCollections(collectionMap) {
  const entries = await Promise.all(
    Object.entries(collectionMap).map(async ([key, collectionName]) => [
      key,
      await getCollectionRecords(collectionName)
    ])
  );

  return Object.fromEntries(entries);
}

export async function getDocument(collectionName, documentId) {
  const snapshot = await getDoc(doc(db, collectionName, documentId));
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function saveDocument(collectionName, documentId, payload) {
  await setDoc(
    doc(db, collectionName, documentId),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function auditFields(isCreate = false) {
  const user = auth.currentUser;
  return {
    ...(isCreate ? { createdAt: serverTimestamp(), createdBy: user?.uid || null } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: user?.uid || null
  };
}

export async function createCollectionRecord(collectionName, payload) {
  const docRef = await addDoc(collection(db, collectionName), {
    ...payload,
    ...auditFields(true)
  });
  return docRef.id;
}

export async function updateCollectionRecord(collectionName, documentId, payload) {
  await updateDoc(doc(db, collectionName, documentId), {
    ...payload,
    ...auditFields(false)
  });
}

export async function deleteCollectionRecord(collectionName, documentId) {
  await deleteDoc(doc(db, collectionName, documentId));
}

export async function commitBatchOperations(operations = []) {
  const batch = writeBatch(db);
  const generatedIds = [];

  operations.forEach((operation) => {
    const ref = operation.id
      ? doc(db, operation.collectionName, operation.id)
      : doc(collection(db, operation.collectionName));

    if (!operation.id) generatedIds.push(ref.id);

    if (operation.type === "set") {
      batch.set(ref, {
        ...operation.payload,
        ...auditFields(true)
      });
    }

    if (operation.type === "update") {
      batch.update(ref, {
        ...operation.payload,
        ...auditFields(false)
      });
    }

    if (operation.type === "delete") {
      batch.delete(ref);
    }
  });

  await batch.commit();
  return generatedIds;
}


export async function postAuditLog(action, payload = {}) {
  return createCollectionRecord(COLLECTIONS.auditLogs, {
    action,
    module: payload.module || "system",
    recordId: payload.recordId || null,
    summary: payload.summary || "",
    before: payload.before || null,
    after: payload.after || null,
    metadata: payload.metadata || {},
    eventAt: serverTimestamp()
  });
}

export async function postLedgerEntry(entry = {}) {
  return createCollectionRecord(COLLECTIONS.ledgerEntries, {
    date: entry.date || new Date().toISOString().slice(0, 10),
    module: entry.module || "general",
    account: entry.account || "General",
    type: entry.type || "journal",
    debit: Number(entry.debit || 0),
    credit: Number(entry.credit || 0),
    referenceCollection: entry.referenceCollection || null,
    referenceId: entry.referenceId || null,
    partyType: entry.partyType || null,
    partyId: entry.partyId || null,
    description: entry.description || "",
    status: entry.status || "posted"
  });
}
