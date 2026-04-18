import { describe, expect, test } from "@jest/globals";

import {
  findStep3CaptionAtTime,
  findStep3PlaybackSegmentAtTime,
  getStep3BeatRailItems,
  getStep3BlockedMessage,
  getStep3CaptionTimeline,
  getStep3PlaybackOwnerSentenceIndex,
  getStep3PlaybackTimeline,
  getStep3PreviewReadiness,
  isStep3PreviewReady,
} from "@/screens/story-editor/step3";
import type { StorySession } from "@/types/story";

function buildSession(overrides: Partial<StorySession> = {}): StorySession {
  return {
    id: "session-1",
    story: {
      sentences: ["Beat one", "Beat two"],
    },
    shots: [
      {
        sentenceIndex: 0,
        selectedClip: {
          url: "https://cdn.example.com/clip-a.mp4",
          thumbUrl: "thumb-a",
        },
      },
      {
        sentenceIndex: 1,
        selectedClip: {
          url: "https://cdn.example.com/clip-b.mp4",
          thumbUrl: "thumb-b",
        },
      },
    ],
    captions: [
      {
        sentenceIndex: 0,
        text: "Beat one",
        startTimeSec: 0,
        endTimeSec: 3,
      },
      {
        sentenceIndex: 1,
        text: "Beat two",
        startTimeSec: 3,
        endTimeSec: 6,
      },
    ],
    previewReadinessV1: {
      version: 1,
      ready: true,
      reasonCode: null,
      missingBeatIndices: [],
    },
    playbackTimelineV1: {
      version: 1,
      source: "auto",
      totalDurationSec: 6,
      segments: [
        {
          segmentIndex: 0,
          sentenceIndex: 0,
          ownerSentenceIndex: 0,
          clipUrl: "https://cdn.example.com/clip-a.mp4",
          clipThumbUrl: "thumb-a",
          globalStartSec: 0,
          globalEndSec: 3,
          clipStartSec: 0,
          durationSec: 3,
        },
        {
          segmentIndex: 1,
          sentenceIndex: 1,
          ownerSentenceIndex: 1,
          clipUrl: "https://cdn.example.com/clip-b.mp4",
          clipThumbUrl: "thumb-b",
          globalStartSec: 3,
          globalEndSec: 6,
          clipStartSec: 0,
          durationSec: 3,
        },
      ],
    },
    ...overrides,
  };
}

describe("client/screens/story-editor/step3", () => {
  test("reads backend preview readiness and playback timeline truth", () => {
    const session = buildSession();

    expect(getStep3PreviewReadiness(session)).toEqual({
      ready: true,
      reasonCode: null,
      missingBeatIndices: [],
    });
    expect(isStep3PreviewReady(session)).toBe(true);
    expect(getStep3PlaybackTimeline(session)).toEqual(
      session.playbackTimelineV1,
    );
  });

  test("maps known backend blocked reasons to user-facing messages", () => {
    const missingClipSession = buildSession({
      previewReadinessV1: {
        version: 1,
        ready: false,
        reasonCode: "MISSING_CLIP_COVERAGE",
        missingBeatIndices: [1],
      },
      playbackTimelineV1: null,
    });
    const staleSyncSession = buildSession({
      previewReadinessV1: {
        version: 1,
        ready: false,
        reasonCode: "VOICE_SYNC_NOT_CURRENT",
        missingBeatIndices: [],
      },
      playbackTimelineV1: null,
    });

    expect(getStep3BlockedMessage(missingClipSession)).toBe(
      "Aligned preview is unavailable until beat 2 has a selected clip.",
    );
    expect(getStep3BlockedMessage(staleSyncSession)).toBe(
      "Sync voice and timing to unlock the synced preview.",
    );
  });

  test("builds caption timeline and finds caption/segment/owner at time", () => {
    const mergedOwnerSession = buildSession({
      playbackTimelineV1: {
        version: 1,
        source: "auto",
        totalDurationSec: 6,
        segments: [
          {
            segmentIndex: 0,
            sentenceIndex: 0,
            ownerSentenceIndex: 0,
            clipUrl: "https://cdn.example.com/clip-a.mp4",
            clipThumbUrl: "thumb-a",
            globalStartSec: 0,
            globalEndSec: 3,
            clipStartSec: 0,
            durationSec: 3,
          },
          {
            segmentIndex: 1,
            sentenceIndex: 1,
            ownerSentenceIndex: 0,
            clipUrl: "https://cdn.example.com/clip-a.mp4",
            clipThumbUrl: "thumb-a",
            globalStartSec: 3,
            globalEndSec: 6,
            clipStartSec: 3,
            durationSec: 3,
          },
        ],
      },
    });

    expect(getStep3CaptionTimeline(mergedOwnerSession)).toHaveLength(2);
    expect(findStep3CaptionAtTime(mergedOwnerSession, 4)).toMatchObject({
      sentenceIndex: 1,
      text: "Beat two",
    });
    expect(findStep3PlaybackSegmentAtTime(mergedOwnerSession, 4)).toMatchObject(
      {
        segmentIndex: 1,
        ownerSentenceIndex: 0,
      },
    );
    expect(
      getStep3PlaybackOwnerSentenceIndex(
        findStep3PlaybackSegmentAtTime(mergedOwnerSession, 4),
      ),
    ).toBe(0);
  });

  test("builds one compact rail item per beat from canonical session truth", () => {
    const session = buildSession();

    expect(getStep3BeatRailItems(session)).toEqual([
      {
        sentenceIndex: 0,
        text: "Beat one",
        clipThumbUrl: "thumb-a",
        clipUrl: "https://cdn.example.com/clip-a.mp4",
        startTimeSec: 0,
        endTimeSec: 3,
        durationSec: 3,
        hasSelectedClip: true,
      },
      {
        sentenceIndex: 1,
        text: "Beat two",
        clipThumbUrl: "thumb-b",
        clipUrl: "https://cdn.example.com/clip-b.mp4",
        startTimeSec: 3,
        endTimeSec: 6,
        durationSec: 3,
        hasSelectedClip: true,
      },
    ]);
  });
});
