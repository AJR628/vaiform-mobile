import React, { useCallback, useMemo, useState, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";

interface StoryboardPreviewStageProps {
  blockedMessage: string | null;
  maxVideoHeight?: number | null;
  onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
  onPrimaryAction: () => void;
  previewArtifactUrl: string | null;
  previewHeroActionLabel: string;
  previewHeroHeadline: string;
  previewHeroHint: string | null;
  previewIsRequesting: boolean;
  previewReady: boolean;
  previewStatusLabel: string;
  previewStatusTone: "neutral" | "success" | "warning" | "info";
  previewSupportingText: string;
  videoRef: RefObject<Video | null>;
  theme: {
    border: string;
    buttonText: string;
    backgroundSecondary: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
}

export function StoryboardPreviewStage({
  blockedMessage,
  maxVideoHeight,
  onPlaybackStatusUpdate,
  onPrimaryAction,
  previewArtifactUrl,
  previewHeroActionLabel,
  previewHeroHeadline,
  previewHeroHint,
  previewIsRequesting,
  previewReady,
  previewStatusLabel,
  previewStatusTone,
  previewSupportingText,
  theme,
  videoRef,
}: StoryboardPreviewStageProps) {
  const [availableWidth, setAvailableWidth] = useState(0);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setAvailableWidth((current) =>
      Math.abs(current - nextWidth) >= 1 ? nextWidth : current,
    );
  }, []);

  const frameSize = useMemo(() => {
    const maxHeight =
      typeof maxVideoHeight === "number" && maxVideoHeight > 0
        ? maxVideoHeight
        : 420;
    const widthDrivenHeight =
      availableWidth > 0 ? (availableWidth * 16) / 9 : maxHeight;
    const height = Math.min(widthDrivenHeight, maxHeight);
    const width =
      availableWidth > 0
        ? Math.min(availableWidth, (height * 9) / 16)
        : (height * 9) / 16;

    return {
      height: Math.max(0, height),
      width: Math.max(0, width),
    };
  }, [availableWidth, maxVideoHeight]);

  const hasPlayablePreview = previewReady && !!previewArtifactUrl;
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
  const blockedHeadline =
    previewHeroHeadline ||
    blockedMessage ||
    "Synced preview is blocked for this session.";

  return (
    <View
      style={styles.stage}
      onLayout={handleStageLayout}
      testID="storyboard-preview-stage"
    >
      <View
        style={[
          styles.frame,
          {
            backgroundColor: "#070A0F",
            borderColor: theme.border,
          },
          frameSize,
        ]}
        testID="storyboard-preview-frame"
      >
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
          <ThemedText
            style={[styles.statusBadgeText, { color: "#F7FAFF" }]}
            numberOfLines={1}
          >
            {previewStatusLabel}
          </ThemedText>
        </View>
        {hasPlayablePreview ? (
          <Video
            ref={videoRef}
            source={{ uri: previewArtifactUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isLooping={false}
            progressUpdateIntervalMillis={250}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            testID="storyboard-preview-video"
          />
        ) : (
          <LinearGradient
            colors={["rgba(10,132,255,0.22)", "rgba(7,10,15,0.92)", "#070A0F"]}
            locations={[0, 0.48, 1]}
            style={styles.blockedSurface}
          >
            <View style={styles.syncIcon}>
              <Feather name="refresh-cw" size={26} color={theme.link} />
            </View>
            <ThemedText style={styles.blockedTitle}>
              {blockedHeadline}
            </ThemedText>
            {blockedMessage && blockedMessage !== blockedHeadline ? (
              <ThemedText
                style={[styles.blockedText, { color: theme.tabIconDefault }]}
              >
                {blockedMessage}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onPrimaryAction}
              disabled={previewIsRequesting}
              style={[
                styles.regenerateButton,
                { opacity: previewIsRequesting ? 0.6 : 1 },
              ]}
              testID="storyboard-preview-regenerate"
            >
              <LinearGradient
                colors={["#35A0FF", theme.link]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.regenerateGradient}
              >
                <Feather name="radio" size={16} color={theme.buttonText} />
                <ThemedText style={styles.regenerateText}>
                  {previewIsRequesting
                    ? "Generating..."
                    : previewHeroActionLabel}
                </ThemedText>
              </LinearGradient>
            </Pressable>
            {previewHeroHint ? (
              <View style={styles.heroHintRow}>
                <Feather name="star" size={12} color={theme.tabIconDefault} />
                <ThemedText
                  style={[styles.heroHintText, { color: theme.tabIconDefault }]}
                >
                  {previewHeroHint}
                </ThemedText>
              </View>
            ) : (
              <ThemedText
                style={[styles.heroHintText, { color: theme.tabIconDefault }]}
              >
                {previewSupportingText}
              </ThemedText>
            )}
          </LinearGradient>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockedSurface: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  blockedTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  blockedText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  frame: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  heroHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  heroHintText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  stage: {
    alignItems: "center",
    width: "100%",
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.xs,
    left: Spacing.md,
    maxWidth: "72%",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    position: "absolute",
    top: Spacing.md,
    zIndex: 2,
  },
  statusBadgeText: {
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
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  video: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  regenerateButton: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
    overflow: "hidden",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 3,
  },
  regenerateGradient: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    minHeight: 50,
    minWidth: 210,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  regenerateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
