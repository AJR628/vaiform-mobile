import { describe, expect, test, beforeEach, jest } from "@jest/globals";

import { auth } from "@/lib/firebase";
import {
  apiRequestNormalized,
  buildCaptionPreviewPayload,
  clearTokenCache,
  normalizeResponse,
  storyFinalize,
} from "@/api/client";

function mockJsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return {
    status: init?.status ?? 200,
    headers,
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
  };
}

describe("client/api/client", () => {
  beforeEach(() => {
    clearTokenCache();
    auth.currentUser = null;
  });

  test("normalizeResponse prefers body requestId over header fallback", () => {
    const result = normalizeResponse<{ ok: boolean }>(
      {
        success: true,
        data: { ok: true },
        requestId: "body-request-id",
      },
      200,
      "header-request-id",
    );

    expect(result).toEqual({
      ok: true,
      data: { ok: true },
      requestId: "body-request-id",
    });
  });

  test("normalizeResponse falls back to the response header requestId", () => {
    const result = normalizeResponse<{ ok: boolean }>(
      {
        success: true,
        data: { ok: true },
      },
      200,
      "header-request-id",
    );

    expect(result).toEqual({
      ok: true,
      data: { ok: true },
      requestId: "header-request-id",
    });
  });

  test("normalizeResponse reports invalid payloads as INVALID_RESPONSE", () => {
    expect(normalizeResponse("nope", 500, "request-id")).toEqual({
      ok: false,
      status: 500,
      code: "INVALID_RESPONSE",
      message: "Invalid response format",
      requestId: "request-id",
    });
  });

  test("buildCaptionPreviewPayload trims text, preserves placement, and whitelists style keys", () => {
    const payload = buildCaptionPreviewPayload({
      text: "  Hello world  ",
      placement: "bottom",
      yPct: 0.9,
      style: {
        fontPx: 42,
        color: "#fff",
        rasterPadding: 8,
        invalidKey: "ignored",
      } as any,
    });

    expect(payload).toEqual({
      ssotVersion: 3,
      mode: "raster",
      measure: "server",
      text: "Hello world",
      placement: "bottom",
      yPct: 0.9,
      frameW: 1080,
      frameH: 1920,
      style: {
        fontPx: 42,
        color: "#fff",
        rasterPadding: 8,
      },
    });
  });

  test("apiRequestNormalized adds auth and x-client headers and normalizes requestId from the response", async () => {
    auth.currentUser = {
      getIdToken: jest.fn(async () => "firebase-id-token"),
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse(
        {
          success: true,
          data: {
            plan: "creator",
          },
        },
        {
          status: 200,
          headers: { "x-request-id": "header-request-id" },
        },
      ),
    );

    const result = await apiRequestNormalized<{ plan: string }>("/api/usage", {
      method: "GET",
    });

    expect(result).toEqual({
      ok: true,
      data: { plan: "creator" },
      requestId: "header-request-id",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test.local/api/usage",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
          "x-client": "mobile",
        }),
      }),
    );
  });

  test("apiRequestNormalized returns NETWORK_ERROR on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("socket hang up"));

    const result = await apiRequestNormalized("/api/usage", { method: "GET" });

    expect(result).toEqual({
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message: "socket hang up",
      requestId: null,
    });
  });

  test("storyFinalize extracts finalize metadata, shortId, retryAfter, and idempotency header", async () => {
    auth.currentUser = {
      getIdToken: jest.fn(async () => "firebase-id-token"),
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse(
        {
          success: true,
          data: {
            id: "session-1",
          },
          shortId: "short-123",
          retryAfter: 15,
          finalize: {
            state: "pending",
            attemptId: "attempt-123",
            pollSessionId: "session-1",
          },
        },
        {
          status: 202,
          headers: {
            "x-request-id": "request-123",
          },
        },
      ),
    );

    const result = await storyFinalize(
      {
        sessionId: "session-1",
      },
      {
        idempotencyKey: "idem-123",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 202,
      requestId: "request-123",
      shortId: "short-123",
      retryAfter: 15,
      finalize: {
        state: "pending",
        attemptId: "attempt-123",
        pollSessionId: "session-1",
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test.local/api/story/finalize",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-id-token",
          "X-Idempotency-Key": "idem-123",
          "x-client": "mobile",
        }),
      }),
    );
  });

  test("storyFinalize returns TIMEOUT when the finalize request aborts", async () => {
    const abortError = new Error("Request aborted");
    abortError.name = "AbortError";
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    const result = await storyFinalize(
      {
        sessionId: "session-1",
      },
      {
        idempotencyKey: "idem-timeout",
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 0,
      code: "TIMEOUT",
      message: "Request timed out after 15 minutes",
      requestId: null,
      finalize: null,
    });
  });
});
