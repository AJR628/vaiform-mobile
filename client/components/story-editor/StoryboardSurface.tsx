import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Step3BeatRailItem } from "@/screens/story-editor/step3";
import type { AVPlaybackStatus, Video } from "expo-av";
import type { RefObject } from "react";

import { StoryboardPreviewStage } from "./StoryboardPreviewStage";
import { StoryTimelineRail } from "./StoryTimelineRail";

interface StoryboardSurfaceProps {
  activeSentenceIndex: number | null;
  blockedMessage: string | null;
  currentPreviewBeatLabel: string | null;
  helperBannerCopy: string | null;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  maxVideoHeight?: number | null;
  onLongPressBeat: (sentenceIndex: number) => void;
  onOpenVoiceSync: () => void;
  onPressBeat: (sentenceIndex: number) => void;
  onPreviewPlaybackStatus: (status: AVPlaybackStatus) => void;
  onRequestPreview: () => void;
  onStopPreview: () => void;
  onTogglePreview: () => void;
  playbackSentenceIndex: number | null;
  previewArtifactUrl: string | null;
  previewDurationSec: number | null;
  previewHeroActionLabel: string;
  previewHeroActionTarget: "voice" | "preview";
  previewHeroHeadline: string;
  previewHeroHint: string | null;
  previewIsRequesting: boolean;
  previewPositionSec: number;
  previewReady: boolean;
  previewStatusLabel: string;
  previewStatusTone: "neutral" | "success" | "warning" | "info";
  previewSupportingText: string;
  railItems: Step3BeatRailItem[];
  selectedSentenceIndex: number | null;
  videoRef: RefObject<Video | null>;
  theme: {
    backgroundDefault: string;
    backgroundSecondary: string;
    border: string;
    buttonText: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
}

export function StoryboardSurface({
  activeSentenceIndex,
  blockedMessage,
  currentPreviewBeatLabel,
  helperBannerCopy,
  isPreviewAvailable,
  isPreviewPlaying,
  maxVideoHeight,
  onLongPressBeat,
  onOpenVoiceSync,
  onPressBeat,
  onPreviewPlaybackStatus,
  onRequestPreview,
  onStopPreview,
  onTogglePreview,
  playbackSentenceIndex,
  previewArtifactUrl,
  previewDurationSec,
  previewHeroActionLabel,
  previewHeroActionTarget,
  previewHeroHeadline,
  previewHeroHint,
  previewIsRequesting,
  previewPositionSec,
  previewReady,
  previewStatusLabel,
  previewStatusTone,
  previewSupportingText,
  railItems,
  selectedSentenceIndex,
  videoRef,
  theme,
}: StoryboardSurfaceProps) {
  const handleHeroAction =
    previewHeroActionTarget === "voice" ? onOpenVoiceSync : onRequestPreview;

  return (
    <LinearGradient
      colors={["#11161D", "#1B2028"]}
      style={[
        styles.container,
        {
          borderColor: theme.border,
        },
      ]}
      testID="storyboard-surface"
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <ThemedText style={styles.title}>Preview</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenVoiceSync}
            style={[
              styles.voiceSyncButton,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
            testID="preview-voice-timing-cta"
          >
            <Feather name="radio" size={14} color={theme.text} />
            <ThemedText style={styles.voiceSyncButtonText}>
              {"Voice & Timing"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <StoryboardPreviewStage
        blockedMessage={blockedMessage}
        maxVideoHeight={maxVideoHeight}
        onPlaybackStatusUpdate={onPreviewPlaybackStatus}
        onPrimaryAction={handleHeroAction}
        previewHeroActionLabel={previewHeroActionLabel}
        previewHeroHeadline={previewHeroHeadline}
        previewHeroHint={previewHeroHint ?? helperBannerCopy}
        previewArtifactUrl={previewArtifactUrl}
        previewIsRequesting={previewIsRequesting}
        previewReady={previewReady}
        previewStatusLabel={previewStatusLabel}
        previewStatusTone={previewStatusTone}
        previewSupportingText={previewSupportingText}
        theme={theme}
        videoRef={videoRef}
      />

      <StoryTimelineRail
        activeSentenceIndex={activeSentenceIndex}
        isPreviewAvailable={isPreviewAvailable}
        isPreviewPlaying={isPreviewPlaying}
        items={railItems}
        onLongPressBeat={onLongPressBeat}
        onPressBeat={onPressBeat}
        onStopPreview={onStopPreview}
        onTogglePreview={onTogglePreview}
        playbackSentenceIndex={playbackSentenceIndex}
        previewDurationSec={previewDurationSec}
        previewPositionSec={previewPositionSec}
        selectedSentenceIndex={selectedSentenceIndex}
        theme={theme}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.sm,
  },
  header: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  voiceSyncButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  voiceSyncButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
