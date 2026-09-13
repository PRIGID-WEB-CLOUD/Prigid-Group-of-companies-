import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  PROCESSING: "#3b82f6",
  SHIPPED: "#8b5cf6",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
};

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    fetch(apiUrl("/api/orders"), { credentials: "include" })
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Order History</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your orders will appear here</Text>
          <Pressable style={[styles.shopBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/shop")}>
            <Text style={[styles.shopBtnText, { color: colors.primaryForeground }]}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Platform.OS === "web" ? 34 : 40 }}>
          {orders.map((order: any) => (
            <View key={order.id} style={[styles.orderCard, { borderColor: colors.border }]}>
              <View style={[styles.orderHeader, { backgroundColor: colors.muted }]}>
                <View style={styles.orderMeta}>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Order Ref</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>
                      #{(order.id || "").toString().slice(-8).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Date</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Total</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>
                      ${Number(order.total || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order.status] || "#64748b") + "20" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] || "#64748b" }]}>
                    {order.status || "Processing"}
                  </Text>
                </View>
              </View>
              {order.items && order.items.length > 0 && (
                <View style={styles.orderItems}>
                  {order.items.slice(0, 3).map((item: any, i: number) => (
                    <View key={i} style={styles.orderItem}>
                      <Image
                        source={{ uri: item.product?.imageUrl || FALLBACK }}
                        style={[styles.itemThumb, { backgroundColor: colors.muted }]}
                        resizeMode="cover"
                      />
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                          {item.product?.name}
                        </Text>
                        <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>
                          Qty: {item.quantity}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {order.items.length > 3 && (
                    <Text style={[styles.moreItems, { color: colors.mutedForeground }]}>
                      +{order.items.length - 3} more items
                    </Text>
                  )}
                </View>
              )}
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    paddingTop: 8,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  shopBtn: { paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  shopBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  orderCard: { borderWidth: 1, overflow: "hidden" },
  orderHeader: { padding: 16, gap: 12 },
  orderMeta: { flexDirection: "row", gap: 24, flexWrap: "wrap" },
  metaLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: "600" },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  orderItems: { padding: 16, gap: 12 },
  orderItem: { flexDirection: "row", gap: 12 },
  itemThumb: { width: 56, height: 68 },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  itemQty: { fontSize: 11 },
  moreItems: { fontSize: 12, marginTop: 4 },
});
