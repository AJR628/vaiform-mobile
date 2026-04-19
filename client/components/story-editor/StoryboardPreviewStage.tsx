import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { CaptionPlacement } from "@/screens/story-editor/model";
import type { Step3PreviewVideoSlot } from "@/screens/story-editor/useStep3PreviewPlayback";

interface StoryboardPreviewStageProps {
  blockedMessage: string | null;
  captionPlacement: CaptionPlacement;
  currentCaptionText: string | null;
  maxVideoHeight?: number | null;
  onPreviewSlotReady: (
    slotKey: Step3PreviewVideoSlot["key"],
    requestToken: number,
  ) => void;
  previewReady: boolean;
  previewVideoSlots: Step3PreviewVideoSlot[];
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
  currentCaptionText,
  maxVideoHeight,
  onPreviewSlotReady,
  previewReady,
  previewVideoSlots,
  theme,
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
    const fontSize = clamp(frameSize.width * 0.07, 13, 24);
    const lineHeight = Math.round(fontSize * 1.16);
    const horizontalInset = clamp(frameSize.width * 0.08, 12, 28);
    const verticalInset = clamp(frameSize.height * 0.055, 12, 30);
    const centerTop = Math.max(
      verticalInset,
      frameSize.height / 2 - lineHeight * 1.2,
    );

    const placementStyle: StyleProp<ViewStyle> =
      captionPlacement === "top"
        ? { top: verticalInset }
        : captionPlacement === "center"
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
        fontSize,
        lineHeight,
      },
    };
  }, [captionPlacement, frameSize.height, frameSize.width]);

  const hasPreviewSlot = previewVideoSlots.some((slot) => !!slot.clipUrl);

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
        {previewReady && hasPreviewSlot ? (
          <>
            {previewVideoSlots.map((slot) =>
              slot.clipUrl ? (
                <Video
                  key={`${slot.key}-${slot.requestToken}`}
                  ref={slot.ref}
                  source={{ uri: slot.clipUrl }}
                  style={[
                    styles.video,
                    slot.isActive ? styles.videoActive : styles.videoStandby,
                  ]}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isLooping={false}
                  progressUpdateIntervalMillis={250}
                  onLoad={() => onPreviewSlotReady(slot.key, slot.requestToken)}
                  onReadyForDisplay={() =>
                    onPreviewSlotReady(slot.key, slot.requestToken)
                  }
                  posterSource={
                    slot.posterUrl ? { uri: slot.posterUrl } : undefined
                  }
                  testID={`storyboard-preview-video-${slot.key}`}
                  usePoster={Boolean(slot.posterUrl)}
                />
              ) : null,
            )}
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
    color: "#fff",
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
  videoActive: {
    opacity: 1,
  },
  videoStandby: {
    opacity: 0,
  },
});
