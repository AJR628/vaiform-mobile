import { describe, expect, test } from "@jest/globals";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearStoredStoryFinalizeAttempt,
  loadStoredStoryFinalizeAttempt,
  storeStoryFinalizeAttempt,
} from "@/lib/storyFinalizeAttemptStorage";

describe("client/lib/storyFinalizeAttemptStorage", () => {
  test("stores and reloads a finalize attempt by uid and session", async () => {
    await storeStoryFinalizeAttempt({
      uid: "user-1",
      sessionId: "session-1",
      attemptId: "attempt-1",
      startedAt: "2026-03-21T12:00:00.000Z",
    });

    await expect(
      loadStoredStoryFinalizeAttempt("user-1", "session-1"),
    ).resolves.toEqual({
      uid: "user-1",
      sessionId: "session-1",
      attemptId: "attempt-1",
      startedAt: "2026-03-21T12:00:00.000Z",
    });
  });

  test("clears malformed stored attempts and returns null", async () => {
    await AsyncStorage.setItem(
      "@vaiform/storyFinalizeAttempt:user-1:session-1",
      JSON.stringify({
        uid: "user-1",
        sessionId: "session-1",
      }),
    );

    await expect(
      loadStoredStoryFinalizeAttempt("user-1", "session-1"),
    ).resolves.toBeNull();
    await expect(
      AsyncStorage.getItem("@vaiform/storyFinalizeAttempt:user-1:session-1"),
    ).resolves.toBeNull();
  });

  test("clears invalid JSON payloads and returns null", async () => {
    await AsyncStorage.setItem(
      "@vaiform/storyFinalizeAttempt:user-1:session-2",
      "{",
    );

    await expect(
      loadStoredStoryFinalizeAttempt("user-1", "session-2"),
    ).resolves.toBeNull();
    await expect(
      AsyncStorage.getItem("@vaiform/storyFinalizeAttempt:user-1:session-2"),
    ).resolves.toBeNull();
  });

  test("clears a stored attempt explicitly", async () => {
    await storeStoryFinalizeAttempt({
      uid: "user-1",
      sessionId: "session-3",
      attemptId: "attempt-3",
      startedAt: "2026-03-21T12:00:00.000Z",
    });

    await clearStoredStoryFinalizeAttempt("user-1", "session-3");

    await expect(
      loadStoredStoryFinalizeAttempt("user-1", "session-3"),
    ).resolves.toBeNull();
  });
});
