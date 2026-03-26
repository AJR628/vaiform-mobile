import React from "react";
import { describe, expect, test, beforeEach, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockNavigation = {
  navigate: jest.fn(),
};
const mockShowError = jest.fn();
const mockSetActiveSessionId = jest.fn();
const mockClearActiveSessionId = jest.fn();
const mockStoryStart = jest.fn();
const mockStoryGenerate = jest.fn();
const mockHapticSuccess = jest.fn();

let mockActiveSessionId: string | null = null;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: (...args: unknown[]) => mockHapticSuccess(...args),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      backgroundRoot: "#000",
      text: "#fff",
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
    activeSessionId: mockActiveSessionId,
    isHydrated: true,
    setActiveSessionId: mockSetActiveSessionId,
    clearActiveSessionId: mockClearActiveSessionId,
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
  Card: ({ children, ...props }: any) => {
    const { View } = require("react-native");
    return <View {...props}>{children}</View>;
  },
}));

jest.mock("@/components/KeyboardAwareScrollViewCompat", () => ({
  KeyboardAwareScrollViewCompat: ({ children, ...props }: any) => {
    const { ScrollView } = require("react-native");
    return <ScrollView {...props}>{children}</ScrollView>;
  },
}));

jest.mock("@/api/client", () => ({
  storyStart: (...args: unknown[]) => mockStoryStart(...args),
  storyGenerate: (...args: unknown[]) => mockStoryGenerate(...args),
}));

import HomeScreen from "@/screens/HomeScreen";

describe("client/screens/HomeScreen", () => {
  beforeEach(() => {
    mockActiveSessionId = null;
    mockNavigation.navigate.mockClear();
    mockShowError.mockClear();
    mockSetActiveSessionId.mockClear();
    mockClearActiveSessionId.mockClear();
    mockStoryStart.mockReset();
    mockStoryGenerate.mockReset();
    mockHapticSuccess.mockClear();

    mockStoryStart.mockResolvedValue({
      ok: true,
      data: {
        id: "session-1",
      },
    });
    mockStoryGenerate.mockResolvedValue({
      ok: true,
      data: {
        id: "session-1",
      },
    });
  });

  test("omits styleKey when no lens is selected and keeps generate payload session-only", async () => {
    const screen = render(<HomeScreen />);
    const input = screen.getByPlaceholderText("Paste article URL...");

    fireEvent.changeText(input, "Build habit momentum");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Build habit momentum")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-script-button"));
    });

    await waitFor(() => {
      expect(mockStoryStart).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryStart).toHaveBeenCalledWith({
      input: "Build habit momentum",
      inputType: "link",
    });
    expect(mockStoryStart.mock.calls[0][0]).not.toHaveProperty("styleKey");

    await waitFor(() => {
      expect(mockStoryGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryGenerate).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(mockStoryGenerate.mock.calls[0][0]).not.toHaveProperty("styleKey");
    expect(mockSetActiveSessionId).toHaveBeenCalledWith("session-1");
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Script", {
      sessionId: "session-1",
    });
  });

  test("sends the exact selected styleKey literal on storyStart and still keeps generate payload session-only", async () => {
    const screen = render(<HomeScreen />);
    const input = screen.getByPlaceholderText("Paste article URL...");

    await act(async () => {
      fireEvent.press(screen.getByTestId("style-option-cozy"));
    });

    fireEvent.changeText(input, "Explain why tiny habits stick");

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Explain why tiny habits stick"),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-script-button"));
    });

    await waitFor(() => {
      expect(mockStoryStart).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryStart).toHaveBeenCalledWith({
      input: "Explain why tiny habits stick",
      inputType: "link",
      styleKey: "cozy",
    });

    await waitFor(() => {
      expect(mockStoryGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mockStoryGenerate).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(mockStoryGenerate.mock.calls[0][0]).not.toHaveProperty("styleKey");
  });
});
