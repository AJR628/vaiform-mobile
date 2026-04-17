import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, Video, type AVPlaybackStatus } from "expo-av";

import type { StorySession } from "@/types/story";

import {
  findStep3CaptionAtTime,
  findStep3PlaybackSegmentAtTime,
  getStep3PlaybackOwnerSentenceIndex,
  isStep3PreviewReady,
} from "./step3";

interface UseStep3PreviewPlaybackOptions {
  session: StorySession | null;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
}

interface VideoSyncSnapshot {
  segmentIndex: number | null;
  syncedAtMs: number;
  shouldPlay: boolean;
}

const PREVIEW_PROGRESS_INTERVAL_MS = 200;
const VIDEO_SYNC_INTERVAL_MS = 250;

export function useStep3PreviewPlayback({
  session,
  showError,
  showWarning,
}: UseStep3PreviewPlaybackOptions) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionSec, setPreviewPositionSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(
    null,
  );

  const soundRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<Video | null>(null);
  const videoSyncRef = useRef<VideoSyncSnapshot>({
    segmentIndex: null,
    syncedAtMs: 0,
    shouldPlay: false,
  });

  const previewReady = useMemo(() => isStep3PreviewReady(session), [session]);
  const previewAudioUrl = session?.voiceSync?.previewAudioUrl ?? null;
  const isPreviewAvailable = previewReady && !!previewAudioUrl;
  const currentPreviewCaption = useMemo(
    () => findStep3CaptionAtTime(session, previewPositionSec),
    [previewPositionSec, session],
  );
  const currentPlaybackSegment = useMemo(
    () => findStep3PlaybackSegmentAtTime(session, previewPositionSec),
    [previewPositionSec, session],
  );
  const playbackOwnerSentenceIndex = useMemo(
    () => getStep3PlaybackOwnerSentenceIndex(currentPlaybackSegment),
    [currentPlaybackSegment],
  );
  const previewSentenceIndex = currentPreviewCaption?.sentenceIndex ?? null;
  const currentSegmentClipUrl = currentPlaybackSegment?.clipUrl ?? null;
  const currentSegmentPosterUrl = currentPlaybackSegment?.clipThumbUrl ?? null;

  const resetPreviewState = useCallback((durationSec?: number | null) => {
    setIsPreviewPlaying(false);
    setPreviewPositionSec(0);
    setPreviewDurationSec(durationSec ?? null);
    videoSyncRef.current = {
      segmentIndex: null,
      syncedAtMs: 0,
      shouldPlay: false,
    };
  }, []);

  const unloadPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;

    const video = videoRef.current;
    if (video) {
      try {
        await video.setStatusAsync({ shouldPlay: false, positionMillis: 0 });
      } catch (error) {
        console.warn("[story] preview video reset failed:", error);
      }
    }

    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.warn("[story] preview unload failed:", error);
      }
    }

    resetPreviewState(
      session?.voiceSync?.previewAudioDurationSec ??
        session?.voiceSync?.totalDurationSec ??
        null,
    );
  }, [
    resetPreviewState,
    session?.voiceSync?.previewAudioDurationSec,
    session?.voiceSync?.totalDurationSec,
  ]);

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
          : (session?.voiceSync?.previewAudioDurationSec ??
              session?.voiceSync?.totalDurationSec ??
              null),
      );

      if (status.didJustFinish) {
        void unloadPreview();
      }
    },
    [
      session?.voiceSync?.previewAudioDurationSec,
      session?.voiceSync?.totalDurationSec,
      unloadPreview,
    ],
  );

  const syncFollowerVideo = useCallback(
    async (force = false) => {
      const segment = currentPlaybackSegment;
      const video = videoRef.current;
      if (!video || !segment) return;

      const now = Date.now();
      const lastSync = videoSyncRef.current;
      const segmentIndex =
        typeof segment.segmentIndex === "number" ? segment.segmentIndex : null;

      if (
        !force &&
        segmentIndex === lastSync.segmentIndex &&
        lastSync.shouldPlay === isPreviewPlaying &&
        now - lastSync.syncedAtMs < VIDEO_SYNC_INTERVAL_MS
      ) {
        return;
      }

      const segmentStartSec = Number(segment.globalStartSec) || 0;
      const clipStartSec = Number(segment.clipStartSec) || 0;
      const segmentDurationSec =
        Number(segment.durationSec) ||
        Math.max(
          0,
          (Number(segment.globalEndSec) || 0) -
            (Number(segment.globalStartSec) || 0),
        );
      const elapsedInSegmentSec = Math.max(
        0,
        previewPositionSec - segmentStartSec,
      );
      const targetPositionSec =
        clipStartSec + Math.min(elapsedInSegmentSec, segmentDurationSec);

      try {
        await video.setStatusAsync({
          shouldPlay: isPreviewPlaying,
          positionMillis: Math.max(0, Math.round(targetPositionSec * 1000)),
        });
        videoSyncRef.current = {
          segmentIndex,
          syncedAtMs: now,
          shouldPlay: isPreviewPlaying,
        };
      } catch (error) {
        console.warn("[story] preview video sync failed:", error);
      }
    },
    [currentPlaybackSegment, isPreviewPlaying, previewPositionSec],
  );

  const togglePreviewPlayback = useCallback(async () => {
    if (!previewReady || !previewAudioUrl) {
      showWarning(
        "Synced preview is unavailable until voice, captions, and clip coverage are ready.",
      );
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
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: PREVIEW_PROGRESS_INTERVAL_MS,
          },
          handlePlaybackStatus,
        );
        soundRef.current = sound;
        setPreviewDurationSec(
          session?.voiceSync?.previewAudioDurationSec ??
            session?.voiceSync?.totalDurationSec ??
            null,
        );
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
        await syncFollowerVideo(true);
      } else {
        await soundRef.current.playAsync();
        await syncFollowerVideo(true);
      }
    } catch (error) {
      console.error("[story] preview playback failed:", error);
      showError("Failed to play synced preview.");
      await unloadPreview();
    }
  }, [
    handlePlaybackStatus,
    previewAudioUrl,
    previewReady,
    session?.voiceSync?.previewAudioDurationSec,
    session?.voiceSync?.totalDurationSec,
    showError,
    showWarning,
    syncFollowerVideo,
    unloadPreview,
  ]);

  const stopPreview = useCallback(async () => {
    await unloadPreview();
  }, [unloadPreview]);

  const handleFollowerVideoLoad = useCallback(() => {
    void syncFollowerVideo(true);
  }, [syncFollowerVideo]);

  useEffect(() => {
    if (soundRef.current) return;
    setPreviewDurationSec(
      session?.voiceSync?.previewAudioDurationSec ??
        session?.voiceSync?.totalDurationSec ??
        null,
    );
  }, [
    session?.voiceSync?.previewAudioDurationSec,
    session?.voiceSync?.totalDurationSec,
  ]);

  useEffect(() => {
    if (!previewReady || !previewAudioUrl) {
      void unloadPreview();
    }
  }, [previewAudioUrl, previewReady, unloadPreview]);

  useEffect(() => {
    return () => {
      void unloadPreview();
    };
  }, [unloadPreview]);

  useEffect(() => {
    if (!soundRef.current || !currentPlaybackSegment) return;
    void syncFollowerVideo();
  }, [
    currentPlaybackSegment,
    isPreviewPlaying,
    previewPositionSec,
    syncFollowerVideo,
  ]);

  return {
    currentPlaybackSegment,
    currentPreviewCaption,
    currentSegmentClipUrl,
    currentSegmentPosterUrl,
    handleFollowerVideoLoad,
    isPreviewAvailable,
    isPreviewPlaying,
    playbackOwnerSentenceIndex,
    previewDurationSec,
    previewPositionSec,
    previewSentenceIndex,
    stopPreview,
    togglePreviewPlayback,
    videoRef,
  };
}
