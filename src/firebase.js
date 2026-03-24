// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyATrYxV8d8-CjiVkCt5dBCsdOBCD-a9tyc",
  authDomain: "todo-app-18703.firebaseapp.com",
  projectId: "todo-app-18703",
  storageBucket: "todo-app-18703.firebasestorage.app",
  messagingSenderId: "929732366019",
  appId: "1:929732366019:web:b2386d967dd4509a441c76",
  measurementId: "G-LK9WGB92R9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

export { db };