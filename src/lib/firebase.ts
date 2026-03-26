import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDtEZQrqT3FW4YhlYy_0b9Z1t93R4pUD2w",
  authDomain: "gabi-ink-e4578.firebaseapp.com",
  projectId: "gabi-ink-e4578",
  storageBucket: "gabi-ink-e4578.firebasestorage.app",
  messagingSenderId: "657817692789",
  appId: "1:657817692789:web:7c3cd410f47559055be63c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);