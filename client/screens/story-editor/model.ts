import type { StoryFinalizePendingMeta } from "@/api/client";
import { formatRenderTimeAmount } from "@/lib/renderUsage";
import type { StorySession, StoryShot, StoryVoiceSync, StoryVoiceSyncState } from "@/types/story";

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

export function unwrapSession<T>(res: unknown): T {
  if (typeof res === "object" && res !== null) {
    const envelope = res as { data?: T; ok?: boolean; success?: boolean };
    if (envelope.data && (envelope.ok === true || envelope.success === true)) {
      return envelope.data as T;
    }
  }
  return res as T;
}

export function getRenderRecovery(session: StorySession | null | undefined): RenderRecoveryState | null {
  const renderRecovery = session?.renderRecovery;
  if (!renderRecovery || typeof renderRecovery !== "object") return null;
  return renderRecovery as RenderRecoveryState;
}

export function getRenderRecoveryShortId(
  session: StorySession | null | undefined,
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

export function extractBeats(session: StorySession | null | undefined): Beat[] {
  if (!session) return [];

  if (Array.isArray(session?.story?.sentences)) {
    return session.story.sentences.map((text: string, index: number) => ({
      sentenceIndex: index,
      text: typeof text === "string" ? text : String(text),
    }));
  }

  return [];
}

export function getSelectedShot(
  session: StorySession | null | undefined,
  sentenceIndex: number,
): StoryShot | null {
  if (!session?.shots) return null;
  return Array.isArray(session.shots)
    ? session.shots.find((shot) => shot?.sentenceIndex === sentenceIndex) || null
    : null;
}

export function getVoiceSync(session: StorySession | null | undefined): StoryVoiceSync | null {
  if (!session?.voiceSync || typeof session.voiceSync !== "object") return null;
  return session.voiceSync;
}

export function getVoiceSyncState(session: StorySession | null | undefined): StoryVoiceSyncState {
  return getVoiceSync(session)?.state ?? "never_synced";
}

export function isVoiceSyncCurrent(session: StorySession | null | undefined): boolean {
  return getVoiceSyncState(session) === "current";
}

export function hasUnsyncedVoiceDraft(
  session: StorySession | null | undefined,
  draftVoicePreset: string | null | undefined,
  draftVoicePacePreset: string | null | undefined,
): boolean {
  if (!session) return false;
  return (
    typeof draftVoicePreset === "string" &&
    draftVoicePreset.length > 0 &&
    draftVoicePreset !== (session.voicePreset ?? "")
  ) || (
    typeof draftVoicePacePreset === "string" &&
    draftVoicePacePreset.length > 0 &&
    draftVoicePacePreset !== (session.voicePacePreset ?? "")
  );
}

export function getVoiceSyncBlockedMessage(
  session: StorySession | null | undefined,
  hasLocalVoiceDraft = false,
): string | null {
  if (!session) return "Storyboard is still loading.";
  if (hasLocalVoiceDraft) {
    return "Voice changed. Sync voice and timing before render.";
  }

  const sync = getVoiceSync(session);
  const state = sync?.state ?? "never_synced";
  if (state === "never_synced") {
    return "Sync voice and timing before render.";
  }
  if (state !== "current") {
    return "Voice timing is stale. Re-sync before render.";
  }
  return null;
}
