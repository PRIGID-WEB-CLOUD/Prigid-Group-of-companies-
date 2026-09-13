// Safe localStorage fallback for iframe / sandboxed environments where localStorage might throw DOMException
try {
  if (typeof window !== "undefined") {
    const testKey = "__localstorage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
  }
} catch (e) {
  console.warn("[AI Studio] localStorage is blocked or not available. Using safe in-memory storage fallback.");
  const memoryStore: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => (key in memoryStore ? memoryStore[key] : null),
    setItem: (key: string, value: string) => { memoryStore[key] = String(value); },
    removeItem: (key: string) => { delete memoryStore[key]; },
    clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]); },
    key: (index: number) => Object.keys(memoryStore)[index] || null,
    get length() { return Object.keys(memoryStore).length; }
  };
  try {
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });
  } catch (err) {
    // If defineProperty is blocked, we can patch the prototype or use a global variable helper
    (window as any).localStorage = mockLocalStorage;
  }
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global fetch interceptor to automatically attach admin bearer token and credentials
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("/api") || url.includes("/api/")) {
    let token = null;
    try {
      token = typeof window !== "undefined" ? localStorage.getItem("luxe_admin_token") : null;
    } catch {
      // Squelch
    }
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const modifiedInit: RequestInit = {
      ...init,
      credentials: init?.credentials || "include",
      headers,
    };
    if (input instanceof Request) {
      return originalFetch(new Request(input, modifiedInit));
    }
    return originalFetch(input, modifiedInit);
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
