// client/lib/storySession.ts
// Shared helpers for working with StorySession responses.
// SSOT: keep response unwrapping and beat extraction in one place.

import type { StorySession, StoryShot } from "@/types/story";

export interface StoryBeat {
  sentenceIndex: number;
  text: string;
}

/**
 * Unwrap payload from the app's NormalizedResponse shape.
 * apiRequestNormalized returns: { ok: true, data: T }
 */
export function unwrapNormalized<T = unknown>(res: unknown): T {
  // Prefer normalized shape first (apiRequestNormalized returns { ok: true, data: T })
  if (
    typeof res === "object" &&
    res !== null &&
    "data" in res &&
    (res as { ok?: boolean; success?: boolean }).ok === true
  ) {
    return (res as { data: T }).data;
  }
  if (
    typeof res === "object" &&
    res !== null &&
    "data" in res &&
    (res as { ok?: boolean; success?: boolean }).success === true
  ) {
    return (res as { data: T }).data;
  }
  // Some wrappers return payload directly (defensive fallback)
  return res as T;
}

/**
 * Extract beats from session with defensive checks.
 * Expected path: session.story.sentences: string[]
 */
export function extractBeats(session: StorySession | null | undefined): StoryBeat[] {
  if (!session) return [];
  if (Array.isArray(session?.story?.sentences)) {
    return session.story.sentences.map((text, index) => ({
      sentenceIndex: index,
      text: typeof text === "string" ? text : String(text),
    }));
  }
  return [];
}

/**
 * Get shot for a given sentenceIndex from session.
 */
export function getSelectedShot(
  session: StorySession | null | undefined,
  sentenceIndex: number,
): StoryShot | null {
  if (!session?.shots) return null;
  return Array.isArray(session.shots)
    ? session.shots.find((shot) => shot?.sentenceIndex === sentenceIndex) || null
    : null;
}
