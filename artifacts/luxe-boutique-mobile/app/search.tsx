import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
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

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();

  const [query, setQuery] = useState(params.q || "");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;
  const cardWidth = (SCREEN_WIDTH - 48) / 2;

  const doSearch = async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/products?search=${encodeURIComponent(q.trim())}`));
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (params.q) doSearch(params.q);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border, flex: 1 }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search products..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => doSearch(query)}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setProducts([]); }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : products.length === 0 && query.trim() ? (
        <View style={styles.center}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No products found for "{query}"
          </Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Search for products by name
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={[styles.resultsText, { color: colors.mutedForeground }]}>
              {products.length} result{products.length !== 1 ? "s" : ""} for "{query}"
            </Text>
          </View>
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 16 }}
            contentContainerStyle={{
              gap: 16,
              padding: 16,
              paddingBottom: Platform.OS === "web" ? 34 : 40,
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
        </>
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
    paddingBottom: 12,
    paddingTop: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  resultsText: { fontSize: 12, fontWeight: "500" },
  productCard: { overflow: "hidden" },
  productImage: { width: "100%", aspectRatio: 0.8 },
  productInfo: { padding: 10, gap: 3 },
  productCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  productName: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  productPrice: { fontSize: 13, fontWeight: "600", marginTop: 2 },
});
