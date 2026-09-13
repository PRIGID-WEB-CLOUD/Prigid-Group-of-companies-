import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { apiUrl } from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=400&auto=format&fit=crop";

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshCart } = useCart();

  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    fetch(apiUrl("/api/cart"), { credentials: "include" })
      .then(r => r.json())
      .then(d => setCart(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const items = cart?.items || [];
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.product?.price || 0) * item.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    if (!shippingAddress.trim()) {
      setError("Please enter a shipping address");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const callbackUrl = Linking.createURL("checkout-verify");
      const res = await fetch(apiUrl("/api/payments/initialize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: user?.name || "Guest",
          customerEmail: user?.email,
          provider: "paystack",
          shippingAddress,
          callbackUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unable to start secure payment.");
      }
      const data = await res.json();
      const authUrl = data?.data?.authorization_url;
      if (!authUrl) throw new Error("Payment provider did not return a checkout URL.");
      const browserResult = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
      if (browserResult.type !== "success" || !browserResult.url) {
        throw new Error("Payment was cancelled before completion.");
      }
      const query = Linking.parse(browserResult.url).queryParams || {};
      const reference = String(query.reference || query.trxref || "");
      if (!reference) throw new Error("Payment reference was not returned.");
      const verify = await fetch(apiUrl(`/api/payments/verify/${encodeURIComponent(reference)}`), {
        credentials: "include",
      });
      const verifyData = await verify.json();
      if (!verify.ok || !verifyData.order) throw new Error(verifyData.error || "Payment could not be verified.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshCart();
      setSuccess(true);
    } catch {
      setError("Payment could not be completed. Please try again.");
    }
    setProcessing(false);
  };

  if (success) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successIcon, { backgroundColor: "#f0fdf4" }]}>
          <Feather name="check" size={40} color="#22c55e" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Order Placed!</Text>
        <Text style={[styles.successText, { color: colors.mutedForeground }]}>
          Thank you for your purchase. You'll receive a confirmation shortly.
        </Text>
        <Pressable
          style={[styles.continueBtn, { backgroundColor: colors.primary }]}
          onPress={() => { router.push("/(tabs)/shop"); }}
        >
          <Text style={[styles.continueBtnText, { color: colors.primaryForeground }]}>Continue Shopping</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/orders")}>
          <Text style={[styles.ordersLink, { color: colors.mutedForeground }]}>View My Orders</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Checkout</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 120 }}>
          {/* Order Summary */}
          <View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Order Summary</Text>
            {items.map((item: any) => (
              <View key={item.productId} style={[styles.summaryItem, { borderBottomColor: colors.border }]}>
                <Image
                  source={{ uri: item.product?.imageUrl || FALLBACK }}
                  style={[styles.thumb, { backgroundColor: colors.muted }]}
                  resizeMode="cover"
                />
                <View style={styles.itemDetail}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                    {item.product?.name}
                  </Text>
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>Qty: {item.quantity}</Text>
                </View>
                <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                  ${(Number(item.product?.price || 0) * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
            </View>
          </View>

          {/* Shipping Address */}
          <View style={styles.addressSection}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Shipping Address</Text>
            <TextInput
              style={[styles.addressInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
              placeholder={"123 Main St, City, Country"}
              placeholderTextColor={colors.mutedForeground}
              value={shippingAddress}
              onChangeText={setShippingAddress}
              multiline
              numberOfLines={3}
            />
          </View>

          {error && (
            <View style={[styles.errorBox, { borderColor: "#fecaca", backgroundColor: "#fef2f2" }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
               You will be redirected to Paystack to complete payment securely. Your order is created only after payment is verified.
            </Text>
          </View>

          <Pressable
            style={[styles.orderBtn, { backgroundColor: processing ? colors.muted : colors.primary }]}
            onPress={handlePlaceOrder}
            disabled={processing || items.length === 0}
          >
            {processing ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.orderBtnText, { color: processing ? colors.mutedForeground : colors.primaryForeground }]}>
                Place Order — ${subtotal.toFixed(2)}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  thumb: { width: 56, height: 68 },
  itemDetail: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  itemQty: { fontSize: 11, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: "700" },
  totalValue: { fontSize: 16, fontWeight: "700" },
  addressSection: { gap: 12 },
  addressInput: {
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, flex: 1 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, alignItems: "flex-start" },
  infoText: { fontSize: 12, lineHeight: 18, flex: 1 },
  orderBtn: { paddingVertical: 16, alignItems: "center" },
  orderBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  successText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  continueBtn: { paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  continueBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  ordersLink: { fontSize: 13, textDecorationLine: "underline" },
});
