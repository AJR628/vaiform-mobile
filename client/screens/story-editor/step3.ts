import type {
  StoryCaption,
  StoryPlaybackTimelineSegmentV1,
  StoryPlaybackTimelineV1,
  StoryPreviewReadinessV1,
  StorySession,
} from "@/types/story";

export interface Step3PreviewReadiness {
  ready: boolean;
  reasonCode: string | null;
  missingBeatIndices: number[];
}

export interface Step3CaptionTimelineItem {
  sentenceIndex: number;
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export interface Step3BeatRailItem {
  sentenceIndex: number;
  text: string;
  clipThumbUrl: string | null;
  clipUrl: string | null;
  startTimeSec: number | null;
  endTimeSec: number | null;
  durationSec: number | null;
  hasSelectedClip: boolean;
}

function normalizeBeatIndices(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getStep3PreviewReadiness(
  session: StorySession | null | undefined,
): Step3PreviewReadiness | null {
  const readiness = session?.previewReadinessV1;
  if (
    !readiness ||
    Number((readiness as StoryPreviewReadinessV1).version) !== 1 ||
    typeof readiness.ready !== "boolean"
  ) {
    return null;
  }

  return {
    ready: readiness.ready === true,
    reasonCode:
      typeof readiness.reasonCode === "string" ? readiness.reasonCode : null,
    missingBeatIndices: normalizeBeatIndices(readiness.missingBeatIndices),
  };
}

export function getStep3PlaybackTimeline(
  session: StorySession | null | undefined,
): StoryPlaybackTimelineV1 | null {
  const timeline = session?.playbackTimelineV1;
  if (
    !timeline ||
    Number(timeline.version) !== 1 ||
    !Array.isArray(timeline.segments) ||
    timeline.segments.length === 0
  ) {
    return null;
  }
  return timeline;
}

export function getStep3CaptionTimeline(
  session: StorySession | null | undefined,
): Step3CaptionTimelineItem[] {
  if (!Array.isArray(session?.captions)) return [];
  return session.captions
    .map((caption: StoryCaption) => {
      const sentenceIndex = toFiniteNumber(caption?.sentenceIndex);
      const startTimeSec = toFiniteNumber(caption?.startTimeSec);
      const endTimeSec = toFiniteNumber(caption?.endTimeSec);
      if (
        sentenceIndex === null ||
        startTimeSec === null ||
        endTimeSec === null
      ) {
        return null;
      }
      return {
        sentenceIndex,
        text: String(caption?.text ?? ""),
        startTimeSec,
        endTimeSec,
      };
    })
    .filter((caption): caption is Step3CaptionTimelineItem => caption !== null)
    .sort((left, right) => left.startTimeSec - right.startTimeSec);
}

export function isStep3PreviewReady(
  session: StorySession | null | undefined,
): boolean {
  const readiness = getStep3PreviewReadiness(session);
  return readiness?.ready === true && !!getStep3PlaybackTimeline(session);
}

export function getStep3BlockedReasonCode(
  session: StorySession | null | undefined,
): string | null {
  const readiness = getStep3PreviewReadiness(session);
  if (!readiness || readiness.ready) return null;
  return readiness.reasonCode;
}

export function getStep3BlockedMessage(
  session: StorySession | null | undefined,
): string | null {
  if (isStep3PreviewReady(session)) return null;

  switch (getStep3BlockedReasonCode(session)) {
    case "VOICE_SYNC_NOT_CURRENT":
      return "Sync voice and timing to unlock the synced preview.";
    case "PREVIEW_AUDIO_MISSING":
      return "Voice sync finished, but preview audio is unavailable for this session.";
    case "CAPTIONS_INCOMPLETE":
      return "Voice sync finished, but caption timing is incomplete for this session.";
    case "MISSING_CLIP_COVERAGE": {
      const readiness = getStep3PreviewReadiness(session);
      const beats =
        readiness?.missingBeatIndices.map((value) => value + 1) ?? [];
      if (beats.length === 0) {
        return "Aligned preview is unavailable until every beat has a selected clip.";
      }
      const beatLabel = beats.length === 1 ? "beat" : "beats";
      const verb = beats.length === 1 ? "has" : "have";
      return `Aligned preview is unavailable until ${beatLabel} ${beats.join(", ")} ${verb} a selected clip.`;
    }
    case "INVALID_PLAYBACK_SEGMENTS":
      return "Voice sync finished, but the render-aligned preview timeline is unavailable for this session.";
    default:
      return "Synced preview is blocked for this session right now.";
  }
}

export function findStep3CaptionAtTime(
  session: StorySession | null | undefined,
  timeSec: number,
): Step3CaptionTimelineItem | null {
  const timeline = getStep3CaptionTimeline(session);
  if (!timeline.length) return null;

  const currentTime = Math.max(0, Number(timeSec) || 0);
  for (const caption of timeline) {
    if (
      currentTime >= caption.startTimeSec &&
      currentTime < caption.endTimeSec
    ) {
      return caption;
    }
  }

  const last = timeline[timeline.length - 1];
  if (last && currentTime >= last.endTimeSec) {
    return last;
  }
  return timeline[0] ?? null;
}

export function findStep3PlaybackSegmentAtTime(
  session: StorySession | null | undefined,
  timeSec: number,
): StoryPlaybackTimelineSegmentV1 | null {
  const timeline = getStep3PlaybackTimeline(session);
  if (!timeline) return null;

  const currentTime = Math.max(0, Number(timeSec) || 0);
  for (const segment of timeline.segments) {
    const startTimeSec = toFiniteNumber(segment?.globalStartSec);
    const endTimeSec = toFiniteNumber(segment?.globalEndSec);
    if (startTimeSec === null || endTimeSec === null) continue;
    if (currentTime >= startTimeSec && currentTime < endTimeSec) {
      return segment;
    }
  }

  const last = timeline.segments[timeline.segments.length - 1];
  if (last && currentTime >= Number(last.globalEndSec)) {
    return last;
  }
  return timeline.segments[0] ?? null;
}

export function getStep3PlaybackOwnerSentenceIndex(
  segment: StoryPlaybackTimelineSegmentV1 | null | undefined,
): number | null {
  const ownerSentenceIndex = toFiniteNumber(
    segment?.ownerSentenceIndex ?? segment?.sentenceIndex,
  );
  return ownerSentenceIndex;
}

function findSegmentForBeat(
  timeline: StoryPlaybackTimelineV1 | null,
  sentenceIndex: number,
): StoryPlaybackTimelineSegmentV1 | null {
  if (!timeline) return null;
  return (
    timeline.segments.find((segment) => {
      const ownerSentenceIndex = getStep3PlaybackOwnerSentenceIndex(segment);
      const segmentSentenceIndex = toFiniteNumber(segment?.sentenceIndex);
      return (
        ownerSentenceIndex === sentenceIndex ||
        segmentSentenceIndex === sentenceIndex
      );
    }) ?? null
  );
}

export function getStep3BeatRailItems(
  session: StorySession | null | undefined,
): Step3BeatRailItem[] {
  const sentences = Array.isArray(session?.story?.sentences)
    ? session.story.sentences
    : [];
  const captions = getStep3CaptionTimeline(session);
  const timeline = getStep3PlaybackTimeline(session);
  const shots = Array.isArray(session?.shots) ? session.shots : [];

  return sentences.map((sentence, sentenceIndex) => {
    const shot =
      shots.find((entry) => entry?.sentenceIndex === sentenceIndex) ?? null;
    const selectedClip = shot?.selectedClip ?? null;
    const caption =
      captions.find((entry) => entry.sentenceIndex === sentenceIndex) ?? null;
    const segment = findSegmentForBeat(timeline, sentenceIndex);
    const captionDuration =
      caption && caption.endTimeSec >= caption.startTimeSec
        ? caption.endTimeSec - caption.startTimeSec
        : null;
    const segmentDuration = toFiniteNumber(segment?.durationSec);
    const shotDuration = toFiniteNumber(shot?.durationSec);

    return {
      sentenceIndex,
      text: typeof sentence === "string" ? sentence : String(sentence ?? ""),
      clipThumbUrl: selectedClip?.thumbUrl ?? segment?.clipThumbUrl ?? null,
      clipUrl: selectedClip?.url ?? segment?.clipUrl ?? null,
      startTimeSec:
        caption?.startTimeSec ?? toFiniteNumber(segment?.globalStartSec),
      endTimeSec: caption?.endTimeSec ?? toFiniteNumber(segment?.globalEndSec),
      durationSec: captionDuration ?? segmentDuration ?? shotDuration,
      hasSelectedClip: Boolean(selectedClip),
    };
  });
}
