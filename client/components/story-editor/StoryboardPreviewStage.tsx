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
  previewHeroActionDisabled: boolean;
  previewHeroActionLabel: string;
  previewHeroHeadline: string;
  previewIsRequesting: boolean;
  previewReady: boolean;
  videoRef: RefObject<Video | null>;
  theme: {
    border: string;
    buttonText: string;
    link: string;
  };
}

export function StoryboardPreviewStage({
  blockedMessage,
  maxVideoHeight,
  onPlaybackStatusUpdate,
  onPrimaryAction,
  previewArtifactUrl,
  previewHeroActionDisabled,
  previewHeroActionLabel,
  previewHeroHeadline,
  previewIsRequesting,
  previewReady,
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
  const actionDisabled = previewHeroActionDisabled || previewIsRequesting;
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
            <Pressable
              accessibilityRole="button"
              onPress={onPrimaryAction}
              disabled={actionDisabled}
              style={[
                styles.regenerateButton,
                { opacity: actionDisabled ? 0.66 : 1 },
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
                  {actionDisabled ? "Generating..." : previewHeroActionLabel}
                </ThemedText>
              </LinearGradient>
            </Pressable>
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
    marginTop: Spacing.md,
    textAlign: "center",
  },
  frame: {
    alignSelf: "center",
    borderRadius: 0,
    overflow: "hidden",
  },
  stage: {
    alignItems: "center",
    width: "100%",
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
