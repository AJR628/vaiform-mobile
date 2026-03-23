import type { StoryFinalizePendingMeta } from "@/api/client";
import { formatRenderTimeAmount } from "@/lib/renderUsage";

export interface Beat {
  sentenceIndex: number;
  text: string;
}

export type CaptionPlacement = "top" | "center" | "bottom";

export const CAPTION_PLACEMENTS: CaptionPlacement[] = ["top", "center", "bottom"];

export const PLACEMENT_TO_YPCT: Record<CaptionPlacement, number> = {
  top: 0.1,
  center: 0.5,
  bottom: 0.9,
};

export interface RenderRecoveryState {
  state?: "pending" | "done" | "failed" | string;
  attemptId?: string | null;
  shortId?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  finishedAt?: string | null;
  failedAt?: string | null;
  code?: string | null;
  message?: string | null;
}

export function unwrapSession<T>(res: any): T {
  if (res?.data && (res?.ok === true || res?.success === true)) {
    return res.data as T;
  }
  return res as T;
}

export function getRenderRecovery(session: any): RenderRecoveryState | null {
  const renderRecovery = session?.renderRecovery;
  if (!renderRecovery || typeof renderRecovery !== "object") return null;
  return renderRecovery as RenderRecoveryState;
}

export function getRenderRecoveryShortId(
  session: any,
  renderRecovery: RenderRecoveryState | null
): string | null {
  if (
    typeof renderRecovery?.shortId === "string" &&
    renderRecovery.shortId.trim().length > 0
  ) {
    return renderRecovery.shortId.trim();
  }
  if (
    typeof session?.finalVideo?.jobId === "string" &&
    session.finalVideo.jobId.trim().length > 0
  ) {
    return session.finalVideo.jobId.trim();
  }
  return null;
}

export function isRenderRecoveryForAttempt(
  renderRecovery: RenderRecoveryState | null,
  attemptId: string
): boolean {
  return (
    !!renderRecovery &&
    typeof renderRecovery.attemptId === "string" &&
    renderRecovery.attemptId === attemptId
  );
}

export function getFinalizeAttemptId(
  finalize: StoryFinalizePendingMeta | null | undefined,
  fallbackAttemptId: string
): string {
  if (typeof finalize?.attemptId === "string" && finalize.attemptId.trim().length > 0) {
    return finalize.attemptId.trim();
  }
  return fallbackAttemptId;
}

export function getInsufficientRenderTimeMessage(
  estimatedSec: number,
  availableSec: number
): string {
  return `Not enough render time. Estimated usage is ${formatRenderTimeAmount(
    estimatedSec
  )}. You have ${formatRenderTimeAmount(availableSec)} left.`;
}

export function extractBeats(session: any): Beat[] {
  if (!session) return [];

  if (Array.isArray(session?.story?.sentences)) {
    return session.story.sentences.map((text: string, index: number) => ({
      sentenceIndex: index,
      text: typeof text === "string" ? text : String(text),
    }));
  }

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

export function getSelectedShot(session: any, sentenceIndex: number): any | null {
  if (!session?.shots) return null;

  if (Array.isArray(session.shots)) {
    return session.shots.find((shot: any) => shot?.sentenceIndex === sentenceIndex) || null;
  }

  if (typeof session.shots === "object") {
    return session.shots[String(sentenceIndex)] || session.shots[sentenceIndex] || null;
  }

  return null;
}
