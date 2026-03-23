import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  Animated as RNAnimated,
} from "react-native";
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { FlowTabsHeader } from "@/components/FlowTabsHeader";
import { BeatActionsModal } from "@/components/story-editor/BeatActionsModal";
import { BeatEditorPanel } from "@/components/story-editor/BeatEditorPanel";
import { StoryDeck } from "@/components/story-editor/StoryDeck";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { getEstimatedUsageSec } from "@/lib/renderUsage";

import { getSelectedShot } from "@/screens/story-editor/model";
import { useStoryEditorCaptionPlacement } from "@/screens/story-editor/useStoryEditorCaptionPlacement";
import { useStoryEditorFinalize } from "@/screens/story-editor/useStoryEditorFinalize";
import { useStoryEditorSession } from "@/screens/story-editor/useStoryEditorSession";

type StoryEditorRouteProp = RouteProp<HomeStackParamList, "StoryEditor">;
type StoryEditorNavProp = NativeStackNavigationProp<HomeStackParamList, "StoryEditor">;

const ACTIVE_SCALE = 1.16;

export default function StoryEditorScreen() {
  const route = useRoute<StoryEditorRouteProp>();
  const navigation = useNavigation<StoryEditorNavProp>();
  const { sessionId } = route.params;
  const { theme } = useTheme();
  const { showError, showSuccess, showWarning } = useToast();
  const { refreshUsage, usageSnapshot, user } = useAuth();
  const availableSec = usageSnapshot?.usage?.availableSec ?? 0;
  const tabBarHeight = useBottomTabBarHeight();

  const [showBeatActionsForIndex, setShowBeatActionsForIndex] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [deckAreaH, setDeckAreaH] = useState(0);
  const [draftText, setDraftText] = useState("");

  const textInputRef = useRef<TextInput>(null);
  const deckListRef = useRef<any>(null);
  const selectionFromDeckRef = useRef(false);
  const deckAreaHRef = useRef(0);
  const isEditingRef = useRef(false);
  const editorHRef = useRef(120);
  const keyboardVisibleRef = useRef(false);
  const editorTranslateY = useRef(new RNAnimated.Value(0)).current;
  const renderAreaHRef = useRef(0);

  const {
    beats,
    beatTexts,
    handleDeleteBeat,
    handleSaveBeat,
    isLoading,
    markShouldRefresh,
    savingByIndex,
    selectedSentenceIndex,
    session,
    setSelectedSentenceIndex,
    setSession,
  } = useStoryEditorSession({
    sessionId,
    showError,
  });

  const committedText =
    selectedSentenceIndex !== null
      ? (beatTexts[selectedSentenceIndex] ??
          beats.find((beat) => beat.sentenceIndex === selectedSentenceIndex)?.text ??
          "")
      : "";

  const {
    captionPlacement,
    handlePlacementChange,
    isLoadingByIndex,
    previewByIndex,
    resetPlacementPreviews,
  } = useStoryEditorCaptionPlacement({
    beats,
    canPrefetch: () => !isEditingRef.current && !keyboardVisibleRef.current,
    committedText,
    selectedSentenceIndex,
    serverPlacement: session?.overlayCaption?.placement,
    sessionId,
    showError,
  });

  const estimatedSec = getEstimatedUsageSec(session);
  const canAttemptRender = Boolean(usageSnapshot);
  const {
    handleRender,
    isRendering,
    renderingModalSubtext,
    renderingModalTitle,
    showRenderingModal,
  } = useStoryEditorFinalize({
    availableSec,
    estimatedSec,
    navigation,
    refreshUsage,
    session,
    sessionId,
    setSession,
    showError,
    showSuccess,
    showWarning,
    usageLoaded: Boolean(usageSnapshot),
    userId: user?.uid,
  });

  const scrollX = useSharedValue(0);
  const onDeckScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onDeckLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0 && height !== deckAreaHRef.current) {
      deckAreaHRef.current = height;
      setDeckAreaH(height);
    }
  }, []);

  const { width: windowWidth } = useWindowDimensions();
  const deckGap = 16;
  const deckPadTop = Spacing["5xl"] + Spacing.lg;
  const deckPadBottom = Spacing.sm;
  const desiredW = Math.round(windowWidth * 0.84);
  const desiredH = desiredW * (16 / 9);
  const deckInnerH =
    deckAreaH > 0 ? Math.max(0, deckAreaH - deckPadTop - deckPadBottom) : 0;
  const fitFactor = 1 + (ACTIVE_SCALE - 1) / 2;
  const maxCardH = deckAreaH > 0 ? deckInnerH / fitFactor : desiredH;
  const cardH = deckAreaH > 0 ? Math.min(maxCardH, desiredH) : desiredH;
  const cardW = Math.round((cardH * 9) / 16);
  const cardStep = cardW + deckGap;

  useEffect(() => {
    if (selectedSentenceIndex === null) return;
    if (isEditingRef.current) return;

    const committed =
      beatTexts[selectedSentenceIndex] ??
      beats.find((beat) => beat.sentenceIndex === selectedSentenceIndex)?.text ??
      "";

    setDraftText(committed);
  }, [beatTexts, beats, selectedSentenceIndex, sessionId]);

  useEffect(() => {
    if (selectionFromDeckRef.current) {
      selectionFromDeckRef.current = false;
      return;
    }
    if (selectedSentenceIndex === null || beats.length === 0) return;

    const index = beats.findIndex((beat) => beat.sentenceIndex === selectedSentenceIndex);
    if (index < 0) return;
    deckListRef.current?.scrollToOffset({ offset: index * cardStep, animated: true });
  }, [beats, cardStep, selectedSentenceIndex]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardDidShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardDidHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height ?? 0;
      if (__DEV__) console.log("[beat] keyboardDidShow", height);
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      const reservedBelowEditor = renderAreaHRef.current || 0;
      const shiftUp = Math.max(0, height - reservedBelowEditor);
      if (__DEV__) console.log("[beat] dock", { height, reservedBelowEditor, shiftUp });
      editorTranslateY.setValue(-shiftUp);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      if (__DEV__) console.log("[beat] keyboardDidHide");
      editorTranslateY.setValue(0);
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [editorTranslateY]);

  const handleDeckCardPress = useCallback(
    (sentenceIndex: number) => {
      if (keyboardVisibleRef.current || keyboardVisible) return;
      const index = beats.findIndex((beat) => beat.sentenceIndex === sentenceIndex);
      if (index < 0) return;

      Haptics.selectionAsync().catch(() => {});
      selectionFromDeckRef.current = true;
      deckListRef.current?.scrollToOffset({
        offset: index * cardStep,
        animated: true,
      });
      setSelectedSentenceIndex(sentenceIndex);
    },
    [beats, cardStep, keyboardVisible, setSelectedSentenceIndex]
  );

  const handleVisibleBeatChange = useCallback(
    (sentenceIndex: number) => {
      selectionFromDeckRef.current = true;
      setSelectedSentenceIndex(sentenceIndex);
    },
    [setSelectedSentenceIndex]
  );

  const handleReplaceClip = useCallback(
    (sentenceIndex: number) => {
      const shot = session ? getSelectedShot(session, sentenceIndex) : null;
      setShowBeatActionsForIndex(null);
      markShouldRefresh();
      navigation.navigate("ClipSearch", {
        sessionId,
        sentenceIndex,
        initialQuery: shot?.searchQuery ?? "",
      });
    },
    [markShouldRefresh, navigation, session, sessionId]
  );

  const handleDeleteBeatFromModal = useCallback(
    (sentenceIndex: number) => {
      setShowBeatActionsForIndex(null);
      handleDeleteBeat(sentenceIndex, {
        onDeleted: resetPlacementPreviews,
      });
    },
    [handleDeleteBeat, resetPlacementPreviews]
  );

  const handleSaveSelectedBeat = useCallback(
    async (text: string) => {
      if (selectedSentenceIndex === null) return;
      isEditingRef.current = false;
      await handleSaveBeat(selectedSentenceIndex, text, {
        onSaved: () => {
          textInputRef.current?.blur();
        },
      });
    },
    [handleSaveBeat, selectedSentenceIndex]
  );

  const toggleEditorCollapsed = useCallback(() => {
    if (keyboardVisibleRef.current || keyboardVisible) return;
    setEditorCollapsed((prev) => !prev);
  }, [keyboardVisible]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
      headerLeft: () => null,
      headerBackVisible: false,
      headerTitle: () => (
        <FlowTabsHeader
          currentStep="storyboard"
          onCreatePress={() => navigation.popToTop()}
          onScriptPress={() => navigation.replace("Script", { sessionId })}
          onRenderPress={handleRender}
          onSpeechPress={() => showWarning("Coming soon.")}
          renderDisabled={!canAttemptRender || isRendering || keyboardVisible}
        />
      ),
    });
  }, [
    canAttemptRender,
    handleRender,
    isRendering,
    keyboardVisible,
    navigation,
    sessionId,
    showWarning,
  ]);

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
          <ThemedText style={styles.emptyText}>No beats found in this storyboard.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const selectedBeat =
    selectedSentenceIndex !== null
      ? beats.find((beat) => beat.sentenceIndex === selectedSentenceIndex) ?? null
      : null;
  const isSaving =
    selectedSentenceIndex !== null ? savingByIndex[selectedSentenceIndex] || false : false;

  return (
    <ThemedView style={styles.container}>
      <StoryDeck
        beats={beats}
        cardH={cardH}
        cardStep={cardStep}
        cardW={cardW}
        deckListRef={deckListRef}
        keyboardVisible={keyboardVisible}
        isLoadingByIndex={isLoadingByIndex}
        onDeckLayout={onDeckLayout}
        onDeckScroll={onDeckScroll}
        onLongPressBeat={setShowBeatActionsForIndex}
        onPressBeat={handleDeckCardPress}
        onVisibleBeatChange={handleVisibleBeatChange}
        previewByIndex={previewByIndex}
        scrollX={scrollX}
        selectedSentenceIndex={selectedSentenceIndex}
        session={session}
        theme={theme}
        windowWidth={windowWidth}
      />

      {selectedBeat ? (
        <BeatEditorPanel
          captionPlacement={captionPlacement}
          draftText={draftText}
          editorCollapsed={editorCollapsed}
          editorTranslateY={editorTranslateY}
          isSaving={isSaving}
          onChangeDraftText={setDraftText}
          onFocus={() => {
            if (__DEV__) console.log("[beat] onFocus");
            isEditingRef.current = true;
          }}
          onLayout={(height) => {
            if (Math.abs(height - editorHRef.current) >= 2) {
              editorHRef.current = height;
            }
          }}
          onPlacementChange={handlePlacementChange}
          onSave={handleSaveSelectedBeat}
          onShowActions={setShowBeatActionsForIndex}
          onToggleCollapsed={toggleEditorCollapsed}
          selectedBeat={selectedBeat}
          textInputRef={textInputRef}
          theme={theme}
        />
      ) : null}

      <View
        style={[styles.renderAreaSpacer, { height: tabBarHeight + Spacing.sm }]}
        onLayout={(event) => {
          renderAreaHRef.current = event.nativeEvent.layout.height;
        }}
      />

      <Modal
        visible={showRenderingModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.renderingModalOverlay}>
          <View
            style={[styles.renderingModalContent, { backgroundColor: theme.backgroundDefault }]}
          >
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText style={styles.renderingModalTitle}>{renderingModalTitle}</ThemedText>
            <ThemedText
              style={[styles.renderingModalSubtext, { color: theme.tabIconDefault }]}
            >
              {renderingModalSubtext}
            </ThemedText>
          </View>
        </View>
      </Modal>

      <BeatActionsModal
        onClose={() => setShowBeatActionsForIndex(null)}
        onDeleteBeat={handleDeleteBeatFromModal}
        onReplaceClip={handleReplaceClip}
        selectedSentenceIndex={showBeatActionsForIndex}
        theme={theme}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  renderAreaSpacer: {
    width: "100%",
  },
  renderingModalContent: {
    borderRadius: 12,
    padding: Spacing.xl,
    minWidth: 280,
    maxWidth: "80%",
    alignItems: "center",
    gap: Spacing.md,
  },
  renderingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  renderingModalSubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  renderingModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
