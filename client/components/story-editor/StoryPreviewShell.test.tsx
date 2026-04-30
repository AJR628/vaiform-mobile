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

describe("client/components/story-editor/StoryPreviewShell", () => {
  test("renders fallback header chrome and the backend blocked message when preview is not ready", () => {
    const onOpenVoiceSync = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <StoryPreviewShell
        blockedMessage="Sync voice and timing to unlock the synced preview."
        currentPreviewBeatLabel={null}
        currentSegmentClipUrl={null}
        currentSegmentPosterUrl={null}
        helperBannerCopy="Clip selection first, then voice sync locks timing."
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        maxVideoHeight={220}
        onOpenVoiceSync={onOpenVoiceSync}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        previewDurationSec={null}
        previewHeroActionDisabled={false}
        previewHeroActionLabel="Voice & Timing"
        previewHeroActionTarget="voice"
        previewHeroHeadline="Re-sync to update preview"
        previewHeroHint={null}
        previewPositionSec={0}
        previewReady={false}
        previewStatusLabel="Voice changed"
        previewStatusTone="warning"
        previewSupportingText="Sync voice and timing to unlock the synced preview."
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    expect(getByTestId("preview-status-chip")).toBeTruthy();
    expect(queryByTestId("preview-helper-banner")).toBeNull();
    expect(getByText("Re-sync to update preview")).toBeTruthy();
    fireEvent.press(getByTestId("preview-voice-timing-cta"));
    expect(onOpenVoiceSync).toHaveBeenCalledTimes(1);

    fireEvent(getByTestId("story-preview-media-stage"), "layout", {
      nativeEvent: { layout: { width: 320, height: 0 } },
    });

    const frameStyle = StyleSheet.flatten(
      getByTestId("story-preview-media-frame").props.style,
    );
    expect(frameStyle.height).toBe(220);
    expect(frameStyle.width).toBeCloseTo(123.75, 2);
  });

  test("renders the preview surface and timing UI without local caption text when preview is ready", () => {
    const { getByText, getByTestId, queryByTestId, queryByText } = render(
      <StoryPreviewShell
        blockedMessage={null}
        currentPreviewBeatLabel="Beat 1"
        currentSegmentClipUrl="https://cdn.example.com/clip-a.mp4"
        currentSegmentPosterUrl="https://cdn.example.com/clip-a.jpg"
        helperBannerCopy={null}
        isPreviewAvailable={true}
        isPreviewPlaying={false}
        maxVideoHeight={240}
        onOpenVoiceSync={jest.fn()}
        onStopPreview={jest.fn()}
        onTogglePreview={jest.fn()}
        onVideoLoad={jest.fn()}
        previewDurationSec={12}
        previewHeroActionDisabled={false}
        previewHeroActionLabel="Generate Preview"
        previewHeroActionTarget="preview"
        previewHeroHeadline="Synced preview ready"
        previewHeroHint={null}
        previewPositionSec={4}
        previewReady={true}
        previewStatusLabel="Synced Preview"
        previewStatusTone="success"
        previewSupportingText="Timing locked to narration."
        theme={theme}
        videoRef={{ current: null }}
      />,
    );

    fireEvent(getByTestId("story-preview-media-stage"), "layout", {
      nativeEvent: { layout: { width: 200, height: 0 } },
    });

    expect(getByText("Beat 1")).toBeTruthy();
    expect(getByText("Synced Preview")).toBeTruthy();
    expect(queryByTestId("preview-helper-banner")).toBeNull();
    expect(getByText("0:04 / 0:12")).toBeTruthy();
    expect(getByTestId("story-preview-shell-video")).toBeTruthy();
    expect(queryByTestId("story-preview-shell-caption")).toBeNull();
    expect(queryByText("Beat one")).toBeNull();
  });
});
