import { useState, useRef, useCallback } from "react";
import {
  captionPreview,
  buildCaptionPreviewPayload,
  type CaptionPreviewStyle,
} from "@/api/client";

const DEBOUNCE_MS = 350;
const CACHE_TTL_MS = 60_000;

/** Deterministic cache key: style + placement + text. Do not rely on styleHash/wrapHash. */
function hashStyleAndText(
  style: CaptionPreviewStyle | undefined,
  placement: string | undefined,
  text: string
): string {
  const styleJson =
    style && typeof style === "object"
      ? JSON.stringify(style, Object.keys(style).sort())
      : "";
  return `${styleJson}|${placement ?? ""}|${text}`;
}

interface CacheEntry {
  rasterUrl: string;
  expiresAt: number;
}

export interface UseCaptionPreviewOptions {
  placement?: "top" | "center" | "bottom";
  style?: CaptionPreviewStyle;
}

export interface PrefetchBeat {
  sentenceIndex: number;
  text: string;
}

export function useCaptionPreview(
  _sessionId: string | undefined,
  selectedSentenceIndex: number | null
) {
  const [previewByIndex, setPreviewByIndex] = useState<Record<number, string | null>>({});
  const [isLoadingByIndex, setIsLoadingByIndex] = useState<Record<number, boolean>>({});

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const abortControllersRef = useRef<Record<number, AbortController>>({});

  const doOneRequest = useCallback(
    (
      sentenceIndex: number,
      text: string,
      options: UseCaptionPreviewOptions = {}
    ): Promise<void> => {
      const { placement = "center", style } = options;
      const trimmed = text?.trim() ?? "";
      const cacheKey = hashStyleAndText(style, placement, trimmed);

      const now = Date.now();
      const cached = cacheRef.current.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        setPreviewByIndex((prev) => {
          if (prev[sentenceIndex] === cached.rasterUrl) return prev;
          return { ...prev, [sentenceIndex]: cached.rasterUrl };
        });
        return Promise.resolve();
      }

      const prevController = abortControllersRef.current[sentenceIndex];
      if (prevController) {
        prevController.abort();
      }
      const controller = new AbortController();
      abortControllersRef.current[sentenceIndex] = controller;

      setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: true }));

      const body = buildCaptionPreviewPayload({
        text: trimmed || " ",
        placement,
        style,
        frameW: 1080,
        frameH: 1920,
      });

      return captionPreview(body, { signal: controller.signal, timeoutMs: 10_000 })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result.ok || !result.data?.meta?.rasterUrl) {
            setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
            return;
          }
          const rasterUrl = result.data.meta.rasterUrl as string;
          cacheRef.current.set(cacheKey, {
            rasterUrl,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          setPreviewByIndex((prev) => ({ ...prev, [sentenceIndex]: rasterUrl }));
          setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
          }
        });
    },
    []
  );

  const requestPreview = useCallback(
    (
      sentenceIndex: number,
      text: string,
      options: UseCaptionPreviewOptions = {}
    ) => {
      const trimmed = text?.trim() ?? "";

      const existingTimer = debounceTimersRef.current[sentenceIndex];
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current[sentenceIndex] = undefined;
      }

      debounceTimersRef.current[sentenceIndex] = setTimeout(() => {
        debounceTimersRef.current[sentenceIndex] = undefined;
        doOneRequest(sentenceIndex, trimmed, options);
      }, DEBOUNCE_MS);
    },
    [doOneRequest]
  );

  const prefetchAllBeats = useCallback(
    async (
      beats: PrefetchBeat[],
      opts?: { delayBetweenMs?: number }
    ): Promise<void> => {
      const delayBetweenMs = opts?.delayBetweenMs ?? 120;
      for (const beat of beats) {
        try {
          await doOneRequest(beat.sentenceIndex, beat.text, { placement: "center" });
        } catch {
          // continue to next beat
        }
        await new Promise((r) => setTimeout(r, delayBetweenMs));
      }
    },
    [doOneRequest]
  );

  return {
    previewByIndex,
    isLoadingByIndex,
    requestPreview,
    prefetchAllBeats,
  };
}
