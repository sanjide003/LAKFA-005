/* Lakfa ERP Firestore Data Layer */
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
  sharing: "profitSharing"
};

export async function getCollectionRecords(collectionName) {
  const snapshot = await getDocs(query(collection(db, collectionName)));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
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
