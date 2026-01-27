import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { storyGet, storyPlan, storySearchAll, storyUpdateBeatText } from "@/api/client";
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
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string | null>(null);
  const [ctaHeight, setCtaHeight] = useState(0);
  const listRef = useRef<FlatList<StoryBeat>>(null);
  const activeInputRef = useRef<TextInput | null>(null);
  const activeListIndexRef = useRef<number | null>(null);
  const keyboardVisibleRef = useRef(false);
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<number | null>(null);
  const [draftTexts, setDraftTexts] = useState<Record<number, string>>({});
  const [savingSentenceIndex, setSavingSentenceIndex] = useState<number | null>(null);

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

  const showCta = !hasShots && editingSentenceIndex === null;
  const isEditing = editingSentenceIndex !== null;

  useEffect(() => {
    // Use keyboardWillShow/keyboardWillHide on iOS for smoother animation
    // Use keyboardDidShow/keyboardDidHide on Android
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;

      // After keyboard appears, re-anchor the focused beat above it
      scrollActiveBeatToKeyboard();
    });

    const subHide = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;

      // Keep your swipe-down behavior: blur triggers onBlur -> saveBeat(...)
      if (editingSentenceIndex !== null) {
        activeInputRef.current?.blur();
      }
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [editingSentenceIndex]);

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

  const saveBeat = async (
    sentenceIndex: number,
    reason: "submit" | "blur",
    explicitText?: string,
  ) => {
    const closeIfCurrent = () =>
      setEditingSentenceIndex((cur) => (cur === sentenceIndex ? null : cur));

    const raw = explicitText ?? draftTexts[sentenceIndex] ?? "";
    const cleaned = raw.replace(/\n/g, " ").trim();

    const current = beats.find((b) => b.sentenceIndex === sentenceIndex)?.text ?? "";

    // If no change, still exit edit mode on blur/submit (but don't break "tap another beat")
    if (!cleaned || cleaned === current) {
      closeIfCurrent();
      if (reason === "submit") Keyboard.dismiss();
      return;
    }

    setSavingSentenceIndex(sentenceIndex);
    try {
      const res = await storyUpdateBeatText({ sessionId, sentenceIndex, text: cleaned });

      if (!res?.ok && res?.success !== true) {
        showError(res?.message || "Failed to save beat. Please try again.");

        // If user dismissed keyboard, don't trap them in "editing" with CTA hidden
        if (reason === "blur") closeIfCurrent();
        return;
      }

      const updated = unwrapNormalized(res);
      setSession(updated);
      setDraftTexts((prev) => ({ ...prev, [sentenceIndex]: cleaned }));

      closeIfCurrent();

      // Only dismiss keyboard on explicit submit/enter
      if (reason === "submit") Keyboard.dismiss();
    } catch (err) {
      console.error("[script] saveBeat error:", err);
      showError("Failed to save beat. Please try again.");
      if (reason === "blur") closeIfCurrent();
    } finally {
      setSavingSentenceIndex(null);
    }
  };

  const scrollActiveBeatToKeyboard = () => {
    const i = activeListIndexRef.current;
    if (i === null) return;

    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: i, viewPosition: 1, animated: true });
      } catch {}
    });
  };

  const renderBeat = ({ item, index }: { item: StoryBeat; index: number }) => {
    const isEditing = editingSentenceIndex === item.sentenceIndex;
    const isSaving = savingSentenceIndex === item.sentenceIndex;
    const draft = draftTexts[item.sentenceIndex] ?? item.text;

    return (
      <Card
        elevation={1}
        style={styles.beatCard}
        onPress={() => {
          // Only block if the currently edited beat is saving (not the tapped beat)
          if (savingSentenceIndex !== null && savingSentenceIndex === editingSentenceIndex) return;

          // If switching from one beat to another while editing:
          if (editingSentenceIndex !== null && editingSentenceIndex !== item.sentenceIndex) {
            const prevIndex = editingSentenceIndex;
            const prevDraft =
              draftTexts[prevIndex] ??
              beats.find((b) => b.sentenceIndex === prevIndex)?.text ??
              "";

            // Track active beat index
            activeListIndexRef.current = index;

            // Switch immediately (keyboard stays open via autoFocus on new TextInput)
            setEditingSentenceIndex(item.sentenceIndex);

            // Ensure draft init for the new beat
            setDraftTexts((prev) => ({
              ...prev,
              [item.sentenceIndex]: prev[item.sentenceIndex] ?? item.text,
            }));

            // Save previous beat AFTER the switch (fire-and-forget)
            requestAnimationFrame(() => {
              saveBeat(prevIndex, "blur", prevDraft);
            });

            // Scroll to new beat
            requestAnimationFrame(() => {
              try {
                listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
              } catch {}
            });

            return;
          }

          // Existing toggle behavior (edit → not edit, or not edit → edit)
          const next = isEditing ? null : item.sentenceIndex;
          
          if (!isEditing) {
            // Track active beat index when entering edit mode
            activeListIndexRef.current = index;
          }
          
          setEditingSentenceIndex(next);

          if (!isEditing) {
            setDraftTexts((prev) => ({
              ...prev,
              [item.sentenceIndex]: prev[item.sentenceIndex] ?? item.text,
            }));

            // Scroll to beat when editing starts
            requestAnimationFrame(() => {
              try {
                listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
              } catch {}
            });
          } else {
            Keyboard.dismiss();
          }
        }}
      >
        <View style={styles.beatHeader}>
          <ThemedText style={[styles.beatLabel, { color: theme.textSecondary }]}>
            Beat {item.sentenceIndex + 1}
          </ThemedText>
        </View>

        {isEditing ? (
          <>
            <TextInput
              ref={(r) => {
                if (isEditing) activeInputRef.current = r;
              }}
              style={[
                styles.textInput,
                { color: theme.textPrimary, backgroundColor: theme.backgroundSecondary },
              ]}
              value={draft}
              onChangeText={(text) => {
                if (text.includes("\n")) {
                  const cleaned = text.replace(/\n/g, " ").trim();
                  setDraftTexts((prev) => ({ ...prev, [item.sentenceIndex]: cleaned }));
                  saveBeat(item.sentenceIndex, "submit", cleaned);
                } else {
                  setDraftTexts((prev) => ({ ...prev, [item.sentenceIndex]: text }));
                }
              }}
              onFocus={() => {
                activeListIndexRef.current = index;

                requestAnimationFrame(() => {
                  try {
                    listRef.current?.scrollToIndex({
                      index,
                      viewPosition: keyboardVisibleRef.current ? 1 : 0.2,
                      animated: true,
                    });
                  } catch {}
                });
              }}
              onBlur={() => {
                // Only save if this is still the active editing beat
                // (prevents duplicate save when switching beats)
                if (editingSentenceIndex === item.sentenceIndex) {
                  saveBeat(item.sentenceIndex, "blur");
                }
              }}
              multiline
              editable={!isSaving}
              autoFocus
              placeholderTextColor={theme.textSecondary}
            />
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            )}
          </>
        ) : (
          <ThemedText style={[styles.beatText, { color: theme.textPrimary }]}>
            {item.text}
          </ThemedText>
        )}
      </Card>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.sm }]}>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="height"
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={beats}
            keyExtractor={(b) => String(b.sentenceIndex)}
            renderItem={renderBeat}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: isEditing
                  ? Spacing.lg
                  : hasShots
                    ? tabBarHeight + Spacing.lg
                    : tabBarHeight + (showCta ? ctaHeight : 0) + Spacing.lg,
              },
            ]}
            scrollIndicatorInsets={{ bottom: isEditing ? 0 : tabBarHeight }}
            onScrollToIndexFailed={() => {}}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
          {showCta && (
            <View
              onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}
              style={[
                styles.ctaContainer,
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: tabBarHeight,
                  backgroundColor: theme.backgroundSecondary,
                  borderTopColor: theme.backgroundTertiary,
                  paddingBottom: Spacing.md,
                },
              ]}
            >
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
        </KeyboardAvoidingView>
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
  textInput: {
    fontSize: 15,
    lineHeight: 21,
    padding: Spacing.md,
    borderRadius: 12,
    minHeight: 90,
    textAlignVertical: "top",
  },
  savingIndicator: {
    marginTop: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
