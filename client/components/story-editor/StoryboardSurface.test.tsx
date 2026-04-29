import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
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

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

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
    const onRequestPreview = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <StoryboardSurface
        activeSentenceIndex={null}
        blockedMessage="Sync voice and timing to unlock the synced preview."
        currentPreviewBeatLabel={null}
        helperBannerCopy="Clip selection first, then voice sync locks timing."
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={260}
        onLongPressBeat={jest.fn()}
        onOpenVoiceSync={onOpenVoiceSync}
        onPressBeat={jest.fn()}
        onPreviewPlaybackStatus={jest.fn()}
        onRequestPreview={onRequestPreview}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={null}
        previewArtifactUrl={null}
        previewDurationSec={null}
        previewHeroActionLabel="Voice & Timing"
        previewHeroActionTarget="voice"
        previewHeroHeadline="Re-sync to update preview"
        previewHeroHint="Generate preview after sync"
        previewIsRequesting={false}
        previewPositionSec={0}
        previewReady={false}
        previewStatusLabel="Voice changed"
        previewStatusTone="warning"
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
    expect(queryByTestId("preview-helper-banner")).toBeNull();
    expect(getByText("Re-sync to update preview")).toBeTruthy();
    expect(getByText("Generate preview after sync")).toBeTruthy();
    fireEvent.press(getByTestId("storyboard-preview-regenerate"));
    expect(onOpenVoiceSync).toHaveBeenCalledTimes(1);
    expect(onRequestPreview).not.toHaveBeenCalled();
    fireEvent.press(getByTestId("preview-voice-timing-cta"));
    expect(onOpenVoiceSync).toHaveBeenCalledTimes(2);
  });

  test("routes current-voice blocked CTA to preview generation", () => {
    const onOpenVoiceSync = jest.fn();
    const onRequestPreview = jest.fn();
    const { getByTestId, getByText } = render(
      <StoryboardSurface
        activeSentenceIndex={null}
        blockedMessage="Generate a synced preview to play this storyboard."
        currentPreviewBeatLabel={null}
        helperBannerCopy="Uses synced voice timing."
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={260}
        onLongPressBeat={jest.fn()}
        onOpenVoiceSync={onOpenVoiceSync}
        onPressBeat={jest.fn()}
        onPreviewPlaybackStatus={jest.fn()}
        onRequestPreview={onRequestPreview}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        playbackSentenceIndex={null}
        previewArtifactUrl={null}
        previewDurationSec={null}
        previewHeroActionLabel="Generate Preview"
        previewHeroActionTarget="preview"
        previewHeroHeadline="Generate a synced preview"
        previewHeroHint="Uses synced voice timing"
        previewIsRequesting={false}
        previewPositionSec={0}
        previewReady={false}
        previewStatusLabel="Ready"
        previewStatusTone="info"
        previewSupportingText="Generate a synced preview to play this storyboard."
        railItems={railItems}
        selectedSentenceIndex={null}
        videoRef={{ current: null }}
        theme={theme}
      />,
    );

    expect(getByText("Generate a synced preview")).toBeTruthy();
    fireEvent.press(getByTestId("storyboard-preview-regenerate"));
    expect(onRequestPreview).toHaveBeenCalledTimes(1);
    expect(onOpenVoiceSync).not.toHaveBeenCalled();
  });

  test("renders ready preview without depending on caption raster assets", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <StoryboardSurface
        activeSentenceIndex={0}
        blockedMessage={null}
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
        previewArtifactUrl="https://cdn.example.com/base.mp4"
        previewDurationSec={10}
        previewHeroActionLabel="Generate Preview"
        previewHeroActionTarget="preview"
        previewHeroHeadline="Synced preview ready"
        previewHeroHint={null}
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

    expect(getByTestId("storyboard-preview-video")).toBeTruthy();
    expect(getByText("Synced Preview")).toBeTruthy();
    expect(queryByTestId("preview-helper-banner")).toBeNull();
    expect(queryByTestId("storyboard-preview-caption")).toBeNull();
  });
});
