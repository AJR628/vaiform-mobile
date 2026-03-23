import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getMyShorts, getShortDetail, type ShortDetail, type ShortItem } from "@/api/client";
import {
  enrichFailureDiagnostic,
  recordClientDiagnostic,
} from "@/lib/diagnostics";

import { adaptShortDetailToShortItem } from "./model";

interface UseShortDetailAvailabilityOptions {
  navigation: any;
  shortId?: string | null;
  shortParam?: ShortItem | null;
  showError: (message: string) => void;
}

export function useShortDetailAvailability({
  navigation,
  shortId,
  shortParam,
  showError,
}: UseShortDetailAvailabilityOptions) {
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shortDetail, setShortDetail] = useState<ShortDetail | null>(null);
  const [isPendingAvailability, setIsPendingAvailability] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [didRetryTimeout, setDidRetryTimeout] = useState(false);

  const escapeHatchRanRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const fallbackInFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!shortParam && !shortId && !escapeHatchRanRef.current) {
      escapeHatchRanRef.current = true;
      console.error("[shorts] ShortDetail requires either short or shortId param - navigating back");
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        const tabNavigator = navigation.getParent();
        if (tabNavigator) {
          tabNavigator.navigate("LibraryTab", { screen: "Library" });
        }
      }
    }
  }, [navigation, shortId, shortParam]);

  useEffect(() => {
    if (!shortId || shortParam) return;

    const RETRY_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 13000, 21000];
    const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

    if (isMountedRef.current) {
      setIsLoadingDetail(true);
      setIsPendingAvailability(false);
      setRetryAttempt(0);
      setDidRetryTimeout(false);
      setShortDetail(null);
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let cancelled = false;

    const attemptFetch = async (attemptIndex: number) => {
      if (cancelled || !isMountedRef.current) return;

      if (__DEV__) {
        console.log(
          `[ShortDetail] attempt ${attemptIndex + 1}/${MAX_ATTEMPTS} shortId=${shortId}`
        );
      }

      const result = await getShortDetail(shortId);

      if (cancelled || !isMountedRef.current) return;

      if (!result.ok) {
        enrichFailureDiagnostic(
          {
            route: `/api/shorts/${shortId}`,
            requestId: result.requestId,
            status: result.status,
            code: result.code,
          },
          {
            shortId,
            retryAttempt: attemptIndex,
            stage: "detail_fetch",
          }
        );
      }

      if (result.ok && result.data) {
        if (isMountedRef.current) {
          setShortDetail(result.data);
          setIsPendingAvailability(false);
          setDidRetryTimeout(false);
          setIsLoadingDetail(false);
          setRetryAttempt(0);
          setRetryCount(0);
        }

        if (__DEV__ && attemptIndex > 0) {
          console.log(
            `[ShortDetail] available after ${attemptIndex + 1} attempts shortId=${shortId}`
          );
        }
        return;
      }

      if (!result.ok && result.status === 404) {
        recordClientDiagnostic({
          route: `/api/shorts/${shortId}`,
          status: result.status,
          code: "DETAIL_PENDING_RETRY",
          message: "Short detail returned 404 during retry window.",
          requestId: result.requestId,
          context: {
            shortId,
            retryAttempt: attemptIndex,
          },
        });
        if (isMountedRef.current) {
          setIsPendingAvailability(true);
          setRetryAttempt(attemptIndex);
          setIsLoadingDetail(true);
        }

        if (attemptIndex % 2 === 0 && attemptIndex <= 4) {
          const tryLibraryFallback = async () => {
            if (fallbackInFlightRef.current || cancelled || !isMountedRef.current || !shortId) {
              return;
            }

            fallbackInFlightRef.current = true;

            try {
              const listResult = await getMyShorts(undefined, 50);
              if (cancelled || !isMountedRef.current) return;

              if (!listResult.ok) {
                enrichFailureDiagnostic(
                  {
                    route: "/api/shorts/mine?limit=50",
                    requestId: listResult.requestId,
                    status: listResult.status,
                    code: listResult.code,
                  },
                  {
                    shortId,
                    retryAttempt: attemptIndex,
                    stage: "library_fallback",
                  }
                );
              }

              if (listResult.ok && listResult.data?.items) {
                const foundShort = listResult.data.items.find(
                  (item) => item.id === shortId && item.status === "ready" && item.videoUrl
                );

                if (foundShort) {
                  recordClientDiagnostic({
                    route: `/api/shorts/${shortId}`,
                    code: "LIBRARY_FALLBACK_HIT",
                    message: "Recovered short from library fallback.",
                    context: {
                      shortId,
                      retryAttempt: attemptIndex,
                    },
                  });
                  if (isMountedRef.current) {
                    setIsPendingAvailability(false);
                    setDidRetryTimeout(false);
                    setIsLoadingDetail(false);
                    setRetryAttempt(0);
                    navigation.setParams({ short: foundShort, shortId: undefined });

                    if (__DEV__) {
                      console.log(
                        `[ShortDetail] fallback success: found short in library list on attempt ${attemptIndex + 1}, id=${shortId}`
                      );
                    }
                  }
                  return;
                }
              }

              recordClientDiagnostic({
                route: `/api/shorts/${shortId}`,
                code: "LIBRARY_FALLBACK_MISS",
                message: "Library fallback did not find the short yet.",
                context: {
                  shortId,
                  retryAttempt: attemptIndex,
                },
              });
              if (__DEV__) {
                console.log(
                  `[ShortDetail] fallback attempt ${attemptIndex + 1}: short not found in library list yet, shortId=${shortId}`
                );
              }
            } catch (error) {
              if (__DEV__) {
                console.error(
                  `[ShortDetail] fallback error on attempt ${attemptIndex + 1}:`,
                  error
                );
              }
            } finally {
              fallbackInFlightRef.current = false;
            }
          };

          void tryLibraryFallback();
        }

        if (attemptIndex >= MAX_ATTEMPTS - 1) {
          recordClientDiagnostic({
            route: `/api/shorts/${shortId}`,
            status: result.status,
            code: "DETAIL_RETRY_TIMEOUT",
            message: "Short detail retry window exhausted.",
            requestId: result.requestId,
            context: {
              shortId,
              retryAttempts: MAX_ATTEMPTS,
            },
          });
          if (isMountedRef.current) {
            setDidRetryTimeout(true);
            setIsLoadingDetail(false);
          }

          if (__DEV__) {
            console.log(
              `[ShortDetail] timeout after ${MAX_ATTEMPTS} attempts shortId=${shortId}`
            );
          }
          return;
        }

        const delay = RETRY_DELAYS_MS[attemptIndex];
        retryTimeoutRef.current = setTimeout(() => {
          if (!cancelled && isMountedRef.current) {
            void attemptFetch(attemptIndex + 1);
          }
          retryTimeoutRef.current = null;
        }, delay);
        return;
      }

      if (isMountedRef.current) {
        setIsPendingAvailability(false);
        setDidRetryTimeout(false);
        setIsLoadingDetail(false);
        showError(!result.ok ? result.message || "Failed to load short details" : "Failed to load short details");
      }

      if (__DEV__) {
        console.log(
          `[ShortDetail] terminal error shortId=${shortId} status=${!result.ok ? result.status : "n/a"} code=${!result.ok ? result.code : "n/a"}`
        );
      }
    };

    void attemptFetch(0);

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      fallbackInFlightRef.current = false;
    };
  }, [navigation, shortId, shortParam, showError]);

  useEffect(() => {
    if (shortDetail && !shortDetail.videoUrl && shortId && retryCount < 2) {
      const delays = [600, 1200];
      const timeoutId = setTimeout(() => {
        console.log(`[shorts] Auto-retry ${retryCount + 1}/2 for missing videoUrl`);
        setRetryCount((prev) => prev + 1);
        getShortDetail(shortId)
          .then((result) => {
            if (result.ok && result.data) {
              setShortDetail(result.data);
            }
          })
          .catch((error) => {
            console.error("[shorts] retry fetch error:", error);
          });
      }, delays[retryCount]);
      return () => clearTimeout(timeoutId);
    }
  }, [retryCount, shortDetail, shortId]);

  const short = useMemo<ShortItem | null>(() => {
    if (shortParam) return shortParam;
    if (shortDetail) return adaptShortDetailToShortItem(shortDetail);
    return null;
  }, [shortDetail, shortParam]);

  const handleRetryFetch = useCallback(async () => {
    if (!shortId) return;
    setIsLoadingDetail(true);
    setRetryCount((prev) => prev + 1);
    try {
      const result = await getShortDetail(shortId);
      if (!result.ok) {
        enrichFailureDiagnostic(
          {
            route: `/api/shorts/${shortId}`,
            requestId: result.requestId,
            status: result.status,
            code: result.code,
          },
          {
            shortId,
            retryCount,
            stage: "manual_retry",
          }
        );
      }
      if (result.ok && result.data) {
        setShortDetail(result.data);
      } else {
        showError(result.ok ? "Failed to load short details" : result.message || "Failed to load short details");
      }
    } catch (error) {
      console.error("[shorts] retry fetch error:", error);
      showError("Failed to load short details");
    } finally {
      setIsLoadingDetail(false);
    }
  }, [retryCount, shortId, showError]);

  return {
    didRetryTimeout,
    handleRetryFetch,
    isLoadingDetail,
    isPendingAvailability,
    retryAttempt,
    retryCount,
    short,
    shortId,
    shortParam,
  };
}
