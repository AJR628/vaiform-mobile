import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Pressable,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { useCaptionPreview } from "@/hooks/useCaptionPreview";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { storyGet, storyUpdateBeatText, storyFinalize } from "@/api/client";
import { Linking } from "react-native";
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
  const { showError, showWarning, showSuccess } = useToast();
  const { userProfile, refreshCredits } = useAuth();
  const credits = userProfile?.credits ?? 0;
  const canRender = credits >= 20;
  const tabBarHeight = useBottomTabBarHeight();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingByIndex, setSavingByIndex] = useState<Record<number, boolean>>(
    {}
  );
  const [beatTexts, setBeatTexts] = useState<Record<number, string>>({});
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [replaceModalForIndex, setReplaceModalForIndex] = useState<number | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showRenderingModal, setShowRenderingModal] = useState(false);

  const { previewByIndex, isLoadingByIndex, requestPreview, prefetchAllBeats } =
    useCaptionPreview(sessionId, selectedSentenceIndex);

  const loggedRef = useRef(false);
  const prefetchDoneForSessionRef = useRef<string | null>(null);
  const shouldRefreshRef = useRef(false);
  const textInputRef = useRef<TextInput>(null);
  const savingRef = useRef<number | null>(null);

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

  const beats = useMemo(
    () => (session ? extractBeats(session) : []),
    [session]
  );

  const selectedText =
    selectedSentenceIndex !== null
      ? (beatTexts[selectedSentenceIndex] ??
          beats.find((b) => b.sentenceIndex === selectedSentenceIndex)?.text ??
          "")
      : "";

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

  // Trigger caption preview for the selected beat (debounced inside hook)
  useEffect(() => {
    if (selectedSentenceIndex === null || !sessionId) return;
    requestPreview(selectedSentenceIndex, selectedText, { placement: "center" });
  }, [selectedSentenceIndex, sessionId, selectedText, requestPreview]);

  // Prefetch caption previews for all beats once per session (no taps)
  useEffect(() => {
    if (!sessionId || beats.length === 0) return;
    if (prefetchDoneForSessionRef.current === sessionId) return;
    prefetchDoneForSessionRef.current = sessionId;
    prefetchAllBeats(beats, { delayBetweenMs: 120 });
  }, [sessionId, beats, prefetchAllBeats]);

  // Set header right button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => navigation.navigate("Script", { sessionId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Feather name="file-text" size={20} color={theme.text} />
          </Pressable>

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
        </View>
      ),
    });
  }, [navigation, theme.text, selectedSentenceIndex, sessionId]);

  const handleSaveBeat = async (
    sentenceIndex: number,
    _source?: "submit" | "blur",
    draftOverride?: string
  ) => {
    if (savingRef.current === sentenceIndex) return;

    const draft = (draftOverride ?? beatTexts[sentenceIndex] ?? "").trim();
    if (!draft) {
      showError("Beat text cannot be empty");
      return;
    }

    const beat = beats.find((b) => b.sentenceIndex === sentenceIndex);
    const original = beat?.text?.trim() ?? "";
    if (draft === original) {
      savingRef.current = sentenceIndex;
      textInputRef.current?.blur();
      Keyboard.dismiss();
      setTimeout(() => {
        savingRef.current = null;
      }, 0);
      return;
    }

    savingRef.current = sentenceIndex;
    setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: true }));

    try {
      const res = await storyUpdateBeatText({
        sessionId,
        sentenceIndex,
        text: draft,
      });

      if (!res?.ok && res?.success !== true) {
        showError(res?.message || "Failed to update beat text");
        return;
      }

      textInputRef.current?.blur();
      Keyboard.dismiss();
      setSelectedSentenceIndex(null);
    } catch (error) {
      console.error("[story] save beat error:", error);
      showError("Failed to update beat text. Please try again.");
    } finally {
      setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
      savingRef.current = null;
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

  const handleRender = async () => {
    // Credit check: verify cost is 20 credits (from spec verification)
    if (credits < 20) {
      showError("Not enough credits. You need 20 credits to render.");
      Linking.openURL("https://vaiform.com/pricing");
      return;
    }

    setIsRendering(true);
    setShowRenderingModal(true);

    try {
      let result = await storyFinalize({ sessionId });
      let retryCount = 0;
      const maxRetries = 1;

      // Handle 503 retry logic
      while (!result.ok && result.retryAfter && retryCount < maxRetries) {
        showWarning(`Server busy. Retrying in ${result.retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, result.retryAfter! * 1000));
        result = await storyFinalize({ sessionId });
        retryCount++;
      }

      if (!result.ok) {
        // Handle different error cases
        if (result.code === "INSUFFICIENT_CREDITS" || result.status === 402) {
          showError("Not enough credits. You need 20 credits to render.");
          Linking.openURL("https://vaiform.com/pricing");
        } else if (result.code === "NOT_FOUND" || result.status === 404) {
          showError("Session not found. Please start a new video.");
          navigation.goBack();
        } else if (result.code === "TIMEOUT") {
          showError("Request timed out. Please try again.");
        } else if (result.code === "NETWORK_ERROR" || result.status === 0) {
          showError("Network error. Please check your connection and try again.");
        } else {
          showError(result.message || "Render failed. Please try again.");
        }
        setShowRenderingModal(false);
        return;
      }

      // Success: navigate to ShortDetail
      if (result.ok && result.shortId) {
        setShowRenderingModal(false);
        showSuccess("Video rendered successfully!");
        
        // Refresh credits to show updated balance
        try {
          await refreshCredits();
        } catch (err) {
          console.warn("[story] Failed to refresh credits after render:", err);
          // Don't block navigation on credit refresh failure
        }
        
        const tabNavigator = navigation.getParent();
        if (__DEV__) {
          console.log("[nav-verify] parent routeNames:", tabNavigator?.getState()?.routeNames);
        }
        if (tabNavigator) {
          tabNavigator.navigate("LibraryTab", {
            screen: "ShortDetail",
            params: { shortId: result.shortId },
          });
        } else {
          console.warn("[story] Could not access tab navigator for cross-stack navigation");
          showError("Render succeeded, but navigation failed. Please check your Library.");
        }
      }
    } catch (error) {
      console.error("[story] render error:", error);
      showError("An unexpected error occurred. Please try again.");
      setShowRenderingModal(false);
    } finally {
      setIsRendering(false);
    }
  };

  const renderTimelineItem = ({ item }: { item: Beat }) => {
    const isSelected = selectedSentenceIndex === item.sentenceIndex;
    const shot = session ? getSelectedShot(session, item.sentenceIndex) : null;
    const selectedClip = shot?.selectedClip || null;
    const captionRasterUrl = previewByIndex[item.sentenceIndex];

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
          <View style={styles.timelineThumbnailWrapper}>
            <Image
              source={{ uri: selectedClip.thumbUrl }}
              style={[
                styles.timelineThumbnail,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              resizeMode="cover"
            />
            {captionRasterUrl && (
              <View style={styles.timelineCaptionOverlay} pointerEvents="none">
                <Image
                  source={{ uri: captionRasterUrl }}
                  style={styles.timelineCaptionImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.timelineThumbnail,
              styles.timelinePlaceholder,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="video" size={16} color={theme.tabIconDefault} />
            {captionRasterUrl && (
              <View style={styles.timelineCaptionOverlay} pointerEvents="none">
                <Image
                  source={{ uri: captionRasterUrl }}
                  style={styles.timelineCaptionImage}
                  resizeMode="contain"
                />
              </View>
            )}
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
          <View style={styles.previewStage9x16}>
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
              {/* Caption preview overlay (server-measured raster) */}
              {selectedSentenceIndex !== null &&
                previewByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <Image
                      source={{ uri: previewByIndex[selectedSentenceIndex]! }}
                      style={styles.captionPreviewImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              {selectedSentenceIndex !== null &&
                isLoadingByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color={theme.link} />
                  </View>
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
              {/* Caption preview overlay (fallback branch) */}
              {selectedSentenceIndex !== null &&
                previewByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <Image
                      source={{ uri: previewByIndex[selectedSentenceIndex]! }}
                      style={styles.captionPreviewImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              {selectedSentenceIndex !== null &&
                isLoadingByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color={theme.link} />
                  </View>
                )}
            </View>
          ) : (
            <View
              style={[
                styles.previewPlaceholder,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <ThemedText style={styles.placeholderText}>No clip selected</ThemedText>
              {/* Caption preview overlay when no clip (server-measured raster) */}
              {selectedSentenceIndex !== null &&
                previewByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <Image
                      source={{ uri: previewByIndex[selectedSentenceIndex]! }}
                      style={styles.captionPreviewImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              {selectedSentenceIndex !== null &&
                isLoadingByIndex[selectedSentenceIndex] && (
                  <View style={styles.captionPreviewOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color={theme.link} />
                  </View>
                )}
            </View>
          )}
          </View>
        </View>
      </View>

      {/* Beat editor */}
      {selectedBeat && (
        <KeyboardAvoidingView
          style={styles.beatEditorKav}
          behavior={Platform.OS === "ios" ? "position" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputContainer}>
            <ThemedText style={styles.beatLabel}>
              Beat {selectedBeat.sentenceIndex + 1}
            </ThemedText>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={displayText}
              onChangeText={(text) => {
                if (selectedSentenceIndex === null) return;
                
                if (text.includes("\n")) {
                  const cleaned = text.replace(/\n/g, " ").trim();
                  setBeatTexts((prev) => ({
                    ...prev,
                    [selectedSentenceIndex]: cleaned,
                  }));
                  handleSaveBeat(selectedBeat.sentenceIndex, "submit", cleaned);
                  textInputRef.current?.blur();
                  Keyboard.dismiss();
                } else {
                  setBeatTexts((prev) => ({
                    ...prev,
                    [selectedSentenceIndex]: text,
                  }));
                }
              }}
              onBlur={() => handleSaveBeat(selectedBeat.sentenceIndex, "blur")}
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
        </KeyboardAvoidingView>
      )}

      {/* Timeline section */}
      <View style={[styles.timelineSection, { 
        borderTopColor: theme.backgroundTertiary,
      }]}>
        <FlatList
          data={beats}
          renderItem={renderTimelineItem}
          keyExtractor={(item) => `beat-${item.sentenceIndex}`}
          extraData={{ previewByIndex, selectedSentenceIndex }}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timelineContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </View>

      {/* Render Button */}
      <View style={[styles.renderButtonContainer, { paddingBottom: tabBarHeight }]}>
        <Pressable
          style={[
            styles.renderButton,
            {
              backgroundColor: canRender && !isRendering ? theme.link : theme.backgroundTertiary,
              opacity: canRender && !isRendering ? 1 : 0.5,
            },
          ]}
          onPress={handleRender}
          disabled={isRendering || !canRender}
        >
          <ThemedText
            style={[
              styles.renderButtonText,
              { color: canRender && !isRendering ? theme.buttonText : theme.text },
            ]}
          >
            {isRendering ? "Rendering..." : "Render"}
          </ThemedText>
        </Pressable>
      </View>

      {/* Rendering Modal */}
      <Modal
        visible={showRenderingModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Don't allow closing during render
          if (!isRendering) {
            setShowRenderingModal(false);
          }
        }}
      >
        <View style={styles.renderingModalOverlay}>
          <View style={[styles.renderingModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText style={styles.renderingModalTitle}>Rendering your video...</ThemedText>
            <ThemedText style={[styles.renderingModalSubtext, { color: theme.tabIconDefault }]}>
              This usually takes 2-5 minutes
            </ThemedText>
          </View>
        </View>
      </Modal>

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
    padding: Spacing.sm,
    gap: Spacing.md,
  },
  previewContainer: {
    flex: 1,
    alignItems: "center",
  },
  previewStage9x16: {
    flex: 1,
    maxWidth: "100%",
    alignSelf: "center",
    aspectRatio: 9 / 16,
    overflow: "hidden",
    position: "relative",
  },
  previewThumbnailContainer: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  previewThumbnail: {
    flex: 1,
    width: "100%",
  },
  captionPreviewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 80,
    height: "45%",
    zIndex: 10,
    elevation: 10,
  },
  captionPreviewImage: {
    width: "100%",
    height: "100%",
  },
  previewFallback: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewPlaceholder: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
  beatEditorKav: {
    flexShrink: 0,
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
  timelineThumbnailWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: 8,
  },
  timelineThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  timelinePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  timelineCaptionOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "50%",
  },
  timelineCaptionImage: {
    width: "100%",
    height: "100%",
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
  renderButtonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "transparent",
  },
  renderButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  renderButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  renderingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  renderingModalContent: {
    borderRadius: 12,
    padding: Spacing.xl,
    minWidth: 280,
    maxWidth: "80%",
    alignItems: "center",
    gap: Spacing.md,
  },
  renderingModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  renderingModalSubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
});
