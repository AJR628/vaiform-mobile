import { useMemo } from "react";

import type { StorySession } from "@/types/story";

import {
  findStep3CaptionAtTime,
  getStep3CaptionOverlay,
  getStep3BlockedMessage,
  getStep3BeatRailItems,
  getStep3CaptionTimeline,
  getStep3DraftPreview,
  getStep3PlaybackTimeline,
  getStep3PreviewReadiness,
  isStep3PreviewReady,
} from "./step3";
import { useStep3PreviewArtifact } from "./useStep3PreviewArtifact";
import { useStoryVoiceSync } from "./useStoryVoiceSync";

interface UseStep3SessionModelOptions {
  refreshUsage: () => Promise<void>;
  session: StorySession | null;
  sessionId: string;
  setSession: (session: StorySession | null) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  useUnifiedPreviewSlots?: boolean;
}

export function useStep3SessionModel({
  refreshUsage,
  session,
  sessionId,
  setSession,
  showError,
  showSuccess,
  showWarning,
  useUnifiedPreviewSlots = false,
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
  void useUnifiedPreviewSlots;
  const previewPlaybackModel = useStep3PreviewArtifact({
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
  const beatRailItems = useMemo(
    () => getStep3BeatRailItems(session),
    [session],
  );
  const draftPreview = useMemo(() => getStep3DraftPreview(session), [session]);
  const captionOverlay = useMemo(
    () => getStep3CaptionOverlay(session),
    [session],
  );
  const currentPreviewCaption = useMemo(
    () =>
      findStep3CaptionAtTime(session, previewPlaybackModel.previewPositionSec),
    [previewPlaybackModel.previewPositionSec, session],
  );
  const previewSentenceIndex = currentPreviewCaption?.sentenceIndex ?? null;

  return {
    ...previewPlaybackModel,
    ...voiceSyncModel,
    beatRailItems,
    captionOverlay,
    captionTimeline,
    currentPreviewCaption,
    currentSegmentClipUrl: null,
    currentSegmentPosterUrl: null,
    draftPreview,
    handleFollowerVideoLoad: () => {},
    handlePreviewSlotReady: () => {},
    playbackTimeline,
    playbackOwnerSentenceIndex: previewSentenceIndex,
    previewBlockedMessage,
    previewReadiness,
    previewReady,
    previewSentenceIndex,
    previewVideoSlots: [],
  };
}
