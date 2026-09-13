import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const FALLBACK = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=600&auto=format&fit=crop";

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;
  const cardWidth = (SCREEN_WIDTH - 48) / 2;

  useEffect(() => {
    const load = async () => {
      try {
        const [rP, rC] = await Promise.all([
          fetch(apiUrl("/api/products")),
          fetch(apiUrl("/api/categories")),
        ]);
        const pData = await rP.json();
        const cData = await rC.json();
        setProducts(Array.isArray(pData) ? pData : []);
        setCategories(Array.isArray(cData) ? cData : []);
        if (params.category) {
          const found = (Array.isArray(cData) ? cData : []).find(
            (c: any) => c.id === params.category || c.name.toLowerCase() === params.category?.toLowerCase()
          );
          if (found) setSelectedCategory(found.id);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const filtered = products.filter(p => {
    const matchesCat = selectedCategory === "all" || p.categoryId === selectedCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Shop</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search products..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            style={[styles.chip, selectedCategory === "all" && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text style={[styles.chipText, { color: selectedCategory === "all" ? colors.primaryForeground : colors.mutedForeground }]}>
              All
            </Text>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              style={[styles.chip, { borderColor: colors.border }, selectedCategory === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.chipText, { color: selectedCategory === cat.id ? colors.primaryForeground : colors.mutedForeground }]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 16 }}
          contentContainerStyle={{
            gap: 16,
            padding: 16,
            paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
          }}
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
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingTop: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
  },
  chips: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
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
});
