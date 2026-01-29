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

export function useCaptionPreview(
  _sessionId: string | undefined,
  selectedSentenceIndex: number | null
) {
  const [previewByIndex, setPreviewByIndex] = useState<Record<number, string | null>>({});
  const [isLoadingByIndex, setIsLoadingByIndex] = useState<Record<number, boolean>>({});

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const abortControllersRef = useRef<Record<number, AbortController>>({});

  const requestPreview = useCallback(
    (
      sentenceIndex: number,
      text: string,
      options: UseCaptionPreviewOptions = {}
    ) => {
      const { placement = "center", style } = options;
      const trimmed = text?.trim() ?? "";
      const cacheKey = hashStyleAndText(style, placement, trimmed);

      // Check cache (TTL 60s)
      const now = Date.now();
      const cached = cacheRef.current.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        setPreviewByIndex((prev) => ({ ...prev, [sentenceIndex]: cached.rasterUrl }));
        return;
      }

      // Debounce: clear existing timer for this beat
      const existingTimer = debounceTimersRef.current[sentenceIndex];
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimersRef.current[sentenceIndex] = undefined;
      }

      debounceTimersRef.current[sentenceIndex] = setTimeout(() => {
        debounceTimersRef.current[sentenceIndex] = undefined;

        // Abort previous in-flight request for this beat
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

        captionPreview(body, { signal: controller.signal, timeoutMs: 10_000 })
          .then((result) => {
            if (controller.signal.aborted) return;
            if (!result.ok || !result.data?.meta?.rasterUrl) {
              setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
              return;
            }
            const rasterUrl = result.data.meta.rasterUrl as string;
            cacheRef.current.set(cacheKey, {
              rasterUrl,
              expiresAt: now + CACHE_TTL_MS,
            });
            setPreviewByIndex((prev) => ({ ...prev, [sentenceIndex]: rasterUrl }));
            setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setIsLoadingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
            }
          });
      }, DEBOUNCE_MS);
    },
    []
  );

  return {
    previewByIndex,
    isLoadingByIndex,
    requestPreview,
  };
}
