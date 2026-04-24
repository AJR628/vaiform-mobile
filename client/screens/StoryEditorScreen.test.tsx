import React from "react";
import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { Alert } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import StoryEditorScreen from "@/screens/StoryEditorScreen";

const mockNavigation = {
  setOptions: jest.fn(),
  getParent: jest.fn(),
  replace: jest.fn(),
  popToTop: jest.fn(),
  goBack: jest.fn(),
};
const mockTabNavigator = {
  navigate: jest.fn(),
  getState: jest.fn(() => ({ routeNames: ["LibraryTab"] })),
};
const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowSuccess = jest.fn();
const mockRefreshUsage = jest.fn(async () => {});
const mockSetActiveSessionId = jest.fn();
const mockStoryGet = jest.fn();
const mockStoryFinalize = jest.fn();
const mockLoadStoredAttempt = jest.fn();
const mockStoreAttempt = jest.fn(async () => {});
const mockClearAttempt = jest.fn(async () => {});
const mockStoryboardSurfaceRender = jest.fn(() => null);
const mockStoryPreviewShellRender = jest.fn(() => null);
const mockStoryDeckRender = jest.fn(() => null);

let mockRouteParams = { sessionId: "session-1" };
let mockUsageSnapshot: any = {
  usage: {
    availableSec: 60,
  },
};

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      backgroundRoot: "#000",
      backgroundDefault: "#111",
      backgroundSecondary: "#222",
      text: "#fff",
      link: "#4A5FFF",
      tabIconDefault: "#999",
      buttonText: "#fff",
    },
  }),
}));

jest.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    showError: mockShowError,
    showWarning: mockShowWarning,
    showSuccess: mockShowSuccess,
  }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    usageSnapshot: mockUsageSnapshot,
    refreshUsage: mockRefreshUsage,
  }),
}));

jest.mock("@/contexts/ActiveStorySessionContext", () => ({
  useActiveStorySession: () => ({
    setActiveSessionId: mockSetActiveSessionId,
  }),
}));

jest.mock("@/hooks/useCaptionPreview", () => ({
  useCaptionPreview: () => ({
    previewByIndex: {},
    isLoadingByIndex: {},
    requestPreview: jest.fn(),
    prefetchAllBeats: jest.fn(),
    cancelPrefetch: jest.fn(),
    resetPreviews: jest.fn(),
  }),
}));

jest.mock("@/api/client", () => ({
  storyGet: (...args: unknown[]) => mockStoryGet(...args),
  storyFinalize: (...args: unknown[]) => mockStoryFinalize(...args),
  storyUpdateBeatText: jest.fn(),
  storyUpdateCaptionStyle: jest.fn(),
  storyDeleteBeat: jest.fn(),
}));

jest.mock("@/components/story-editor/StoryPreviewShell", () => ({
  StoryPreviewShell: (props: unknown) => mockStoryPreviewShellRender(props),
}));

jest.mock("@/components/story-editor/StoryboardSurface", () => {
  return {
    StoryboardSurface: (props: unknown) => mockStoryboardSurfaceRender(props),
  };
});

jest.mock("@/components/story-editor/StoryDeck", () => {
  return {
    StoryDeck: (props: unknown) => mockStoryDeckRender(props),
  };
});

jest.mock("@/lib/storyFinalizeAttemptStorage", () => ({
  loadStoredStoryFinalizeAttempt: (...args: unknown[]) =>
    mockLoadStoredAttempt(...args),
  storeStoryFinalizeAttempt: (...args: unknown[]) => mockStoreAttempt(...args),
  clearStoredStoryFinalizeAttempt: (...args: unknown[]) =>
    mockClearAttempt(...args),
}));

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    status: "voice_synced",
    story: {
      sentences: ["Beat one"],
    },
    shots: [
      {
        sentenceIndex: 0,
        searchQuery: "Beat one",
        candidates: [],
        selectedClip: {
          id: "clip-1",
          thumbUrl: "https://cdn.example.com/clip-1.jpg",
        },
      },
    ],
    overlayCaption: {
      placement: "center",
    },
    voicePreset: "male_calm",
    voicePacePreset: "normal",
    voiceSync: {
      state: "current",
      staleScope: "none",
      staleBeatIndices: [],
      totalDurationSec: 24,
      currentFingerprint: "sync-session-1",
      nextEstimatedChargeSec: 0,
      cached: false,
    },
    billingEstimate: {
      estimatedSec: 12,
    },
    ...overrides,
  };
}

function getHeaderProps() {
  const options = mockNavigation.setOptions.mock.calls.at(-1)?.[0];
  expect(options?.headerTitle).toBeDefined();
  return options.headerTitle().props;
}

describe("client/screens/StoryEditorScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.EXPO_PUBLIC_STEP3_UNIFIED_SURFACE;
    mockRouteParams = { sessionId: "session-1" };
    mockUsageSnapshot = {
      usage: {
        availableSec: 60,
      },
    };
    mockNavigation.setOptions.mockClear();
    mockNavigation.getParent.mockReset();
    mockNavigation.getParent.mockReturnValue(mockTabNavigator);
    mockNavigation.replace.mockClear();
    mockNavigation.popToTop.mockClear();
    mockNavigation.goBack.mockClear();
    mockTabNavigator.navigate.mockClear();
    mockShowError.mockClear();
    mockShowWarning.mockClear();
    mockShowSuccess.mockClear();
    mockRefreshUsage.mockClear();
    mockSetActiveSessionId.mockClear();
    mockStoryGet.mockReset();
    mockStoryFinalize.mockReset();
    mockLoadStoredAttempt.mockReset();
    mockLoadStoredAttempt.mockResolvedValue(null);
    mockStoreAttempt.mockClear();
    mockClearAttempt.mockClear();
    mockStoryboardSurfaceRender.mockClear();
    mockStoryPreviewShellRender.mockClear();
    mockStoryDeckRender.mockClear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_STEP3_UNIFIED_SURFACE;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("uses the legacy deck path when the unified storyboard flag is off", async () => {
    mockStoryGet.mockResolvedValue({
      ok: true,
      data: buildSession(),
    });

    render(<StoryEditorScreen />);

    await waitFor(() => {
      expect(mockStoryDeckRender).toHaveBeenCalled();
    });

    expect(mockStoryboardSurfaceRender).not.toHaveBeenCalled();
    expect(mockStoryPreviewShellRender).toHaveBeenCalled();
    expect(
      mockStoryPreviewShellRender.mock.calls.at(-1)?.[0],
    ).toMatchObject({
      onOpenVoiceSync: expect.any(Function),
      previewStatusLabel: "Rough Preview",
      previewStatusTone: "neutral",
      previewSupportingText:
        "Generate a synced preview to play this storyboard.",
      helperBannerCopy: "Clip selection first, then voice sync locks timing.",
    });
  });

  test("uses the unified surface path without mounting the legacy deck when the flag is on", async () => {
    process.env.EXPO_PUBLIC_STEP3_UNIFIED_SURFACE = "1";
    mockStoryGet.mockResolvedValue({
      ok: true,
      data: buildSession({
        captions: [
          {
            sentenceIndex: 0,
            text: "Beat one",
            startTimeSec: 0,
            endTimeSec: 4,
          },
        ],
        previewReadinessV1: {
          version: 1,
          ready: true,
          reasonCode: null,
          missingBeatIndices: [],
        },
        draftPreviewV1: {
          version: 1,
          state: "ready",
          artifact: {
            url: "https://cdn.example.com/preview.mp4",
            durationSec: 4,
            width: 1080,
            height: 1920,
          },
        },
        playbackTimelineV1: {
          version: 1,
          source: "auto",
          totalDurationSec: 4,
          segments: [
            {
              segmentIndex: 0,
              sentenceIndex: 0,
              ownerSentenceIndex: 0,
              clipUrl: "https://cdn.example.com/clip-1.mp4",
              clipThumbUrl: "https://cdn.example.com/clip-1.jpg",
              globalStartSec: 0,
              globalEndSec: 4,
              clipStartSec: 0,
              durationSec: 4,
            },
          ],
        },
      }),
    });

    render(<StoryEditorScreen />);

    await waitFor(() => {
      expect(mockStoryboardSurfaceRender).toHaveBeenCalled();
    });

    expect(mockStoryDeckRender).not.toHaveBeenCalled();
    expect(mockStoryPreviewShellRender).not.toHaveBeenCalled();
    expect(
      mockStoryboardSurfaceRender.mock.calls.at(-1)?.[0],
    ).toMatchObject({
      onOpenVoiceSync: expect.any(Function),
      previewStatusLabel: "Synced Preview",
      previewStatusTone: "success",
      previewSupportingText: "Timing locked to narration.",
      helperBannerCopy: null,
    });
  });

  test("shows the insufficient render time message before calling finalize", async () => {
    mockUsageSnapshot = {
      usage: {
        availableSec: 5,
      },
    };
    mockStoryGet.mockResolvedValue({
      ok: true,
      data: buildSession(),
    });

    render(<StoryEditorScreen />);

    await waitFor(() => {
      expect(mockNavigation.setOptions).toHaveBeenCalled();
    });

    await act(async () => {
      getHeaderProps().onRenderPress();
    });

    expect(mockShowError).toHaveBeenCalledWith(
      "Not enough render time. Estimated usage is 12s. You have 5s left.",
    );
    expect(mockStoryFinalize).not.toHaveBeenCalled();
  });

  test("persists the active attempt and recovers an accepted 202 finalize to success", async () => {
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession({
          renderRecovery: {
            state: "pending",
            attemptId: "attempt-202",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession({
          renderRecovery: {
            state: "done",
            attemptId: "attempt-202",
            shortId: "short-202",
          },
        }),
      });
    mockStoryFinalize.mockResolvedValue({
      ok: true,
      status: 202,
      data: buildSession({
        renderRecovery: {
          state: "pending",
          attemptId: "attempt-202",
        },
      }),
      requestId: "request-202",
      shortId: null,
      retryAfter: undefined,
      finalize: {
        state: "pending",
        attemptId: "attempt-202",
        pollSessionId: "session-1",
      },
    });

    jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        const renderButton = buttons?.[1] as
          | { onPress?: () => void }
          | undefined;
        renderButton?.onPress?.();
      });

    render(<StoryEditorScreen />);

    await waitFor(() => {
      expect(mockNavigation.setOptions).toHaveBeenCalled();
      expect(mockStoryGet).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      getHeaderProps().onRenderPress();
    });

    await waitFor(() => {
      expect(mockStoreAttempt).toHaveBeenCalledWith({
        uid: "user-1",
        sessionId: "session-1",
        attemptId: "attempt-202",
        startedAt: expect.any(String),
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockClearAttempt).toHaveBeenCalledWith("user-1", "session-1");
      expect(mockRefreshUsage).toHaveBeenCalledTimes(1);
      expect(mockShowSuccess).toHaveBeenCalledWith(
        "Video rendered successfully!",
      );
      expect(mockTabNavigator.navigate).toHaveBeenCalledWith("LibraryTab", {
        screen: "ShortDetail",
        params: { shortId: "short-202" },
      });
    });
  });

  test("adopts the server attempt when finalize reports FINALIZE_ALREADY_ACTIVE", async () => {
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession({
          renderRecovery: {
            state: "done",
            attemptId: "attempt-live",
            shortId: "short-live",
          },
        }),
      });
    mockStoryFinalize.mockResolvedValue({
      ok: false,
      status: 409,
      code: "FINALIZE_ALREADY_ACTIVE",
      message: "Already active",
      requestId: "request-live",
      finalize: {
        state: "pending",
        attemptId: "attempt-live",
        pollSessionId: "session-1",
      },
    });

    jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        const renderButton = buttons?.[1] as
          | { onPress?: () => void }
          | undefined;
        renderButton?.onPress?.();
      });

    render(<StoryEditorScreen />);

    await waitFor(() => {
      expect(mockNavigation.setOptions).toHaveBeenCalled();
      expect(mockStoryGet).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      getHeaderProps().onRenderPress();
    });

    await waitFor(() => {
      expect(mockStoreAttempt).toHaveBeenCalledWith({
        uid: "user-1",
        sessionId: "session-1",
        attemptId: "attempt-live",
        startedAt: expect.any(String),
      });
      expect(mockClearAttempt).toHaveBeenCalledWith("user-1", "session-1");
      expect(mockTabNavigator.navigate).toHaveBeenCalledWith("LibraryTab", {
        screen: "ShortDetail",
        params: { shortId: "short-live" },
      });
    });
  });
});
