import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";

interface StoryPreviewShellProps {
  blockedMessage: string | null;
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
  previewHeroActionDisabled?: boolean;
  previewHeroActionLabel?: string;
  previewHeroActionTarget?: "voice" | "preview";
  previewHeroHeadline: string;
  previewHeroHint: string | null;
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
  previewHeroActionDisabled: _previewHeroActionDisabled,
  previewHeroActionLabel: _previewHeroActionLabel,
  previewHeroActionTarget: _previewHeroActionTarget,
  previewHeroHeadline,
  previewHeroHint,
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
    <LinearGradient
      colors={["#0A0F16", "#141B24"]}
      style={[
        styles.container,
        {
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.monitorChrome}>
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
          <View
            style={[styles.statusDot, { backgroundColor: statusAccentColor }]}
          />
          <ThemedText style={styles.statusChipText} numberOfLines={1}>
            {previewStatusLabel}
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

      <View
        style={styles.frameArea}
        onLayout={handleFrameAreaLayout}
        testID="story-preview-media-stage"
      >
        <View
          style={[
            styles.videoFrame,
            {
              backgroundColor: "#070A0F",
              borderColor: theme.border,
            },
            frameStyle,
          ]}
          testID="story-preview-media-frame"
        >
          {previewReady && currentSegmentClipUrl ? (
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
              testID="story-preview-shell-video"
            />
          ) : (
            <LinearGradient
              colors={[
                "rgba(10,132,255,0.18)",
                "rgba(7,10,15,0.94)",
                "#070A0F",
              ]}
              locations={[0, 0.52, 1]}
              style={styles.blockedSurface}
            >
              <View style={styles.syncIcon}>
                <Feather name="refresh-cw" size={22} color={theme.link} />
              </View>
              <ThemedText style={styles.blockedTitle}>
                {previewHeroHeadline ||
                  blockedMessage ||
                  "Synced preview is blocked for this session."}
              </ThemedText>
            </LinearGradient>
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
    </LinearGradient>
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
    paddingHorizontal: Spacing.xl,
  },
  blockedTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  blockedText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.xs,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    padding: 6,
  },
  frameArea: {
    alignItems: "center",
    width: "100%",
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
  monitorChrome: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  statusChip: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    flexShrink: 1,
    maxWidth: "72%",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  statusChipText: {
    color: "#F7FAFF",
    fontSize: 13,
    fontWeight: "700",
  },
  statusDot: {
    borderRadius: BorderRadius.full,
    height: 9,
    width: 9,
  },
  syncIcon: {
    alignItems: "center",
    backgroundColor: "rgba(10,132,255,0.14)",
    borderColor: "rgba(10,132,255,0.34)",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    height: 60,
    justifyContent: "center",
    width: 60,
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
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  video: {
    height: "100%",
    width: "100%",
  },
  videoFrame: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
});
