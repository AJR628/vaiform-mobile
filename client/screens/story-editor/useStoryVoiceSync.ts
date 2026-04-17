import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";

import { storyGet, storySync } from "@/api/client";
import { formatRenderTimeAmount } from "@/lib/renderUsage";
import type { StorySession, StoryVoiceOption } from "@/types/story";

import { getVoiceSync, hasUnsyncedVoiceDraft } from "./model";

interface UseStoryVoiceSyncOptions {
  refreshUsage: () => Promise<void>;
  session: StorySession | null;
  sessionId: string;
  setSession: (session: StorySession | null) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

function formatUuidFromBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

async function createSyncIdempotencyKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidFromBytes(bytes);
}

const SYNC_POLL_DELAY_MS = 3000;
const SYNC_POLL_MAX_ATTEMPTS = 40;

export function useStoryVoiceSync({
  refreshUsage,
  session,
  sessionId,
  setSession,
  showError,
  showSuccess,
  showWarning,
}: UseStoryVoiceSyncOptions) {
  const persistedVoicePreset = session?.voicePreset ?? "";
  const persistedVoicePacePreset = session?.voicePacePreset ?? "normal";

  const [draftVoicePreset, setDraftVoicePreset] =
    useState(persistedVoicePreset);
  const [draftVoicePacePreset] = useState<"normal">("normal");
  const [isSyncing, setIsSyncing] = useState(false);

  const lastPersistedVoicePresetRef = useRef(persistedVoicePreset);
  const lastPersistedVoicePacePresetRef = useRef(persistedVoicePacePreset);
  const syncRunIdRef = useRef(0);

  useEffect(() => {
    const persistedChanged =
      lastPersistedVoicePresetRef.current !== persistedVoicePreset ||
      lastPersistedVoicePacePresetRef.current !== persistedVoicePacePreset;

    if (persistedChanged) {
      lastPersistedVoicePresetRef.current = persistedVoicePreset;
      lastPersistedVoicePacePresetRef.current = persistedVoicePacePreset;
      setDraftVoicePreset(persistedVoicePreset);
    }
  }, [persistedVoicePacePreset, persistedVoicePreset]);

  const voiceOptions = useMemo<StoryVoiceOption[]>(
    () => (Array.isArray(session?.voiceOptions) ? session.voiceOptions : []),
    [session?.voiceOptions],
  );
  const voiceSync = useMemo(() => getVoiceSync(session), [session]);
  const hasLocalVoiceDraft = useMemo(
    () =>
      hasUnsyncedVoiceDraft(session, draftVoicePreset, draftVoicePacePreset),
    [draftVoicePacePreset, draftVoicePreset, session],
  );
  const syncEstimateSec = voiceSync?.nextEstimatedChargeSec ?? null;
  const renderEstimateSec = session?.billingEstimate?.estimatedSec ?? null;

  useEffect(() => {
    return () => {
      syncRunIdRef.current += 1;
    };
  }, []);

  const handleSyncVoice = useCallback(async () => {
    if (isSyncing) return;
    if (!draftVoicePreset) {
      showError("Select a voice before syncing.");
      return;
    }

    syncRunIdRef.current += 1;
    const syncRunId = syncRunIdRef.current;

    const pollForCanonicalSync = async (
      pollSessionId: string,
    ): Promise<StorySession | null> => {
      for (let attempt = 0; attempt < SYNC_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (syncRunIdRef.current !== syncRunId) {
          return null;
        }

        const res = await storyGet(pollSessionId);
        if (syncRunIdRef.current !== syncRunId) {
          return null;
        }

        if (res.ok && res.data) {
          setSession(res.data);
          if (getVoiceSync(res.data)?.state === "current") {
            return res.data;
          }
        }

        if (attempt < SYNC_POLL_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, SYNC_POLL_DELAY_MS),
          );
        }
      }

      return null;
    };

    setIsSyncing(true);
    try {
      const idempotencyKey = await createSyncIdempotencyKey();
      const mode =
        hasLocalVoiceDraft ||
        voiceSync?.state === "never_synced" ||
        voiceSync?.staleScope === "full"
          ? "full"
          : "stale";
      const result = await storySync(
        {
          sessionId,
          mode,
          voicePreset: draftVoicePreset,
          voicePacePreset: draftVoicePacePreset,
        },
        { idempotencyKey },
      );

      const syncErrorCode = !result.ok ? result.code : null;
      const shouldRecoverViaCanonicalPoll =
        (result.ok &&
          result.status === 202 &&
          result.sync?.state === "pending") ||
        syncErrorCode === "STORY_SYNC_ALREADY_ACTIVE" ||
        syncErrorCode === "TIMEOUT" ||
        syncErrorCode === "NETWORK_ERROR";

      if (!result.ok && !shouldRecoverViaCanonicalPoll) {
        showError(result.message || "Failed to sync voice and timing.");
        return;
      }

      if (result.ok && result.data) {
        setSession(result.data);
      }

      let resolvedSession = result.ok ? (result.data ?? null) : null;
      if (
        shouldRecoverViaCanonicalPoll ||
        (resolvedSession && getVoiceSync(resolvedSession)?.state !== "current")
      ) {
        const polledSession = await pollForCanonicalSync(
          result.sync?.pollSessionId ?? sessionId,
        );
        if (polledSession) {
          resolvedSession = polledSession;
        } else if (syncRunIdRef.current === syncRunId) {
          showWarning(
            "Voice sync is still processing. Check back in a moment and retry if needed.",
          );
          return;
        } else {
          return;
        }
      }

      try {
        await refreshUsage();
      } catch (error) {
        console.warn("[story] Failed to refresh usage after sync:", error);
      }

      const billedSec = resolvedSession?.voiceSync?.lastChargeSec ?? 0;
      const cached =
        resolvedSession?.voiceSync?.cached === true || billedSec <= 0;
      showSuccess(
        cached
          ? "Voice sync is already current."
          : `Voice synced. Used ${formatRenderTimeAmount(billedSec)} of balance.`,
      );
    } catch (error) {
      console.error("[story] sync voice failed:", error);
      showError("Failed to sync voice and timing.");
    } finally {
      setIsSyncing(false);
    }
  }, [
    draftVoicePacePreset,
    draftVoicePreset,
    hasLocalVoiceDraft,
    isSyncing,
    refreshUsage,
    sessionId,
    setSession,
    showError,
    showSuccess,
    showWarning,
    voiceSync?.staleScope,
    voiceSync?.state,
  ]);

  return {
    draftVoicePacePreset,
    draftVoicePreset,
    hasLocalVoiceDraft,
    isSyncing,
    renderEstimateSec,
    setDraftVoicePreset,
    syncEstimateSec,
    voiceOptions,
    voiceSync,
    handleSyncVoice,
  };
}
