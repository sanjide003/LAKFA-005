/* Lakfa ERP Firebase Configuration & Initialization */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Production Firebase project configuration for Lakfa ERP.
export const firebaseConfig = {
  apiKey: "AIzaSyCOT73k7YWxlh0qYFYGKa1W_NW29LjwsgQ",
  authDomain: "fest-21d67.firebaseapp.com",
  projectId: "fest-21d67",
  storageBucket: "fest-21d67.firebasestorage.app",
  messagingSenderId: "476270819694",
  appId: "1:476270819694:web:2689cf709656cfde1d697f",
  measurementId: "G-93HHHL4H2P"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore Database
export const auth = getAuth(app);
export const db = getFirestore(app);
