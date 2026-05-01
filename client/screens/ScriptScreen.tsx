import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useActiveStorySession } from "@/contexts/ActiveStorySessionContext";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import {
  storyDeleteBeat,
  storyGet,
  storyPlan,
  storySearchAll,
  storyUpdateBeatText,
  storyUpdateScript,
} from "@/api/client";
import { unwrapNormalized, extractBeats, StoryBeat } from "@/lib/storySession";

import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import type { StorySession } from "@/types/story";

type ScriptRouteProp = RouteProp<HomeStackParamList, "Script">;

const MAX_BEAT_CHARS = 160;
const MAX_TOTAL_CHARS = 850;
const MAX_BEATS = 8;

export default function ScriptScreen() {
  const route = useRoute<ScriptRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList, "Script">>();
  const { sessionId } = route.params;

  const { theme } = useTheme();
  const { showError } = useToast();
  const { setActiveSessionId } = useActiveStorySession();
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
  const savingSentenceIndicesRef = useRef<Set<number>>(new Set());
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<
    number | null
  >(null);
  const [draftTexts, setDraftTexts] = useState<Record<number, string>>({});
  const [savingSentenceIndex, setSavingSentenceIndex] = useState<number | null>(
    null,
  );
  const [isScriptUpdating, setIsScriptUpdating] = useState(false);
  const [isAddingBeat, setIsAddingBeat] = useState(false);
  const [newBeatDraft, setNewBeatDraft] = useState("");

  useEffect(() => {
    setActiveSessionId(sessionId);
  }, [sessionId, setActiveSessionId]);

  const refreshSession = useCallback(
    async ({
      showLoading = false,
      errorMessage = "Failed to load script. Please try again.",
    }: {
      showLoading?: boolean;
      errorMessage?: string;
    } = {}) => {
      if (showLoading) setIsLoading(true);
      try {
        const res = await storyGet(sessionId);
        if (!res?.ok) {
          showError(res?.message || errorMessage);
          return null;
        }
        const unwrapped = unwrapNormalized<StorySession>(res);
        setSession(unwrapped);
        return unwrapped;
      } catch (err) {
        console.error("[script] load error:", err);
        showError(errorMessage);
        return null;
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [sessionId, showError],
  );

  useEffect(() => {
    void refreshSession({ showLoading: true });
  }, [refreshSession]);

  const beats: StoryBeat[] = useMemo(() => extractBeats(session), [session]);

  const hasShots = useMemo(() => {
    if (!session) return false;
    return Array.isArray(session.shots) ? session.shots.length > 0 : false;
  }, [session]);

  const orderedSentences = useMemo(
    () =>
      beats
        .slice()
        .sort((left, right) => left.sentenceIndex - right.sentenceIndex)
        .map((beat) => beat.text),
    [beats],
  );

  const showCta =
    !hasShots &&
    editingSentenceIndex === null &&
    savingSentenceIndex === null &&
    !isAddingBeat &&
    !isScriptUpdating;
  const isEditing = editingSentenceIndex !== null;

  const validateScriptSentences = useCallback(
    (sentences: string[]) => {
      if (sentences.length === 0) {
        showError("Story needs at least one beat.");
        return false;
      }
      if (sentences.length > MAX_BEATS) {
        showError(`Story can include up to ${MAX_BEATS} beats.`);
        return false;
      }
      if (sentences.some((sentence) => sentence.trim().length === 0)) {
        showError("Beat text cannot be empty.");
        return false;
      }
      if (sentences.some((sentence) => sentence.length > MAX_BEAT_CHARS)) {
        showError(`Beat text must stay under ${MAX_BEAT_CHARS} characters.`);
        return false;
      }
      if (sentences.join("").length > MAX_TOTAL_CHARS) {
        showError(`Story must stay under ${MAX_TOTAL_CHARS} total characters.`);
        return false;
      }
      return true;
    },
    [showError],
  );

  const replacePreStoryboardScript = useCallback(
    async (
      sentences: string[],
      {
        errorMessage = "Failed to update script. Please try again.",
      }: { errorMessage?: string } = {},
    ) => {
      if (!validateScriptSentences(sentences)) return false;

      setIsScriptUpdating(true);
      try {
        const res = await storyUpdateScript({ sessionId, sentences });
        if (!res?.ok) {
          showError(res?.message || errorMessage);
          return false;
        }

        const unwrapped = unwrapNormalized<StorySession>(res);
        setSession(unwrapped);
        await refreshSession({
          errorMessage:
            "Script updated, but failed to refresh. Please try again.",
        });
        return true;
      } catch (err) {
        console.error("[script] updateScript error:", err);
        showError(errorMessage);
        return false;
      } finally {
        setIsScriptUpdating(false);
      }
    },
    [refreshSession, sessionId, showError, validateScriptSentences],
  );

  useEffect(() => {
    // Use keyboardWillShow/keyboardWillHide on iOS for smoother animation
    // Use keyboardDidShow/keyboardDidHide on Android
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

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

    const current =
      beats.find((b) => b.sentenceIndex === sentenceIndex)?.text ?? "";

    if (!cleaned) {
      showError("Beat text cannot be empty.");
      if (reason === "blur") closeIfCurrent();
      return;
    }

    if (cleaned.length > MAX_BEAT_CHARS) {
      showError(`Beat text must stay under ${MAX_BEAT_CHARS} characters.`);
      if (reason === "blur") closeIfCurrent();
      return;
    }

    const nextTotalChars = beats
      .slice()
      .sort((left, right) => left.sentenceIndex - right.sentenceIndex)
      .map((beat) =>
        beat.sentenceIndex === sentenceIndex ? cleaned : beat.text,
      )
      .join("").length;
    if (nextTotalChars > MAX_TOTAL_CHARS) {
      showError(`Story must stay under ${MAX_TOTAL_CHARS} total characters.`);
      if (reason === "blur") closeIfCurrent();
      return;
    }

    // If no change, still exit edit mode on blur/submit (but don't break "tap another beat")
    if (cleaned === current) {
      closeIfCurrent();
      if (reason === "submit") Keyboard.dismiss();
      return;
    }

    const nextSentences = orderedSentences.map((sentence, index) =>
      index === sentenceIndex ? cleaned : sentence,
    );

    if (savingSentenceIndicesRef.current.has(sentenceIndex)) {
      return;
    }

    savingSentenceIndicesRef.current.add(sentenceIndex);
    setSavingSentenceIndex(sentenceIndex);
    try {
      const res = hasShots
        ? await storyUpdateBeatText({ sessionId, sentenceIndex, text: cleaned })
        : await storyUpdateScript({ sessionId, sentences: nextSentences });

      if (!res?.ok) {
        showError(res?.message || "Failed to save beat. Please try again.");

        // If user dismissed keyboard, don't trap them in "editing" with CTA hidden
        if (reason === "blur") closeIfCurrent();
        return;
      }

      setDraftTexts((prev) => ({ ...prev, [sentenceIndex]: cleaned }));
      if (hasShots) {
        setSession((prev: StorySession | null) => {
          const sentences = prev?.story?.sentences;
          if (!prev || !Array.isArray(sentences)) return prev;
          if (sentenceIndex < 0 || sentenceIndex >= sentences.length)
            return prev;

          return {
            ...prev,
            story: {
              ...prev.story,
              sentences: nextSentences,
            },
          };
        });
      } else {
        const unwrapped = unwrapNormalized<StorySession>(res);
        setSession(unwrapped);
      }

      closeIfCurrent();

      // Only dismiss keyboard on explicit submit/enter
      if (reason === "submit") Keyboard.dismiss();

      await refreshSession({
        errorMessage:
          "Beat saved, but failed to refresh script. Please try again.",
      });
    } catch (err) {
      console.error("[script] saveBeat error:", err);
      showError("Failed to save beat. Please try again.");
      if (reason === "blur") closeIfCurrent();
    } finally {
      savingSentenceIndicesRef.current.delete(sentenceIndex);
      setSavingSentenceIndex((currentSaving) =>
        currentSaving === sentenceIndex ? null : currentSaving,
      );
    }
  };

  const scrollActiveBeatToKeyboard = () => {
    const i = activeListIndexRef.current;
    if (i === null) return;

    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({
          index: i,
          viewPosition: 1,
          animated: true,
        });
      } catch {}
    });
  };

  const handleDeleteBeat = async (sentenceIndex: number) => {
    if (!hasShots) {
      const nextSentences = orderedSentences.filter(
        (_, index) => index !== sentenceIndex,
      );
      const updated = await replacePreStoryboardScript(nextSentences, {
        errorMessage: "Failed to delete beat.",
      });
      if (!updated) return;
      setEditingSentenceIndex(null);
      setDraftTexts({});
      setSavingSentenceIndex(null);
      setIsAddingBeat(false);
      setNewBeatDraft("");
      return;
    }

    const res = await storyDeleteBeat({ sessionId, sentenceIndex });
    if (!res?.ok) {
      showError(res?.message ?? "Failed to delete beat.");
      return;
    }
    await refreshSession({
      errorMessage: "Failed to reload script. Please try again.",
    });
    setEditingSentenceIndex(null);
    setDraftTexts({});
    setSavingSentenceIndex(null);
  };

  const handleSaveNewBeat = async () => {
    const cleaned = newBeatDraft.replace(/\n/g, " ").trim();
    if (!cleaned) {
      showError("Beat text cannot be empty.");
      return;
    }

    const updated = await replacePreStoryboardScript(
      [...orderedSentences, cleaned],
      {
        errorMessage: "Failed to add beat.",
      },
    );
    if (!updated) return;

    setIsAddingBeat(false);
    setNewBeatDraft("");
  };

  const handleCancelNewBeat = () => {
    setIsAddingBeat(false);
    setNewBeatDraft("");
  };

  const renderAddBeatFooter = () => {
    if (hasShots) return null;

    if (isAddingBeat) {
      return (
        <View
          style={[
            styles.addBeatDraftCard,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText
            style={[styles.beatLabel, { color: theme.textSecondary }]}
          >
            New Beat
          </ThemedText>
          <TextInput
            style={[
              styles.textInput,
              styles.addBeatInput,
              {
                color: theme.textPrimary,
                backgroundColor: theme.backgroundTertiary,
              },
            ]}
            value={newBeatDraft}
            onChangeText={setNewBeatDraft}
            multiline
            autoFocus
            editable={!isScriptUpdating}
            maxLength={MAX_BEAT_CHARS}
            placeholder="Write the next beat"
            placeholderTextColor={theme.textSecondary}
          />
          <View style={styles.addBeatActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleCancelNewBeat}
              disabled={isScriptUpdating}
              style={({ pressed }) => [
                styles.cancelAddButton,
                isScriptUpdating && styles.trashButtonDisabled,
                pressed && !isScriptUpdating && { opacity: 0.75 },
              ]}
            >
              <ThemedText
                style={[styles.cancelAddText, { color: theme.textSecondary }]}
              >
                Cancel
              </ThemedText>
            </Pressable>
            <Button
              onPress={handleSaveNewBeat}
              disabled={isScriptUpdating}
              style={styles.saveAddButton}
            >
              {isScriptUpdating ? "Saving..." : "Save"}
            </Button>
          </View>
        </View>
      );
    }

    const atLimit = beats.length >= MAX_BEATS;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsAddingBeat(true)}
        disabled={atLimit || isScriptUpdating || savingSentenceIndex !== null}
        style={({ pressed }) => [
          styles.addBeatButton,
          { borderColor: theme.backgroundTertiary },
          (atLimit || isScriptUpdating || savingSentenceIndex !== null) &&
            styles.trashButtonDisabled,
          pressed &&
            !(atLimit || isScriptUpdating || savingSentenceIndex !== null) && {
              opacity: 0.75,
            },
        ]}
      >
        <Feather name="plus" size={16} color={theme.primary} />
        <ThemedText style={[styles.addBeatText, { color: theme.primary }]}>
          {atLimit ? `${MAX_BEATS} beat maximum` : "+ Add beat"}
        </ThemedText>
      </Pressable>
    );
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
          if (
            savingSentenceIndex !== null &&
            savingSentenceIndex === editingSentenceIndex
          )
            return;

          // If switching from one beat to another while editing:
          if (
            editingSentenceIndex !== null &&
            editingSentenceIndex !== item.sentenceIndex
          ) {
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
                listRef.current?.scrollToIndex({
                  index,
                  viewPosition: 0.2,
                  animated: true,
                });
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
                listRef.current?.scrollToIndex({
                  index,
                  viewPosition: 0.2,
                  animated: true,
                });
              } catch {}
            });
          } else {
            Keyboard.dismiss();
          }
        }}
      >
        <View style={styles.beatHeader}>
          <ThemedText
            style={[styles.beatLabel, { color: theme.textSecondary }]}
          >
            Beat {item.sentenceIndex + 1}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete beat ${item.sentenceIndex + 1}`}
            onPress={() => {
              Alert.alert(
                "Delete beat?",
                "This beat will be removed. You can't undo.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => handleDeleteBeat(item.sentenceIndex),
                  },
                ],
              );
            }}
            disabled={
              editingSentenceIndex === item.sentenceIndex ||
              savingSentenceIndex !== null
            }
            style={({ pressed }) => [
              styles.trashButton,
              (editingSentenceIndex === item.sentenceIndex ||
                savingSentenceIndex !== null) &&
                styles.trashButtonDisabled,
              pressed &&
                !(
                  editingSentenceIndex === item.sentenceIndex ||
                  savingSentenceIndex !== null
                ) && { opacity: 0.7 },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        {isEditing ? (
          <>
            <TextInput
              ref={(r) => {
                if (isEditing) activeInputRef.current = r;
              }}
              style={[
                styles.textInput,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
              value={draft}
              onChangeText={(text) => {
                if (text.includes("\n")) {
                  const cleaned = text.replace(/\n/g, " ").trim();
                  setDraftTexts((prev) => ({
                    ...prev,
                    [item.sentenceIndex]: cleaned,
                  }));
                  saveBeat(item.sentenceIndex, "submit", cleaned);
                } else {
                  setDraftTexts((prev) => ({
                    ...prev,
                    [item.sentenceIndex]: text,
                  }));
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
              maxLength={MAX_BEAT_CHARS}
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
    <ThemedView
      style={[styles.container, { paddingTop: headerHeight + Spacing.sm }]}
    >
      <View style={styles.topNote}>
        <ThemedText style={[styles.topTitle, { color: theme.textPrimary }]}>
          Script
        </ThemedText>
        <ThemedText
          style={[styles.topSubtitle, { color: theme.textSecondary }]}
        >
          Review and edit your beats before choosing clips.
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading script...
          </ThemedText>
        </View>
      ) : beats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText
            style={[styles.emptyText, { color: theme.textSecondary }]}
          >
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
            ListFooterComponent={renderAddBeatFooter}
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
                <ThemedText
                  style={[styles.progressText, { color: theme.textSecondary }]}
                >
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
  beatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  beatLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trashButton: {
    padding: Spacing.xs,
  },
  trashButtonDisabled: {
    opacity: 0.4,
  },
  beatText: { fontSize: 15, lineHeight: 21 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
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
  addBeatButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  addBeatText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addBeatDraftCard: {
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addBeatInput: {
    minHeight: 76,
  },
  addBeatActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  cancelAddButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAddText: {
    fontSize: 14,
    fontWeight: "600",
  },
  saveAddButton: {
    minWidth: 104,
  },
});
