import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { apiUrl } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop";

export default function WishlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  const loadWishlist = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await fetch(apiUrl("/api/wishlist"), { credentials: "include" });
      const data = await res.json();
      setWishlist(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); loadWishlist(); }, [loadWishlist]));

  const removeItem = async (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetch(apiUrl(`/api/wishlist/${productId}`), { method: "DELETE", credentials: "include" });
    setWishlist(prev => prev.filter((item: any) => item.productId !== productId));
  };

  const addToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      const res = await fetch(apiUrl("/api/cart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (res.ok) {
        await refreshCart();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push("/(tabs)/cart");
      }
    } finally {
      setAddingToCart(null);
    }
  };

  const cardWidth = (SCREEN_WIDTH - 48) / 2;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Wishlist</Text>
        </View>
        <View style={styles.center}>
          <Feather name="heart" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to view your wishlist</Text>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/login")}>
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Wishlist</Text>
        {wishlist.length > 0 && (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{wishlist.length} items</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : wishlist.length === 0 ? (
        <View style={styles.center}>
          <Feather name="heart" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your wishlist is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Save items you love</Text>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/shop")}>
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Browse Shop</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 16, paddingBottom: Platform.OS === "web" ? 34 : 40 }}>
          {wishlist.map((item: any) => (
            <View key={item.productId} style={[styles.card, { width: cardWidth, backgroundColor: colors.muted }]}>
              <Pressable onPress={() => router.push(`/product/${item.productId}`)}>
                <Image
                  source={{ uri: item.product?.imageUrl || FALLBACK }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </Pressable>
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeItem(item.productId)}
              >
                <Feather name="x" size={14} color={colors.foreground} />
              </Pressable>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={2}>
                  {item.product?.name}
                </Text>
                <Text style={[styles.cardPrice, { color: colors.foreground }]}>
                  ${Number(item.product?.price || 0).toFixed(2)}
                </Text>
                <Pressable
                  style={[styles.cartBtn, { borderColor: colors.border }]}
                  onPress={() => addToCart(item.productId)}
                  disabled={addingToCart === item.productId}
                >
                  {addingToCart === item.productId ? (
                    <ActivityIndicator size="small" color={colors.foreground} />
                  ) : (
                    <Text style={[styles.cartBtnText, { color: colors.foreground }]}>Add to Bag</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, paddingTop: 8, flex: 1 },
  count: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, color: "#64748b" },
  actionBtn: { paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  actionBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  card: { overflow: "hidden" },
  cardImage: { width: "100%", aspectRatio: 0.8 },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { padding: 10, gap: 6 },
  cardName: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  cardPrice: { fontSize: 13, fontWeight: "600" },
  cartBtn: { borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  cartBtnText: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
});
