import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLa95CXa2JoaXZRQ8CN1sYKmQcJBNHcj4",
  authDomain: "reminder-60e25.firebaseapp.com",
  projectId: "reminder-60e25",
  storageBucket: "reminder-60e25.firebasestorage.app",
  messagingSenderId: "1064375876913",
  appId: "1:1064375876913:web:026211b710612a060f0410",
  measurementId: "G-KFRB37RN4W"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };
