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
const mockStoryUpdateScript = jest.fn();

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
  Button: ({ children, disabled, onPress }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable disabled={disabled} onPress={onPress}>
        {typeof children === "string" ? <Text>{children}</Text> : children}
      </Pressable>
    );
  },
}));

jest.mock("@/api/client", () => ({
  storyGet: (...args: unknown[]) => mockStoryGet(...args),
  storyPlan: (...args: unknown[]) => mockStoryPlan(...args),
  storySearchAll: (...args: unknown[]) => mockStorySearchAll(...args),
  storyUpdateBeatText: (...args: unknown[]) => mockStoryUpdateBeatText(...args),
  storyDeleteBeat: (...args: unknown[]) => mockStoryDeleteBeat(...args),
  storyUpdateScript: (...args: unknown[]) => mockStoryUpdateScript(...args),
}));

import ScriptScreen from "@/screens/ScriptScreen";

function buildSession(sentences: string[] | string, shots: unknown[] = []) {
  return {
    id: "session-1",
    status: "story_generated",
    story: {
      sentences: Array.isArray(sentences) ? sentences : [sentences],
    },
    shots,
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
    mockStoryUpdateScript.mockReset();
  });

  test("pre-storyboard edit uses update-script, refetches once, and keeps edited text visible", async () => {
    const refetch = createDeferred<{
      ok: boolean;
      data: ReturnType<typeof buildSession>;
    }>();
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession("Original sentence text"),
      })
      .mockReturnValueOnce(refetch.promise);
    mockStoryUpdateScript.mockResolvedValue({
      ok: true,
      data: buildSession("Updated sentence text"),
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
      expect(mockStoryUpdateScript).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryUpdateScript).toHaveBeenCalledWith({
      sessionId: "session-1",
      sentences: ["Updated sentence text"],
    });
    expect(mockStoryUpdateBeatText).not.toHaveBeenCalled();
    expect(mockStoryDeleteBeat).not.toHaveBeenCalled();
    expect(mockStoryPlan).not.toHaveBeenCalled();
    expect(mockStorySearchAll).not.toHaveBeenCalled();
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

  test("post-storyboard edit preserves the storyboard-aware update-beat-text endpoint", async () => {
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession("Original sentence text", [{ sentenceIndex: 0 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession("Updated sentence text", [{ sentenceIndex: 0 }]),
      });
    mockStoryUpdateBeatText.mockResolvedValue({
      ok: true,
      data: {
        sentences: ["Updated sentence text"],
        shots: [{ sentenceIndex: 0 }],
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
    expect(mockStoryUpdateScript).not.toHaveBeenCalled();
  });

  test("pre-storyboard add beat appends through update-script only", async () => {
    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(["Beat one", "Beat two"]),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(["Beat one", "Beat two", "Beat three"]),
      });
    mockStoryUpdateScript.mockResolvedValue({
      ok: true,
      data: buildSession(["Beat one", "Beat two", "Beat three"]),
    });

    const screen = render(<ScriptScreen />);

    await waitFor(() => {
      expect(screen.getByText("Beat one")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("+ Add beat"));
    });

    const input = await screen.findByPlaceholderText("Write the next beat");
    await act(async () => {
      fireEvent.changeText(input, "Beat three");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockStoryUpdateScript).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryUpdateScript).toHaveBeenCalledWith({
      sessionId: "session-1",
      sentences: ["Beat one", "Beat two", "Beat three"],
    });
    expect(mockStoryUpdateBeatText).not.toHaveBeenCalled();
    expect(mockStoryDeleteBeat).not.toHaveBeenCalled();
    expect(mockStoryPlan).not.toHaveBeenCalled();
    expect(mockStorySearchAll).not.toHaveBeenCalled();
  });

  test("pre-storyboard delete uses update-script instead of delete-beat", async () => {
    const { Alert } = require("react-native");
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(
        (
          _title: string,
          _message?: string,
          buttons?: Array<{ text: string; onPress?: () => void }>,
        ) => {
          buttons?.find((button) => button.text === "Delete")?.onPress?.();
        },
      );

    mockStoryGet
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(["Beat one", "Beat two"]),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildSession(["Beat two"]),
      });
    mockStoryUpdateScript.mockResolvedValue({
      ok: true,
      data: buildSession(["Beat two"]),
    });

    const screen = render(<ScriptScreen />);

    await waitFor(() => {
      expect(screen.getByText("Beat one")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete beat 1"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockStoryUpdateScript).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryUpdateScript).toHaveBeenCalledWith({
      sessionId: "session-1",
      sentences: ["Beat two"],
    });
    expect(mockStoryDeleteBeat).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test("Generate Storyboard still calls plan then search", async () => {
    mockStoryGet.mockResolvedValue({
      ok: true,
      data: buildSession("Beat one"),
    });
    mockStoryPlan.mockResolvedValue({
      ok: true,
      data: buildSession("Beat one"),
    });
    mockStorySearchAll.mockResolvedValue({
      ok: true,
      data: buildSession("Beat one"),
    });

    const screen = render(<ScriptScreen />);

    await waitFor(() => {
      expect(screen.getByText("Generate Storyboard")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Generate Storyboard"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockNavigation.replace).toHaveBeenCalledWith("StoryEditor", {
        sessionId: "session-1",
      });
    });

    expect(mockStoryPlan).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(mockStorySearchAll).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(mockStoryPlan.mock.invocationCallOrder[0]).toBeLessThan(
      mockStorySearchAll.mock.invocationCallOrder[0],
    );
    expect(mockStoryUpdateScript).not.toHaveBeenCalled();
  });
});
