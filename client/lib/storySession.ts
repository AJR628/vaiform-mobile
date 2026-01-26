// client/lib/storySession.ts
// Shared helpers for working with StorySession responses.
// SSOT: keep response unwrapping and beat extraction in one place.

export interface StoryBeat {
  sentenceIndex: number;
  text: string;
}

/**
 * Unwrap payload from the app's NormalizedResponse shape.
 * apiRequestNormalized returns: { ok: true, data: T }
 */
export function unwrapNormalized<T = any>(res: any): T {
  // Prefer normalized shape first (apiRequestNormalized returns { ok: true, data: T })
  if (res?.data && (res?.ok === true || res?.success === true)) return res.data as T;
  // Some wrappers return payload directly (defensive fallback)
  return res as T;
}

/**
 * Extract beats from session with defensive checks.
 * Expected path: session.story.sentences: string[]
 */
export function extractBeats(session: any): StoryBeat[] {
  if (!session) return [];

  // story.sentences (expected path)
  if (Array.isArray(session?.story?.sentences)) {
    return session.story.sentences.map((text: any, index: number) => ({
      sentenceIndex: index,
      text: typeof text === "string" ? text : String(text),
    }));
  }

  // Fallback checks (defensive)
  if (Array.isArray(session?.sentences)) {
    return session.sentences.map((item: any, index: number) => ({
      sentenceIndex: index,
      text: typeof item === "string" ? item : item?.text || String(item),
    }));
  }

  if (Array.isArray(session?.beats)) {
    return session.beats.map((beat: any, index: number) => ({
      sentenceIndex: index,
      text: beat?.text || String(beat),
    }));
  }

  return [];
}

/**
 * Get shot for a given sentenceIndex from session.
 */
export function getSelectedShot(session: any, sentenceIndex: number): any | null {
  if (!session?.shots) return null;

  // If shots is an array, find by sentenceIndex property
  if (Array.isArray(session.shots)) {
    return session.shots.find((s: any) => s?.sentenceIndex === sentenceIndex) || null;
  }

  // If shots is an object/map, try accessing by key
  if (typeof session.shots === "object") {
    return session.shots[String(sentenceIndex)] || session.shots[sentenceIndex] || null;
  }

  return null;
}
