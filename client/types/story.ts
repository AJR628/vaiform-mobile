// Minimal story types - structure will be refined in later phases

/**
 * Story session type (placeholder - will be typed properly later)
 */
export type StorySession = any;

/**
 * Finalize response success data
 */
export interface StoryFinalizeSuccess {
  url: string;
  durationSec: number;
  jobId: string;
}

export interface StoryFinalizeEnvelopeMeta {
  state?: "pending" | string;
  attemptId?: string | null;
  pollSessionId?: string | null;
}

/**
 * Full finalize response shape (before normalization)
 * Includes shortId at top level and retryAfter for 503 errors
 */
export interface StoryFinalizeResponse {
  success: boolean;
  data?: {
    id: string;
    status: "rendered";
    finalVideo: StoryFinalizeSuccess;
  };
  shortId?: string | null;
  finalize?: StoryFinalizeEnvelopeMeta;
  error?: string;
  detail?: string;
  retryAfter?: number;
}
