import React, { useCallback, useMemo, useState, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { CaptionPlacement } from "@/screens/story-editor/model";
import type { StoryCaptionOverlayV1 } from "@/types/story";

interface StoryboardPreviewStageProps {
  blockedMessage: string | null;
  captionPlacement: CaptionPlacement;
  captionOverlay: StoryCaptionOverlayV1 | null;
  currentCaptionText: string | null;
  maxVideoHeight?: number | null;
  onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
  onRequestPreview: () => void;
  previewArtifactUrl: string | null;
  previewIsRequesting: boolean;
  previewReady: boolean;
  videoRef: RefObject<Video | null>;
  theme: {
    backgroundSecondary: string;
    tabIconDefault: string;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function StoryboardPreviewStage({
  blockedMessage,
  captionPlacement,
  captionOverlay,
  currentCaptionText,
  maxVideoHeight,
  onPlaybackStatusUpdate,
  onRequestPreview,
  previewArtifactUrl,
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

  const captionStyle = useMemo(() => {
    const style = captionOverlay?.style ?? {};
    const frame = captionOverlay?.frame;
    const frameWidth = Number(frame?.width) > 0 ? Number(frame?.width) : 1080;
    const scale = frameSize.width > 0 ? frameSize.width / frameWidth : 1;
    const fontSize = clamp(Number(style.fontPx || 76) * scale, 13, 28);
    const lineHeight = Math.round(fontSize * 1.16);
    const horizontalInset = clamp(frameSize.width * 0.08, 12, 28);
    const verticalInset = clamp(frameSize.height * 0.055, 12, 30);
    const yPct = Number(style.yPct);
    const placement =
      style.placement ?? captionOverlay?.placement ?? captionPlacement;
    const centerTop = Math.max(
      verticalInset,
      frameSize.height / 2 - lineHeight * 1.2,
    );

    const placementStyle: StyleProp<ViewStyle> = Number.isFinite(yPct)
      ? {
          top: clamp(
            yPct * frameSize.height,
            verticalInset,
            frameSize.height - verticalInset - lineHeight * 2,
          ),
        }
      : placement === "top"
        ? { top: verticalInset }
        : placement === "center"
          ? { top: centerTop }
          : { bottom: verticalInset };

    return {
      overlay: [
        styles.captionOverlay,
        placementStyle,
        {
          left: horizontalInset,
          right: horizontalInset,
        },
      ] as StyleProp<ViewStyle>,
      text: {
        color: typeof style.color === "string" ? style.color : "#fff",
        fontSize,
        fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
        fontWeight: style.weightCss === "normal" ? "400" : "700",
        lineHeight,
      } as TextStyle,
    };
  }, [captionOverlay, captionPlacement, frameSize.height, frameSize.width]);

  const hasPlayablePreview = previewReady && !!previewArtifactUrl;

  return (
    <View
      style={styles.stage}
      onLayout={handleStageLayout}
      testID="storyboard-preview-stage"
    >
      <View
        style={[
          styles.frame,
          { backgroundColor: theme.backgroundSecondary },
          frameSize,
        ]}
        testID="storyboard-preview-frame"
      >
        {hasPlayablePreview ? (
          <>
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
            <View style={captionStyle.overlay} pointerEvents="none">
              <ThemedText
                style={[styles.captionText, captionStyle.text]}
                testID="storyboard-preview-caption"
              >
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
            <Pressable
              onPress={onRequestPreview}
              disabled={previewIsRequesting}
              style={[
                styles.regenerateButton,
                { opacity: previewIsRequesting ? 0.6 : 1 },
              ]}
              testID="storyboard-preview-regenerate"
            >
              <ThemedText style={styles.regenerateText}>
                {previewIsRequesting ? "Generating..." : "Generate Preview"}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockedSurface: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  blockedText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: "center",
  },
  captionOverlay: {
    position: "absolute",
  },
  captionText: {
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  frame: {
    alignSelf: "center",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  stage: {
    alignItems: "center",
    width: "100%",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  regenerateText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
