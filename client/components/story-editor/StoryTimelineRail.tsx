import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Step3BeatRailItem } from "@/screens/story-editor/step3";

interface StoryTimelineRailProps {
  activeSentenceIndex: number | null;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  items: Step3BeatRailItem[];
  onLongPressBeat: (sentenceIndex: number) => void;
  onPressBeat: (sentenceIndex: number) => void;
  onStopPreview: () => void;
  onTogglePreview: () => void;
  playbackSentenceIndex: number | null;
  previewDurationSec: number | null;
  previewPositionSec: number;
  selectedSentenceIndex: number | null;
  theme: {
    backgroundSecondary: string;
    border: string;
    buttonText: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
}

function formatDuration(value: number | null): string {
  if (!Number.isFinite(value ?? NaN) || value === null) return "--:--";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getTileWidth(item: Step3BeatRailItem): number {
  const duration = Number(item.durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return 72;
  return Math.round(Math.min(Math.max(60 + duration * 6, 68), 116));
}

function getDurationLabel(value: number | null): string {
  return formatDuration(value);
}

const SEGMENT_HEIGHT = 96;

export function StoryTimelineRail({
  activeSentenceIndex,
  isPreviewAvailable,
  isPreviewPlaying,
  items,
  onLongPressBeat,
  onPressBeat,
  onStopPreview,
  onTogglePreview,
  playbackSentenceIndex,
  previewDurationSec,
  previewPositionSec,
  selectedSentenceIndex,
  theme,
}: StoryTimelineRailProps) {
  const progressPct = useMemo(() => {
    const duration = Number(previewDurationSec);
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(Math.max((previewPositionSec / duration) * 100, 0), 100);
  }, [previewDurationSec, previewPositionSec]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "rgba(7,10,15,0.9)",
          borderColor: "rgba(255,255,255,0.10)",
        },
      ]}
      testID="story-timeline-rail"
    >
      <View style={styles.topline}>
        <Pressable
          onPress={onTogglePreview}
          disabled={!isPreviewAvailable}
          accessibilityRole="button"
          style={[
            styles.playButton,
            {
              backgroundColor: isPreviewAvailable
                ? "rgba(10,132,255,0.18)"
                : "rgba(255,255,255,0.08)",
              borderColor: isPreviewAvailable
                ? "rgba(10,132,255,0.42)"
                : "rgba(255,255,255,0.10)",
              opacity: isPreviewAvailable ? 1 : 0.55,
            },
          ]}
          testID="story-timeline-play"
        >
          <Feather
            name={isPreviewPlaying ? "pause" : "play"}
            size={20}
            color={theme.buttonText}
          />
        </Pressable>
        <ThemedText style={[styles.timeText, { color: theme.tabIconDefault }]}>
          {formatDuration(previewPositionSec)}
        </ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.link, width: `${progressPct}%` },
            ]}
            testID="story-timeline-progress"
          />
        </View>
        <ThemedText style={[styles.timeText, { color: theme.tabIconDefault }]}>
          {formatDuration(previewDurationSec)}
        </ThemedText>
        <Pressable
          onPress={onStopPreview}
          disabled={!isPreviewAvailable}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.stopButton,
            {
              borderColor: "rgba(255,255,255,0.10)",
              opacity: isPreviewAvailable ? 1 : 0.45,
            },
          ]}
          testID="story-timeline-stop"
        >
          <Feather name="square" size={16} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        testID="story-timeline-scroll"
      >
        <View
          style={[
            styles.strip,
            {
              backgroundColor: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.10)",
            },
          ]}
          testID="story-timeline-strip"
        >
          {items.map((item, index) => {
            const isSelected = selectedSentenceIndex === item.sentenceIndex;
            const isPlaybackActive =
              playbackSentenceIndex === item.sentenceIndex;
            const isActive = activeSentenceIndex === item.sentenceIndex;
            const durationLabel = getDurationLabel(item.durationSec);

            return (
              <Pressable
                key={`rail-${item.sentenceIndex}`}
                onPress={() => onPressBeat(item.sentenceIndex)}
                onLongPress={() => onLongPressBeat(item.sentenceIndex)}
                style={[
                  styles.tile,
                  {
                    width: getTileWidth(item),
                    height: SEGMENT_HEIGHT,
                    backgroundColor: isActive
                      ? "rgba(10,132,255,0.12)"
                      : "rgba(255,255,255,0.06)",
                    borderRightColor:
                      index < items.length - 1 ? theme.border : "transparent",
                    shadowColor: isSelected ? theme.link : "transparent",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isSelected ? 0.28 : 0,
                    shadowRadius: isSelected ? 12 : 0,
                    elevation: isSelected ? 2 : 0,
                  },
                ]}
                testID={`story-timeline-tile-${item.sentenceIndex}`}
              >
                {item.clipThumbUrl ? (
                  <Image
                    source={{ uri: item.clipThumbUrl }}
                    style={styles.tileThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={styles.tileEmpty}
                    testID={`story-timeline-fallback-${item.sentenceIndex}`}
                  >
                    <Feather
                      name="video"
                      size={14}
                      color={theme.tabIconDefault}
                    />
                  </View>
                )}
                <View style={styles.tileScrim} pointerEvents="none" />
                <View style={styles.tileMetaRow} pointerEvents="none">
                  <ThemedText style={styles.tileBeat}>
                    B{item.sentenceIndex + 1}
                  </ThemedText>
                  <ThemedText
                    style={[styles.tileDuration, { color: "#fff" }]}
                    testID={`story-timeline-duration-${item.sentenceIndex}`}
                  >
                    {durationLabel}
                  </ThemedText>
                </View>
                <View style={styles.tileCopy} pointerEvents="none">
                  <ThemedText
                    numberOfLines={1}
                    style={[styles.tileText, { color: theme.text }]}
                  >
                    {item.text || "Untitled"}
                  </ThemedText>
                </View>
                {isSelected ? (
                  <View
                    pointerEvents="none"
                    style={[styles.selectionRing, { borderColor: theme.link }]}
                    testID={`story-timeline-selected-${item.sentenceIndex}`}
                  />
                ) : null}
                {isPlaybackActive ? (
                  <>
                    <View
                      pointerEvents="none"
                      style={[styles.playbackRing, { borderColor: theme.link }]}
                      testID={`story-timeline-playback-${item.sentenceIndex}`}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.playbackMarker,
                        { backgroundColor: theme.link },
                      ]}
                      testID={`story-timeline-playback-marker-${item.sentenceIndex}`}
                    />
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.sm,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  playButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  progressFill: {
    borderRadius: BorderRadius.full,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  progressTrack: {
    borderRadius: BorderRadius.full,
    flex: 1,
    height: 5,
    overflow: "hidden",
  },
  railContent: {
    paddingVertical: 2,
  },
  selectionRing: {
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    bottom: 3,
    left: 3,
    position: "absolute",
    right: 3,
    top: 3,
  },
  playbackMarker: {
    borderRadius: BorderRadius.full,
    height: 4,
    left: "32%",
    position: "absolute",
    right: "32%",
    top: 0,
  },
  playbackRing: {
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    bottom: 3,
    left: 3,
    position: "absolute",
    right: 3,
    top: 3,
  },
  strip: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  tile: {
    borderRightWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  tileBeat: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  tileDuration: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  tileCopy: {
    bottom: 8,
    left: 6,
    position: "absolute",
    right: 6,
  },
  tileEmpty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  tileScrim: {
    backgroundColor: "rgba(0,0,0,0.42)",
    bottom: 0,
    height: "54%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  tileMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 6,
    position: "absolute",
    right: 6,
    top: 6,
  },
  tileText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  tileThumb: {
    height: "100%",
    width: "100%",
  },
  timeText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    minWidth: 36,
    textAlign: "center",
  },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stopButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
