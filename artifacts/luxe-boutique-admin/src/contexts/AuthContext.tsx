import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  quickLogin: (email?: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "luxe_admin_token";

export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (retries = 2) => {
    try {
      const headers = getAdminAuthHeaders();
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers,
      });
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
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setUser(data);
      return {};
    }
    const data = await res.json();
    return { error: data.error || "Invalid email or password" };
  };

  const quickLogin = async (email?: string) => {
    try {
      const res = await fetch("/api/auth/admin/quick-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : {}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
        setUser(data);
        return {};
      }
      const data = await res.json();
      return { error: data.error || "Quick login failed" };
    } catch {
      return { error: "Network error during quick login." };
    }
  };

  const logout = async () => {
    const headers = getAdminAuthHeaders();
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers,
    }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setUser(data);
      return {};
    }
    const data = await res.json();
    return { error: data.error || "Registration failed" };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, quickLogin, logout, register, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
