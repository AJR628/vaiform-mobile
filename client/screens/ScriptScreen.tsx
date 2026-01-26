import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { storyGet } from "@/api/client";
import { unwrapNormalized, extractBeats, StoryBeat } from "@/lib/storySession";

import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import type { StorySession } from "@/types/story";

type ScriptRouteProp = RouteProp<HomeStackParamList, "Script">;

export default function ScriptScreen() {
  const route = useRoute<ScriptRouteProp>();
  const { sessionId } = route.params;

  const { theme } = useTheme();
  const { showError } = useToast();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await storyGet(sessionId);
        if (!res?.ok && res?.success !== true) {
          showError(res?.message || "Failed to load script. Please try again.");
          return;
        }
        const unwrapped = unwrapNormalized(res);
        setSession(unwrapped);
      } catch (err) {
        console.error("[script] load error:", err);
        showError("Failed to load script. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [sessionId, showError]);

  const beats: StoryBeat[] = useMemo(() => extractBeats(session), [session]);

  const renderBeat = ({ item }: { item: StoryBeat }) => {
    return (
      <Card elevation={1} style={styles.beatCard}>
        <View style={styles.beatHeader}>
          <ThemedText style={[styles.beatLabel, { color: theme.textSecondary }]}>
            Beat {item.sentenceIndex + 1}
          </ThemedText>
        </View>
        <ThemedText style={[styles.beatText, { color: theme.textPrimary }]}>
          {item.text}
        </ThemedText>
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.topNote}>
        <ThemedText style={[styles.topTitle, { color: theme.textPrimary }]}>
          Script
        </ThemedText>
        <ThemedText style={[styles.topSubtitle, { color: theme.textSecondary }]}>
          {__DEV__ 
            ? "Phase 1: read-only script view. Editing + remix buttons come next."
            : "Review and edit your beats before choosing clips."}
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading script...
          </ThemedText>
        </View>
      ) : beats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No beats found for this session.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={beats}
          keyExtractor={(b) => String(b.sentenceIndex)}
          renderItem={renderBeat}
          contentContainerStyle={styles.listContent}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNote: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  topTitle: { fontSize: 20, fontWeight: "600" },
  topSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  beatCard: { padding: Spacing.md },
  beatHeader: { marginBottom: 8 },
  beatLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  beatText: { fontSize: 15, lineHeight: 21 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  emptyText: { fontSize: 14, textAlign: "center" },
});
