import React from "react";
import { describe, expect, test, beforeEach, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockNavigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
};
const mockSetActiveSessionId = jest.fn();
const mockShowError = jest.fn();
const mockStoryGet = jest.fn();
const mockStoryPlan = jest.fn();
const mockStorySearchAll = jest.fn();
const mockStoryUpdateBeatText = jest.fn();
const mockStoryDeleteBeat = jest.fn();

let mockRouteParams = { sessionId: "session-1" };

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useNavigation: () => mockNavigation,
}));

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
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
      backgroundTertiary: "#333",
      textPrimary: "#fff",
      textSecondary: "#aaa",
      buttonText: "#fff",
      primary: "#4A5FFF",
      link: "#4A5FFF",
    },
  }),
}));

jest.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    showError: mockShowError,
  }),
}));

jest.mock("@/contexts/ActiveStorySessionContext", () => ({
  useActiveStorySession: () => ({
    setActiveSessionId: mockSetActiveSessionId,
  }),
}));

jest.mock("@/components/ThemedText", () => ({
  ThemedText: ({ children, ...props }: any) => {
    const { Text } = require("react-native");
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock("@/components/ThemedView", () => ({
  ThemedView: ({ children, ...props }: any) => {
    const { View } = require("react-native");
    return <View {...props}>{children}</View>;
  },
}));

jest.mock("@/components/Card", () => ({
  Card: ({ children, onPress }: any) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable testID="beat-card" onPress={onPress}>
        {children}
      </Pressable>
    );
  },
}));

jest.mock("@/components/Button", () => ({
  Button: ({ children, onPress }: any) => {
    const { Pressable } = require("react-native");
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock("@/api/client", () => ({
  storyGet: (...args: unknown[]) => mockStoryGet(...args),
  storyPlan: (...args: unknown[]) => mockStoryPlan(...args),
  storySearchAll: (...args: unknown[]) => mockStorySearchAll(...args),
  storyUpdateBeatText: (...args: unknown[]) => mockStoryUpdateBeatText(...args),
  storyDeleteBeat: (...args: unknown[]) => mockStoryDeleteBeat(...args),
}));

import ScriptScreen from "@/screens/ScriptScreen";

function buildSession(sentence: string) {
  return {
    id: "session-1",
    status: "story_generated",
    story: {
      sentences: [sentence],
    },
    shots: [],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("client/screens/ScriptScreen", () => {
  beforeEach(() => {
    mockRouteParams = { sessionId: "session-1" };
    mockNavigation.replace.mockClear();
    mockNavigation.navigate.mockClear();
    mockSetActiveSessionId.mockClear();
    mockShowError.mockClear();
    mockStoryGet.mockReset();
    mockStoryPlan.mockReset();
    mockStorySearchAll.mockReset();
    mockStoryUpdateBeatText.mockReset();
    mockStoryDeleteBeat.mockReset();
  });

  test("saves once, refetches once, and keeps edited text visible while refetch is pending", async () => {
    const refetch = createDeferred<{ ok: boolean; data: ReturnType<typeof buildSession> }>();
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession("Original sentence text"),
      })
      .mockReturnValueOnce(refetch.promise);
    mockStoryUpdateBeatText.mockResolvedValue({
      ok: true,
      data: {
        sentences: ["Updated sentence text"],
        shots: [],
      },
    });

    const screen = render(<ScriptScreen />);

    await waitFor(() => {
      expect(screen.getByText("Original sentence text")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("beat-card"));
    });

    const input = await screen.findByDisplayValue("Original sentence text");

    await act(async () => {
      fireEvent.changeText(input, "Updated sentence text\n");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockStoryUpdateBeatText).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryUpdateBeatText).toHaveBeenCalledWith({
      sessionId: "session-1",
      sentenceIndex: 0,
      text: "Updated sentence text",
    });
    expect(mockStoryGet).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Updated sentence text")).toBeTruthy();
    expect(screen.queryByText("Original sentence text")).toBeNull();

    await act(async () => {
      refetch.resolve({
        ok: true,
        data: buildSession("Updated sentence text"),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Updated sentence text")).toBeTruthy();
    });

    expect(mockStoryGet).toHaveBeenCalledTimes(2);
    expect(mockShowError).not.toHaveBeenCalled();
  });
});
