import { auth } from "@/lib/firebase";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://your-vaiform-backend.com";

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

// ─────────────────────────────────────────────────────────────────────────────
// Normalized response types
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedSuccess<T> {
  ok: true;
  data: T;
}

export interface NormalizedError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type NormalizedResponse<T> = NormalizedSuccess<T> | NormalizedError;

/**
 * Normalize API responses that use either { success: true, data } or { ok: true } envelopes.
 * - If success:true and data exists => return data
 * - If success:true and NO data => return whole object as data (for /credits where credits is top-level)
 * - Handle ok:true pattern if encountered
 */
export function normalizeResponse<T>(
  json: unknown,
  status: number
): NormalizedResponse<T> {
  if (typeof json !== "object" || json === null) {
    return { ok: false, status, code: "INVALID_RESPONSE", message: "Invalid response format" };
  }

  const obj = json as Record<string, unknown>;

  // Handle success:true envelope
  if (obj.success === true) {
    // If data field exists, return it; otherwise return whole object as data
    const data = obj.data !== undefined ? obj.data : obj;
    return { ok: true, data: data as T };
  }

  // Handle ok:true envelope
  if (obj.ok === true) {
    const data = obj.data !== undefined ? obj.data : obj;
    return { ok: true, data: data as T };
  }

  // Error response
  const code = (obj.code || obj.error || "UNKNOWN_ERROR") as string;
  const message = (obj.message || obj.detail || "Unknown error") as string;
  return { ok: false, status, code, message };
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, requireAuth = true } = options;

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
  });

  console.log(`[api] ${method} ${endpoint} ${response.status} hasAuthHeader=${hasAuthHeader}`);

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
  const { method = "GET", body, headers = {}, requireAuth = true } = options;

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
    });

    console.log(`[api] ${method} ${endpoint} ${response.status} hasAuthHeader=${hasAuthHeader}`);

    const contentType = response.headers.get("content-type");
    let json: unknown = null;
    if (contentType && contentType.includes("application/json")) {
      json = await response.json();
    } else {
      const text = await response.text();
      json = { message: text };
    }

    return normalizeResponse<T>(json, response.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, status: 0, code: "NETWORK_ERROR", message };
  }
}

export async function healthCheck(): Promise<unknown> {
  return apiRequest("/health", { requireAuth: false });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  plan: string;
  isMember: boolean;
  subscriptionStatus: string;
  credits: number;
  freeShortsUsed: number;
}

export interface CreditsResponse {
  uid: string;
  email: string;
  credits: number;
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
  credits?: {
    before?: number;
    after?: number;
    cost?: number;
  };
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed API functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/users/ensure - Create or fetch user profile (idempotent)
 */
export async function ensureUser(): Promise<NormalizedResponse<UserProfile>> {
  const result = await apiRequestNormalized<UserProfile>("/api/users/ensure", {
    method: "POST",
    requireAuth: true,
  });

  // Default plan to "free" if not provided
  if (result.ok && result.data && !result.data.plan) {
    result.data.plan = "free";
  }

  return result;
}

/**
 * GET /credits - Fetch current credits (credits is top-level in response)
 */
export async function getCredits(): Promise<NormalizedResponse<CreditsResponse>> {
  return apiRequestNormalized<CreditsResponse>("/credits", {
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
