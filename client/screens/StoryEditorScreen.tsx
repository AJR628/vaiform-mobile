import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Pressable,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useRoute,
  useNavigation,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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

type StoryEditorNavProp = NativeStackNavigationProp<
  HomeStackParamList,
  "StoryEditor"
>;

export default function StoryEditorScreen() {
  const route = useRoute<StoryEditorRouteProp>();
  const navigation = useNavigation<StoryEditorNavProp>();
  const { sessionId } = route.params;
  const { theme } = useTheme();
  const { showError } = useToast();
  const tabBarHeight = useBottomTabBarHeight();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingByIndex, setSavingByIndex] = useState<Record<number, boolean>>(
    {}
  );
  const [beatTexts, setBeatTexts] = useState<Record<number, string>>({});
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [replaceModalForIndex, setReplaceModalForIndex] = useState<number | null>(null);

  const loggedRef = useRef(false);
  const shouldRefreshRef = useRef(false);

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

  // Refresh session when screen comes into focus (e.g., after modal closes)
  useFocusEffect(
    useCallback(() => {
      if (!shouldRefreshRef.current || isLoading) return;
      shouldRefreshRef.current = false; // clear BEFORE awaiting
      const refreshSession = async () => {
        try {
          const res = await storyGet(sessionId);
          if (res?.ok || res?.success === true) {
            const unwrappedSession = unwrapSession(res);
            setSession(unwrappedSession);
          }
        } catch (error) {
          // Silently fail - session will refresh on next manual action
          console.error("[story] refresh error:", error);
        }
      };
      refreshSession();
    }, [sessionId, isLoading]) // deps exclude session
  );

  const beats = session ? extractBeats(session) : [];

  // Clamp selectedSentenceIndex by membership (not numeric range)
  useEffect(() => {
    if (beats.length === 0) {
      setSelectedSentenceIndex(null);
      return;
    }

    // If no selection yet, set to first beat's sentenceIndex
    if (selectedSentenceIndex === null) {
      setSelectedSentenceIndex(beats[0].sentenceIndex);
      return;
    }

    // Check if selectedSentenceIndex exists in beats
    const exists = beats.some((beat) => beat.sentenceIndex === selectedSentenceIndex);
    if (!exists) {
      // Set to first beat's sentenceIndex if current selection is invalid
      setSelectedSentenceIndex(beats[0].sentenceIndex);
    }
  }, [session, beats, selectedSentenceIndex]);

  // Set header right button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            if (selectedSentenceIndex !== null) {
              setReplaceModalForIndex(selectedSentenceIndex);
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="more-horizontal" size={22} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, theme.text, selectedSentenceIndex]);

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

  const handleReplaceClip = (sentenceIndex: number) => {
    const shot = session ? getSelectedShot(session, sentenceIndex) : null;
    setReplaceModalForIndex(null); // Close modal before navigating
    shouldRefreshRef.current = true;
    navigation.navigate("ClipSearch", {
      sessionId,
      sentenceIndex,
      initialQuery: shot?.searchQuery ?? "",
    });
  };

  const renderTimelineItem = ({ item }: { item: Beat }) => {
    const isSelected = selectedSentenceIndex === item.sentenceIndex;
    const shot = session ? getSelectedShot(session, item.sentenceIndex) : null;
    const selectedClip = shot?.selectedClip || null;

    return (
      <Pressable
        style={[
          styles.timelineItem,
          isSelected && {
            borderColor: theme.link,
            borderWidth: 2,
          },
        ]}
        onPress={() => setSelectedSentenceIndex(item.sentenceIndex)}
        onLongPress={() => setReplaceModalForIndex(item.sentenceIndex)}
      >
        {selectedClip?.thumbUrl ? (
          <Image
            source={{ uri: selectedClip.thumbUrl }}
            style={[
              styles.timelineThumbnail,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.timelineThumbnail,
              styles.timelinePlaceholder,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
              <Feather name="video" size={16} color={theme.tabIconDefault} />
          </View>
        )}
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
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

  // Get selected shot and beat
  const selectedShot =
    selectedSentenceIndex !== null
      ? getSelectedShot(session, selectedSentenceIndex)
      : null;
  const selectedClip = selectedShot?.selectedClip || null;
  const selectedBeat =
    selectedSentenceIndex !== null
      ? beats.find((b) => b.sentenceIndex === selectedSentenceIndex)
      : null;
  const isSaving =
    selectedSentenceIndex !== null
      ? savingByIndex[selectedSentenceIndex] || false
      : false;
  const displayText =
    selectedSentenceIndex !== null
      ? beatTexts[selectedSentenceIndex] ?? selectedBeat?.text ?? ""
      : "";

  return (
    <ThemedView style={styles.container}>
      {/* Preview section */}
      <View style={styles.previewSection}>
        {/* Big preview of selected shot */}
        <View style={styles.previewContainer}>
          {selectedClip?.thumbUrl ? (
            <View style={styles.previewThumbnailContainer}>
              <Image
                source={{ uri: selectedClip.thumbUrl }}
                style={[
                  styles.previewThumbnail,
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
                styles.previewFallback,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="video" size={32} color={theme.tabIconDefault} />
              <ThemedText style={styles.fallbackText}>Video selected</ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.previewPlaceholder,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText style={styles.placeholderText}>No clip selected</ThemedText>
            </View>
          )}
        </View>

        {/* Selected beat text input */}
        {selectedBeat && (
          <View style={styles.inputContainer}>
            <ThemedText style={styles.beatLabel}>
              Beat {selectedBeat.sentenceIndex + 1}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={displayText}
              onChangeText={(text) => {
                if (selectedSentenceIndex !== null) {
                  setBeatTexts((prev) => ({
                    ...prev,
                    [selectedSentenceIndex]: text,
                  }));
                }
              }}
              onBlur={() => {
                if (selectedSentenceIndex !== null) {
                  handleSaveBeat(selectedSentenceIndex);
                }
              }}
              multiline
              editable={!isSaving}
              placeholderTextColor={theme.tabIconDefault}
            />
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={theme.link} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Timeline section */}
      <View style={[styles.timelineSection, { 
        borderTopColor: theme.backgroundTertiary,
        paddingBottom: tabBarHeight 
      }]}>
        <FlatList
          data={beats}
          renderItem={renderTimelineItem}
          keyExtractor={(item) => `beat-${item.sentenceIndex}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timelineContent}
        />
      </View>

      {/* Replace Clip Modal */}
      <Modal
        visible={replaceModalForIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReplaceModalForIndex(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReplaceModalForIndex(null)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={styles.modalTitle}>Replace Clip</ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={() => setReplaceModalForIndex(null)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.link },
                ]}
                onPress={() => {
                  if (replaceModalForIndex !== null) {
                    handleReplaceClip(replaceModalForIndex);
                  }
                }}
              >
                <ThemedText
                  style={[styles.modalButtonText, { color: theme.buttonText }]}
                >
                  Replace Clip
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  previewSection: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  previewContainer: {
    flex: 1,
    justifyContent: "center",
  },
  previewThumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    gap: Spacing.xs,
  },
  previewThumbnail: {
    width: "100%",
    height: "100%",
  },
  previewFallback: {
    width: "100%",
    aspectRatio: 16 / 9,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: 12,
  },
  previewPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: 12,
  },
  providerLabel: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: "capitalize",
  },
  fallbackText: {
    fontSize: 14,
    opacity: 0.7,
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.6,
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
  timelineSection: {
    borderTopWidth: 1,
  },
  timelineContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  timelineItem: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: Spacing.sm,
  },
  timelineThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  timelinePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 12,
    padding: Spacing.xl,
    minWidth: 280,
    maxWidth: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {},
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
