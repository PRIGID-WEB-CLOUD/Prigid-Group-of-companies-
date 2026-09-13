import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
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
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HERO_IMAGE = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop";
const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=600&auto=format&fit=crop";

const CATEGORIES = [
  {
    id: "Monochrome",
    name: "Monochrome",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "Accessories",
    name: "Accessories",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "Footwear",
    name: "Footwear",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=800&auto=format&fit=crop",
  },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    fetch(apiUrl("/api/products"))
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d.slice(0, 8)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cardWidth = (SCREEN_WIDTH - 48) / 2;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
      }}
    >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + WEB_TOP }]}>
        <Image
          source={{ uri: HERO_IMAGE }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>THE SUMMER ATELIER 2024</Text>
          <Text style={styles.heroTitle}>{"Architectural\nElegance"}</Text>
          <Text style={styles.heroSubtitle}>
            A study in precision tailoring and sustainable silk fabrics.
          </Text>
          <Pressable
            style={styles.heroButton}
            onPress={() => router.push("/(tabs)/shop")}
          >
            <Text style={styles.heroButtonText}>Explore Collection</Text>
          </Pressable>
        </View>
      </View>

      {/* Categories */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}>Curation</Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>The Collections</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              style={styles.categoryCard}
              onPress={() => router.push(`/(tabs)/shop?category=${cat.id}`)}
            >
              <Image source={{ uri: cat.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <View style={styles.categoryOverlay} />
              <Text style={styles.categoryName}>{cat.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Featured Products */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
          <Text style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}>New In</Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Featured</Text>
        </View>
        {loading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, paddingHorizontal: 16 }}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.productSkeleton, { width: cardWidth, backgroundColor: colors.muted }]} />
            ))}
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 16 }}
            contentContainerStyle={{ gap: 16, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.productCard, { width: cardWidth, backgroundColor: colors.muted }]}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <Image
                  source={{ uri: item.imageUrl || FALLBACK }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
                <View style={styles.productInfo}>
                  <Text style={[styles.productCategory, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.category?.name || "Boutique"}
                  </Text>
                  <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.productPrice, { color: colors.foreground }]}>
                    ${Number(item.price).toFixed(2)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Banner CTA */}
      <Pressable
        style={styles.banner}
        onPress={() => router.push("/(tabs)/shop")}
      >
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1770&auto=format&fit=crop" }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay} />
        <View style={styles.bannerContent}>
          <Text style={styles.bannerEyebrow}>New Season</Text>
          <Text style={styles.bannerTitle}>Shop All</Text>
          <Text style={styles.bannerArrow}>→</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 520,
    justifyContent: "flex-end",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  heroContent: {
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "300",
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "300",
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 16,
  },
  heroButton: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  heroButtonText: {
    color: "#0f172a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  section: {
    paddingVertical: 32,
    gap: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    gap: 4,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "300",
    letterSpacing: -0.5,
  },
  categoryCard: {
    width: 160,
    height: 200,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  categoryName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    padding: 12,
  },
  productSkeleton: {
    height: 280,
    borderRadius: 0,
  },
  productCard: {
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    aspectRatio: 0.8,
  },
  productInfo: {
    padding: 10,
    gap: 3,
  },
  productCategory: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  productName: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  banner: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bannerContent: {
    padding: 20,
    gap: 4,
  },
  bannerEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "300",
  },
  bannerArrow: {
    color: "#ffffff",
    fontSize: 20,
    marginTop: 4,
  },
});
