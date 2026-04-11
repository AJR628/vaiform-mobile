export type StoryVoiceSyncState = "never_synced" | "stale" | "current" | "syncing" | string;
export type StoryVoiceSyncScope = "none" | "beat" | "full" | string;

export interface StoryInput {
  text: string;
  type: "link" | "idea" | "paragraph" | string;
  url?: string;
}

export interface StoryTextBlock {
  sentences: string[];
}

export interface StoryPlanBeat {
  sentenceIndex: number;
  searchQuery?: string;
  visualDescription?: string;
  durationSec?: number;
}

export interface StoryClip {
  id?: string;
  url?: string;
  thumbUrl?: string | null;
  duration?: number;
  width?: number;
  height?: number;
  photographer?: string | null;
  sourceUrl?: string | null;
  provider?: string;
  providerId?: string;
  license?: string;
}

export interface StoryShot {
  sentenceIndex: number;
  searchQuery?: string;
  durationSec?: number;
  selectedClip?: StoryClip | null;
  candidates?: StoryClip[];
}

export interface StoryCaption {
  sentenceIndex: number;
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export interface StoryCaptionMeta {
  lines: string[];
  effectiveStyle?: Record<string, unknown>;
  styleHash?: string;
  textHash?: string;
  wrapHash?: string;
  maxWidthPx?: number;
  totalTextH?: number;
}

export interface StoryNarrationBeat {
  fingerprint?: string | null;
  durationSec?: number | null;
  syncedAt?: string | null;
}

export interface StoryBeat {
  captionMeta?: StoryCaptionMeta | null;
  narration?: StoryNarrationBeat | null;
}

export interface StoryOverlayCaptionStyle {
  fontFamily?: string;
  fontPx?: number;
  weightCss?: string;
  fontStyle?: "normal" | "italic";
  letterSpacingPx?: number;
  lineSpacingPx?: number;
  color?: string;
  opacity?: number;
  strokePx?: number;
  strokeColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  placement?: "top" | "center" | "bottom" | "custom" | string;
  yPct?: number;
  xPct?: number;
  wPct?: number;
}

export interface StoryVoiceOption {
  key: string;
  name: string;
  gender?: string | null;
  emotion?: string | null;
}

export interface StoryVoiceSync {
  schemaVersion?: number;
  state: StoryVoiceSyncState;
  requiredForRender?: boolean;
  staleScope?: StoryVoiceSyncScope;
  staleBeatIndices?: number[];
  currentFingerprint?: string | null;
  nextEstimatedChargeSec?: number | null;
  totalDurationSec?: number | null;
  previewAudioUrl?: string | null;
  previewAudioDurationSec?: number | null;
  lastChargeSec?: number | null;
  totalBilledSec?: number | null;
  lastSyncedAt?: string | null;
  cached?: boolean;
}

export interface StoryBillingEstimate {
  estimatedSec: number | null;
  source?: string | null;
  computedAt?: string | null;
  heuristicEstimatedSec?: number | null;
  heuristicSource?: string | null;
  heuristicComputedAt?: string | null;
}

export interface StoryBilling {
  billedSec?: number;
  settledAt?: string | null;
}

export interface StoryRenderRecovery {
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

export interface StoryFinalVideo {
  url: string;
  durationSec: number;
  jobId: string;
}

export interface StorySession {
  id: string;
  uid?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  status?: string;
  styleKey?: string;
  input?: StoryInput;
  story?: StoryTextBlock;
  plan?: StoryPlanBeat[];
  shots?: StoryShot[];
  captions?: StoryCaption[];
  beats?: StoryBeat[];
  overlayCaption?: StoryOverlayCaptionStyle;
  captionStyle?: StoryOverlayCaptionStyle;
  voicePreset?: string;
  voicePacePreset?: string;
  voiceOptions?: StoryVoiceOption[];
  voiceSync?: StoryVoiceSync;
  billingEstimate?: StoryBillingEstimate;
  billing?: StoryBilling;
  renderRecovery?: StoryRenderRecovery | null;
  finalVideo?: StoryFinalVideo | null;
}

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
