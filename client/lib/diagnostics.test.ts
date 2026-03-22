import { describe, expect, test } from "@jest/globals";

import {
  clearDiagnostics,
  enrichFailureDiagnostic,
  getRecentDiagnostics,
  recordApiFailure,
  recordClientDiagnostic,
} from "@/lib/diagnostics";

describe("client/lib/diagnostics", () => {
  test("records api failures with requestId and method", () => {
    const entry = recordApiFailure({
      route: "/api/usage",
      method: "GET",
      status: 503,
      code: "SERVER_BUSY",
      message: "Try again",
      requestId: "request-1",
    });

    expect(entry).toMatchObject({
      source: "api",
      route: "/api/usage",
      method: "GET",
      status: 503,
      code: "SERVER_BUSY",
      message: "Try again",
      requestId: "request-1",
    });
  });

  test("enriches the latest matching diagnostic in place", () => {
    recordClientDiagnostic({
      route: "/api/story/finalize",
      code: "NETWORK_ERROR",
      message: "Socket reset",
      requestId: "request-2",
      context: {
        sessionId: "session-1",
      },
    });

    const enriched = enrichFailureDiagnostic(
      {
        route: "/api/story/finalize",
        requestId: "request-2",
        code: "NETWORK_ERROR",
      },
      {
        attemptId: "attempt-1",
      },
    );

    expect(enriched.context).toEqual({
      sessionId: "session-1",
      attemptId: "attempt-1",
    });
  });

  test("creates a fallback diagnostic when no match exists", () => {
    const entry = enrichFailureDiagnostic(
      {
        route: "/api/story/session-1",
        code: "RECOVERY_PENDING",
      },
      {
        attemptId: "attempt-2",
      },
      {
        source: "client",
        route: "/api/story/session-1",
        status: 200,
        code: "RECOVERY_PENDING",
        message: "Still pending",
      },
    );

    expect(entry).toMatchObject({
      source: "client",
      route: "/api/story/session-1",
      status: 200,
      code: "RECOVERY_PENDING",
      message: "Still pending",
      context: {
        attemptId: "attempt-2",
      },
    });
  });

  test("keeps only the latest 50 diagnostics and returns defensive copies", () => {
    for (let index = 0; index < 60; index += 1) {
      recordClientDiagnostic({
        route: `/route-${index}`,
        code: `CODE_${index}`,
      });
    }

    const diagnostics = getRecentDiagnostics();
    expect(diagnostics).toHaveLength(50);
    expect(diagnostics[0].route).toBe("/route-10");

    diagnostics[0].context.extra = "mutated";
    expect(getRecentDiagnostics()[0].context.extra).toBeUndefined();
  });

  test("clears the diagnostic buffer", () => {
    recordClientDiagnostic({
      route: "/api/usage",
      code: "SERVER_BUSY",
    });

    clearDiagnostics();

    expect(getRecentDiagnostics()).toEqual([]);
  });
});
