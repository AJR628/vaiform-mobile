import { act, renderHook } from "@testing-library/react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { useStoryVoiceSync } from "@/screens/story-editor/useStoryVoiceSync";
import type { StorySession } from "@/types/story";

const mockStorySync = jest.fn();
const mockStoryGet = jest.fn();
const mockSetAudioModeAsync = jest.fn(async () => {});

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16)),
}));

jest.mock("@/api/client", () => ({
  storySync: (...args: unknown[]) => mockStorySync(...args),
  storyGet: (...args: unknown[]) => mockStoryGet(...args),
}));

function buildSession(overrides: Partial<StorySession> = {}): StorySession {
  return {
    id: "session-1",
    story: { sentences: ["Beat one"] },
    voicePreset: "male_calm",
    voicePacePreset: "normal",
    voiceOptions: [{ key: "male_calm", name: "Male Calm" }],
    voiceSync: {
      state: "stale",
      staleScope: "full",
      staleBeatIndices: [],
      previewAudioUrl: null,
      nextEstimatedChargeSec: 3,
      totalDurationSec: null,
      lastChargeSec: null,
      cached: false,
    },
    billingEstimate: { estimatedSec: 9 },
    ...overrides,
  };
}

describe("client/screens/story-editor/useStoryVoiceSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockStorySync.mockReset();
    mockStoryGet.mockReset();
    mockSetAudioModeAsync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("polls canonical storyGet when sync returns pending metadata", async () => {
    const setSession = jest.fn();
    const showError = jest.fn();
    const showSuccess = jest.fn();
    const showWarning = jest.fn();
    const refreshUsage = jest.fn(async () => {});

    mockStorySync.mockResolvedValue({
      ok: true,
      status: 202,
      data: buildSession(),
      sync: {
        state: "pending",
        attemptId: "attempt-sync",
        pollSessionId: "session-poll",
      },
    });
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession({
          voiceSync: {
            state: "current",
            staleScope: "none",
            staleBeatIndices: [],
            previewAudioUrl: "https://cdn.example.com/preview.mp3",
            nextEstimatedChargeSec: 0,
            totalDurationSec: 12,
            lastChargeSec: 6,
            cached: false,
          },
        }),
      });

    const { result } = renderHook(() =>
      useStoryVoiceSync({
        refreshUsage,
        session: buildSession(),
        sessionId: "session-1",
        setSession,
        showError,
        showSuccess,
        showWarning,
      }),
    );

    await act(async () => {
      const promise = result.current.handleSyncVoice();
      await Promise.resolve();
      await jest.runAllTimersAsync();
      await promise;
    });

    expect(mockStorySync).toHaveBeenCalledTimes(1);
    expect(mockStoryGet).toHaveBeenCalledWith("session-poll");
    expect(setSession).toHaveBeenCalledTimes(3);
    expect(refreshUsage).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith(
      "Voice synced. Used 6s of balance.",
    );
    expect(showError).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
  });
});
