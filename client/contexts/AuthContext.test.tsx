import React from "react";
import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { Pressable, Text, View } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

let authStateCallback: ((user: any) => void | Promise<void>) | null = null;
let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

const mockOnAuthStateChanged = jest.fn(
  (_auth: unknown, callback: typeof authStateCallback) => {
    authStateCallback = callback;
    return jest.fn();
  },
);
const mockFirebaseSignOut = jest.fn(async () => {});
const mockEnsureUser = jest.fn();
const mockGetUsage = jest.fn();
const mockClearTokenCache = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  GoogleAuthProvider: class MockGoogleAuthProvider {
    static credential(token: string) {
      return { token };
    }
  },
  signInWithCredential: jest.fn(),
  signInWithPopup: jest.fn(),
}));

jest.mock("@/api/client", () => ({
  clearTokenCache: (...args: unknown[]) => mockClearTokenCache(...args),
  ensureUser: (...args: unknown[]) => mockEnsureUser(...args),
  getUsage: (...args: unknown[]) => mockGetUsage(...args),
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function AuthSnapshot() {
  const { user, userProfile, usageSnapshot, isLoading, error, refreshUsage } =
    useAuth();

  return (
    <View>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="user">{user?.uid ?? "none"}</Text>
      <Text testID="profile">{userProfile?.uid ?? "none"}</Text>
      <Text testID="availableSec">
        {String(usageSnapshot?.usage?.availableSec ?? "none")}
      </Text>
      <Text testID="error">{error ?? "none"}</Text>
      <Pressable
        testID="refreshUsage"
        onPress={() => void refreshUsage().catch(() => {})}
      >
        <Text>refresh</Text>
      </Pressable>
    </View>
  );
}

async function emitAuthState(user: any) {
  await act(async () => {
    await authStateCallback?.(user);
  });
}

describe("client/contexts/AuthContext", () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    authStateCallback = null;
    mockOnAuthStateChanged.mockClear();
    mockFirebaseSignOut.mockClear();
    mockEnsureUser.mockReset();
    mockGetUsage.mockReset();
    mockClearTokenCache.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("waits for ensureUser and getUsage before exposing the signed-in app state", async () => {
    mockEnsureUser.mockResolvedValue({
      ok: true,
      data: {
        uid: "user-1",
      },
      requestId: "ensure-request",
    });
    mockGetUsage.mockResolvedValue({
      ok: true,
      data: {
        usage: {
          availableSec: 120,
        },
      },
      requestId: "usage-request",
    });

    const screen = render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>,
    );

    await emitAuthState({ uid: "user-1" });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("user-1");
      expect(screen.getByTestId("profile")).toHaveTextContent("user-1");
      expect(screen.getByTestId("availableSec")).toHaveTextContent("120");
      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });
  });

  test("signs back out when ensureUser fails during bootstrap", async () => {
    mockEnsureUser.mockResolvedValue({
      ok: false,
      status: 503,
      code: "SERVER_BUSY",
      message: "Retry later",
      requestId: "ensure-request",
    });

    const screen = render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>,
    );

    await emitAuthState({ uid: "user-2" });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("none");
      expect(screen.getByTestId("availableSec")).toHaveTextContent("none");
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Couldn't finish account setup. Please sign in again.",
      );
    });
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
    expect(mockGetUsage).not.toHaveBeenCalled();
  });

  test("signs back out when the canonical usage fetch fails during bootstrap", async () => {
    mockEnsureUser.mockResolvedValue({
      ok: true,
      data: {
        uid: "user-3",
      },
      requestId: "ensure-request",
    });
    mockGetUsage.mockResolvedValue({
      ok: false,
      status: 500,
      code: "USAGE_FETCH_FAILED",
      message: "Usage unavailable",
      requestId: "usage-request",
    });

    const screen = render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>,
    );

    await emitAuthState({ uid: "user-3" });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("none");
      expect(screen.getByTestId("profile")).toHaveTextContent("none");
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Couldn't finish account setup. Please sign in again.",
      );
    });
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  test("refreshUsage updates the usage snapshot after bootstrap succeeds", async () => {
    mockEnsureUser.mockResolvedValue({
      ok: true,
      data: {
        uid: "user-4",
      },
      requestId: "ensure-request",
    });
    mockGetUsage
      .mockResolvedValueOnce({
        ok: true,
        data: {
          usage: {
            availableSec: 60,
          },
        },
        requestId: "usage-request-1",
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          usage: {
            availableSec: 42,
          },
        },
        requestId: "usage-request-2",
      });

    const screen = render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>,
    );

    await emitAuthState({ uid: "user-4" });
    await waitFor(() => {
      expect(screen.getByTestId("availableSec")).toHaveTextContent("60");
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("refreshUsage"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("availableSec")).toHaveTextContent("42");
    });
  });
});
