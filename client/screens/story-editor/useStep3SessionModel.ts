import { useMemo } from "react";

import type { StorySession } from "@/types/story";

import {
  findStep3CaptionAtTime,
  findStep3PlaybackSegmentAtTime,
  getStep3BlockedMessage,
  getStep3CaptionTimeline,
  getStep3PlaybackOwnerSentenceIndex,
  getStep3PlaybackTimeline,
  getStep3PreviewReadiness,
  isStep3PreviewReady,
} from "./step3";
import { useStoryVoiceSync } from "./useStoryVoiceSync";

interface UseStep3SessionModelOptions {
  refreshUsage: () => Promise<void>;
  session: StorySession | null;
  sessionId: string;
  setSession: (session: StorySession | null) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

export function useStep3SessionModel({
  refreshUsage,
  session,
  sessionId,
  setSession,
  showError,
  showSuccess,
  showWarning,
}: UseStep3SessionModelOptions) {
  const voiceSyncModel = useStoryVoiceSync({
    refreshUsage,
    session,
    sessionId,
    setSession,
    showError,
    showSuccess,
    showWarning,
  });

  const previewReadiness = useMemo(
    () => getStep3PreviewReadiness(session),
    [session],
  );
  const previewReady = useMemo(() => isStep3PreviewReady(session), [session]);
  const previewBlockedMessage = useMemo(
    () => getStep3BlockedMessage(session),
    [session],
  );
  const playbackTimeline = useMemo(
    () => getStep3PlaybackTimeline(session),
    [session],
  );
  const captionTimeline = useMemo(
    () => getStep3CaptionTimeline(session),
    [session],
  );
  const currentPreviewCaption = useMemo(
    () => findStep3CaptionAtTime(session, voiceSyncModel.previewPositionSec),
    [session, voiceSyncModel.previewPositionSec],
  );
  const currentPlaybackSegment = useMemo(
    () =>
      findStep3PlaybackSegmentAtTime(
        session,
        voiceSyncModel.previewPositionSec,
      ),
    [session, voiceSyncModel.previewPositionSec],
  );
  const playbackOwnerSentenceIndex = useMemo(
    () => getStep3PlaybackOwnerSentenceIndex(currentPlaybackSegment),
    [currentPlaybackSegment],
  );
  const previewSentenceIndex = currentPreviewCaption?.sentenceIndex ?? null;

  return {
    ...voiceSyncModel,
    captionTimeline,
    currentPlaybackSegment,
    currentPreviewCaption,
    playbackOwnerSentenceIndex,
    playbackTimeline,
    previewBlockedMessage,
    previewReadiness,
    previewReady,
    previewSentenceIndex,
  };
}
