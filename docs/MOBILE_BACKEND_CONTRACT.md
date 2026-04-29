# MOBILE_BACKEND_CONTRACT

- Status: CONSUMER_NOTE
- Owner repo: mobile
- Source of truth for: mobile-side pointer to backend-owned contract docs and local alignment rules for this repo
- Canonical counterpart/source: backend repo `docs/FINAL_PAID_BETA_LAUNCH_PLAN.md`, backend repo `docs/MOBILE_BACKEND_CONTRACT.md`, backend repo `docs/MOBILE_HARDENING_PLAN.md`, backend repo `docs/LEGACY_WEB_SURFACES.md`
- Last verified against: both repos on 2026-04-11

This file is not a second canonical contract document. The backend repo owns backend/mobile contract truth, and this file should stay a pointer/alignment note rather than rebuilding endpoint tables here.

## Canonical Backend Truth

Use these backend docs as the canonical source before changing any mobile-used route behavior:

- backend repo `docs/FINAL_PAID_BETA_LAUNCH_PLAN.md` for the current launch-phase authority
- backend repo `docs/MOBILE_BACKEND_CONTRACT.md`
- backend repo `docs/MOBILE_HARDENING_PLAN.md` for route-level hardening status
- backend repo `docs/LEGACY_WEB_SURFACES.md`

## Mobile Repo Rule

The mobile repo keeps one canonical usage doc only:

- docs/MOBILE_USED_SURFACES.md for what the mobile app currently calls, sends, and reads now.

Trust order in this repo:

1. `docs/MOBILE_USED_SURFACES.md` for exact current callers.
2. Backend repo `docs/FINAL_PAID_BETA_LAUNCH_PLAN.md` for current launch-phase status and priorities.
3. Backend repo `docs/MOBILE_BACKEND_CONTRACT.md` and `docs/MOBILE_HARDENING_PLAN.md` for server guarantees and hardening status.

If backend route behavior changes, update the backend canonical docs first. Update docs/MOBILE_USED_SURFACES.md in this repo only when actual mobile usage changes.

## Current Local Alignment Note

- Active billing path used by mobile is GET /api/usage.
- Current mobile readers are AuthContext bootstrap + refreshUsage(), surfaced by SettingsScreen and post-render refresh in StoryEditorScreen.
- Current billing fields read by mobile are `data.usage.availableSec` and session `billingEstimate.estimatedSec`.
- StoryEditorScreen now also uses `POST /api/story/sync` as the explicit speech/timing commit point and reads `voiceSync`, `voicePreset`, `voicePacePreset`, `voiceOptions`, and synced `captions` from `GET /api/story/:sessionId`.
- StoryEditorScreen Step 3 now uses `POST /api/story/preview` to request a backend-owned captioned preview artifact, then polls only `GET /api/story/:sessionId` for `draftPreviewV1` readiness/readback.
- Step 3 ready-preview playback truth is `draftPreviewV1.artifact.url`. `captionOverlayV1` and `playbackTimelineV1` may still be present as compatibility/timing/style metadata, but neither is the ready-preview visual renderer or active mobile playback engine.
- Render is now blocked client-side unless sync is current and there is no local unsynced voice draft.
- StoryEditorScreen reads the current backend-owned session `billingEstimate.estimatedSec` as the render charge only after sync is current; sync charge estimation lives under `voiceSync.nextEstimatedChargeSec`.
- Current `/api/users/ensure` profile shape used by mobile is `{ uid, email, plan, freeShortsUsed }`.
- Do not reintroduce GET /credits, backend aliases, or a global /api base-URL convention in this repo.
- Auth bootstrap remains ensureUser()-driven in this repo, but app readiness now also depends on the canonical usage fetch.
