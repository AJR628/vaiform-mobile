import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { describe, expect, jest, test } from "@jest/globals";

import { StoryTimelineRail } from "@/components/story-editor/StoryTimelineRail";
import type { Step3BeatRailItem } from "@/screens/story-editor/step3";

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

const theme = {
  backgroundSecondary: "#222222",
  border: "#333333",
  buttonText: "#ffffff",
  link: "#4A5FFF",
  tabIconDefault: "#999999",
  text: "#ffffff",
};

const items: Step3BeatRailItem[] = [
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
  {
    sentenceIndex: 1,
    text: "Beat two",
    clipThumbUrl: null,
    clipUrl: null,
    startTimeSec: 3,
    endTimeSec: 7,
    durationSec: 4,
    hasSelectedClip: false,
  },
  {
    sentenceIndex: 2,
    text: "Beat three",
    clipThumbUrl: null,
    clipUrl: null,
    startTimeSec: null,
    endTimeSec: null,
    durationSec: null,
    hasSelectedClip: false,
  },
];

describe("client/components/story-editor/StoryTimelineRail", () => {
  test("renders a connected filmstrip and preserves beat interactions", () => {
    const onPressBeat = jest.fn();
    const onLongPressBeat = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <StoryTimelineRail
        activeSentenceIndex={0}
        isPreviewAvailable
        isPreviewPlaying={false}
        items={items}
        onLongPressBeat={onLongPressBeat}
        onPressBeat={onPressBeat}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={0}
        previewDurationSec={8}
        previewPositionSec={2}
        selectedSentenceIndex={1}
        theme={theme}
      />,
    );

    expect(getByText("B1")).toBeTruthy();
    expect(getByText("B2")).toBeTruthy();
    expect(getByTestId("story-timeline-strip")).toBeTruthy();
    expect(getByTestId("story-timeline-selected-1")).toBeTruthy();
    expect(getByTestId("story-timeline-playback-0")).toBeTruthy();
    expect(getByTestId("story-timeline-playback-marker-0")).toBeTruthy();
    expect(queryByTestId("story-timeline-selected-0")).toBeNull();

    fireEvent.press(getByTestId("story-timeline-tile-1"));
    fireEvent(getByTestId("story-timeline-tile-0"), "longPress");

    expect(onPressBeat).toHaveBeenCalledWith(1);
    expect(onLongPressBeat).toHaveBeenCalledWith(0);
  });

  test("shows passive progress from provided preview clock values", () => {
    const { getByTestId } = render(
      <StoryTimelineRail
        activeSentenceIndex={null}
        isPreviewAvailable
        isPreviewPlaying={false}
        items={items}
        onLongPressBeat={jest.fn()}
        onPressBeat={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={null}
        previewDurationSec={10}
        previewPositionSec={4}
        selectedSentenceIndex={null}
        theme={theme}
      />,
    );

    const progressStyle = StyleSheet.flatten(
      getByTestId("story-timeline-progress").props.style,
    );

    expect(progressStyle.width).toBe("40%");
  });

  test("uses stable mobile width clamps and fallback thumbnail rendering", () => {
    const { getAllByText, getByTestId } = render(
      <StoryTimelineRail
        activeSentenceIndex={2}
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        items={items}
        onLongPressBeat={jest.fn()}
        onPressBeat={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={2}
        previewDurationSec={null}
        previewPositionSec={0}
        selectedSentenceIndex={2}
        theme={theme}
      />,
    );

    const shortStyle = StyleSheet.flatten(
      getByTestId("story-timeline-tile-0").props.style,
    );
    const longerStyle = StyleSheet.flatten(
      getByTestId("story-timeline-tile-1").props.style,
    );
    const fallbackStyle = StyleSheet.flatten(
      getByTestId("story-timeline-tile-2").props.style,
    );

    expect(longerStyle.width).toBeGreaterThan(shortStyle.width);
    expect(fallbackStyle.width).toBe(72);
    expect(getByTestId("story-timeline-fallback-2")).toBeTruthy();
    expect(getAllByText("--:--").length).toBeGreaterThanOrEqual(1);
  });
});
