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
  previewHeroActionDisabled: boolean;
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
  previewHeroActionDisabled,
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
  const statusAccentColor =
    previewStatusTone === "success"
      ? "#66D17A"
      : previewStatusTone === "warning"
        ? "#F2B24D"
        : previewStatusTone === "info"
          ? theme.link
          : theme.text;
  const statusBackgroundColor =
    previewStatusTone === "success"
      ? "rgba(102,209,122,0.16)"
      : previewStatusTone === "warning"
        ? "rgba(242,178,77,0.16)"
        : previewStatusTone === "info"
          ? "rgba(10,132,255,0.18)"
          : "rgba(255,255,255,0.12)";

  return (
    <LinearGradient
      colors={["#0A0F16", "#141B24"]}
      style={[
        styles.container,
        {
          borderColor: theme.border,
        },
      ]}
      testID="storyboard-surface"
    >
      <View style={styles.monitorChrome}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusBackgroundColor,
              borderColor: statusAccentColor,
            },
          ]}
          testID="preview-status-chip"
        >
          <View
            style={[styles.statusDot, { backgroundColor: statusAccentColor }]}
          />
          <ThemedText style={styles.statusBadgeText} numberOfLines={1}>
            {previewStatusLabel}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenVoiceSync}
          style={[
            styles.voiceSyncButton,
            {
              backgroundColor: "rgba(255,255,255,0.08)",
              borderColor: "rgba(255,255,255,0.14)",
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

      <View
        style={[
          styles.viewportWrap,
          {
            borderColor: theme.border,
          },
        ]}
      >
        <StoryboardPreviewStage
          blockedMessage={blockedMessage}
          maxVideoHeight={maxVideoHeight}
          onPlaybackStatusUpdate={onPreviewPlaybackStatus}
          onPrimaryAction={handleHeroAction}
          previewHeroActionDisabled={previewHeroActionDisabled}
          previewHeroActionLabel={previewHeroActionLabel}
          previewHeroHeadline={previewHeroHeadline}
          previewArtifactUrl={previewArtifactUrl}
          previewIsRequesting={previewIsRequesting}
          previewReady={previewReady}
          theme={theme}
          videoRef={videoRef}
        />
      </View>

      <View style={styles.railDock}>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 0,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
    overflow: "hidden",
    padding: 6,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  monitorChrome: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  railDock: {
    paddingTop: 0,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    flexShrink: 1,
    gap: Spacing.xs,
    maxWidth: "56%",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  statusBadgeText: {
    color: "#F7FAFF",
    fontSize: 13,
    fontWeight: "700",
  },
  statusDot: {
    borderRadius: BorderRadius.full,
    height: 9,
    width: 9,
  },
  viewportWrap: {
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  voiceSyncButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
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
