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
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
} from "react-native-reanimated";
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

  const scrollX = useSharedValue(0);
  const onDeckScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const loggedRef = useRef(false);
  const prefetchDoneForSessionRef = useRef<string | null>(null);
  const shouldRefreshRef = useRef(false);
  const textInputRef = useRef<TextInput>(null);
  const savingRef = useRef<number | null>(null);
  const deckListRef = useRef<FlatList<Beat>>(null);
  const selectionFromDeckRef = useRef(false);
  const deckAreaHRef = useRef(0);
  const isEditingRef = useRef(false);

  const [deckAreaH, setDeckAreaH] = useState(0);
  const [draftText, setDraftText] = useState("");

  const onDeckLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== deckAreaHRef.current) {
      deckAreaHRef.current = h;
      setDeckAreaH(h);
    }
  }, []);

  const { width: windowWidth } = useWindowDimensions();
  const deckGap = 12;
  const desiredW = Math.round(windowWidth * 0.84);
  const desiredH = desiredW * (16 / 9);
  const cardH = deckAreaH > 0 ? Math.min(deckAreaH, desiredH) : desiredH;
  const cardW = Math.round((cardH * 9) / 16);
  const cardStep = cardW + deckGap;

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

  const committedText =
    selectedSentenceIndex !== null
      ? (beatTexts[selectedSentenceIndex] ??
          beats.find((b) => b.sentenceIndex === selectedSentenceIndex)?.text ??
          "")
      : "";

  // Sync draftText when selection changes (not when beatTexts changes — avoid clobbering active typing)
  useEffect(() => {
    if (selectedSentenceIndex === null) return;
    if (isEditingRef.current) return;

    const committed =
      beatTexts[selectedSentenceIndex] ??
      beats.find((b) => b.sentenceIndex === selectedSentenceIndex)?.text ??
      "";

    setDraftText(committed);
  }, [selectedSentenceIndex, sessionId, beats]);

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

  // Trigger caption preview for the selected beat (debounced inside hook). Only on committed text.
  useEffect(() => {
    if (selectedSentenceIndex === null || !sessionId) return;
    if (!committedText.trim()) return;
    requestPreview(selectedSentenceIndex, committedText, { placement: "center" });
  }, [selectedSentenceIndex, sessionId, committedText, requestPreview]);

  // Prefetch caption previews for all beats once per session (no taps)
  useEffect(() => {
    if (!sessionId || beats.length === 0) return;
    if (prefetchDoneForSessionRef.current === sessionId) return;
    prefetchDoneForSessionRef.current = sessionId;
    prefetchAllBeats(beats, { delayBetweenMs: 120 });
  }, [sessionId, beats, prefetchAllBeats]);

  // Selection → deck scroll (only when selection changed externally, not from onMomentumScrollEnd)
  useEffect(() => {
    if (selectionFromDeckRef.current) {
      selectionFromDeckRef.current = false;
      return;
    }
    if (selectedSentenceIndex === null || beats.length === 0) return;
    const index = beats.findIndex((b) => b.sentenceIndex === selectedSentenceIndex);
    if (index < 0) return;
    deckListRef.current?.scrollToOffset({ offset: index * cardStep, animated: true });
  }, [selectedSentenceIndex, beats, cardStep]);

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

    isEditingRef.current = false;

    const draft = (draftOverride ?? beatTexts[sentenceIndex] ?? "").trim();
    if (!draft) {
      showError("Beat text cannot be empty");
      return;
    }

    const beat = beats.find((b) => b.sentenceIndex === sentenceIndex);
    const committed = beatTexts[sentenceIndex] ?? beat?.text?.trim() ?? "";
    if (draft === committed) {
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

      setBeatTexts((prev) => ({ ...prev, [sentenceIndex]: draft }));
      textInputRef.current?.blur();
      Keyboard.dismiss();
      // Keep selection so deck does not jump back to beat 1
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

  // Selected beat and display text for beat editor (deck is the only preview surface)
  const selectedBeat =
    selectedSentenceIndex !== null
      ? beats.find((b) => b.sentenceIndex === selectedSentenceIndex)
      : null;
  const isSaving =
    selectedSentenceIndex !== null
      ? savingByIndex[selectedSentenceIndex] || false
      : false;

  function DeckCard({ item, index }: { item: Beat; index: number }) {
    const shot = session ? getSelectedShot(session, item.sentenceIndex) : null;
    const clip = shot?.selectedClip || null;
    const meta = previewByIndex[item.sentenceIndex] ?? null;
    const frameW = meta?.frameW ?? 1080;
    const scaleMeta = cardW / frameW;
    const overlayW = (meta?.rasterW ?? 0) * scaleMeta;
    const overlayH = (meta?.rasterH ?? 0) * scaleMeta;
    const leftPx =
      (typeof meta?.xPx_png === "number"
        ? meta.xPx_png
        : (frameW - (meta?.rasterW ?? 0)) / 2) * scaleMeta;
    const topPx = (meta?.yPx_png ?? 0) * scaleMeta;
    const hasMeta = meta?.rasterUrl && overlayW > 0 && overlayH > 0;

    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * cardStep,
        index * cardStep,
        (index + 1) * cardStep,
      ];
      return {
        transform: [
          { scale: interpolate(scrollX.value, inputRange, [0.93, 1, 0.93]) },
        ],
      };
    });

    return (
      <Animated.View style={[{ width: cardStep, alignItems: "center" }, animatedStyle]}>
        <Pressable
          style={[
            styles.deckCard,
            { width: cardW, height: cardH, backgroundColor: theme.backgroundSecondary },
          ]}
          onLongPress={() => setReplaceModalForIndex(item.sentenceIndex)}
        >
          {clip?.thumbUrl ? (
            <View style={styles.deckCardInner}>
              <Image
                source={{ uri: clip.thumbUrl }}
                style={[styles.deckThumbnail, { backgroundColor: theme.backgroundSecondary }]}
                resizeMode="cover"
              />
              {hasMeta && (
                <View
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: overlayW,
                    height: overlayH,
                  }}
                  pointerEvents="none"
                >
                  <Image
                    source={{ uri: meta!.rasterUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="stretch"
                  />
                </View>
              )}
              {isLoadingByIndex[item.sentenceIndex] && (
                <View style={styles.deckCaptionLoading} pointerEvents="none">
                  <ActivityIndicator size="small" color={theme.link} />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.deckCardInner, styles.deckPlaceholder]}>
              <Feather name="video" size={24} color={theme.tabIconDefault} />
              <ThemedText style={styles.deckPlaceholderText}>No clip</ThemedText>
              {hasMeta && meta?.rasterUrl && (
                <View
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: overlayW,
                    height: overlayH,
                  }}
                  pointerEvents="none"
                >
                  <Image
                    source={{ uri: meta.rasterUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="stretch"
                  />
                </View>
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  const renderDeckItem = ({ item, index }: { item: Beat; index: number }) => (
    <DeckCard item={item} index={index} />
  );

  return (
    <ThemedView style={styles.container}>
      {/* Deck: center card is the stage */}
      <View style={styles.deckSection} onLayout={onDeckLayout}>
        <Animated.FlatList
          ref={deckListRef as React.RefObject<Animated.FlatList<Beat>>}
          data={beats}
          renderItem={renderDeckItem}
          keyExtractor={(item) => `beat-${item.sentenceIndex}`}
          horizontal
          snapToInterval={cardStep}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: (windowWidth - cardW) / 2 }}
          extraData={{ previewByIndex, selectedSentenceIndex }}
          removeClippedSubviews={false}
          onScroll={onDeckScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / cardStep);
            const clamped = Math.max(0, Math.min(index, beats.length - 1));
            selectionFromDeckRef.current = true;
            setSelectedSentenceIndex(beats[clamped].sentenceIndex);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
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
              value={draftText}
              onFocus={() => {
                isEditingRef.current = true;
              }}
              onBlur={() => {
                handleSaveBeat(selectedBeat.sentenceIndex, "blur", draftText);
              }}
              onChangeText={(text) => {
                if (selectedSentenceIndex === null) return;

                if (text.includes("\n")) {
                  const cleaned = text.replace(/\n/g, " ").trim();
                  setDraftText(cleaned);
                  handleSaveBeat(selectedBeat.sentenceIndex, "submit", cleaned);
                  textInputRef.current?.blur();
                  Keyboard.dismiss();
                } else {
                  setDraftText(text);
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
        </KeyboardAvoidingView>
      )}

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
  deckSection: {
    flex: 1,
    overflow: "visible" as const,
  },
  deckCard: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  deckCardInner: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  deckThumbnail: {
    width: "100%",
    height: "100%",
  },
  deckPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  deckPlaceholderText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  deckCaptionLoading: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
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
