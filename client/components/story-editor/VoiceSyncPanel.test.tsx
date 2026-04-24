import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, jest, test } from "@jest/globals";

import { VoiceSyncPanel } from "@/components/story-editor/VoiceSyncPanel";
import type { StoryVoiceSync } from "@/types/story";

jest.mock("@/components/Button", () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => {
    const React = require("react");
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable onPress={disabled ? undefined : onPress}>
        <Text>{children}</Text>
      </Pressable>
    );
  },
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

const voiceOptions = [
  {
    key: "male_calm",
    name: "Calm",
    gender: "Male",
    emotion: "Neutral",
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof VoiceSyncPanel>> = {}) {
  const onClose = jest.fn();
  const onSync = jest.fn();
  const onTogglePreview = jest.fn();

  const utils = render(
    <VoiceSyncPanel
      currentCaptionText={null}
      currentPreviewBeatLabel={null}
      draftVoicePreset="male_calm"
      hasLocalVoiceDraft={false}
      isPreviewAvailable={false}
      isPreviewPlaying={false}
      isSyncing={false}
      onClose={onClose}
      onSelectVoice={jest.fn()}
      onSync={onSync}
      onTogglePreview={onTogglePreview}
      previewDurationSec={null}
      previewPositionSec={0}
      renderEstimateSec={12}
      syncEstimateSec={8}
      theme={theme}
      voiceOptions={voiceOptions}
      voiceSync={null}
      {...overrides}
    />,
  );

  return { ...utils, onClose, onSync, onTogglePreview };
}

describe("client/components/story-editor/VoiceSyncPanel", () => {
  test("renders unsynced preview-context copy and preserves controls", () => {
    const { getByText, onClose, onSync } = renderPanel();

    expect(getByText("Voice & Timing")).toBeTruthy();
    expect(
      getByText("Choose a voice and sync timing to unlock the final preview."),
    ).toBeTruthy();
    expect(getByText("Preview controls")).toBeTruthy();
    expect(getByText("Sync Voice & Timing")).toBeTruthy();
    expect(
      getByText("Sync voice and timing to unlock preview playback."),
    ).toBeTruthy();

    fireEvent.press(getByText("Close"));
    fireEvent.press(getByText("Sync Voice & Timing"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  test("renders current synced copy", () => {
    const currentVoiceSync: StoryVoiceSync = {
      state: "current",
      totalDurationSec: 24,
    };

    const { getByText, onTogglePreview } = renderPanel({
      isPreviewAvailable: true,
      previewDurationSec: 24,
      voiceSync: currentVoiceSync,
    });

    expect(getByText("Preview timing is locked to this voice.")).toBeTruthy();
    fireEvent.press(getByText("Play"));
    expect(onTogglePreview).toHaveBeenCalledTimes(1);
  });

  test("renders stale copy and local draft copy", () => {
    const staleVoiceSync: StoryVoiceSync = {
      state: "stale",
      staleScope: "full",
    };

    const { getByText, rerender } = renderPanel({
      voiceSync: staleVoiceSync,
    });

    expect(
      getByText("Voice or script changed. Re-sync to update preview timing."),
    ).toBeTruthy();

    rerender(
      <VoiceSyncPanel
        currentCaptionText={null}
        currentPreviewBeatLabel={null}
        draftVoicePreset="male_calm"
        hasLocalVoiceDraft={true}
        isPreviewAvailable={false}
        isPreviewPlaying={false}
        isSyncing={false}
        onClose={jest.fn()}
        onSelectVoice={jest.fn()}
        onSync={jest.fn()}
        onTogglePreview={jest.fn()}
        previewDurationSec={null}
        previewPositionSec={0}
        renderEstimateSec={12}
        syncEstimateSec={8}
        theme={theme}
        voiceOptions={voiceOptions}
        voiceSync={staleVoiceSync}
      />,
    );

    expect(
      getByText("Voice changed. Sync to update preview timing."),
    ).toBeTruthy();
  });
});
