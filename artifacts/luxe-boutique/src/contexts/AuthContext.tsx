import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, signInWithPopup, firebaseSignOut } from "../lib/firebase";

type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (retries = 2) => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 503 && retries > 0) {
        setTimeout(() => fetchUser(retries - 1), 600);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
      setLoading(false);
    } catch {
      if (retries > 0) {
        setTimeout(() => fetchUser(retries - 1), 600);
        return;
      }
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      setLoading(false);
      return {};
    }
    const data = await res.json();
    return { error: data.error || "Invalid email or password" };
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user && result.user.email) {
        const res = await fetch("/api/auth/firebase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.user.email,
            name: result.user.displayName || result.user.email.split("@")[0],
            uid: result.user.uid,
          }),
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setLoading(false);
          return {};
        }
        const data = await res.json();
        return { error: data.error || "Firebase customer authentication failed" };
      }
      return { error: "No user account returned from Google" };
    } catch (err: any) {
      console.warn("Firebase Auth Warning:", err);
      const errCode = err?.code || "";
      const errMessage = err?.message || "";
      const isNetworkErr = errCode === "auth/network-request-failed" || errMessage.includes("auth/network-request-failed");
      return {
        error: isNetworkErr
          ? "Google Authentication network request failed (auth/network-request-failed). If using an embedded preview or restricted network, please open the application in a new window or sign in with email and password."
          : errMessage || "Google Sign-In failed",
      };
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await firebaseSignOut(auth).catch(() => {});
    setUser(null);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      setLoading(false);
      return {};
    }
    const data = await res.json();
    return { error: data.error || "Registration failed" };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, register, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
