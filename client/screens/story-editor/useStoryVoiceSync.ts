import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, type AVPlaybackStatus } from "expo-av";
import * as Crypto from "expo-crypto";

import { storySync } from "@/api/client";
import { formatRenderTimeAmount } from "@/lib/renderUsage";
import type { StoryCaption, StorySession, StoryVoiceOption } from "@/types/story";

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
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function findCaptionAtSecond(captions: StoryCaption[] | undefined, positionSec: number): StoryCaption | null {
  if (!Array.isArray(captions) || captions.length === 0) return null;
  return (
    captions.find(
      (caption) =>
        positionSec >= Number(caption.startTimeSec ?? 0) &&
        positionSec < Number(caption.endTimeSec ?? Number.MAX_SAFE_INTEGER),
    ) ||
    captions[captions.length - 1] ||
    null
  );
}

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

  const [draftVoicePreset, setDraftVoicePreset] = useState(persistedVoicePreset);
  const [draftVoicePacePreset] = useState<"normal">("normal");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionSec, setPreviewPositionSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const lastPersistedVoicePresetRef = useRef(persistedVoicePreset);
  const lastPersistedVoicePacePresetRef = useRef(persistedVoicePacePreset);

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
    () => hasUnsyncedVoiceDraft(session, draftVoicePreset, draftVoicePacePreset),
    [draftVoicePacePreset, draftVoicePreset, session],
  );
  const syncEstimateSec = voiceSync?.nextEstimatedChargeSec ?? null;
  const renderEstimateSec = session?.billingEstimate?.estimatedSec ?? null;
  const previewAudioUrl = voiceSync?.previewAudioUrl ?? null;

  const currentPreviewCaption = useMemo(
    () => findCaptionAtSecond(session?.captions, previewPositionSec),
    [previewPositionSec, session?.captions],
  );
  const previewSentenceIndex = currentPreviewCaption?.sentenceIndex ?? null;

  const resetPreviewState = useCallback(() => {
    setIsPreviewPlaying(false);
    setPreviewPositionSec(0);
    setPreviewDurationSec(null);
  }, []);

  const unloadPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) {
      resetPreviewState();
      return;
    }
    try {
      await sound.unloadAsync();
    } catch (error) {
      console.warn("[story] preview unload failed:", error);
    } finally {
      resetPreviewState();
    }
  }, [resetPreviewState]);

  useEffect(() => {
    return () => {
      void unloadPreview();
    };
  }, [unloadPreview]);

  useEffect(() => {
    void unloadPreview();
  }, [previewAudioUrl, unloadPreview]);

  const handlePlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if ("error" in status && status.error) {
          console.warn("[story] preview playback error:", status.error);
        }
        return;
      }

      setIsPreviewPlaying(status.isPlaying);
      setPreviewPositionSec(status.positionMillis / 1000);
      setPreviewDurationSec(
        Number.isFinite(status.durationMillis ?? NaN)
          ? (status.durationMillis ?? 0) / 1000
          : null,
      );

      if (status.didJustFinish) {
        void unloadPreview();
      }
    },
    [unloadPreview],
  );

  const togglePreviewPlayback = useCallback(async () => {
    if (!previewAudioUrl) {
      showWarning("Sync voice and timing first to preview narration.");
      return;
    }

    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: previewAudioUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 200 },
          handlePlaybackStatus,
        );
        soundRef.current = sound;
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        await unloadPreview();
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPreviewPlaying(false);
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error("[story] preview playback failed:", error);
      showError("Failed to play narration preview.");
      await unloadPreview();
    }
  }, [handlePlaybackStatus, previewAudioUrl, showError, showWarning, unloadPreview]);

  const handleSyncVoice = useCallback(async () => {
    if (isSyncing) return;
    if (!draftVoicePreset) {
      showError("Select a voice before syncing.");
      return;
    }

    setIsSyncing(true);
    try {
      const idempotencyKey = await createSyncIdempotencyKey();
      const mode =
        hasLocalVoiceDraft || voiceSync?.state === "never_synced" || voiceSync?.staleScope === "full"
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

      if (!result.ok) {
        showError(result.message || "Failed to sync voice and timing.");
        return;
      }

      if (result.data) {
        setSession(result.data);
      }

      try {
        await refreshUsage();
      } catch (error) {
        console.warn("[story] Failed to refresh usage after sync:", error);
      }

      const billedSec = result.data?.voiceSync?.lastChargeSec ?? 0;
      const cached = result.data?.voiceSync?.cached === true || billedSec <= 0;
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
    voiceSync?.staleScope,
    voiceSync?.state,
  ]);

  return {
    currentPreviewCaption,
    draftVoicePacePreset,
    draftVoicePreset,
    hasLocalVoiceDraft,
    isPreviewAvailable: Boolean(previewAudioUrl),
    isPreviewPlaying,
    isSyncing,
    previewDurationSec,
    previewPositionSec,
    previewSentenceIndex,
    renderEstimateSec,
    setDraftVoicePreset,
    stopPreview: unloadPreview,
    syncEstimateSec,
    togglePreviewPlayback,
    voiceOptions,
    voiceSync,
    handleSyncVoice,
  };
}
