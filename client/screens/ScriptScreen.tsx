import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { storyGet, storyPlan, storySearchAll } from "@/api/client";
import { unwrapNormalized, extractBeats, StoryBeat } from "@/lib/storySession";

import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import type { StorySession } from "@/types/story";

type ScriptRouteProp = RouteProp<HomeStackParamList, "Script">;

export default function ScriptScreen() {
  const route = useRoute<ScriptRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, "Script">>();
  const { sessionId } = route.params;

  const { theme } = useTheme();
  const { showError } = useToast();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string | null>(null);

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

  const hasShots = useMemo(() => {
    if (!session) return false;
    return Array.isArray((session as any)?.shots) 
      ? (session as any).shots.length > 0 
      : !!(session as any)?.shots;
  }, [session]);

  const handleGenerateStoryboard = async () => {
    setIsBuilding(true);
    
    try {
      // Step 1: Plan shots
      setBuildProgress("Planning shots…");
      const planResult = await storyPlan({ sessionId });
      
      if (!planResult.ok) {
        showError(planResult.message || "Failed to plan shots");
        setIsBuilding(false);
        setBuildProgress(null);
        return;
      }
      
      // Step 2: Search clips
      setBuildProgress("Finding clips…");
      const searchResult = await storySearchAll({ sessionId });
      
      if (!searchResult.ok) {
        showError(searchResult.message || "Failed to find clips");
        setIsBuilding(false);
        setBuildProgress(null);
        return;
      }
      
      // Success: replace Script with StoryEditor
      navigation.replace("StoryEditor", { sessionId });
    } catch (error) {
      console.error("[script] build error:", error);
      showError("Failed to generate storyboard. Please try again.");
      setIsBuilding(false);
      setBuildProgress(null);
    }
  };

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
        <>
          <FlatList
            data={beats}
            keyExtractor={(b) => String(b.sentenceIndex)}
            renderItem={renderBeat}
            contentContainerStyle={[
              styles.listContent,
              !hasShots && { paddingBottom: Spacing.xl + 100 },
            ]}
          />
          {!hasShots && (
            <View style={[
              styles.ctaContainer,
              { 
                borderTopColor: theme.backgroundTertiary,
                paddingBottom: insets.bottom + Spacing.md,
              },
            ]}>
              {buildProgress && (
                <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                  {buildProgress}
                </ThemedText>
              )}
              <Button
                onPress={handleGenerateStoryboard}
                disabled={isBuilding}
                style={styles.generateButton}
              >
                {isBuilding ? "Generating..." : "Generate Storyboard"}
              </Button>
            </View>
          )}
        </>
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
  ctaContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  generateButton: {
    marginTop: Spacing.sm,
  },
  progressText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
});
