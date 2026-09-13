import React, { useEffect, useState } from "react";
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const FALLBACK = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop";

export default function BlogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    fetch(apiUrl("/api/posts"))
      .then(r => r.json())
      .then(d => setPosts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + WEB_TOP, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Journal</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Feather name="book-open" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: Platform.OS === "web" ? 34 : 40 }}
        >
          {posts.map((post: any, i: number) => (
            <Pressable
              key={post.id}
              style={[styles.postCard, { backgroundColor: colors.background }]}
              onPress={() => router.push(`/blog/${post.slug || post.id}`)}
            >
              <Image
                source={{ uri: post.coverImage || FALLBACK }}
                style={[styles.postImage, { backgroundColor: colors.muted }]}
                resizeMode="cover"
              />
              <View style={styles.postInfo}>
                <Text style={[styles.postEyebrow, { color: colors.mutedForeground }]}>
                  {post.category || "Atelier Journal"}
                </Text>
                <Text style={[styles.postTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {post.title}
                </Text>
                {post.excerpt && (
                  <Text style={[styles.postExcerpt, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {post.excerpt}
                  </Text>
                )}
                <View style={styles.postMeta}>
                  <Text style={[styles.postDate, { color: colors.mutedForeground }]}>
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
                  </Text>
                  <View style={styles.readMore}>
                    <Text style={[styles.readMoreText, { color: colors.foreground }]}>Read</Text>
                    <Feather name="arrow-right" size={12} color={colors.foreground} />
                  </View>
                </View>
              </View>
            </Pressable>
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
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  postCard: { gap: 16 },
  postImage: { width: "100%", height: 220 },
  postInfo: { gap: 8 },
  postEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 2.5, textTransform: "uppercase" },
  postTitle: { fontSize: 20, fontWeight: "400", lineHeight: 26, letterSpacing: -0.3 },
  postExcerpt: { fontSize: 13, lineHeight: 20, fontWeight: "300" },
  postMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  postDate: { fontSize: 11 },
  readMore: { flexDirection: "row", alignItems: "center", gap: 4 },
  readMoreText: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
});
