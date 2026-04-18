import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { describe, expect, jest, test } from "@jest/globals";

import { StoryboardSurface } from "@/components/story-editor/StoryboardSurface";
import type { Step3BeatRailItem } from "@/screens/story-editor/step3";

jest.mock("expo-av", () => ({
  Video: "Video",
  ResizeMode: { COVER: "cover" },
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

const theme = {
  backgroundDefault: "#111111",
  backgroundSecondary: "#222222",
  border: "#333333",
  buttonText: "#ffffff",
  link: "#4A5FFF",
  tabIconDefault: "#999999",
  text: "#ffffff",
};

const railItems: Step3BeatRailItem[] = [
  {
    sentenceIndex: 0,
    text: "Beat one",
    clipThumbUrl: "https://cdn.example.com/thumb-a.jpg",
    clipUrl: "https://cdn.example.com/clip-a.mp4",
    startTimeSec: 0,
    endTimeSec: 3,
    durationSec: 3,
    hasSelectedClip: true,
  },
];

describe("client/components/story-editor/StoryboardSurface", () => {
  test("renders blocked state and compact rail inside one surface", () => {
    const { getByTestId, getAllByText } = render(
      <StoryboardSurface
        activeSentenceIndex={null}
        blockedMessage="Sync voice and timing to unlock the synced preview."
        captionPlacement="bottom"
        currentCaptionText={null}
        currentPreviewBeatLabel={null}
        currentSegmentClipUrl={null}
        currentSegmentPosterUrl={null}
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={260}
        onLongPressBeat={jest.fn()}
        onPressBeat={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        playbackSentenceIndex={null}
        previewDurationSec={null}
        previewPositionSec={0}
        previewReady={false}
        railItems={railItems}
        selectedSentenceIndex={null}
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    expect(getByTestId("storyboard-surface")).toBeTruthy();
    expect(getByTestId("story-timeline-rail")).toBeTruthy();
    expect(
      getAllByText("Sync voice and timing to unlock the synced preview.")
        .length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("renders ready preview without depending on caption raster assets", () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <StoryboardSurface
        activeSentenceIndex={0}
        blockedMessage={null}
        captionPlacement="center"
        currentCaptionText="Caption from canonical session timing"
        currentPreviewBeatLabel="Beat 1"
        currentSegmentClipUrl="https://cdn.example.com/clip-a.mp4"
        currentSegmentPosterUrl="https://cdn.example.com/poster-a.jpg"
        isPreviewAvailable
        isPreviewPlaying={false}
        maxVideoHeight={280}
        onLongPressBeat={jest.fn()}
        onPressBeat={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        playbackSentenceIndex={0}
        previewDurationSec={10}
        previewPositionSec={4}
        previewReady
        railItems={railItems}
        selectedSentenceIndex={0}
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    fireEvent(getByTestId("storyboard-preview-stage"), "layout", {
      nativeEvent: { layout: { width: 240, height: 0 } },
    });

    const captionStyle = StyleSheet.flatten(
      getByTestId("storyboard-preview-caption").props.style,
    );

    expect(UNSAFE_getByType("Video")).toBeTruthy();
    expect(captionStyle.fontSize).toBeGreaterThanOrEqual(13);
    expect(captionStyle.fontSize).toBeLessThanOrEqual(24);
  });
});
