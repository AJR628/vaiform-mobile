import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoute, RouteProp } from "@react-navigation/native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { storyGet, storyUpdateBeatText } from "@/api/client";
import type { StorySession } from "@/types/story";

type StoryEditorRouteProp = RouteProp<HomeStackParamList, "StoryEditor">;

interface Beat {
  sentenceIndex: number;
  text: string;
}

/**
 * Unwrap session from NormalizedResponse shape
 */
function unwrapSession(res: any): any {
  // Prefer normalized shape first (apiRequestNormalized returns { ok: true, data: T })
  if (res?.data && (res?.ok === true || res?.success === true)) return res.data;
  // Some wrappers return session directly (defensive fallback)
  return res;
}

/**
 * Extract beats from session with defensive checks
 */
function extractBeats(session: any): Beat[] {
  if (!session) return [];

  // Check story.sentences (expected path from spec)
  if (Array.isArray(session?.story?.sentences)) {
    return session.story.sentences.map((text: string, index: number) => ({
      sentenceIndex: index,
      text: typeof text === "string" ? text : String(text),
    }));
  }

  // Fallback checks (defensive)
  if (Array.isArray(session?.sentences)) {
    return session.sentences.map((item: any, index: number) => ({
      sentenceIndex: index,
      text: typeof item === "string" ? item : item?.text || String(item),
    }));
  }

  if (Array.isArray(session?.beats)) {
    return session.beats.map((beat: any, index: number) => ({
      sentenceIndex: index,
      text: beat?.text || String(beat),
    }));
  }

  return [];
}

/**
 * Get shot for a given sentenceIndex from session
 */
function getSelectedShot(session: any, sentenceIndex: number): any | null {
  if (!session?.shots) return null;

  // If shots is an array, find by sentenceIndex property
  if (Array.isArray(session.shots)) {
    return session.shots.find((s: any) => s?.sentenceIndex === sentenceIndex) || null;
  }

  // If shots is an object/map, try accessing by key
  if (typeof session.shots === "object") {
    return session.shots[String(sentenceIndex)] || session.shots[sentenceIndex] || null;
  }

  return null;
}

export default function StoryEditorScreen() {
  const route = useRoute<StoryEditorRouteProp>();
  const { sessionId } = route.params;
  const { theme } = useTheme();
  const { showError } = useToast();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingByIndex, setSavingByIndex] = useState<Record<number, boolean>>(
    {}
  );
  const [beatTexts, setBeatTexts] = useState<Record<number, string>>({});

  const loggedRef = useRef(false);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        const res = await storyGet(sessionId);
        if (!res?.ok && res?.success !== true) {
          showError(
            res?.message || "Failed to load storyboard. Please try again."
          );
          setIsLoading(false);
          return;
        }

        const unwrappedSession = unwrapSession(res);
        setSession(unwrappedSession);

        // Extract beats and initialize beatTexts
        const beats = extractBeats(unwrappedSession);
        setBeatTexts((prev) => {
          const updated = { ...prev };
          beats.forEach((beat) => {
            // Only initialize if not already set (preserve existing edits)
            if (updated[beat.sentenceIndex] === undefined) {
              updated[beat.sentenceIndex] = beat.text;
            }
          });
          return updated;
        });

        // __DEV__ logging (once per session load)
        if (__DEV__ && unwrappedSession && !loggedRef.current) {
          loggedRef.current = true;
          console.log(
            "[story] session keys",
            Object.keys(unwrappedSession || {})
          );
          const beats = extractBeats(unwrappedSession);
          if (beats.length > 0) {
            console.log(
              "[story] beats found:",
              beats.length,
              "sample:",
              beats[0]
            );
          } else {
            console.log("[story] no beats found in session");
          }
          // Log shots structure
          if (unwrappedSession?.shots?.[0]) {
            console.log("[story] shots[0] sample:", unwrappedSession.shots[0]);
          }
        }
      } catch (error) {
        console.error("[story] load error:", error);
        showError("Failed to load storyboard. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId, showError]);

  const beats = session ? extractBeats(session) : [];

  const handleSaveBeat = async (sentenceIndex: number) => {
    const text = beatTexts[sentenceIndex];
    if (!text || text.trim() === "") {
      showError("Beat text cannot be empty");
      return;
    }

    setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: true }));

    try {
      const res = await storyUpdateBeatText({
        sessionId,
        sentenceIndex,
        text: text.trim(),
      });

      if (!res?.ok && res?.success !== true) {
        showError(res?.message || "Failed to update beat text");
        // On error, we could optionally revert the optimistic update
        // For now, keep the edited text in beatTexts (user can retry)
        return;
      }

      // Optimistic update: beatTexts already has the updated text, so no action needed
      // The UI will continue showing the edited text
    } catch (error) {
      console.error("[story] save beat error:", error);
      showError("Failed to update beat text. Please try again.");
    } finally {
      setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
    }
  };

  const renderBeat = ({ item }: { item: Beat }) => {
    const isSaving = savingByIndex[item.sentenceIndex] || false;
    const displayText = beatTexts[item.sentenceIndex] ?? item.text;

    // Get shot for this beat
    const shot = session ? getSelectedShot(session, item.sentenceIndex) : null;
    const selectedClip = shot?.selectedClip || null;

    return (
      <Card elevation={1} style={styles.beatCard}>
        <ThemedText style={styles.beatLabel}>
          Beat {item.sentenceIndex + 1}
        </ThemedText>
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.textInput,
              {
                color: theme.textPrimary,
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            value={displayText}
            onChangeText={(text) => {
              setBeatTexts((prev) => ({
                ...prev,
                [item.sentenceIndex]: text,
              }));
            }}
            onBlur={() => handleSaveBeat(item.sentenceIndex)}
            multiline
            editable={!isSaving}
            placeholderTextColor={theme.textTertiary}
          />
          {isSaving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          )}
        </View>

        {/* Clip preview */}
        <View style={styles.clipPreviewContainer}>
          {selectedClip?.thumbUrl ? (
            <View style={styles.thumbnailContainer}>
              <Image
                source={{ uri: selectedClip.thumbUrl }}
                style={[
                  styles.thumbnail,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                resizeMode="cover"
              />
              {selectedClip.provider && (
                <ThemedText style={styles.providerLabel}>
                  {selectedClip.provider}
                </ThemedText>
              )}
            </View>
          ) : selectedClip ? (
            <View
              style={[
                styles.fallbackContainer,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="video" size={24} color={theme.textTertiary} />
              <ThemedText style={styles.fallbackText}>Video selected</ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.placeholderContainer,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText style={styles.placeholderText}>No clip selected</ThemedText>
            </View>
          )}
        </View>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={styles.loadingText}>Loading storyboard...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (beats.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No beats found in this storyboard.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={beats}
        renderItem={renderBeat}
        keyExtractor={(item) => `beat-${item.sentenceIndex}`}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
  beatCard: {
    marginBottom: Spacing.md,
  },
  beatLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  inputContainer: {
    position: "relative",
  },
  textInput: {
    minHeight: 80,
    padding: Spacing.md,
    borderRadius: 8,
    fontSize: 16,
    textAlignVertical: "top",
  },
  savingIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  clipPreviewContainer: {
    marginTop: Spacing.md,
  },
  thumbnailContainer: {
    gap: Spacing.xs,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
  },
  providerLabel: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: "capitalize",
  },
  fallbackContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 8,
  },
  fallbackText: {
    fontSize: 14,
    opacity: 0.7,
  },
  placeholderContainer: {
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.6,
  },
});
