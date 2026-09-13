import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "./AuthContext";

type CartContextType = {
  cartCount: number;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/cart"), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const count = data?.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) ?? 0;
        setCartCount(count);
      } else {
        setCartCount(0);
      }
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => { refreshCart(); }, [refreshCart]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
