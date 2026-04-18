import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { describe, expect, jest, test } from "@jest/globals";

import { StoryPreviewShell } from "@/components/story-editor/StoryPreviewShell";

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

describe("client/components/story-editor/StoryPreviewShell", () => {
  test("renders the backend blocked message when preview is not ready", () => {
    const { getAllByText, getByTestId } = render(
      <StoryPreviewShell
        blockedMessage="Sync voice and timing to unlock the synced preview."
        currentCaptionText={null}
        currentPreviewBeatLabel={null}
        currentSegmentClipUrl={null}
        currentSegmentPosterUrl={null}
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={220}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        previewDurationSec={null}
        previewPositionSec={0}
        previewReady={false}
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    expect(
      getAllByText("Sync voice and timing to unlock the synced preview."),
    ).toHaveLength(2);

    fireEvent(getByTestId("story-preview-media-stage"), "layout", {
      nativeEvent: { layout: { width: 320, height: 0 } },
    });

    const frameStyle = StyleSheet.flatten(
      getByTestId("story-preview-media-frame").props.style,
    );
    expect(frameStyle.height).toBe(220);
    expect(frameStyle.width).toBeCloseTo(123.75, 2);
  });

  test("renders the preview surface and timing UI when preview is ready", () => {
    const { getByText, getByTestId, UNSAFE_getByType } = render(
      <StoryPreviewShell
        blockedMessage={null}
        currentCaptionText="Beat one"
        currentPreviewBeatLabel="Beat 1"
        currentSegmentClipUrl="https://cdn.example.com/clip-a.mp4"
        currentSegmentPosterUrl="https://cdn.example.com/clip-a.jpg"
        isPreviewAvailable={true}
        isPreviewPlaying={false}
        maxVideoHeight={240}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        previewDurationSec={12}
        previewPositionSec={4}
        previewReady={true}
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    fireEvent(getByTestId("story-preview-media-stage"), "layout", {
      nativeEvent: { layout: { width: 200, height: 0 } },
    });

    expect(getByText("Beat 1")).toBeTruthy();
    expect(getByText("0:04 / 0:12")).toBeTruthy();
    expect(UNSAFE_getByType("Video")).toBeTruthy();
  });
});
