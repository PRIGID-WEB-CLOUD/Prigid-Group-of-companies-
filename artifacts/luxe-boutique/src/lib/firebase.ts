import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import firebaseConfig from "../../../../firebase-applet-config.json";

let safeApp: any = null;
let safeAuth: any = null;
let isOperational = false;

try {
  safeApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  isOperational = true;
} catch (e) {
  console.warn("[AI Studio] Failed to initialize Firebase App:", e);
}

try {
  if (safeApp) {
    safeAuth = getAuth(safeApp);
    isOperational = true;
  }
} catch (e) {
  console.warn(
    "[AI Studio] Firebase getAuth failed, likely due to sandboxed iframe storage restrictions. Setting up mock auth interface.",
    e
  );
  isOperational = false;
}

if (!safeAuth) {
  safeAuth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => {
      setTimeout(() => cb(null), 0);
      return () => {};
    },
    config: {},
  };
}

export const app = safeApp;
export const auth = safeAuth;
export const isFirebaseOperational = isOperational;
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
};

