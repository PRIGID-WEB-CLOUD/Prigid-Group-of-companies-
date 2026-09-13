import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD0hBsmKdYhcRtNtZhNcZ7LreGx-8T-T-4",
  authDomain: "gen-lang-client-0609669316.firebaseapp.com",
  projectId: "gen-lang-client-0609669316",
  storageBucket: "gen-lang-client-0609669316.firebasestorage.app",
  messagingSenderId: "518896878897",
  appId: "1:518896878897:web:faa8821548e18d4c10dc10"
};

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

