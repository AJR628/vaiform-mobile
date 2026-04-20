import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Video, type AVPlaybackStatus } from "expo-av";
import * as Crypto from "expo-crypto";

import { storyGet, storyPreview } from "@/api/client";
import type { StorySession } from "@/types/story";

import { getStep3DraftPreview } from "./step3";

interface UseStep3PreviewArtifactOptions {
  session: StorySession | null;
  sessionId: string;
  setSession: (session: StorySession | null) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 80;

function isPendingState(state: string): boolean {
  return state === "queued" || state === "running";
}

export function useStep3PreviewArtifact({
  session,
  sessionId,
  setSession,
  showError,
  showSuccess,
  showWarning,
}: UseStep3PreviewArtifactOptions) {
  const videoRef = useRef<Video | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionSec, setPreviewPositionSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(
    null,
  );
  const [isPreviewRequesting, setIsPreviewRequesting] = useState(false);

  const draftPreview = useMemo(() => getStep3DraftPreview(session), [session]);
  const previewArtifactUrl = draftPreview.artifactUrl;
  const previewReady = draftPreview.state === "ready" && !!previewArtifactUrl;
  const isPreviewAvailable = previewReady;

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const pollPreview = useCallback(async () => {
    if (!sessionId) return;
    pollAttemptsRef.current += 1;
    const result = await storyGet(sessionId);
    if (!result.ok) {
      showError(result.message);
      clearPoll();
      return;
    }
    setSession(result.data);
    const next = getStep3DraftPreview(result.data);
    if (next.state === "ready") {
      showSuccess("Preview is ready.");
      clearPoll();
      return;
    }
    if (
      next.state === "failed" ||
      next.state === "blocked" ||
      next.state === "stale"
    ) {
      if (next.state === "failed") {
        showError(next.errorMessage ?? "Preview generation failed.");
      }
      clearPoll();
      return;
    }
    if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
      showWarning(
        "Preview is still generating. Refresh this screen to check again.",
      );
      clearPoll();
      return;
    }
    pollTimerRef.current = setTimeout(() => {
      void pollPreview();
    }, POLL_INTERVAL_MS);
  }, [clearPoll, sessionId, setSession, showError, showSuccess, showWarning]);

  const requestPreview = useCallback(async () => {
    if (!sessionId || isPreviewRequesting) return;
    setIsPreviewRequesting(true);
    try {
      const idempotencyKey = await Crypto.randomUUID();
      const result = await storyPreview(
        { sessionId },
        {
          idempotencyKey,
        },
      );
      if (!result.ok) {
        showError(result.message);
        return;
      }
      setSession(result.data);
      const next = getStep3DraftPreview(result.data);
      if (next.state === "ready") {
        showSuccess("Preview is ready.");
        return;
      }
      if (isPendingState(next.state)) {
        showWarning("Preview generation started.");
        clearPoll();
        pollTimerRef.current = setTimeout(() => {
          void pollPreview();
        }, POLL_INTERVAL_MS);
        return;
      }
      if (next.state === "blocked") {
        showWarning(
          "Preview is blocked until required story assets are ready.",
        );
        return;
      }
      if (next.state === "failed") {
        showError(next.errorMessage ?? "Preview generation failed.");
      }
    } finally {
      setIsPreviewRequesting(false);
    }
  }, [
    clearPoll,
    isPreviewRequesting,
    pollPreview,
    sessionId,
    setSession,
    showError,
    showSuccess,
    showWarning,
  ]);

  const stopPreview = useCallback(async () => {
    const video = videoRef.current;
    setIsPreviewPlaying(false);
    setPreviewPositionSec(0);
    if (!video) return;
    try {
      await video.setStatusAsync({ shouldPlay: false, positionMillis: 0 });
    } catch (error) {
      console.warn("[story] preview stop failed:", error);
    }
  }, []);

  const togglePreviewPlayback = useCallback(async () => {
    if (!previewReady || !previewArtifactUrl) {
      if (
        draftPreview.state === "stale" ||
        draftPreview.state === "not_requested"
      ) {
        await requestPreview();
        return;
      }
      showWarning("Preview is not ready yet.");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    try {
      if (isPreviewPlaying) {
        await video.pauseAsync();
        setIsPreviewPlaying(false);
      } else {
        await video.playAsync();
        setIsPreviewPlaying(true);
      }
    } catch (error) {
      console.warn("[story] preview playback failed:", error);
      showError("Preview playback failed.");
    }
  }, [
    draftPreview.state,
    isPreviewPlaying,
    previewArtifactUrl,
    previewReady,
    requestPreview,
    showError,
    showWarning,
  ]);

  const handlePreviewPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setPreviewPositionSec(Math.max(0, status.positionMillis / 1000));
      if (Number.isFinite(status.durationMillis ?? NaN)) {
        setPreviewDurationSec((status.durationMillis ?? 0) / 1000);
      }
      setIsPreviewPlaying(status.isPlaying === true);
      if (status.didJustFinish) {
        setIsPreviewPlaying(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!previewReady) {
      void stopPreview();
    }
  }, [previewReady, stopPreview]);

  useEffect(
    () => () => {
      clearPoll();
    },
    [clearPoll],
  );

  return {
    draftPreview,
    handlePreviewPlaybackStatus,
    isPreviewAvailable,
    isPreviewPlaying,
    isPreviewRequesting,
    previewArtifactUrl,
    previewDurationSec: previewDurationSec ?? draftPreview.durationSec,
    previewPositionSec,
    previewReady,
    requestPreview,
    stopPreview,
    togglePreviewPlayback,
    videoRef,
  };
}
