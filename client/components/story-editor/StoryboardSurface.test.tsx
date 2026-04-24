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
  test("renders blocked state, header chrome, and compact rail inside one surface", () => {
    const onOpenVoiceSync = jest.fn();
    const { getByTestId, getAllByText, getByText } = render(
      <StoryboardSurface
        activeSentenceIndex={null}
        blockedMessage="Sync voice and timing to unlock the synced preview."
        captionPlacement="bottom"
        currentCaptionText={null}
        currentPreviewBeatLabel={null}
        helperBannerCopy="Clip selection first, then voice sync locks timing."
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={260}
        onLongPressBeat={jest.fn()}
        onOpenVoiceSync={onOpenVoiceSync}
        onPressBeat={jest.fn()}
        onPreviewPlaybackStatus={jest.fn()}
        onRequestPreview={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={null}
        captionOverlay={null}
        previewArtifactUrl={null}
        previewDurationSec={null}
        previewIsRequesting={false}
        previewPositionSec={0}
        previewReady={false}
        previewStatusLabel="Rough Preview"
        previewStatusTone="neutral"
        previewSupportingText="Sync voice and timing to unlock the synced preview."
        railItems={railItems}
        selectedSentenceIndex={null}
        videoRef={{ current: null }}
        theme={theme}
      />,
    );

    expect(getByTestId("storyboard-surface")).toBeTruthy();
    expect(getByTestId("story-timeline-rail")).toBeTruthy();
    expect(getByText("Preview")).toBeTruthy();
    expect(getByTestId("preview-status-chip")).toBeTruthy();
    expect(getByTestId("preview-helper-banner")).toBeTruthy();
    expect(
      getAllByText("Sync voice and timing to unlock the synced preview.")
        .length,
    ).toBeGreaterThanOrEqual(1);
    fireEvent.press(getByTestId("preview-voice-timing-cta"));
    expect(onOpenVoiceSync).toHaveBeenCalledTimes(1);
  });

  test("renders ready preview without depending on caption raster assets", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <StoryboardSurface
        activeSentenceIndex={0}
        blockedMessage={null}
        captionPlacement="center"
        currentCaptionText="Caption from canonical session timing"
        currentPreviewBeatLabel="Beat 1"
        helperBannerCopy={null}
        isPreviewAvailable
        isPreviewPlaying={false}
        maxVideoHeight={280}
        onLongPressBeat={jest.fn()}
        onOpenVoiceSync={jest.fn()}
        onPressBeat={jest.fn()}
        onPreviewPlaybackStatus={jest.fn()}
        onRequestPreview={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={0}
        captionOverlay={{
          version: 1,
          contractVersion: "caption-overlay-v1",
          rendererVersion: "caption-overlay-v1",
          frame: { width: 1080, height: 1920 },
          placement: "center",
          style: { placement: "center", fontPx: 72 },
          segments: [],
        }}
        previewArtifactUrl="https://cdn.example.com/base.mp4"
        previewDurationSec={10}
        previewIsRequesting={false}
        previewPositionSec={4}
        previewReady
        previewStatusLabel="Synced Preview"
        previewStatusTone="success"
        previewSupportingText="Timing locked to narration."
        railItems={railItems}
        selectedSentenceIndex={0}
        videoRef={{ current: null }}
        theme={theme}
      />,
    );

    fireEvent(getByTestId("storyboard-preview-stage"), "layout", {
      nativeEvent: { layout: { width: 240, height: 0 } },
    });

    const captionStyle = StyleSheet.flatten(
      getByTestId("storyboard-preview-caption").props.style,
    );

    expect(getByTestId("storyboard-preview-video")).toBeTruthy();
    expect(getByText("Synced Preview")).toBeTruthy();
    expect(queryByTestId("preview-helper-banner")).toBeNull();
    expect(captionStyle.fontSize).toBeGreaterThanOrEqual(13);
    expect(captionStyle.fontSize).toBeLessThanOrEqual(28);
  });
});
