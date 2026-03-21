import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "@vaiform/storyFinalizeAttempt:";

export interface StoredStoryFinalizeAttempt {
  uid: string;
  sessionId: string;
  attemptId: string;
  startedAt: string;
}

function storageKey(uid: string, sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${uid}:${sessionId}`;
}

export async function loadStoredStoryFinalizeAttempt(
  uid: string,
  sessionId: string
): Promise<StoredStoryFinalizeAttempt | null> {
  const raw = await AsyncStorage.getItem(storageKey(uid, sessionId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredStoryFinalizeAttempt>;
    if (
      typeof parsed?.uid !== "string" ||
      typeof parsed?.sessionId !== "string" ||
      typeof parsed?.attemptId !== "string" ||
      typeof parsed?.startedAt !== "string"
    ) {
      await AsyncStorage.removeItem(storageKey(uid, sessionId));
      return null;
    }
    return {
      uid: parsed.uid,
      sessionId: parsed.sessionId,
      attemptId: parsed.attemptId,
      startedAt: parsed.startedAt,
    };
  } catch {
    await AsyncStorage.removeItem(storageKey(uid, sessionId));
    return null;
  }
}

export async function storeStoryFinalizeAttempt(
  attempt: StoredStoryFinalizeAttempt
): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(attempt.uid, attempt.sessionId),
    JSON.stringify(attempt)
  );
}

export async function clearStoredStoryFinalizeAttempt(
  uid: string,
  sessionId: string
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(uid, sessionId));
}
