import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { CaptionPlacement } from "@/screens/story-editor/model";
import type { Step3BeatRailItem } from "@/screens/story-editor/step3";
import type { AVPlaybackStatus, Video } from "expo-av";
import type { RefObject } from "react";
import type { StoryCaptionOverlayV1 } from "@/types/story";

import { StoryboardPreviewStage } from "./StoryboardPreviewStage";
import { StoryTimelineRail } from "./StoryTimelineRail";

interface StoryboardSurfaceProps {
  activeSentenceIndex: number | null;
  blockedMessage: string | null;
  captionPlacement: CaptionPlacement;
  currentCaptionText: string | null;
  currentPreviewBeatLabel: string | null;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  maxVideoHeight?: number | null;
  onLongPressBeat: (sentenceIndex: number) => void;
  onPressBeat: (sentenceIndex: number) => void;
  onPreviewPlaybackStatus: (status: AVPlaybackStatus) => void;
  onRequestPreview: () => void;
  onStopPreview: () => void;
  onTogglePreview: () => void;
  playbackSentenceIndex: number | null;
  captionOverlay: StoryCaptionOverlayV1 | null;
  previewArtifactUrl: string | null;
  previewDurationSec: number | null;
  previewIsRequesting: boolean;
  previewPositionSec: number;
  previewReady: boolean;
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
  captionPlacement,
  currentCaptionText,
  currentPreviewBeatLabel,
  isPreviewAvailable,
  isPreviewPlaying,
  maxVideoHeight,
  onLongPressBeat,
  onPressBeat,
  onPreviewPlaybackStatus,
  onRequestPreview,
  onStopPreview,
  onTogglePreview,
  playbackSentenceIndex,
  captionOverlay,
  previewArtifactUrl,
  previewDurationSec,
  previewIsRequesting,
  previewPositionSec,
  previewReady,
  railItems,
  selectedSentenceIndex,
  videoRef,
  theme,
}: StoryboardSurfaceProps) {
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
        <ThemedText style={styles.title}>Storyboard Preview</ThemedText>
        <ThemedText style={[styles.copy, { color: theme.tabIconDefault }]}>
          {previewReady
            ? (currentPreviewBeatLabel ??
              "Preview follows synced narration timing.")
            : (blockedMessage ?? "Synced preview is currently unavailable.")}
        </ThemedText>
      </View>

      <StoryboardPreviewStage
        blockedMessage={blockedMessage}
        captionPlacement={captionPlacement}
        captionOverlay={captionOverlay}
        currentCaptionText={currentCaptionText}
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
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
});
