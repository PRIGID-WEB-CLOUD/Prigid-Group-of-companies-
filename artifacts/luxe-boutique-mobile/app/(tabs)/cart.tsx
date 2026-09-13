import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  const fetchCart = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await fetch(apiUrl("/api/cart"), { credentials: "include" });
      if (res.ok) setCart(await res.json());
    } catch {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchCart(); }, [user]));

  const updateQty = async (productId: string, qty: number) => {
    if (qty < 1) return;
    await fetch(apiUrl(`/api/cart/${productId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity: qty }),
    });
    fetchCart();
    refreshCart();
  };

  const removeItem = async (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetch(apiUrl(`/api/cart/${productId}`), { method: "DELETE", credentials: "include" });
    fetchCart();
    refreshCart();
  };

  const items = cart?.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.product?.price || 0) * item.quantity, 0);

  if (!user) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + WEB_TOP + 16 }]}>
        <Feather name="shopping-bag" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your bag is empty</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sign in to access your cart</Text>
        <Pressable style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/login")}>
          <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + WEB_TOP + 16 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + WEB_TOP + 16 }]}>
        <Feather name="shopping-bag" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your bag is empty</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add items from the shop</Text>
        <Pressable style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/shop")}>
          <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>Browse Shop</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Bag</Text>
        <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
          {items.length} {items.length === 1 ? "item" : "items"}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : 120 }}
      >
        {items.map((item: any) => (
          <View key={item.productId} style={[styles.item, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.push(`/product/${item.productId}`)}>
              <Image
                source={{ uri: item.product?.imageUrl || FALLBACK }}
                style={styles.itemImage}
                resizeMode="cover"
              />
            </Pressable>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemCategory, { color: colors.mutedForeground }]}>
                {item.product?.category?.name || "Boutique"}
              </Text>
              <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                {item.product?.name}
              </Text>
              <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                ${(Number(item.product?.price || 0) * item.quantity).toFixed(2)}
              </Text>
              <View style={styles.qtyRow}>
                <Pressable
                  style={[styles.qtyBtn, { borderColor: colors.border }]}
                  onPress={() => updateQty(item.productId, item.quantity - 1)}
                >
                  <Feather name="minus" size={14} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.qty, { color: colors.foreground }]}>{item.quantity}</Text>
                <Pressable
                  style={[styles.qtyBtn, { borderColor: colors.border }]}
                  onPress={() => updateQty(item.productId, item.quantity + 1)}
                >
                  <Feather name="plus" size={14} color={colors.foreground} />
                </Pressable>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeItem(item.productId)}
                >
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={[styles.summary, { borderTopColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Shipping</Text>
            <Text style={[styles.summaryValue, { color: colors.mutedForeground }]}>Calculated at checkout</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>Estimated Total</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
          </View>
          <Pressable
            style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/checkout")}
          >
            <Text style={[styles.checkoutBtnText, { color: colors.primaryForeground }]}>Proceed to Checkout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  loginBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  loginBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingTop: 8,
  },
  headerCount: {
    fontSize: 13,
  },
  item: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 90,
    height: 110,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemCategory: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  removeBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  summary: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 13,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  checkoutBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  checkoutBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
