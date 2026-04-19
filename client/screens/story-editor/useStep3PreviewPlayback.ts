import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Audio, Video, type AVPlaybackStatus } from "expo-av";

import type {
  StoryPlaybackTimelineSegmentV1,
  StorySession,
} from "@/types/story";

import {
  findStep3CaptionAtTime,
  findStep3PlaybackSegmentAtTime,
  getStep3PlaybackOwnerSentenceIndex,
  getStep3PlaybackTimeline,
  isStep3PreviewReady,
} from "./step3";

type PreviewSlotKey = "a" | "b";

export interface Step3PreviewVideoSlot {
  clipUrl: string | null;
  isActive: boolean;
  isReady: boolean;
  key: PreviewSlotKey;
  posterUrl: string | null;
  ref: RefObject<Video | null>;
  requestToken: number;
  segmentIndex: number | null;
}

interface UseStep3PreviewPlaybackOptions {
  session: StorySession | null;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  useUnifiedPreviewSlots?: boolean;
}

interface LegacyVideoSyncSnapshot {
  segmentIndex: number | null;
  syncedAtMs: number;
  shouldPlay: boolean;
}

interface SlotRuntimeState {
  clipUrl: string | null;
  isWarmup: boolean;
  lastShouldPlay: boolean;
  lastSyncedPositionMillis: number | null;
  pendingSwap: boolean;
  posterUrl: string | null;
  ready: boolean;
  requestToken: number;
  segmentIndex: number | null;
  shouldPlay: boolean;
  syncedAtMs: number;
  targetPositionMillis: number;
}

type SlotRuntimeStateMap = Record<PreviewSlotKey, SlotRuntimeState>;

const PREVIEW_PROGRESS_INTERVAL_MS = 200;
const LEGACY_VIDEO_SYNC_INTERVAL_MS = 250;
const NORMAL_DRIFT_TOLERANCE_MS = 220;
const HARD_SEEK_TOLERANCE_MS = 60;
const DRIFT_CHECK_INTERVAL_MS = 1500;
const BOUNDARY_WARMUP_LEAD_SEC = 0.35;
const SLOT_KEYS: PreviewSlotKey[] = ["a", "b"];

function createEmptySlot(): SlotRuntimeState {
  return {
    clipUrl: null,
    isWarmup: false,
    lastShouldPlay: false,
    lastSyncedPositionMillis: null,
    pendingSwap: false,
    posterUrl: null,
    ready: false,
    requestToken: 0,
    segmentIndex: null,
    shouldPlay: false,
    syncedAtMs: 0,
    targetPositionMillis: 0,
  };
}

function createInitialSlots(): SlotRuntimeStateMap {
  return {
    a: createEmptySlot(),
    b: createEmptySlot(),
  };
}

function getSegmentIndex(
  segment: StoryPlaybackTimelineSegmentV1 | null | undefined,
): number | null {
  const value = Number(segment?.segmentIndex);
  return Number.isFinite(value) ? value : null;
}

function getSegmentTargetPositionMillis(
  segment: StoryPlaybackTimelineSegmentV1,
  audioTimeSec: number,
): number {
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
    (Number(audioTimeSec) || 0) - segmentStartSec,
  );
  const targetPositionSec =
    clipStartSec + Math.min(elapsedInSegmentSec, segmentDurationSec);

  return Math.max(0, Math.round(targetPositionSec * 1000));
}

function getNextPlaybackSegment(
  session: StorySession | null,
  segment: StoryPlaybackTimelineSegmentV1 | null,
): StoryPlaybackTimelineSegmentV1 | null {
  const timeline = getStep3PlaybackTimeline(session);
  const segmentIndex = getSegmentIndex(segment);
  if (!timeline || segmentIndex === null) return null;

  const currentPosition = timeline.segments.findIndex(
    (entry) => getSegmentIndex(entry) === segmentIndex,
  );
  if (currentPosition < 0) return null;
  return timeline.segments[currentPosition + 1] ?? null;
}

function getPlaybackSegmentByIndex(
  session: StorySession | null,
  segmentIndex: number | null,
): StoryPlaybackTimelineSegmentV1 | null {
  if (segmentIndex === null) return null;
  const timeline = getStep3PlaybackTimeline(session);
  return (
    timeline?.segments.find(
      (entry) => getSegmentIndex(entry) === segmentIndex,
    ) ?? null
  );
}

function getOtherSlotKey(slotKey: PreviewSlotKey): PreviewSlotKey {
  return slotKey === "a" ? "b" : "a";
}

export function useStep3PreviewPlayback({
  session,
  showError,
  showWarning,
  useUnifiedPreviewSlots = false,
}: UseStep3PreviewPlaybackOptions) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPositionSec, setPreviewPositionSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState<number | null>(
    null,
  );
  const [previewSlotsState, setPreviewSlotsState] =
    useState<SlotRuntimeStateMap>(() => createInitialSlots());
  const [activeSlotKey, setActiveSlotKey] = useState<PreviewSlotKey>("a");

  const soundRef = useRef<Audio.Sound | null>(null);
  const legacyVideoRef = useRef<Video | null>(null);
  const slotARef = useRef<Video | null>(null);
  const slotBRef = useRef<Video | null>(null);
  const legacyVideoSyncRef = useRef<LegacyVideoSyncSnapshot>({
    segmentIndex: null,
    syncedAtMs: 0,
    shouldPlay: false,
  });
  const previewSlotsRef = useRef<SlotRuntimeStateMap>(previewSlotsState);
  const activeSlotKeyRef = useRef<PreviewSlotKey>(activeSlotKey);
  const isPreviewPlayingRef = useRef(false);
  const previewPositionSecRef = useRef(0);
  const sessionRef = useRef<StorySession | null>(session);
  const slotRequestTokenRef = useRef(0);
  const slotCommandQueuesRef = useRef<Record<PreviewSlotKey, Promise<void>>>({
    a: Promise.resolve(),
    b: Promise.resolve(),
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

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    isPreviewPlayingRef.current = isPreviewPlaying;
  }, [isPreviewPlaying]);

  useEffect(() => {
    previewPositionSecRef.current = previewPositionSec;
  }, [previewPositionSec]);

  useEffect(() => {
    activeSlotKeyRef.current = activeSlotKey;
  }, [activeSlotKey]);

  const getNextSlotRequestToken = useCallback(() => {
    slotRequestTokenRef.current += 1;
    return slotRequestTokenRef.current;
  }, []);

  const commitPreviewSlots = useCallback(
    (updater: (current: SlotRuntimeStateMap) => SlotRuntimeStateMap) => {
      setPreviewSlotsState((current) => {
        const next = updater(current);
        previewSlotsRef.current = next;
        return next;
      });
    },
    [],
  );

  const getSlotVideoRef = useCallback((slotKey: PreviewSlotKey) => {
    return slotKey === "a" ? slotARef.current : slotBRef.current;
  }, []);

  const enqueueSlotCommand = useCallback(
    (slotKey: PreviewSlotKey, command: () => Promise<void>) => {
      const run = slotCommandQueuesRef.current[slotKey]
        .catch(() => undefined)
        .then(command);
      slotCommandQueuesRef.current[slotKey] = run.catch(() => undefined);
      return run;
    },
    [],
  );

  const setSlotPlaybackStatus = useCallback(
    async (
      slotKey: PreviewSlotKey,
      {
        force = false,
        positionMillis,
        shouldPlay,
        toleranceMillis = NORMAL_DRIFT_TOLERANCE_MS,
      }: {
        force?: boolean;
        positionMillis: number;
        shouldPlay: boolean;
        toleranceMillis?: number;
      },
    ): Promise<boolean> => {
      const slot = previewSlotsRef.current[slotKey];
      const video = getSlotVideoRef(slotKey);
      if (!video || !slot.clipUrl) return false;

      const targetPositionMillis = Math.max(0, Math.round(positionMillis));
      if (!force && slot.lastShouldPlay === shouldPlay) {
        const millisSinceSync = Date.now() - slot.syncedAtMs;
        if (shouldPlay && millisSinceSync < DRIFT_CHECK_INTERVAL_MS) {
          return true;
        }

        if (shouldPlay) {
          if (typeof video.getStatusAsync !== "function") {
            return true;
          }
          const status = await video.getStatusAsync();
          if (status.isLoaded) {
            const driftMillis = Math.abs(
              (status.positionMillis ?? 0) - targetPositionMillis,
            );
            if (driftMillis <= toleranceMillis) {
              return true;
            }
          }
        } else {
          const driftMillis =
            slot.lastSyncedPositionMillis === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(slot.lastSyncedPositionMillis - targetPositionMillis);
          if (driftMillis <= toleranceMillis) {
            return true;
          }
        }
      }

      await enqueueSlotCommand(slotKey, async () => {
        await video.setStatusAsync({
          positionMillis: targetPositionMillis,
          shouldPlay,
        });
      });

      commitPreviewSlots((current) => ({
        ...current,
        [slotKey]: {
          ...current[slotKey],
          lastShouldPlay: shouldPlay,
          lastSyncedPositionMillis: targetPositionMillis,
          shouldPlay,
          syncedAtMs: Date.now(),
          targetPositionMillis,
        },
      }));
      return true;
    },
    [commitPreviewSlots, enqueueSlotCommand, getSlotVideoRef],
  );

  const pauseSlot = useCallback(
    async (slotKey: PreviewSlotKey) => {
      const video = getSlotVideoRef(slotKey);
      if (!video) return;
      try {
        await enqueueSlotCommand(slotKey, async () => {
          await video.setStatusAsync({ shouldPlay: false });
        });
      } catch (error) {
        console.warn("[story] preview video pause failed:", error);
      }
      commitPreviewSlots((current) => ({
        ...current,
        [slotKey]: {
          ...current[slotKey],
          lastShouldPlay: false,
          shouldPlay: false,
        },
      }));
    },
    [commitPreviewSlots, enqueueSlotCommand, getSlotVideoRef],
  );

  const finalizePreviewSlot = useCallback(
    async (slotKey: PreviewSlotKey, requestToken: number) => {
      const slot = previewSlotsRef.current[slotKey];
      if (!slot || slot.requestToken !== requestToken || !slot.clipUrl) return;

      const segment = getPlaybackSegmentByIndex(
        sessionRef.current,
        slot.segmentIndex,
      );
      const positionMillis = segment
        ? getSegmentTargetPositionMillis(segment, previewPositionSecRef.current)
        : slot.targetPositionMillis;
      const shouldPlay = slot.pendingSwap && isPreviewPlayingRef.current;
      const synced = await setSlotPlaybackStatus(slotKey, {
        force: true,
        positionMillis,
        shouldPlay,
        toleranceMillis: HARD_SEEK_TOLERANCE_MS,
      });
      if (!synced) return;

      const latest = previewSlotsRef.current[slotKey];
      if (latest.requestToken !== requestToken) return;

      commitPreviewSlots((current) => ({
        ...current,
        [slotKey]: {
          ...current[slotKey],
          ready: true,
          targetPositionMillis: positionMillis,
        },
      }));

      if (!latest.pendingSwap) return;

      const previousActiveSlotKey = activeSlotKeyRef.current;
      activeSlotKeyRef.current = slotKey;
      setActiveSlotKey(slotKey);
      commitPreviewSlots((current) => ({
        ...current,
        [slotKey]: {
          ...current[slotKey],
          isWarmup: false,
          pendingSwap: false,
          shouldPlay: isPreviewPlayingRef.current,
        },
        [previousActiveSlotKey]: {
          ...current[previousActiveSlotKey],
          isWarmup: false,
          pendingSwap: false,
          shouldPlay: false,
        },
      }));
      if (previousActiveSlotKey !== slotKey) {
        void pauseSlot(previousActiveSlotKey);
      }
    },
    [commitPreviewSlots, pauseSlot, setSlotPlaybackStatus],
  );

  const preparePreviewSlot = useCallback(
    (
      slotKey: PreviewSlotKey,
      segment: StoryPlaybackTimelineSegmentV1,
      audioTimeSec: number,
      {
        isWarmup = false,
        pendingSwap = false,
        shouldPlay = false,
      }: {
        isWarmup?: boolean;
        pendingSwap?: boolean;
        shouldPlay?: boolean;
      },
    ) => {
      const segmentIndex = getSegmentIndex(segment);
      const clipUrl =
        typeof segment.clipUrl === "string" ? segment.clipUrl : "";
      if (segmentIndex === null || !clipUrl) return;

      const currentSlot = previewSlotsRef.current[slotKey];
      const clipChanged = currentSlot.clipUrl !== clipUrl;
      const segmentChanged = currentSlot.segmentIndex !== segmentIndex;
      const requestToken =
        clipChanged || segmentChanged || pendingSwap
          ? getNextSlotRequestToken()
          : currentSlot.requestToken;
      const targetPositionMillis = getSegmentTargetPositionMillis(
        segment,
        audioTimeSec,
      );
      const ready = !clipChanged && currentSlot.ready;

      commitPreviewSlots((current) => ({
        ...current,
        [slotKey]: {
          ...current[slotKey],
          clipUrl,
          isWarmup,
          pendingSwap,
          posterUrl: segment.clipThumbUrl ?? null,
          ready,
          requestToken,
          segmentIndex,
          shouldPlay,
          targetPositionMillis,
          ...(clipChanged
            ? {
                lastShouldPlay: false,
                lastSyncedPositionMillis: null,
                syncedAtMs: 0,
              }
            : {}),
        },
      }));

      if (ready || !clipChanged) {
        void finalizePreviewSlot(slotKey, requestToken);
      }
    },
    [commitPreviewSlots, finalizePreviewSlot, getNextSlotRequestToken],
  );

  const warmNextPreviewSegment = useCallback(
    (segment: StoryPlaybackTimelineSegmentV1, audioTimeSec: number) => {
      if (!isPreviewPlayingRef.current) return;

      const segmentEndSec = Number(segment.globalEndSec);
      if (!Number.isFinite(segmentEndSec)) return;

      const remainingSec = segmentEndSec - (Number(audioTimeSec) || 0);
      if (remainingSec <= 0 || remainingSec > BOUNDARY_WARMUP_LEAD_SEC) return;

      const nextSegment = getNextPlaybackSegment(sessionRef.current, segment);
      const nextClipUrl =
        typeof nextSegment?.clipUrl === "string" ? nextSegment.clipUrl : "";
      if (!nextSegment || !nextClipUrl) return;

      const activeSlot = previewSlotsRef.current[activeSlotKeyRef.current];
      if (activeSlot.clipUrl === nextClipUrl) return;

      const standbySlotKey = getOtherSlotKey(activeSlotKeyRef.current);
      const standbySlot = previewSlotsRef.current[standbySlotKey];
      const nextSeekAudioTimeSec = Math.max(
        Number(audioTimeSec) || 0,
        Number(nextSegment.globalStartSec) || 0,
      );
      const nextTargetPositionMillis = getSegmentTargetPositionMillis(
        nextSegment,
        nextSeekAudioTimeSec,
      );
      const standbyAlreadyWarm =
        standbySlot.clipUrl === nextClipUrl &&
        standbySlot.segmentIndex === getSegmentIndex(nextSegment) &&
        standbySlot.ready &&
        standbySlot.isWarmup &&
        Math.abs(standbySlot.targetPositionMillis - nextTargetPositionMillis) <=
          HARD_SEEK_TOLERANCE_MS;

      if (standbyAlreadyWarm) return;

      preparePreviewSlot(standbySlotKey, nextSegment, nextSeekAudioTimeSec, {
        isWarmup: true,
        pendingSwap: false,
        shouldPlay: false,
      });
    },
    [preparePreviewSlot],
  );

  const syncUnifiedPreviewSegment = useCallback(
    (force = false) => {
      const segment = currentPlaybackSegment;
      if (!segment) return;

      const activeKey = activeSlotKeyRef.current;
      const activeSlot = previewSlotsRef.current[activeKey];
      const audioTimeSec = previewPositionSecRef.current;
      const targetPositionMillis = getSegmentTargetPositionMillis(
        segment,
        audioTimeSec,
      );

      if (!activeSlot.clipUrl) {
        preparePreviewSlot(activeKey, segment, audioTimeSec, {
          isWarmup: false,
          pendingSwap: false,
          shouldPlay: isPreviewPlayingRef.current,
        });
        warmNextPreviewSegment(segment, audioTimeSec);
        return;
      }

      if (activeSlot.clipUrl === segment.clipUrl) {
        const activeSegmentIndex = getSegmentIndex(segment);
        if (activeSlot.segmentIndex !== activeSegmentIndex) {
          commitPreviewSlots((current) => ({
            ...current,
            [activeKey]: {
              ...current[activeKey],
              isWarmup: false,
              pendingSwap: false,
              posterUrl: segment.clipThumbUrl ?? null,
              segmentIndex: activeSegmentIndex,
              targetPositionMillis,
            },
          }));
        }
        void setSlotPlaybackStatus(activeKey, {
          force,
          positionMillis: targetPositionMillis,
          shouldPlay: isPreviewPlayingRef.current,
          toleranceMillis: force
            ? HARD_SEEK_TOLERANCE_MS
            : NORMAL_DRIFT_TOLERANCE_MS,
        });
        warmNextPreviewSegment(segment, audioTimeSec);
        return;
      }

      preparePreviewSlot(getOtherSlotKey(activeKey), segment, audioTimeSec, {
        isWarmup: false,
        pendingSwap: true,
        shouldPlay: isPreviewPlayingRef.current,
      });
    },
    [
      commitPreviewSlots,
      currentPlaybackSegment,
      preparePreviewSlot,
      setSlotPlaybackStatus,
      warmNextPreviewSegment,
    ],
  );

  const resetUnifiedPreviewSlots = useCallback(() => {
    const nextSlots = createInitialSlots();
    SLOT_KEYS.forEach((slotKey) => {
      nextSlots[slotKey].requestToken = getNextSlotRequestToken();
      const video = getSlotVideoRef(slotKey);
      if (video) {
        void enqueueSlotCommand(slotKey, async () => {
          await video.setStatusAsync({
            positionMillis: 0,
            shouldPlay: false,
          });
        }).catch((error) => {
          console.warn("[story] preview slot reset failed:", error);
        });
      }
    });
    activeSlotKeyRef.current = "a";
    setActiveSlotKey("a");
    previewSlotsRef.current = nextSlots;
    setPreviewSlotsState(nextSlots);
  }, [enqueueSlotCommand, getNextSlotRequestToken, getSlotVideoRef]);

  const resetPreviewState = useCallback(
    (durationSec?: number | null) => {
      setIsPreviewPlaying(false);
      setPreviewPositionSec(0);
      setPreviewDurationSec(durationSec ?? null);
      legacyVideoSyncRef.current = {
        segmentIndex: null,
        syncedAtMs: 0,
        shouldPlay: false,
      };
      resetUnifiedPreviewSlots();
    },
    [resetUnifiedPreviewSlots],
  );

  const unloadPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;

    const legacyVideo = legacyVideoRef.current;
    if (legacyVideo) {
      try {
        await legacyVideo.setStatusAsync({
          positionMillis: 0,
          shouldPlay: false,
        });
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

  const syncLegacyFollowerVideo = useCallback(
    async (force = false) => {
      const segment = currentPlaybackSegment;
      const video = legacyVideoRef.current;
      if (!video || !segment) return;

      const now = Date.now();
      const lastSync = legacyVideoSyncRef.current;
      const segmentIndex = getSegmentIndex(segment);

      if (
        !force &&
        segmentIndex === lastSync.segmentIndex &&
        lastSync.shouldPlay === isPreviewPlaying &&
        now - lastSync.syncedAtMs < LEGACY_VIDEO_SYNC_INTERVAL_MS
      ) {
        return;
      }

      try {
        await video.setStatusAsync({
          shouldPlay: isPreviewPlaying,
          positionMillis: getSegmentTargetPositionMillis(
            segment,
            previewPositionSec,
          ),
        });
        legacyVideoSyncRef.current = {
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
        isPreviewPlayingRef.current = true;
        setIsPreviewPlaying(true);
        setPreviewDurationSec(
          session?.voiceSync?.previewAudioDurationSec ??
            session?.voiceSync?.totalDurationSec ??
            null,
        );
        if (useUnifiedPreviewSlots) {
          syncUnifiedPreviewSegment(true);
        }
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        await unloadPreview();
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        isPreviewPlayingRef.current = false;
        setIsPreviewPlaying(false);
        if (useUnifiedPreviewSlots) {
          syncUnifiedPreviewSegment(true);
        } else {
          await syncLegacyFollowerVideo(true);
        }
      } else {
        await soundRef.current.playAsync();
        isPreviewPlayingRef.current = true;
        setIsPreviewPlaying(true);
        if (useUnifiedPreviewSlots) {
          syncUnifiedPreviewSegment(true);
        } else {
          await syncLegacyFollowerVideo(true);
        }
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
    syncLegacyFollowerVideo,
    syncUnifiedPreviewSegment,
    unloadPreview,
    useUnifiedPreviewSlots,
  ]);

  const stopPreview = useCallback(async () => {
    await unloadPreview();
  }, [unloadPreview]);

  const handleFollowerVideoLoad = useCallback(() => {
    if (useUnifiedPreviewSlots) {
      const slotKey = activeSlotKeyRef.current;
      const slot = previewSlotsRef.current[slotKey];
      void finalizePreviewSlot(slotKey, slot.requestToken);
      return;
    }
    void syncLegacyFollowerVideo(true);
  }, [finalizePreviewSlot, syncLegacyFollowerVideo, useUnifiedPreviewSlots]);

  const handlePreviewSlotReady = useCallback(
    (slotKey: PreviewSlotKey, requestToken: number) => {
      void finalizePreviewSlot(slotKey, requestToken);
    },
    [finalizePreviewSlot],
  );

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
    if (!useUnifiedPreviewSlots || !previewReady || !currentPlaybackSegment) {
      return;
    }
    syncUnifiedPreviewSegment(false);
  }, [
    currentPlaybackSegment,
    previewReady,
    previewPositionSec,
    syncUnifiedPreviewSegment,
    useUnifiedPreviewSlots,
  ]);

  useEffect(() => {
    if (useUnifiedPreviewSlots) return;
    if (!soundRef.current || !currentPlaybackSegment) return;
    void syncLegacyFollowerVideo();
  }, [
    currentPlaybackSegment,
    isPreviewPlaying,
    previewPositionSec,
    syncLegacyFollowerVideo,
    useUnifiedPreviewSlots,
  ]);

  const previewVideoSlots = useMemo<Step3PreviewVideoSlot[]>(
    () =>
      SLOT_KEYS.map((slotKey) => ({
        clipUrl: previewSlotsState[slotKey].clipUrl,
        isActive: activeSlotKey === slotKey,
        isReady: previewSlotsState[slotKey].ready,
        key: slotKey,
        posterUrl: previewSlotsState[slotKey].posterUrl,
        ref: slotKey === "a" ? slotARef : slotBRef,
        requestToken: previewSlotsState[slotKey].requestToken,
        segmentIndex: previewSlotsState[slotKey].segmentIndex,
      })),
    [activeSlotKey, previewSlotsState],
  );

  return {
    currentPlaybackSegment,
    currentPreviewCaption,
    currentSegmentClipUrl,
    currentSegmentPosterUrl,
    handleFollowerVideoLoad,
    handlePreviewSlotReady,
    isPreviewAvailable,
    isPreviewPlaying,
    playbackOwnerSentenceIndex,
    previewDurationSec,
    previewPositionSec,
    previewSentenceIndex,
    previewVideoSlots,
    stopPreview,
    togglePreviewPlayback,
    videoRef: legacyVideoRef,
  };
}
