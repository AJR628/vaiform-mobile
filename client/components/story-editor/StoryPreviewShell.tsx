import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";

interface StoryPreviewShellProps {
  blockedMessage: string | null;
  currentCaptionText: string | null;
  currentPreviewBeatLabel: string | null;
  currentSegmentClipUrl: string | null;
  currentSegmentPosterUrl: string | null;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  onStopPreview: () => void;
  onTogglePreview: () => void;
  onVideoLoad: () => void;
  previewDurationSec: number | null;
  previewPositionSec: number;
  previewReady: boolean;
  theme: {
    backgroundDefault: string;
    backgroundSecondary: string;
    border: string;
    buttonText: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
  videoRef: React.RefObject<Video | null>;
}

function formatDuration(value: number | null): string {
  if (!Number.isFinite(value ?? NaN) || value === null) return "--:--";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function StoryPreviewShell({
  blockedMessage,
  currentCaptionText,
  currentPreviewBeatLabel,
  currentSegmentClipUrl,
  currentSegmentPosterUrl,
  isPreviewAvailable,
  isPreviewPlaying,
  onStopPreview,
  onTogglePreview,
  onVideoLoad,
  previewDurationSec,
  previewPositionSec,
  previewReady,
  theme,
  videoRef,
}: StoryPreviewShellProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title}>Synced Preview</ThemedText>
          <ThemedText
            style={[styles.subtleText, { color: theme.tabIconDefault }]}
          >
            {previewReady
              ? "Preview playback follows the backend Step 3 timeline."
              : (blockedMessage ?? "Synced preview is currently unavailable.")}
          </ThemedText>
        </View>
      </View>

      <View
        style={[
          styles.videoFrame,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        {previewReady && currentSegmentClipUrl ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: currentSegmentClipUrl }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping={false}
              progressUpdateIntervalMillis={250}
              onLoad={onVideoLoad}
              onReadyForDisplay={onVideoLoad}
              posterSource={
                currentSegmentPosterUrl
                  ? { uri: currentSegmentPosterUrl }
                  : undefined
              }
              usePoster={Boolean(currentSegmentPosterUrl)}
            />
            <View style={styles.captionOverlay} pointerEvents="none">
              <ThemedText style={styles.captionText}>
                {currentCaptionText ?? "Preview timing will appear here."}
              </ThemedText>
            </View>
          </>
        ) : (
          <View style={styles.blockedSurface}>
            <Feather name="lock" size={24} color={theme.tabIconDefault} />
            <ThemedText style={styles.blockedText}>
              {blockedMessage ?? "Synced preview is blocked for this session."}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.transportRow}>
        <View style={styles.transportCopy}>
          <ThemedText style={styles.beatLabel}>
            {currentPreviewBeatLabel ?? "Awaiting preview"}
          </ThemedText>
          <ThemedText
            style={[styles.subtleText, { color: theme.tabIconDefault }]}
          >
            {formatDuration(previewPositionSec)} /{" "}
            {formatDuration(previewDurationSec)}
          </ThemedText>
        </View>
        <View style={styles.transportButtons}>
          <Pressable
            onPress={onTogglePreview}
            disabled={!isPreviewAvailable}
            style={[
              styles.transportButton,
              {
                backgroundColor: isPreviewAvailable
                  ? theme.link
                  : theme.backgroundSecondary,
                opacity: isPreviewAvailable ? 1 : 0.55,
              },
            ]}
          >
            <ThemedText style={{ color: theme.buttonText }}>
              {isPreviewPlaying ? "Pause" : "Play"}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={onStopPreview}
            disabled={!isPreviewAvailable}
            style={[
              styles.secondaryButton,
              {
                borderColor: theme.border,
                opacity: isPreviewAvailable ? 1 : 0.55,
              },
            ]}
          >
            <ThemedText style={{ color: theme.text }}>Stop</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  beatLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  blockedSurface: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  blockedText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: "center",
  },
  captionOverlay: {
    bottom: Spacing.lg,
    left: Spacing.md,
    position: "absolute",
    right: Spacing.md,
  },
  captionText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  subtleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  transportButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  transportButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  transportCopy: {
    flex: 1,
    gap: 4,
  },
  transportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  video: {
    height: "100%",
    width: "100%",
  },
  videoFrame: {
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    width: "100%",
  },
});
