import React from "react";
import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { render, waitFor, act } from "@testing-library/react-native";

const mockNavigation = {
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  getParent: jest.fn(),
};
const mockTabNavigator = {
  navigate: jest.fn(),
};
const mockShowError = jest.fn();
const mockGetShortDetail = jest.fn();
const mockGetMyShorts = jest.fn();

let mockRouteParams: any = {
  shortId: "short-1",
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
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

jest.mock("@/api/client", () => ({
  getShortDetail: (...args: unknown[]) => mockGetShortDetail(...args),
  getMyShorts: (...args: unknown[]) => mockGetMyShorts(...args),
}));

import ShortDetailScreen from "@/screens/ShortDetailScreen";

describe("client/screens/ShortDetailScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouteParams = { shortId: "short-1" };
    mockNavigation.setParams.mockClear();
    mockNavigation.canGoBack.mockClear();
    mockNavigation.canGoBack.mockReturnValue(true);
    mockNavigation.goBack.mockClear();
    mockNavigation.getParent.mockReset();
    mockNavigation.getParent.mockReturnValue(mockTabNavigator);
    mockTabNavigator.navigate.mockClear();
    mockShowError.mockClear();
    mockGetShortDetail.mockReset();
    mockGetMyShorts.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("enters pending availability mode and retries short detail after a 404", async () => {
    mockGetShortDetail
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        code: "NOT_FOUND",
        message: "Not found",
        requestId: "detail-404-a",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        code: "NOT_FOUND",
        message: "Still not ready",
        requestId: "detail-404-b",
      });
    mockGetMyShorts.mockResolvedValue({
      ok: true,
      data: {
        items: [],
        hasMore: false,
      },
    });

    const screen = render(<ShortDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText("Finalizing your render...")).toBeTruthy();
      expect(mockGetShortDetail).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockGetShortDetail).toHaveBeenCalledTimes(2);
    });
  });

  test("switches to the library short when fallback finds a ready item", async () => {
    mockGetShortDetail.mockResolvedValue({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Not found",
      requestId: "detail-404",
    });
    mockGetMyShorts.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "short-1",
            status: "ready",
            videoUrl: "https://cdn.example.com/short-1.mp4",
            thumbUrl: "https://cdn.example.com/short-1.jpg",
            coverImageUrl: "https://cdn.example.com/short-1-cover.jpg",
            quoteText: "Quote",
            durationSec: 12,
            createdAt: "2026-03-21T12:00:00.000Z",
          },
        ],
        hasMore: false,
      },
    });

    render(<ShortDetailScreen />);

    await waitFor(() => {
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        short: expect.objectContaining({
          id: "short-1",
          status: "ready",
        }),
        shortId: undefined,
      });
    });
  });

  test("treats non-404 detail failures as terminal and surfaces the current error message", async () => {
    mockGetShortDetail.mockResolvedValue({
      ok: false,
      status: 500,
      code: "SERVER_ERROR",
      message: "Backend unavailable",
      requestId: "detail-500",
    });

    render(<ShortDetailScreen />);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith("Backend unavailable");
    });
  });
});
