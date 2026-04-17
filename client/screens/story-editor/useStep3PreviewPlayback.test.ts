import { act, renderHook } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import { useStep3PreviewPlayback } from "@/screens/story-editor/useStep3PreviewPlayback";
import type { StorySession } from "@/types/story";

const mockSetAudioModeAsync = jest.fn(async () => {});
const mockCreateAsync = jest.fn();
const mockUnloadAsync = jest.fn(async () => {});
const mockPauseAsync = jest.fn(async () => {});
const mockPlayAsync = jest.fn(async () => {});
const mockGetStatusAsync = jest.fn();

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
  },
  Video: "Video",
  ResizeMode: { COVER: "cover" },
}));

function buildSession(overrides: Partial<StorySession> = {}): StorySession {
  return {
    id: "session-1",
    story: {
      sentences: ["Beat one", "Beat two"],
    },
    shots: [
      {
        sentenceIndex: 0,
        selectedClip: {
          url: "https://cdn.example.com/clip-a.mp4",
          thumbUrl: "https://cdn.example.com/clip-a.jpg",
        },
      },
      {
        sentenceIndex: 1,
        selectedClip: {
          url: "https://cdn.example.com/clip-b.mp4",
          thumbUrl: "https://cdn.example.com/clip-b.jpg",
        },
      },
    ],
    captions: [
      {
        sentenceIndex: 0,
        text: "Beat one",
        startTimeSec: 0,
        endTimeSec: 3,
      },
      {
        sentenceIndex: 1,
        text: "Beat two",
        startTimeSec: 3,
        endTimeSec: 6,
      },
    ],
    previewReadinessV1: {
      version: 1,
      ready: true,
      reasonCode: null,
      missingBeatIndices: [],
    },
    playbackTimelineV1: {
      version: 1,
      source: "auto",
      totalDurationSec: 6,
      segments: [
        {
          segmentIndex: 0,
          sentenceIndex: 0,
          ownerSentenceIndex: 0,
          clipUrl: "https://cdn.example.com/clip-a.mp4",
          clipThumbUrl: "https://cdn.example.com/clip-a.jpg",
          globalStartSec: 0,
          globalEndSec: 3,
          clipStartSec: 0,
          durationSec: 3,
        },
        {
          segmentIndex: 1,
          sentenceIndex: 1,
          ownerSentenceIndex: 1,
          clipUrl: "https://cdn.example.com/clip-b.mp4",
          clipThumbUrl: "https://cdn.example.com/clip-b.jpg",
          globalStartSec: 3,
          globalEndSec: 6,
          clipStartSec: 0,
          durationSec: 3,
        },
      ],
    },
    voiceSync: {
      state: "current",
      staleScope: "none",
      staleBeatIndices: [],
      previewAudioUrl: "https://cdn.example.com/preview.mp3",
      previewAudioDurationSec: 6,
      totalDurationSec: 6,
      cached: false,
      nextEstimatedChargeSec: 0,
    },
    ...overrides,
  };
}

describe("client/screens/story-editor/useStep3PreviewPlayback", () => {
  beforeEach(() => {
    mockSetAudioModeAsync.mockClear();
    mockCreateAsync.mockReset();
    mockUnloadAsync.mockClear();
    mockPauseAsync.mockClear();
    mockPlayAsync.mockClear();
    mockGetStatusAsync.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("does not start playback when backend preview readiness is blocked", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();

    const { result } = renderHook(() =>
      useStep3PreviewPlayback({
        session: buildSession({
          previewReadinessV1: {
            version: 1,
            ready: false,
            reasonCode: "VOICE_SYNC_NOT_CURRENT",
            missingBeatIndices: [],
          },
          playbackTimelineV1: null,
        }),
        showError,
        showWarning,
      }),
    );

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    expect(mockCreateAsync).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Synced preview is unavailable until voice, captions, and clip coverage are ready.",
    );
    expect(result.current.isPreviewAvailable).toBe(false);
  });

  test("starts playback only when backend preview readiness is ready", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();
    const sound = {
      unloadAsync: mockUnloadAsync,
      pauseAsync: mockPauseAsync,
      playAsync: mockPlayAsync,
      getStatusAsync: mockGetStatusAsync,
    };
    mockCreateAsync.mockResolvedValue({ sound });

    const { result } = renderHook(() =>
      useStep3PreviewPlayback({
        session: buildSession(),
        showError,
        showWarning,
      }),
    );

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.isPreviewAvailable).toBe(true);
    expect(result.current.currentPlaybackSegment?.segmentIndex).toBe(0);
    expect(result.current.currentPreviewCaption?.sentenceIndex).toBe(0);
  });

  test("cleans up audio when the preview hook unloads", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();
    const sound = {
      unloadAsync: mockUnloadAsync,
      pauseAsync: mockPauseAsync,
      playAsync: mockPlayAsync,
      getStatusAsync: mockGetStatusAsync,
    };
    mockCreateAsync.mockResolvedValue({ sound });

    const { result, unmount } = renderHook(
      ({ session }) =>
        useStep3PreviewPlayback({
          session,
          showError,
          showWarning,
        }),
      {
        initialProps: { session: buildSession() },
      },
    );

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    await act(async () => {
      unmount();
    });

    expect(mockUnloadAsync).toHaveBeenCalled();
  });
});
