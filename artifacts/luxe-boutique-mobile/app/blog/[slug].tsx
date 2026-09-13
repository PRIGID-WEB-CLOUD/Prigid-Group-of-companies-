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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiUrl } from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop";

export default function BlogPostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const WEB_TOP = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    fetch(apiUrl(`/api/posts/${slug}`))
      .then(r => r.json())
      .then(d => { setPost(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + WEB_TOP }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Post not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.foreground }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : 40 }}
      >
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: post.coverImage || FALLBACK }}
            style={{ width: "100%", height: 300 }}
            resizeMode="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <Pressable
            style={[styles.backBtn, { top: insets.top + WEB_TOP + 8 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            {post.category || "Atelier Journal"}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{post.title}</Text>
          {post.createdAt && (
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </Text>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.body, { color: colors.foreground }]}>
            {post.content || post.excerpt || "No content available."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  notFound: { fontSize: 16 },
  backLink: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, gap: 12 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 2.5, textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: "400", lineHeight: 32, letterSpacing: -0.5 },
  date: { fontSize: 12 },
  divider: { height: 1, marginVertical: 8 },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "300" },
});
