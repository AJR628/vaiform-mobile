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

  if (requireAuth) {
    const idToken = await getIdToken();
    if (idToken) {
      requestHeaders["Authorization"] = `Bearer ${idToken}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

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

export async function healthCheck(): Promise<unknown> {
  return apiRequest("/health", { requireAuth: false });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
