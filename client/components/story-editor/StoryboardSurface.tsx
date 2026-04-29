import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

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
  const statusAccentColor =
    previewStatusTone === "success"
      ? "#66d17a"
      : previewStatusTone === "warning"
        ? "#f2b24d"
        : previewStatusTone === "info"
          ? theme.link
          : theme.text;
  const statusBackgroundColor =
    previewStatusTone === "success"
      ? "rgba(102, 209, 122, 0.14)"
      : previewStatusTone === "warning"
        ? "rgba(242, 178, 77, 0.14)"
        : previewStatusTone === "info"
          ? "rgba(74, 95, 255, 0.14)"
          : theme.backgroundSecondary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundDefault,
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
        <View style={styles.headerStatusRow}>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: statusBackgroundColor,
                borderColor: statusAccentColor,
              },
            ]}
            testID="preview-status-chip"
          >
            <ThemedText
              style={[styles.statusChipText, { color: statusAccentColor }]}
            >
              {previewStatusLabel}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.copy, { color: theme.tabIconDefault }]}>
          {previewSupportingText}
        </ThemedText>
      </View>

      {helperBannerCopy ? (
        <View
          style={[
            styles.helperBanner,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            },
          ]}
          testID="preview-helper-banner"
        >
          <Feather name="star" size={14} color={theme.tabIconDefault} />
          <ThemedText style={styles.helperBannerText}>
            {helperBannerCopy}
          </ThemedText>
        </View>
      ) : null}

      <StoryboardPreviewStage
        blockedMessage={blockedMessage}
        maxVideoHeight={maxVideoHeight}
        onPlaybackStatusUpdate={onPreviewPlaybackStatus}
        onRequestPreview={onRequestPreview}
        previewArtifactUrl={previewArtifactUrl}
        previewIsRequesting={previewIsRequesting}
        previewReady={previewReady}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  copy: {
    fontSize: 13,
    lineHeight: 18,
  },
  header: {
    gap: Spacing.xs,
  },
  headerStatusRow: {
    alignItems: "flex-start",
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  helperBanner: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  helperBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statusChip: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  voiceSyncButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  voiceSyncButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
