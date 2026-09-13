import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop";

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { refreshCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    fetch(apiUrl(`/api/products/${id}`))
      .then(r => r.json())
      .then(d => { setProduct(d); setLoading(false); })
      .catch(() => setLoading(false));

    if (user) {
      fetch(apiUrl("/api/wishlist"), { credentials: "include" })
        .then(r => r.json())
        .then((w: any[]) => {
          if (Array.isArray(w)) setIsWishlisted(w.some(item => item.productId === id));
        })
        .catch(() => {});
    }
  }, [id]);

  const addToCart = async () => {
    setAdding(true);
    try {
      const res = await fetch(apiUrl("/api/cart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: id, quantity }),
      });
      if (res.ok) {
        await refreshCart();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Error", data.error || "Could not add item to cart.");
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) { router.push("/login"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isWishlisted) {
      await fetch(apiUrl(`/api/wishlist/${id}`), { method: "DELETE", credentials: "include" });
      setIsWishlisted(false);
    } else {
      await fetch(apiUrl("/api/wishlist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: id }),
      });
      setIsWishlisted(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Product not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.foreground }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const stock = product.stock ?? 0;
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 5;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: product.imageUrl || FALLBACK }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.15 }}
            contentFit="cover"
          />
          {/* Back button */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + WEB_TOP + 8, backgroundColor: "rgba(255,255,255,0.9)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          {/* Wishlist button */}
          <Pressable
            style={[styles.wishlistBtn, { top: insets.top + WEB_TOP + 8, backgroundColor: "rgba(255,255,255,0.9)" }]}
            onPress={toggleWishlist}
          >
            <Feather
              name="heart"
              size={20}
              color={isWishlisted ? "#ef4444" : colors.foreground}
            />
          </Pressable>
          {product.isNew && (
            <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.newBadgeText, { color: colors.primaryForeground }]}>New</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={[styles.info, { borderBottomColor: colors.border }]}>
          <Text style={[styles.category, { color: colors.mutedForeground }]}>
            {product.category?.name || "Boutique"}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text>
          <Text style={[styles.price, { color: colors.foreground }]}>
            ${Number(product.price).toFixed(2)}
          </Text>
          {lowStock && (
            <Text style={[styles.stockWarning, { color: "#f59e0b" }]}>
              Only {stock} left in stock
            </Text>
          )}
          {!inStock && (
            <Text style={[styles.stockWarning, { color: colors.destructive }]}>Out of stock</Text>
          )}
        </View>

        {/* Description */}
        {product.description && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Description</Text>
            <Text style={[styles.description, { color: colors.foreground }]}>{product.description}</Text>
          </View>
        )}

        {/* Quantity */}
        {inStock && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Quantity</Text>
            <View style={styles.qtyRow}>
              <Pressable
                style={[styles.qtyBtn, { borderColor: colors.border }]}
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.qty, { color: colors.foreground }]}>{quantity}</Text>
              <Pressable
                style={[styles.qtyBtn, { borderColor: colors.border }]}
                onPress={() => setQuantity(q => Math.min(stock, q + 1))}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Reviews */}
        {product.reviews && product.reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Reviews ({product.reviews.length})
            </Text>
            {product.reviews.slice(0, 3).map((review: any, i: number) => (
              <View key={i} style={[styles.review, { borderTopColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>
                    {review.user?.name || "Customer"}
                  </Text>
                  <View style={styles.stars}>
                    {[1,2,3,4,5].map(s => (
                      <Feather key={s} name="star" size={12} color={s <= review.rating ? "#f59e0b" : colors.mutedForeground} />
                    ))}
                  </View>
                </View>
                <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>{review.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add to Cart CTA */}
      <View style={[
        styles.cta,
        {
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        }
      ]}>
        <Pressable
          style={[
            styles.ctaBtn,
            { backgroundColor: inStock ? (added ? "#16a34a" : colors.primary) : colors.muted }
          ]}
          onPress={addToCart}
          disabled={!inStock || adding}
        >
          {adding ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[
              styles.ctaBtnText,
              { color: inStock ? colors.primaryForeground : colors.mutedForeground }
            ]}>
              {!inStock ? "Out of Stock" : added ? "Added to Bag!" : "Add to Bag"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
  },
  backLink: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  wishlistBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  newBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  info: {
    padding: 20,
    gap: 6,
    borderBottomWidth: 1,
  },
  category: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 22,
    fontWeight: "400",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  stockWarning: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  section: {
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "300",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 28,
    textAlign: "center",
  },
  review: {
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: "600",
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    padding: 16,
    borderTopWidth: 1,
  },
  ctaBtn: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
