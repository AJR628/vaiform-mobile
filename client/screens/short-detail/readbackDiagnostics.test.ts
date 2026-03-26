import { describe, expect, test } from "@jest/globals";

import {
  buildLibraryFallbackHitDiagnostic,
  buildLibraryFallbackMissDiagnostic,
  buildLibraryFallbackReadbackContext,
  buildShortDetailManualRetryContext,
  buildShortDetailPendingDiagnostic,
  buildShortDetailReadbackContext,
  buildShortDetailRetryTimeoutDiagnostic,
  LIBRARY_FALLBACK_READBACK_STAGE,
  LIBRARY_FALLBACK_SURFACE,
  SHORT_DETAIL_MANUAL_RETRY_SURFACE,
  SHORT_DETAIL_READBACK_STAGE,
  SHORT_DETAIL_SURFACE,
} from "@/screens/short-detail/readbackDiagnostics";

describe("short-detail readback diagnostics", () => {
  test("builds canonical short-detail pending diagnostics", () => {
    expect(
      buildShortDetailPendingDiagnostic({
        shortId: "short-123",
        retryAttempt: 2,
        requestId: "request-1",
      }),
    ).toEqual({
      route: "/api/shorts/short-123",
      status: 404,
      code: "DETAIL_PENDING_RETRY",
      message: "Short detail returned 404 during retry window.",
      requestId: "request-1",
      context: {
        shortId: "short-123",
        retryAttempt: 2,
        stage: SHORT_DETAIL_READBACK_STAGE,
        surface: SHORT_DETAIL_SURFACE,
      },
    });
  });

  test("builds canonical library fallback hit and miss diagnostics with request correlation", () => {
    expect(
      buildLibraryFallbackHitDiagnostic({
        shortId: "short-456",
        retryAttempt: 0,
        requestId: "request-hit",
      }),
    ).toEqual({
      route: "/api/shorts/short-456",
      code: "LIBRARY_FALLBACK_HIT",
      message: "Recovered short from library fallback.",
      requestId: "request-hit",
      context: {
        shortId: "short-456",
        retryAttempt: 0,
        stage: LIBRARY_FALLBACK_READBACK_STAGE,
        surface: LIBRARY_FALLBACK_SURFACE,
      },
    });

    expect(
      buildLibraryFallbackMissDiagnostic({
        shortId: "short-456",
        retryAttempt: 1,
        requestId: "request-miss",
      }),
    ).toEqual({
      route: "/api/shorts/short-456",
      code: "LIBRARY_FALLBACK_MISS",
      message: "Library fallback did not find the short yet.",
      requestId: "request-miss",
      context: {
        shortId: "short-456",
        retryAttempt: 1,
        stage: LIBRARY_FALLBACK_READBACK_STAGE,
        surface: LIBRARY_FALLBACK_SURFACE,
      },
    });
  });

  test("builds canonical readback contexts for enrichFailureDiagnostic", () => {
    expect(
      buildShortDetailReadbackContext({
        shortId: "short-789",
        retryAttempt: 3,
      }),
    ).toEqual({
      shortId: "short-789",
      retryAttempt: 3,
      stage: SHORT_DETAIL_READBACK_STAGE,
      surface: SHORT_DETAIL_SURFACE,
    });

    expect(
      buildLibraryFallbackReadbackContext({
        shortId: "short-789",
        retryAttempt: 4,
      }),
    ).toEqual({
      shortId: "short-789",
      retryAttempt: 4,
      stage: LIBRARY_FALLBACK_READBACK_STAGE,
      surface: LIBRARY_FALLBACK_SURFACE,
    });
  });

  test("builds canonical timeout and manual retry contexts", () => {
    expect(
      buildShortDetailRetryTimeoutDiagnostic({
        shortId: "short-timeout",
        retryAttempts: 7,
        requestId: "request-timeout",
      }),
    ).toEqual({
      route: "/api/shorts/short-timeout",
      status: 404,
      code: "DETAIL_RETRY_TIMEOUT",
      message: "Short detail retry window exhausted.",
      requestId: "request-timeout",
      context: {
        shortId: "short-timeout",
        retryAttempts: 7,
        stage: SHORT_DETAIL_READBACK_STAGE,
        surface: SHORT_DETAIL_SURFACE,
      },
    });

    expect(
      buildShortDetailManualRetryContext({
        shortId: "short-timeout",
        retryCount: 1,
      }),
    ).toEqual({
      shortId: "short-timeout",
      retryCount: 1,
      stage: SHORT_DETAIL_READBACK_STAGE,
      surface: SHORT_DETAIL_MANUAL_RETRY_SURFACE,
    });
  });
});
