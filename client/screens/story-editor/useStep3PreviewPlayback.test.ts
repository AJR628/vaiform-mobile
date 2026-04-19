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
const mockVideoASetStatusAsync = jest.fn(async () => {});
const mockVideoBSetStatusAsync = jest.fn(async () => {});

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
    mockVideoASetStatusAsync.mockClear();
    mockVideoBSetStatusAsync.mockClear();
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

  test("warms standby slot near a segment boundary without replacing active immediately", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();
    const session = buildSession();
    let playbackStatus: ((status: Record<string, unknown>) => void) | undefined;
    const sound = {
      unloadAsync: mockUnloadAsync,
      pauseAsync: mockPauseAsync,
      playAsync: mockPlayAsync,
      getStatusAsync: mockGetStatusAsync,
    };
    mockCreateAsync.mockImplementation(
      async (
        _source: unknown,
        _status: unknown,
        onPlaybackStatusUpdate?: (status: Record<string, unknown>) => void,
      ) => {
        playbackStatus = onPlaybackStatusUpdate;
        return { sound };
      },
    );

    const { result } = renderHook(() =>
      useStep3PreviewPlayback({
        session,
        showError,
        showWarning,
        useUnifiedPreviewSlots: true,
      }),
    );

    result.current.previewVideoSlots[0].ref.current = {
      setStatusAsync: mockVideoASetStatusAsync,
    } as never;
    result.current.previewVideoSlots[1].ref.current = {
      setStatusAsync: mockVideoBSetStatusAsync,
    } as never;

    await act(async () => {
      result.current.handlePreviewSlotReady(
        "a",
        result.current.previewVideoSlots[0].requestToken,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    await act(async () => {
      playbackStatus?.({
        durationMillis: 6000,
        isLoaded: true,
        isPlaying: true,
        positionMillis: 2800,
      });
      await Promise.resolve();
    });

    const standby = result.current.previewVideoSlots.find(
      (slot) => slot.key === "b",
    );

    expect(result.current.previewVideoSlots[0].isActive).toBe(true);
    expect(standby?.clipUrl).toBe("https://cdn.example.com/clip-b.mp4");
    expect(standby?.isActive).toBe(false);
  });

  test("keeps active slot visible until standby readiness matches the current token", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();
    const session = buildSession();
    let playbackStatus: ((status: Record<string, unknown>) => void) | undefined;
    const sound = {
      unloadAsync: mockUnloadAsync,
      pauseAsync: mockPauseAsync,
      playAsync: mockPlayAsync,
      getStatusAsync: mockGetStatusAsync,
    };
    mockCreateAsync.mockImplementation(
      async (
        _source: unknown,
        _status: unknown,
        onPlaybackStatusUpdate?: (status: Record<string, unknown>) => void,
      ) => {
        playbackStatus = onPlaybackStatusUpdate;
        return { sound };
      },
    );

    const { result } = renderHook(() =>
      useStep3PreviewPlayback({
        session,
        showError,
        showWarning,
        useUnifiedPreviewSlots: true,
      }),
    );

    result.current.previewVideoSlots[0].ref.current = {
      setStatusAsync: mockVideoASetStatusAsync,
    } as never;
    result.current.previewVideoSlots[1].ref.current = {
      setStatusAsync: mockVideoBSetStatusAsync,
    } as never;

    await act(async () => {
      result.current.handlePreviewSlotReady(
        "a",
        result.current.previewVideoSlots[0].requestToken,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    await act(async () => {
      playbackStatus?.({
        durationMillis: 6000,
        isLoaded: true,
        isPlaying: true,
        positionMillis: 3100,
      });
      await Promise.resolve();
    });

    const pendingStandby = result.current.previewVideoSlots.find(
      (slot) => slot.key === "b",
    );
    const staleToken = Math.max(0, (pendingStandby?.requestToken ?? 1) - 1);

    await act(async () => {
      result.current.handlePreviewSlotReady("b", staleToken);
      await Promise.resolve();
    });

    expect(result.current.previewVideoSlots[0].isActive).toBe(true);
    expect(result.current.previewVideoSlots[1].isActive).toBe(false);

    await act(async () => {
      result.current.handlePreviewSlotReady(
        "b",
        result.current.previewVideoSlots[1].requestToken,
      );
      await Promise.resolve();
    });

    expect(result.current.previewVideoSlots[0].isActive).toBe(false);
    expect(result.current.previewVideoSlots[1].isActive).toBe(true);
  });

  test("does not repeatedly hard-seek the active slot for same-segment ticks within tolerance", async () => {
    const showWarning = jest.fn();
    const showError = jest.fn();
    const session = buildSession();
    let playbackStatus: ((status: Record<string, unknown>) => void) | undefined;
    const sound = {
      unloadAsync: mockUnloadAsync,
      pauseAsync: mockPauseAsync,
      playAsync: mockPlayAsync,
      getStatusAsync: mockGetStatusAsync,
    };
    mockCreateAsync.mockImplementation(
      async (
        _source: unknown,
        _status: unknown,
        onPlaybackStatusUpdate?: (status: Record<string, unknown>) => void,
      ) => {
        playbackStatus = onPlaybackStatusUpdate;
        return { sound };
      },
    );

    const { result } = renderHook(() =>
      useStep3PreviewPlayback({
        session,
        showError,
        showWarning,
        useUnifiedPreviewSlots: true,
      }),
    );

    result.current.previewVideoSlots[0].ref.current = {
      setStatusAsync: mockVideoASetStatusAsync,
    } as never;

    await act(async () => {
      result.current.handlePreviewSlotReady(
        "a",
        result.current.previewVideoSlots[0].requestToken,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.togglePreviewPlayback();
    });

    mockVideoASetStatusAsync.mockClear();

    await act(async () => {
      playbackStatus?.({
        durationMillis: 6000,
        isLoaded: true,
        isPlaying: true,
        positionMillis: 1000,
      });
      await Promise.resolve();
    });
    const callsAfterFirstTick = mockVideoASetStatusAsync.mock.calls.length;

    await act(async () => {
      playbackStatus?.({
        durationMillis: 6000,
        isLoaded: true,
        isPlaying: true,
        positionMillis: 1120,
      });
      await Promise.resolve();
    });

    expect(mockVideoASetStatusAsync.mock.calls.length).toBe(
      callsAfterFirstTick,
    );
  });
});
