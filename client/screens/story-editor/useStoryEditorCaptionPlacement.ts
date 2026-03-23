import { useCallback, useEffect, useRef, useState } from "react";

import { storyUpdateCaptionStyle } from "@/api/client";
import { useCaptionPreview } from "@/hooks/useCaptionPreview";

import {
  CAPTION_PLACEMENTS,
  type Beat,
  type CaptionPlacement,
  PLACEMENT_TO_YPCT,
} from "./model";

interface UseStoryEditorCaptionPlacementOptions {
  beats: Beat[];
  canPrefetch: () => boolean;
  committedText: string;
  selectedSentenceIndex: number | null;
  serverPlacement?: CaptionPlacement;
  sessionId: string;
  showError: (message: string) => void;
}

export function useStoryEditorCaptionPlacement({
  beats,
  canPrefetch,
  committedText,
  selectedSentenceIndex,
  serverPlacement,
  sessionId,
  showError,
}: UseStoryEditorCaptionPlacementOptions) {
  const [captionPlacement, setCaptionPlacement] = useState<CaptionPlacement>("center");

  const {
    cancelPrefetch,
    isLoadingByIndex,
    prefetchAllBeats,
    previewByIndex,
    requestPreview,
    resetPreviews,
  } = useCaptionPreview(sessionId, selectedSentenceIndex);

  const prefetchDoneForSessionRef = useRef<string | null>(null);
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  const pendingPlacementRef = useRef<CaptionPlacement | null>(null);
  const lastPersistedPlacementRef = useRef<CaptionPlacement>("center");
  const lastPersistedYPctRef = useRef<number>(PLACEMENT_TO_YPCT.center);

  useEffect(() => {
    if (serverPlacement && CAPTION_PLACEMENTS.includes(serverPlacement)) {
      setCaptionPlacement((prev) => (prev === serverPlacement ? prev : serverPlacement));
      lastPersistedPlacementRef.current = serverPlacement;
      lastPersistedYPctRef.current = PLACEMENT_TO_YPCT[serverPlacement];
    }
  }, [serverPlacement]);

  useEffect(() => {
    if (selectedSentenceIndex === null || !sessionId) return;
    if (!committedText.trim()) return;
    const yPct = PLACEMENT_TO_YPCT[captionPlacement];
    requestPreview(selectedSentenceIndex, committedText, {
      placement: captionPlacement,
      yPct,
    });
  }, [captionPlacement, committedText, requestPreview, selectedSentenceIndex, sessionId]);

  useEffect(() => {
    if (!sessionId || beats.length === 0) return;
    if (prefetchDoneForSessionRef.current === sessionId) return;

    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchTimeoutRef.current = null;
      if (!canPrefetch()) return;
      if (prefetchDoneForSessionRef.current === sessionId) return;
      prefetchDoneForSessionRef.current = sessionId;
      void prefetchAllBeats(beats, {
        delayBetweenMs: 120,
        placement: captionPlacement,
        yPct: PLACEMENT_TO_YPCT[captionPlacement],
      });
    }, 1500);

    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
    };
  }, [beats, canPrefetch, captionPlacement, prefetchAllBeats, sessionId]);

  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
    };
  }, []);

  const requestPlacementPreview = useCallback(
    (placement: CaptionPlacement) => {
      if (selectedSentenceIndex === null) return;
      if (!committedText.trim()) return;
      const yPct = PLACEMENT_TO_YPCT[placement];
      requestPreview(selectedSentenceIndex, committedText, {
        placement,
        yPct,
        immediate: true,
      });
    },
    [committedText, requestPreview, selectedSentenceIndex]
  );

  const persistPlacement = useCallback(
    async (placement: CaptionPlacement) => {
      if (persistInFlightRef.current) {
        pendingPlacementRef.current = placement;
        return;
      }

      persistInFlightRef.current = true;
      const yPct = PLACEMENT_TO_YPCT[placement];

      try {
        const res = await storyUpdateCaptionStyle({
          sessionId,
          overlayCaption: { placement, yPct },
        });
        if (!res.ok) {
          throw new Error(res?.message || "Failed to update caption placement");
        }
        lastPersistedPlacementRef.current = placement;
        lastPersistedYPctRef.current = yPct;
      } catch (error) {
        console.error("[story] update caption placement error:", error);
        const fallbackPlacement = lastPersistedPlacementRef.current ?? "center";
        pendingPlacementRef.current = null;
        setCaptionPlacement(fallbackPlacement);
        requestPlacementPreview(fallbackPlacement);
        showError("Failed to update caption placement. Please try again.");
        return;
      } finally {
        persistInFlightRef.current = false;
        const pending = pendingPlacementRef.current;
        if (pending && pending !== lastPersistedPlacementRef.current) {
          pendingPlacementRef.current = null;
          void persistPlacement(pending);
        } else {
          pendingPlacementRef.current = null;
        }
      }
    },
    [requestPlacementPreview, sessionId, showError]
  );

  const handlePlacementChange = useCallback(
    (nextPlacement: CaptionPlacement) => {
      if (selectedSentenceIndex === null || !committedText.trim()) return;
      if (prefetchTimeoutRef.current != null) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
      cancelPrefetch();
      setCaptionPlacement(nextPlacement);
      requestPlacementPreview(nextPlacement);
      void persistPlacement(nextPlacement);
    },
    [
      cancelPrefetch,
      committedText,
      persistPlacement,
      requestPlacementPreview,
      selectedSentenceIndex,
    ]
  );

  const resetPlacementPreviews = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
    prefetchDoneForSessionRef.current = null;
    resetPreviews();
  }, [resetPreviews]);

  return {
    captionPlacement,
    handlePlacementChange,
    isLoadingByIndex,
    previewByIndex,
    resetPlacementPreviews,
  };
}
