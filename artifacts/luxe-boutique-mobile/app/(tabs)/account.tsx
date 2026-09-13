import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { apiUrl } from "@/lib/api";

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, loading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useFocusEffect(useCallback(() => {
    if (user) {
      setOrdersLoading(true);
      fetch(apiUrl("/api/orders"), { credentials: "include" })
        .then(r => r.json())
        .then(d => setOrders(Array.isArray(d) ? d.slice(0, 5) : []))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
  }, [user]));

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <Feather name="user" size={48} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in to view your orders, wishlist, and account settings.
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/login")}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/register")}>
          <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
            New to Luxe Boutique? <Text style={{ color: colors.foreground, fontWeight: "700" }}>Create Account</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 }}
    >
      {/* Profile header */}
      <View style={[styles.profileHeader, { paddingTop: insets.top + WEB_TOP + 16, backgroundColor: colors.primary }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.profileName}>{user.name}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
        {user.role === "admin" && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      {/* Recent Orders */}
      <View style={[styles.section, { borderBottomColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Feather name="package" size={18} color={colors.foreground} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Orders</Text>
        </View>
        {ordersLoading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
        ) : orders.length === 0 ? (
          <Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>No orders yet</Text>
        ) : (
          orders.map((order: any) => (
            <View key={order.id} style={[styles.orderRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.orderId, { color: colors.mutedForeground }]}>
                  #{(order.id || "").toString().slice(0, 8).toUpperCase()}
                </Text>
                <Text style={[styles.orderStatus, { color: colors.foreground }]}>
                  {order.status || "Processing"}
                </Text>
              </View>
              <Text style={[styles.orderAmount, { color: colors.foreground }]}>
                ${Number(order.total || 0).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Menu items */}
      {[
        { icon: "package" as const, label: "Order History", onPress: () => router.push("/orders") },
        { icon: "heart" as const, label: "Wishlist", onPress: () => router.push("/wishlist") },
        { icon: "search" as const, label: "Search", onPress: () => router.push("/search") },
        { icon: "book-open" as const, label: "Journal", onPress: () => router.push("/blog") },
      ].map(item => (
        <Pressable
          key={item.label}
          style={[styles.menuRow, { borderBottomColor: colors.border }]}
          onPress={item.onPress}
        >
          <View style={styles.menuLeft}>
            <Feather name={item.icon} size={18} color={colors.foreground} />
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      ))}

      {/* Logout */}
      <Pressable
        style={[styles.logoutBtn, { borderColor: colors.border }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  linkText: {
    fontSize: 13,
  },
  profileHeader: {
    padding: 24,
    paddingBottom: 32,
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  profileName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  profileEmail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  adminBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  adminBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  emptyLabel: {
    paddingHorizontal: 16,
    fontSize: 13,
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  orderId: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  orderStatus: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginTop: 8,
    marginHorizontal: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
