import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
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
  helperBannerCopy: string | null;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  maxVideoHeight?: number | null;
  onOpenVoiceSync: () => void;
  onStopPreview: () => void;
  onTogglePreview: () => void;
  onVideoLoad: () => void;
  previewDurationSec: number | null;
  previewPositionSec: number;
  previewReady: boolean;
  previewStatusLabel: string;
  previewStatusTone: "neutral" | "success" | "warning" | "info";
  previewSupportingText: string;
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
  helperBannerCopy,
  isPreviewAvailable,
  isPreviewPlaying,
  maxVideoHeight,
  onOpenVoiceSync,
  onStopPreview,
  onTogglePreview,
  onVideoLoad,
  previewDurationSec,
  previewPositionSec,
  previewReady,
  previewStatusLabel,
  previewStatusTone,
  previewSupportingText,
  theme,
  videoRef,
}: StoryPreviewShellProps) {
  const [availableWidth, setAvailableWidth] = useState(0);
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

  const handleFrameAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setAvailableWidth((current) =>
      Math.abs(current - nextWidth) >= 1 ? nextWidth : current,
    );
  }, []);

  const frameStyle = useMemo(() => {
    const fallbackHeight =
      typeof maxVideoHeight === "number" && maxVideoHeight > 0
        ? maxVideoHeight
        : 320;
    const widthDrivenHeight =
      availableWidth > 0 ? (availableWidth * 16) / 9 : fallbackHeight;
    const frameHeight =
      typeof maxVideoHeight === "number" && maxVideoHeight > 0
        ? Math.min(widthDrivenHeight, maxVideoHeight)
        : widthDrivenHeight;
    const frameWidth =
      availableWidth > 0
        ? Math.min(availableWidth, (frameHeight * 9) / 16)
        : (frameHeight * 9) / 16;

    return {
      height: Math.max(0, frameHeight),
      width: Math.max(0, frameWidth),
    };
  }, [availableWidth, maxVideoHeight]);

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
          <ThemedText style={styles.title}>Preview</ThemedText>
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
          <ThemedText
            style={[styles.subtleText, { color: theme.tabIconDefault }]}
          >
            {previewSupportingText}
          </ThemedText>
        </View>
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

      <View
        style={styles.frameArea}
        onLayout={handleFrameAreaLayout}
        testID="story-preview-media-stage"
      >
        <View
          style={[
            styles.videoFrame,
            { backgroundColor: theme.backgroundSecondary },
            frameStyle,
          ]}
          testID="story-preview-media-frame"
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
                {blockedMessage ??
                  "Synced preview is blocked for this session."}
              </ThemedText>
            </View>
          )}
        </View>
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
  frameArea: {
    alignItems: "center",
    width: "100%",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerStatusRow: {
    alignItems: "flex-start",
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
  video: {
    height: "100%",
    width: "100%",
  },
  videoFrame: {
    alignSelf: "center",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
});
