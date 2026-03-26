export const SHORT_DETAIL_READBACK_STAGE = "short_detail_readback";
export const LIBRARY_FALLBACK_READBACK_STAGE = "library_fallback_readback";

export const SHORT_DETAIL_SURFACE = "short_detail";
export const LIBRARY_FALLBACK_SURFACE = "library_fallback";
export const SHORT_DETAIL_MANUAL_RETRY_SURFACE = "short_detail_manual_retry";

export function buildShortDetailReadbackContext({
  shortId,
  retryAttempt,
}: {
  shortId: string;
  retryAttempt: number;
}) {
  return {
    shortId,
    retryAttempt,
    stage: SHORT_DETAIL_READBACK_STAGE,
    surface: SHORT_DETAIL_SURFACE,
  };
}

export function buildLibraryFallbackReadbackContext({
  shortId,
  retryAttempt,
}: {
  shortId: string;
  retryAttempt: number;
}) {
  return {
    shortId,
    retryAttempt,
    stage: LIBRARY_FALLBACK_READBACK_STAGE,
    surface: LIBRARY_FALLBACK_SURFACE,
  };
}

export function buildShortDetailPendingDiagnostic({
  shortId,
  retryAttempt,
  requestId,
}: {
  shortId: string;
  retryAttempt: number;
  requestId: string | null;
}) {
  return {
    route: `/api/shorts/${shortId}`,
    status: 404,
    code: "DETAIL_PENDING_RETRY",
    message: "Short detail returned 404 during retry window.",
    requestId,
    context: buildShortDetailReadbackContext({
      shortId,
      retryAttempt,
    }),
  };
}

export function buildLibraryFallbackHitDiagnostic({
  shortId,
  retryAttempt,
  requestId,
}: {
  shortId: string;
  retryAttempt: number;
  requestId: string | null;
}) {
  return {
    route: `/api/shorts/${shortId}`,
    code: "LIBRARY_FALLBACK_HIT",
    message: "Recovered short from library fallback.",
    requestId,
    context: buildLibraryFallbackReadbackContext({
      shortId,
      retryAttempt,
    }),
  };
}

export function buildLibraryFallbackMissDiagnostic({
  shortId,
  retryAttempt,
  requestId,
}: {
  shortId: string;
  retryAttempt: number;
  requestId: string | null;
}) {
  return {
    route: `/api/shorts/${shortId}`,
    code: "LIBRARY_FALLBACK_MISS",
    message: "Library fallback did not find the short yet.",
    requestId,
    context: buildLibraryFallbackReadbackContext({
      shortId,
      retryAttempt,
    }),
  };
}

export function buildShortDetailRetryTimeoutDiagnostic({
  shortId,
  retryAttempts,
  requestId,
}: {
  shortId: string;
  retryAttempts: number;
  requestId: string | null;
}) {
  return {
    route: `/api/shorts/${shortId}`,
    status: 404,
    code: "DETAIL_RETRY_TIMEOUT",
    message: "Short detail retry window exhausted.",
    requestId,
    context: {
      shortId,
      retryAttempts,
      stage: SHORT_DETAIL_READBACK_STAGE,
      surface: SHORT_DETAIL_SURFACE,
    },
  };
}

export function buildShortDetailManualRetryContext({
  shortId,
  retryCount,
}: {
  shortId: string;
  retryCount: number;
}) {
  return {
    shortId,
    retryCount,
    stage: SHORT_DETAIL_READBACK_STAGE,
    surface: SHORT_DETAIL_MANUAL_RETRY_SURFACE,
  };
}
