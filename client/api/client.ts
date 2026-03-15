import { auth } from "@/lib/firebase";
import type { StorySession, StoryFinalizeResponse } from "@/types/story";

// Normalize base URL to remove trailing slash (prevents double slashes in paths).
const apiBaseUrlEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
if (!apiBaseUrlEnv) {
  throw new Error("Missing required EXPO_PUBLIC_API_BASE_URL");
}
const API_BASE_URL = apiBaseUrlEnv.replace(/\/$/, "");

const API_LOG =
  __DEV__ && (process.env.EXPO_PUBLIC_API_LOG === "1");

let cachedIdToken: string | null = null;
let tokenExpirationTime: number = 0;

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    cachedIdToken = null;
    return null;
  }

  const now = Date.now();
  if (cachedIdToken && tokenExpirationTime > now + 60000) {
    return cachedIdToken;
  }

  try {
    cachedIdToken = await user.getIdToken(true);
    tokenExpirationTime = now + 3600000;
    return cachedIdToken;
  } catch (error) {
    console.error("Failed to get ID token:", error);
    cachedIdToken = null;
    return null;
  }
}

export function clearTokenCache(): void {
  cachedIdToken = null;
  tokenExpirationTime = 0;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  /** When provided, passed to fetch for request cancellation (e.g. per-beat caption preview). */
  signal?: AbortSignal;
}

export interface ApiError {
  status: number;
  message: string;
  isAuthError: boolean;
  isRateLimited: boolean;
  isServerError: boolean;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  );
}

// -----------------------------------------------------------------------------
// Normalized response types
// -----------------------------------------------------------------------------

export interface NormalizedSuccess<T> {
  ok: true;
  data: T;
  requestId: string | null;
}

export interface NormalizedError {
  ok: false;
  status: number;
  code: string;
  message: string;
  requestId: string | null;
}

export type NormalizedResponse<T> = NormalizedSuccess<T> | NormalizedError;

function getEnvelopeRequestId(
  obj: Record<string, unknown>,
  fallback: string | null
): string | null {
  if (typeof obj.requestId === "string") {
    return obj.requestId;
  }
  if (obj.requestId === null) {
    return null;
  }
  return fallback;
}

/**
 * Normalize API responses that use either { success: true, data } or { ok: true } envelopes.
 * - If success:true and data exists => return data
 * - If success:true and NO data => return whole object as data (defensive fallback for non-standard success payloads)
 * - Handle ok:true pattern if encountered
 */
export function normalizeResponse<T>(
  json: unknown,
  status: number,
  requestIdFallback: string | null = null
): NormalizedResponse<T> {
  if (typeof json !== "object" || json === null) {
    return {
      ok: false,
      status,
      code: "INVALID_RESPONSE",
      message: "Invalid response format",
      requestId: requestIdFallback,
    };
  }

  const obj = json as Record<string, unknown>;
  const requestId = getEnvelopeRequestId(obj, requestIdFallback);

  // Handle success:true envelope
  if (obj.success === true) {
    const data = obj.data !== undefined ? obj.data : obj;
    return { ok: true, data: data as T, requestId };
  }

  // Handle ok:true envelope
  if (obj.ok === true) {
    const data = obj.data !== undefined ? obj.data : obj;
    return { ok: true, data: data as T, requestId };
  }

  const code = (obj.code || obj.error || "UNKNOWN_ERROR") as string;
  const message = (obj.message || obj.detail || "Unknown error") as string;
  return { ok: false, status, code, message, requestId };
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, requireAuth = true, signal } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client": "mobile",
    ...headers,
  };

  let hasAuthHeader = false;
  if (requireAuth) {
    const idToken = await getIdToken();
    if (idToken) {
      requestHeaders["Authorization"] = `Bearer ${idToken}`;
      hasAuthHeader = true;
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const isCaptionPreview = endpoint.includes("/api/caption/preview");
  const shouldLog = API_LOG && !isCaptionPreview;
  if (shouldLog) {
    console.log(`[api] ${method} ${endpoint} ${response.status} hasAuthHeader=${hasAuthHeader}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const apiError: ApiError = {
      status: response.status,
      message: errorText || response.statusText,
      isAuthError: response.status === 401,
      isRateLimited: response.status === 429,
      isServerError: response.status >= 500,
    };
    throw apiError;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text() as unknown as T;
}

/**
 * Make an API request and return a normalized response.
 * Does not throw on HTTP errors; instead returns { ok: false, ... }
 */
export async function apiRequestNormalized<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<NormalizedResponse<T>> {
  const { method = "GET", body, headers = {}, requireAuth = true, signal } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client": "mobile",
    ...headers,
  };

  let hasAuthHeader = false;
  if (requireAuth) {
    const idToken = await getIdToken();
    if (idToken) {
      requestHeaders["Authorization"] = `Bearer ${idToken}`;
      hasAuthHeader = true;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const responseRequestId = response.headers.get("x-request-id");
    const contentType = response.headers.get("content-type");
    let json: unknown = null;
    if (contentType && contentType.includes("application/json")) {
      json = await response.json();
    } else {
      const text = await response.text();
      json = { message: text };
    }

    const normalized = normalizeResponse<T>(json, response.status, responseRequestId);
    const isCaptionPreview = endpoint.includes("/api/caption/preview");
    const shouldLog = API_LOG && !isCaptionPreview;
    if (shouldLog) {
      console.log(
        `[api] ${method} ${endpoint} ${response.status} requestId=${normalized.requestId ?? "n/a"} hasAuthHeader=${hasAuthHeader}`
      );
    }

    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, status: 0, code: "NETWORK_ERROR", message, requestId: null };
  }
}

export async function healthCheck(): Promise<unknown> {
  return apiRequest("/health", { requireAuth: false });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UserProfile {
  uid: string;
  email: string;
  plan: string;
  freeShortsUsed: number;
}

export interface UsageMembership {
  status: string;
  kind: string;
  billingCadence: string;
  startedAt: string | null;
  expiresAt: string | null;
  canceledAt: string | null;
}

export interface UsageLedger {
  billingUnit: "sec";
  periodStartAt: string | null;
  periodEndAt: string | null;
  cycleIncludedSec: number;
  cycleUsedSec: number;
  cycleReservedSec: number;
  availableSec: number;
}

export interface UsageSnapshot {
  plan: string;
  membership: UsageMembership;
  usage: UsageLedger;
}

export interface ShortBilling {
  estimatedSec?: number;
  billedSec?: number;
  settledAt?: string;
  source?: string;
}

export interface ShortItem {
  id: string;
  ownerId: string;
  status: string;
  videoUrl?: string;
  thumbUrl?: string;
  coverImageUrl?: string;
  durationSec?: number;
  quoteText?: string;
  template?: string;
  mode?: string;
  voiceover?: string;
  captionMode?: string;
  watermark?: boolean;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

export interface ShortsListResponse {
  items: ShortItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ShortDetail {
  id: string;
  videoUrl?: string;
  coverImageUrl?: string;
  durationSec?: number;
  usedTemplate?: string;
  usedQuote?: {
    text?: string;
    author?: string;
  };
  billing?: ShortBilling;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Caption preview (server-measured flow)
// -----------------------------------------------------------------------------

/** Style whitelist for caption preview: typography, color/effects, layout only. */
export interface CaptionPreviewStyle {
  fontFamily?: string;
  fontPx?: number;
  weightCss?: string;
  fontStyle?: string;
  letterSpacingPx?: number;
  lineSpacingPx?: number;
  textAlign?: string;
  textTransform?: string;
  color?: string;
  opacity?: number;
  strokePx?: number;
  strokeColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  wPct?: number;
  internalPaddingPx?: number;
  internalPadding?: number;
  rasterPadding?: number;
}

export interface StoryOverlayCaptionStyle extends CaptionPreviewStyle {
  placement?: "top" | "center" | "bottom";
  yPct?: number;
}

/** Server-measured request body: text + placement or yPct, optional style. No geometry. */
export interface CaptionPreviewRequestBody {
  ssotVersion: 3;
  mode: "raster";
  measure: "server";
  text: string;
  placement?: "top" | "center" | "bottom";
  yPct?: number;
  style?: CaptionPreviewStyle;
  frameW?: number;
  frameH?: number;
}

/** Meta returned by server; use keys verbatim (rasterUrl, rasterW, rasterH, etc.). */
export interface CaptionPreviewMeta {
  rasterUrl: string;
  rasterW?: number;
  rasterH?: number;
  yPx_png?: number;
  rasterPadding?: number;
  lines?: number;
  totalTextH?: number;
  [key: string]: unknown;
}

export interface CaptionPreviewData {
  imageUrl?: string | null;
  wPx?: number;
  hPx?: number;
  xPx?: number;
  meta: CaptionPreviewMeta;
}

const CAPTION_PREVIEW_STYLE_KEYS: (keyof CaptionPreviewStyle)[] = [
  "fontFamily", "fontPx", "weightCss", "fontStyle", "letterSpacingPx", "lineSpacingPx",
  "textAlign", "textTransform", "color", "opacity", "strokePx", "strokeColor",
  "shadowBlur", "shadowOffsetX", "shadowOffsetY", "shadowColor",
  "wPct", "internalPaddingPx", "internalPadding", "rasterPadding",
];

function extractStyleWhitelist(style: CaptionPreviewStyle | undefined): CaptionPreviewStyle | undefined {
  if (!style || typeof style !== "object") return undefined;
  const out: CaptionPreviewStyle = {};
  for (const k of CAPTION_PREVIEW_STYLE_KEYS) {
    if (style[k] !== undefined) (out as Record<string, unknown>)[k] = style[k];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Build server-measured caption preview payload (mobile). Only whitelisted style keys.
 */
export function buildCaptionPreviewPayload(params: {
  text: string;
  placement?: "top" | "center" | "bottom";
  yPct?: number;
  style?: CaptionPreviewStyle;
  frameW?: number;
  frameH?: number;
}): CaptionPreviewRequestBody {
  const { text, placement, yPct, style, frameW = 1080, frameH = 1920 } = params;
  const body: CaptionPreviewRequestBody = {
    ssotVersion: 3,
    mode: "raster",
    measure: "server",
    text: text.trim() || " ",
    frameW,
    frameH,
  };
  if (placement !== undefined) body.placement = placement;
  if (yPct !== undefined) body.yPct = yPct;
  const sanitized = extractStyleWhitelist(style);
  if (sanitized) body.style = sanitized;
  return body;
}

export interface CaptionPreviewOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * POST /api/caption/preview - server-measured caption preview. Returns data.meta.rasterUrl (base64 data URL).
 */
export async function captionPreview(
  body: CaptionPreviewRequestBody,
  options: CaptionPreviewOptions = {}
): Promise<NormalizedResponse<CaptionPreviewData>> {
  const { signal, timeoutMs = 10_000 } = options;
  let effectiveSignal: AbortSignal | undefined = signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0 || signal) {
    const controller = new AbortController();
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }
    effectiveSignal = controller.signal;
  }
  try {
    const result = await apiRequestNormalized<CaptionPreviewData>("/api/caption/preview", {
      method: "POST",
      body,
      requireAuth: true,
      signal: effectiveSignal,
    });
    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// -----------------------------------------------------------------------------
// Typed API functions
// -----------------------------------------------------------------------------

/**
 * POST /api/users/ensure - Create or fetch user profile (idempotent)
 */
export async function ensureUser(): Promise<NormalizedResponse<UserProfile>> {
  return apiRequestNormalized<UserProfile>("/api/users/ensure", {
    method: "POST",
    requireAuth: true,
  });
}

/**
 * GET /api/usage - Fetch canonical billing usage from the standard success envelope
 */
export async function getUsage(): Promise<NormalizedResponse<UsageSnapshot>> {
  return apiRequestNormalized<UsageSnapshot>("/api/usage", {
    method: "GET",
    requireAuth: true,
  });
}

/**
 * GET /api/shorts/mine - Fetch user's shorts library
 * @param cursor - ISO timestamp from previous response's nextCursor
 * @param limit - Number of items to fetch (default 24, max 100)
 */
export async function getMyShorts(
  cursor?: string,
  limit: number = 24
): Promise<NormalizedResponse<ShortsListResponse>> {
  let endpoint = `/api/shorts/mine?limit=${limit}`;
  if (cursor) {
    endpoint += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return apiRequestNormalized<ShortsListResponse>(endpoint, {
    method: "GET",
    requireAuth: true,
  });
}

/**
 * GET /api/shorts/:id - Fetch short detail
 * Note: List item key is `id`, not `jobId`
 * Returns 404 if not ready
 */
export async function getShortDetail(
  id: string
): Promise<NormalizedResponse<ShortDetail>> {
  return apiRequestNormalized<ShortDetail>(`/api/shorts/${id}`, {
    method: "GET",
    requireAuth: true,
  });
}

// -----------------------------------------------------------------------------
// Story API functions
// -----------------------------------------------------------------------------

/**
 * POST /api/story/start - Create new story session
 */
export async function storyStart(body: {
  input: string;
  inputType?: "link" | "idea" | "paragraph";
  styleKey?: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/start", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/generate - Generate script from input
 */
export async function storyGenerate(body: {
  sessionId: string;
  input?: string;
  inputType?: "link" | "idea" | "paragraph";
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/generate", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/plan - Generate visual shot plan
 */
export async function storyPlan(body: {
  sessionId: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/plan", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/search - Search clips for all shots
 */
export async function storySearchAll(body: {
  sessionId: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/search", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * GET /api/story/:sessionId - Get session state
 */
export async function storyGet(
  sessionId: string
): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>(`/api/story/${sessionId}`, {
    method: "GET",
    requireAuth: true,
  });
}

/**
 * POST /api/story/estimate - Refresh billing estimate at render intent
 */
export async function storyEstimate(body: {
  sessionId: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/estimate", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/update-beat-text - Edit single beat text
 */
export async function storyUpdateBeatText(body: {
  sessionId: string;
  sentenceIndex: number;
  text: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/update-beat-text", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/delete-beat - Delete beat (sentence + shot). Response is { sentences, shots } per spec; client refetches via storyGet for SSOT.
 */
export async function storyDeleteBeat(body: {
  sessionId: string;
  sentenceIndex: number;
}): Promise<NormalizedResponse<{ sentences: string[]; shots: any[] }>> {
  return apiRequestNormalized<{ sentences: string[]; shots: any[] }>(
    "/api/story/delete-beat",
    {
      method: "POST",
      body,
      requireAuth: true,
    }
  );
}

/**
 * POST /api/story/search-shot - Search clips for single shot
 */
export async function storySearchShot(body: {
  sessionId: string;
  sentenceIndex: number;
  query?: string;
  page?: number;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/search-shot", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/update-shot - Swap selected clip for shot
 */
export async function storyUpdateShot(body: {
  sessionId: string;
  sentenceIndex: number;
  clipId: string;
}): Promise<NormalizedResponse<StorySession>> {
  return apiRequestNormalized<StorySession>("/api/story/update-shot", {
    method: "POST",
    body,
    requireAuth: true,
  });
}

/**
 * POST /api/story/update-caption-style - Persist caption overlay style for session
 */
export async function storyUpdateCaptionStyle(body: {
  sessionId: string;
  overlayCaption: StoryOverlayCaptionStyle;
}): Promise<NormalizedResponse<{ overlayCaption?: StoryOverlayCaptionStyle }>> {
  return apiRequestNormalized<{ overlayCaption?: StoryOverlayCaptionStyle }>(
    "/api/story/update-caption-style",
    {
      method: "POST",
      body,
      requireAuth: true,
    }
  );
}

/**
 * POST /api/story/finalize - Render final video (blocking, 2-10 minutes)
 * Special handling: extracts shortId from top-level response and retryAfter from 503 headers
 */
export async function storyFinalize(
  body: {
    sessionId: string;
  },
  options: {
    idempotencyKey: string;
  }
): Promise<NormalizedResponse<StorySession> & { shortId?: string | null; retryAfter?: number }> {
  const idempotencyKey = options.idempotencyKey?.trim();
  if (!idempotencyKey) {
    throw new Error("storyFinalize requires a non-empty idempotencyKey option");
  }

  const url = `${API_BASE_URL}/api/story/finalize`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client": "mobile",
    "X-Idempotency-Key": idempotencyKey,
  };

  const idToken = await getIdToken();
  if (idToken) {
    requestHeaders["Authorization"] = `Bearer ${idToken}`;
  }

  try {
    // 15-minute timeout using AbortController (works consistently across platforms)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900_000); // 15 minutes

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return {
          ok: false,
          status: 0,
          code: "TIMEOUT",
          message: "Request timed out after 15 minutes",
          requestId: null,
        };
      }
      throw fetchError;
    }

    const responseRequestId = response.headers.get("x-request-id");
    const contentType = response.headers.get("content-type");
    let json: unknown = null;
    if (contentType && contentType.includes("application/json")) {
      json = await response.json();
    } else {
      const text = await response.text();
      json = { message: text };
    }

    // Extract retryAfter from header if 503
    let retryAfter: number | undefined;
    if (response.status === 503) {
      const retryAfterHeader = response.headers.get("Retry-After");
      if (retryAfterHeader) {
        retryAfter = parseInt(retryAfterHeader, 10);
      }
    }

    const normalized = normalizeResponse<StorySession>(json, response.status, responseRequestId);

    if (API_LOG) {
      console.log(
        `[api] POST /api/story/finalize ${response.status} requestId=${normalized.requestId ?? "n/a"}`
      );
    }

    let shortId: string | null | undefined;
    if (typeof json === "object" && json !== null) {
      const rawResponse = json as StoryFinalizeResponse;
      if (rawResponse.success === true && rawResponse.shortId !== undefined) {
        shortId = rawResponse.shortId;
      }
      // Also check body.retryAfter if header wasn't available
      if (retryAfter === undefined && rawResponse.retryAfter !== undefined) {
        retryAfter = rawResponse.retryAfter;
      }
    }

    return {
      ...normalized,
      shortId,
      retryAfter,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message,
      requestId: null,
    };
  }
}
