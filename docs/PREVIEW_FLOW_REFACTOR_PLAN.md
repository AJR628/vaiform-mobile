# PREVIEW_FLOW_REFACTOR_PLAN

- Status: Planned
- Owner repo: mobile
- Purpose: Single source of truth for the mobile Preview-flow refactor so phased implementation stays aligned with approved UX direction, current repo architecture, and existing backend/mobile behavior.
- Last verified against repo: 2026-04-28
- Current phase: Phase 1D completed; ready preview uses backend-burned captions only

## Goal

- Change the visible flow from `Create -> Script -> Storyboard -> Speech -> Render` to `Create -> Script -> Preview -> Render`.
- Remove `Speech` as a visible peer top-level step.
- Keep voice sync as a contextual action inside the Preview workspace.
- Evolve Preview from rough clip/storyboard editing into synced final-like review.
- Restyle the beat rail into a connected duration-based filmstrip.
- Preserve current backend routes, payloads, headers, polling, idempotency, and response contracts.

## Frozen Target UX Notes

- This refactor freezes the attached Preview-workspace mockup discussed in planning as the target directional UI reference for implementation phases.
- The mockup is UX direction, not pixel-perfect design-token authority. Existing mobile theme tokens and current dark premium styling remain the implementation baseline.
- In repo terms, the target direction means:
  - top pills show only `Create`, `Script`, `Preview`, `Render`
  - the active Step 3 workspace presents itself as `Preview`
  - `Voice & Timing` is an in-workspace CTA that opens the existing voice sync modal flow
  - the workspace header can show state such as `Rough Preview`, `Synced Preview`, `Syncing`, or `Preview Stale`
  - helper guidance appears only when sync/timing state needs explanation
  - the rail reads as one connected filmstrip with duration-proportional segments, selected-beat emphasis, and clear playback progress
- This file freezes product truth first. Internal route names, screen names, and ownership do not need to match visible labels in early phases.

## Current Repo Truth

- `StoryEditorScreen` owns workspace state, preview playback orchestration, render gating, and the voice-sync modal flow. Evidence: `client/screens/StoryEditorScreen.tsx:148-157`, `client/screens/StoryEditorScreen.tsx:201-285`, `client/screens/StoryEditorScreen.tsx:541-549`, `client/screens/StoryEditorScreen.tsx:792-836`.
- `FlowTabsHeader` still keeps internal `storyboard` and `speech` step semantics, but only renders `Create`, `Script`, `Preview`, and `Render` after Phase 1. Evidence: `client/components/FlowTabsHeader.tsx:6-14`, `client/components/FlowTabsHeader.tsx:51-53`.
- `StoryEditorScreen` still owns `openVoiceSyncModal()` and still passes `onSpeechPress` into `FlowTabsHeader`, but visible voice-sync entry now lives inside the Step 3 Preview workspace surfaces instead of the top pill row. Evidence: `client/screens/StoryEditorScreen.tsx:541-583`, `client/screens/StoryEditorScreen.tsx:630-714`.
- `StoryboardSurface` is already the unified Step 3 Preview workspace render surface, composing `StoryboardPreviewStage` and `StoryTimelineRail`, and now renders the Phase 2 Preview header/status/CTA treatment from screen-derived props. Evidence: `client/components/story-editor/StoryboardSurface.tsx:16-55`, `client/components/story-editor/StoryboardSurface.tsx:117-207`.
- `StoryPreviewShell` remains the legacy Step 3 fallback path behind the feature flag and now carries a minimal fallback Preview header/status/CTA treatment so voice sync stays reachable when unified Step 3 is off. It no longer renders a local RN caption overlay over ready preview video. Evidence: `client/components/story-editor/StoryPreviewShell.tsx:14-42`, `client/components/story-editor/StoryPreviewShell.tsx:124-280`.
- `StoryTimelineRail` remains the rail owner, still derives width from `durationSec` using stable mobile clamps, and now renders a connected fixed-height filmstrip while keeping the top progress bar as the moving playback indicator. Evidence: `client/components/story-editor/StoryTimelineRail.tsx:40-48`, `client/components/story-editor/StoryTimelineRail.tsx:67-188`, `client/components/story-editor/StoryTimelineRail.tsx:224-302`.
- `useStep3SessionModel` remains the composition point for preview playback state plus voice sync state. Evidence: `client/screens/story-editor/useStep3SessionModel.ts:40-57`, `client/screens/story-editor/useStep3SessionModel.ts:59-111`.
- `Step3BeatRailItem` remains the rail data contract and already contains `startTimeSec`, `endTimeSec`, `durationSec`, `clipThumbUrl`, `clipUrl`, `sentenceIndex`, and `text`. Evidence: `client/screens/story-editor/step3.ts:36-45`, `client/screens/story-editor/step3.ts:314-349`.
- Unified Step 3 is still behind the feature flag `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE === "1"`. Checked-in `eas.json` and `app.json` do not force the flag for beta/release, so the legacy fallback must be treated as potentially user-visible unless external EAS environment config proves otherwise. Evidence: `client/screens/story-editor/featureFlags.ts:1-3`, `client/screens/StoryEditorScreen.tsx:148`, `client/screens/StoryEditorScreen.tsx:630-725`, `client/screens/StoryEditorScreen.test.tsx:219-310`, `eas.json:2-10`, `app.json:1-57`.
- Backend/mobile behavior for this refactor is preserved, not redesigned. Mobile caller truth already uses `GET /api/story/:sessionId`, `POST /api/story/preview`, `POST /api/story/sync`, and `POST /api/story/finalize` with the current normalized transport. Evidence: `client/api/client.ts:703-786`, `client/api/client.ts:887-1023`, `docs/MOBILE_USED_SURFACES.md:49-61`, plus backend contract references in backend repo docs `MOBILE_BACKEND_CONTRACT.md` sections covering session projection, preview, and sync.

## Non-Negotiable Guardrails

- Do not create a new Preview screen.
- Do not create or keep a fake Speech screen/step.
- Do not move state ownership out of `StoryEditorScreen`.
- Do not fork a second preview model if `useStep3SessionModel` already covers the needed state.
- Do not rewrite `Step3BeatRailItem`.
- Do not change backend routes, payloads, headers, polling, idempotency, timeout behavior, or response shapes in this refactor.
- Do not spread preview status derivation across multiple components; derive once at the screen/model boundary and render downstream.
- Do not remove the legacy fallback or the unified-surface feature flag unless a later explicit phase approves that change.
- Do not rename internal route names, screen names, or component semantics early just to match visible `Preview` terminology.
- Do not move modal ownership from `StoryEditorScreen` into `StoryboardSurface` or `VoiceSyncPanel`.
- Do not make `StoryboardSurface` directly perform sync side effects; it may only trigger the existing modal open handler.
- Do not duplicate contract truth from backend docs into this file; reference backend docs when preserving server behavior matters.
- Keep `client/api/client.ts` as the transport owner for these flows.
- Keep current render gating semantics intact unless an explicit later phase is approved separately.
- Backend `draftPreviewV1.artifact.url` is the only visual caption source for ready preview; do not keep React Native ready-preview captions as a runtime backup.

## Phase Plan

### Phase 1: Flow Truth And Preview Entry Point

- Implementation status: Completed on 2026-04-23.
- Actual outcome: Runtime change stayed header-only in `client/components/FlowTabsHeader.tsx`. Internal `storyboard` and `speech` step wiring, existing `currentStep="storyboard"` callsites, and existing `onStoryboardPress` / `onSpeechPress` props remained unchanged.
- Objective: Make the visible flow tell the truth with the smallest possible diff.
- Why this phase is isolated: It is presentation-only flow correction and should not change state ownership, route semantics, or backend behavior.
- In scope:
  - remove the visible `Speech` pill from the top-level header
  - show `Preview` as the user-facing Step 3 label
  - preserve internal `storyboard` wiring where possible
  - keep `StoryEditorScreen` as the routed Step 3 screen
  - keep the existing voice sync modal flow reachable from inside Step 3, not from a peer header step
- Out of scope:
  - route renames
  - screen renames
  - component renames
  - preview status chips
  - helper banners
  - rail redesign
  - voice panel copy polish
- Likely files touched:
  - `client/components/FlowTabsHeader.tsx`
  - `client/navigation/HomeStackNavigator.tsx` only if needed for compile or visible-label alignment
  - `client/screens/StoryEditorScreen.tsx` only if needed for compile or header-callsite alignment
  - `client/screens/StoryEditorScreen.test.tsx` only if needed for test alignment
- Risks / coupling notes:
  - `FlowTabsHeader` is used by both Home and Script headers, so the visible step update must stay consistent across all callsites.
  - This phase should prefer presentation-only truth. Avoid internal renames unless repo truth proves they are required.
- Manual verification checklist:
  - Home header shows `Create`, `Script`, `Preview`, `Render`
  - Script header shows `Create`, `Script`, `Preview`, `Render`
  - StoryEditor header shows `Create`, `Script`, `Preview`, `Render`
  - `Preview` still lands on the existing `StoryEditor` screen
  - no separate `Speech` destination appears anywhere in the header flow
  - render button enable/disable behavior is unchanged
- Exit criteria:
  - visible top-level flow truth is corrected
  - internal `storyboard` semantics are still intact unless a strictly necessary change was documented
  - no backend/mobile contract behavior changed

### Phase 2: Preview Workspace Header, Status, And Voice CTA

- Implementation status: Completed on 2026-04-23.
- Actual outcome: `StoryEditorScreen` now derives one screen-level Preview workspace chrome view-model and passes it into both runtime branches. `StoryboardSurface` renders the full Preview header/status/CTA treatment. `StoryPreviewShell` was touched as a minimal fallback access/header patch because the unified-surface feature flag still allows the legacy branch.
- Objective: Make `StoryboardSurface` present itself as the real Preview workspace.
- Why this phase is isolated: It changes only Step 3 workspace presentation and CTA wiring, while keeping ownership and transport boundaries intact.
- In scope:
  - derive one preview workspace view-model from existing screen/model state
  - change workspace title to `Preview`
  - add status chip semantics such as `Rough Preview`, `Synced Preview`, `Syncing`, `Preview Stale`
  - add `Voice & Timing` CTA inside the workspace
  - add helper banner behavior for unsynced or stale preview states when justified by existing state
- Out of scope:
  - rail filmstrip redesign
  - backend sync or preview contract changes
  - moving sync logic into child components
  - feature-flag removal
- Likely files touched:
  - `client/screens/StoryEditorScreen.tsx`
  - `client/components/story-editor/StoryboardSurface.tsx`
  - `client/components/story-editor/StoryboardSurface.test.tsx`
  - possibly `client/screens/story-editor/useStep3SessionModel.ts` if exposing existing composed state more clearly is truly necessary
- Risks / coupling notes:
  - Preview status semantics must remain derived from existing truth: `draftPreviewV1`, `previewReadinessV1`, `voiceSync`, `hasLocalVoiceDraft`, and `isSyncing`.
  - Avoid duplicating status logic between `StoryEditorScreen`, `StoryboardSurface`, and `VoiceSyncPanel`.
- Manual verification checklist:
  - workspace title reads `Preview`
  - `Voice & Timing` opens the existing modal/sheet flow
  - blocked/ready state messaging still matches `step3.ts`
  - helper banner appears only for the intended unsynced/stale states
  - render gating behavior remains unchanged
- Exit criteria:
  - Preview workspace header reflects approved UX direction
  - existing modal flow is reused, not replaced
  - no duplicate preview-state logic was introduced

### Phase 3: Connected Duration Filmstrip Rail

- Implementation status: Completed on 2026-04-23.
- Actual outcome: `StoryTimelineRail` was restyled into a connected fixed-height filmstrip with duration-derived clamped widths, stronger selected/playback emphasis, and preserved transport/interactions. No screen, model, or backend-facing files were changed.
- Objective: Restyle the existing rail into a connected duration-based filmstrip without changing its data contract.
- Why this phase is isolated: It is a rail presentation/layout refactor on top of already-proven Step 3 timing data.
- In scope:
  - keep `StoryTimelineRail` as the rail owner
  - keep `Step3BeatRailItem` as the input contract
  - move from disconnected portrait cards to a connected same-height filmstrip
  - preserve duration-proportional widths
  - preserve selected-beat emphasis and playback progress clarity
  - preserve current press/long-press/playback wiring
- Out of scope:
  - preview model rewrites
  - transport ownership moves
  - new timeline data contracts
  - backend timing changes
- Likely files touched:
  - `client/components/story-editor/StoryTimelineRail.tsx`
  - related Step 3 tests if needed
- Risks / coupling notes:
  - strip-width math and playback indicator placement should stay encapsulated inside `StoryTimelineRail`.
  - existing `durationSec` fallback behavior for missing/invalid timing must remain stable.
- Manual verification checklist:
  - rail appears visually connected
  - all beat segments share a stable height
  - segment widths still reflect beat duration proportionally
  - selected beat is clearly visible
  - playback progress remains clear during preview playback
  - beat press and long-press behavior is unchanged
- Exit criteria:
  - filmstrip direction matches the frozen UX target
  - `Step3BeatRailItem` contract remains unchanged
  - no transport or backend logic changed

### Phase 4: Voice Panel Copy, Docs, And Final Alignment

- Implementation status: Completed on 2026-04-23.
- Actual outcome: `VoiceSyncPanel` copy now reads as a contextual Preview drawer, mobile docs now reflect `Voice & Timing` from Preview as caller truth, and the refactor SSOT is recorded as complete. No runtime behavior, readiness logic, rail behavior, or backend-facing contract usage changed.
- Objective: Finish terminology alignment and repo-doc truth after the UI behavior lands.
- Why this phase is isolated: It should only tighten wording, update docs, and record actual implementation truth after the runtime phases are stable.
- In scope:
  - adjust `VoiceSyncPanel` copy so it reads as a Preview-context control drawer
  - update `docs/MOBILE_USED_SURFACES.md` if visible caller-truth wording changed
  - check `docs/DOCS_INDEX.md` only if this file or active mobile doc navigation now needs a front-door link
  - update this file with what actually landed
- Out of scope:
  - new behavior
  - backend route changes
  - broad doc rewrites
  - speculative future cleanup
- Likely files touched:
  - `client/components/story-editor/VoiceSyncPanel.tsx`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
  - `docs/MOBILE_USED_SURFACES.md`
  - possibly `docs/DOCS_INDEX.md`
- Risks / coupling notes:
  - mobile docs must remain caller-truth only.
  - backend contract docs are not default in-scope mobile Phase 4 work; if wording drift is discovered there, record it as a follow-up instead of broadening this phase into a cross-repo doc sweep.
- Manual verification checklist:
  - voice panel copy reads as contextual Preview support, not a separate step
  - docs match the implemented UI truth
  - no duplicate contract truth was added
  - typecheck and relevant tests pass for changed files
- Exit criteria:
  - repo docs and UI terminology are aligned
  - this plan file includes implementation log entries for landed phases
  - no stale `Speech` step wording remains in active mobile docs unless intentionally preserved for internal semantics and documented

## Phase Execution Rules

Every implementation phase must follow this order:

1. audit the targeted files first
2. implement only the active phase scope
3. manually verify the changed behavior
4. update this markdown file with implementation truth, not intent
5. only then begin the next phase

Additional execution rules:

- Do not pull work from later phases into the active phase unless the dependency is unavoidable and documented.
- If an implementation phase needs more than a minimal guardrail-breaking change, stop and document the reason here before broadening scope.
- If repo truth differs from this plan during execution, update this file to reflect the proven truth before continuing.
- If a phase breaks `StoryEditorScreen` runtime behavior or unified/legacy path expectations, stop, document the break, and identify the rollback point before widening scope.

## Implementation Log Template

### Phase Update Template

- Phase:
- Date:
- Branch / PR:
- Files changed:
- What actually changed:
- What differed from plan:
- Manual verification performed:
- Tests run:
- Env / feature flag state:
- Follow-ups discovered:

### Phase 1 Update

- Phase: Phase 1 - Flow Truth And Preview Entry Point
- Date: 2026-04-23
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/components/FlowTabsHeader.tsx`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
- What actually changed:
  - changed the visible `storyboard` pill label from `Storyboard` to `Preview`
  - removed the visible `Speech` pill from the rendered header list
  - preserved internal `FlowStep` values, including `storyboard` and `speech`
  - preserved existing `onStoryboardPress`, `onSpeechPress`, and `currentStep="storyboard"` callsites unchanged
- What differed from plan:
  - no runtime compatibility edits outside `FlowTabsHeader.tsx` were required
  - Phase 1 stayed header-only for runtime behavior
- Manual verification performed:
  - audited `HomeStackNavigator`, `StoryEditorScreen`, and `StoryEditorScreen.test.tsx` before editing
  - confirmed Home header still renders through `FlowTabsHeader` with `currentStep="create"`
  - confirmed Script header still renders through `FlowTabsHeader` with `currentStep="script"`
  - confirmed StoryEditor header still renders through `FlowTabsHeader` with `currentStep="storyboard"`
  - confirmed visible header flow is now `Create`, `Script`, `Preview`, `Render`
  - confirmed `Preview` still maps to the existing `storyboard` internal step and existing `StoryEditor` route wiring
  - confirmed no visible `Speech` pill remains
  - confirmed render gating logic in `StoryEditorScreen` is unchanged
  - confirmed unified and legacy Step 3 body selection logic is unchanged
- Tests run:
  - `npm run check:types`
  - `npm run test:ci -- StoryEditorScreen.test.tsx`
- Env / feature flag state:
  - `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE` behavior unchanged
  - existing legacy/unified Step 3 gating preserved
- Follow-ups discovered:
  - Phase 2 can build on unchanged `StoryEditorScreen` ownership and modal wiring without additional Phase 1 cleanup

### Phase 2 Update

- Phase: Phase 2 - Preview Workspace Header, Status, And Voice CTA
- Date: 2026-04-23
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/screens/StoryEditorScreen.tsx`
  - `client/components/story-editor/StoryboardSurface.tsx`
  - `client/components/story-editor/StoryPreviewShell.tsx`
  - `client/screens/StoryEditorScreen.test.tsx`
  - `client/components/story-editor/StoryboardSurface.test.tsx`
  - `client/components/story-editor/StoryPreviewShell.test.tsx`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
- What actually changed:
  - derived one screen-level Preview workspace chrome view-model in `StoryEditorScreen`
  - landed the approved Phase 2 status mapping in `StoryEditorScreen`:
    - `Syncing`: `isSyncing === true`
    - `Synced Preview`: `voiceSync?.state === "current"` and `previewReady === true`
    - `Preview Stale`: `hasLocalVoiceDraft === true` or `voiceSync?.state === "stale"` or `draftPreview.state === "stale"`
    - `Rough Preview`: every remaining pre-sync / not-ready editing state
  - passed `onOpenVoiceSync={openVoiceSyncModal}` plus derived status/supporting/banner props into both unified and legacy Step 3 branches
  - updated `StoryboardSurface` to render `Preview`, a status chip, a visible `Voice & Timing` CTA, a supporting line, and an optional helper banner without taking over sync logic
  - touched `StoryPreviewShell` as a minimal fallback access/header patch only, because `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE` still allows the legacy branch
  - kept `useStep3SessionModel.ts`, `step3.ts`, and `VoiceSyncPanel.tsx` unchanged
- What differed from plan:
  - `StoryPreviewShell.tsx` was required, not optional, because Phase 1 removed the only visible voice-sync entry and the legacy branch still mounts when the unified feature flag is off
  - a small max-video-height reserve adjustment landed in `StoryEditorScreen.tsx` so the added Phase 2 header/banner chrome does not overrun the Step 3 layout
- Manual verification performed:
  - re-audited `StoryEditorScreen`, `StoryboardSurface`, `StoryPreviewShell`, `useStep3SessionModel`, `step3`, `VoiceSyncPanel`, `StoryEditorScreen.test.tsx`, and `featureFlags.ts` before editing
  - confirmed top pills remain `Create`, `Script`, `Preview`, `Render`
  - confirmed unified branch now receives and renders Preview title/status/CTA/header-support copy plus the optional helper banner
  - confirmed legacy branch now receives and renders fallback Preview title/status/CTA/header-support copy plus the optional helper banner
  - confirmed both branches wire `Voice & Timing` to the existing `openVoiceSyncModal` owner in `StoryEditorScreen`
  - confirmed blocked/playable preview behavior still flows from existing `previewReady` and `previewBlockedMessage` truth
  - confirmed render gating logic remains unchanged in `StoryEditorScreen`
- Tests run:
  - `npm run check:types`
  - `npm run test:ci -- client/screens/StoryEditorScreen.test.tsx client/components/story-editor/StoryboardSurface.test.tsx client/components/story-editor/StoryPreviewShell.test.tsx`
- Env / feature flag state:
  - `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE` behavior unchanged
  - unified and legacy Step 3 branch selection preserved
- Follow-ups discovered:
  - Phase 3 can restyle the rail without revisiting Phase 2 status ownership
  - `StoryPreviewShell` still remains a legacy fallback shell and was intentionally not brought to full mockup parity in this phase

### Phase 3 Update

- Phase: Phase 3 - Connected Duration Filmstrip Rail
- Date: 2026-04-23
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/components/story-editor/StoryTimelineRail.tsx`
  - `client/components/story-editor/StoryTimelineRail.test.tsx`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
- What actually changed:
  - restyled `StoryTimelineRail` from separated portrait cards into a connected fixed-height filmstrip
  - kept the existing top transport row and top progress bar as-is for playback controls and moving progress indication
  - preserved local width behavior inside `StoryTimelineRail` using duration-derived mobile clamps and a stable fallback width for missing or invalid duration
  - preserved beat labels, missing-thumbnail fallback, press behavior, long-press behavior, Play/Pause, and Stop behavior
  - added clearer selected and playback-active emphasis inside the rail without changing data flow or ownership
  - kept `Step3BeatRailItem`, `step3.ts`, and `useStep3SessionModel.ts` unchanged
- What differed from plan:
  - no compatibility edits were required in `StoryboardSurface.tsx`, `StoryboardSurface.test.tsx`, or `StoryEditorScreen.tsx`
  - global strip-level playhead was intentionally deferred; Phase 3 keeps the top progress bar as the only moving playback indicator
- Manual verification performed:
  - re-audited the Phase 3 SSOT section, `StoryTimelineRail.tsx`, `StoryTimelineRail.test.tsx`, `StoryboardSurface.tsx`, `StoryboardSurface.test.tsx`, `step3.ts`, `useStep3SessionModel.ts`, and `StoryEditorScreen.tsx` before editing
  - confirmed unified Preview path still mounts `StoryTimelineRail` inside `StoryboardSurface`
  - confirmed the top transport row still exposes Play/Pause, current time, top progress bar, total duration, and Stop
  - confirmed the strip now reads as one connected filmstrip with same-height segments
  - confirmed segment widths remain duration-derived and visibly duration-correlated with stable mobile clamps
  - confirmed selected and playback-active states are both still visible, with playback-active stronger than selected-only
  - confirmed beat press and long-press wiring remains local to `StoryTimelineRail`
  - confirmed missing-thumbnail fallback still renders intentionally
  - confirmed legacy path remains unchanged because it does not render `StoryTimelineRail`
- Tests run:
  - `npm run check:types`
  - `npm run test:ci -- client/components/story-editor/StoryTimelineRail.test.tsx`
- Env / feature flag state:
  - `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE` behavior unchanged
  - unified and legacy Step 3 branch selection preserved
- Follow-ups discovered:
  - width behavior remains duration-derived with mobile clamps, not exact total-duration proportional layout math
  - global strip-level playhead remains deferred unless a later phase explicitly introduces safe strip measurement/state ownership for it

### Phase 4 Update

- Phase: Phase 4 - Voice Panel Copy, Docs, And Final Alignment
- Date: 2026-04-23
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/components/story-editor/VoiceSyncPanel.tsx`
  - `client/components/story-editor/VoiceSyncPanel.test.tsx`
  - `docs/MOBILE_USED_SURFACES.md`
  - `docs/DOCS_INDEX.md`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
- What actually changed:
  - updated `VoiceSyncPanel` copy to use the `Voice & Timing` product concept and Preview-workspace language
  - kept the existing sync button labels `Sync Voice & Timing` and `Syncing...`
  - fixed the voice metadata separator to an ASCII-safe `" - "`
  - updated `docs/MOBILE_USED_SURFACES.md` so `/api/story/sync` now describes the user opening `Voice & Timing` from the Preview workspace instead of a stale `Speech surface`
  - added `docs/PREVIEW_FLOW_REFACTOR_PLAN.md` to `docs/DOCS_INDEX.md` as an active implementation tracker only
  - added a focused `VoiceSyncPanel` render/copy test
- What differed from plan:
  - no additional runtime compatibility edits were required outside `VoiceSyncPanel.tsx`
  - `MOBILE_USED_SURFACES.md` and `DOCS_INDEX.md` both had their verification dates updated while landing the wording fixes
- Manual verification performed:
  - re-audited `PREVIEW_FLOW_REFACTOR_PLAN.md`, `VoiceSyncPanel.tsx`, `MOBILE_USED_SURFACES.md`, `DOCS_INDEX.md`, `StoryEditorScreen.tsx`, and existing related test inventory before editing
  - confirmed `VoiceSyncPanel` still opens from the existing Preview-owned modal flow in `StoryEditorScreen`
  - confirmed close, sync, and preview-toggle callback wiring remained unchanged in the panel
  - confirmed no preview readiness, render gating, sync behavior, rail behavior, or feature-flag behavior changed in this phase
  - confirmed `MOBILE_USED_SURFACES.md` now references `Voice & Timing` from Preview rather than a stale `Speech surface`
  - confirmed `DOCS_INDEX.md` lists the refactor plan as an implementation tracker only, not contract truth
  - recorded the user-reported manual Expo verification of the post-Phase-3 connected filmstrip, sync flow, and overall Preview flow as external verification context rather than repo-derived evidence
- Tests run:
  - `npm run check:types`
  - `npm run test:ci -- client/components/story-editor/VoiceSyncPanel.test.tsx`
- Env / feature flag state:
  - `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE` behavior unchanged
  - unified and legacy Step 3 branch selection preserved
- Follow-ups discovered:
  - legacy cleanup remains a separate follow-up and was not part of this refactor-completion phase
  - feature-flag removal remains out-of-scope follow-up work and did not happen here

### Phase 1D Update

- Phase: Phase 1D - Backend-Burned Ready Preview Captions Only
- Date: 2026-04-28
- Branch / PR: local working tree on `main`
- Release flag decision:
  - checked-in `eas.json` and `app.json` do not set `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE=1`
  - because external beta/release EAS env cannot be proven from repo truth, legacy `StoryPreviewShell` is treated as potentially user-visible
  - local RN ready-preview caption overlays were removed from both the unified `StoryboardPreviewStage` and the legacy fallback `StoryPreviewShell`
- Files changed:
  - `client/components/story-editor/StoryboardPreviewStage.tsx`
  - `client/components/story-editor/StoryboardSurface.tsx`
  - `client/components/story-editor/StoryboardSurface.test.tsx`
  - `client/components/story-editor/StoryPreviewShell.tsx`
  - `client/components/story-editor/StoryPreviewShell.test.tsx`
  - `client/screens/StoryEditorScreen.tsx`
  - `docs/MOBILE_USED_SURFACES.md`
  - `docs/PREVIEW_FLOW_REFACTOR_PLAN.md`
- What actually changed:
  - ready unified preview now renders only the backend preview video from `draftPreviewV1.artifact.url`
  - ready legacy fallback preview no longer overlays local RN caption text
  - `captionOverlayV1` and current caption metadata remain available upstream for timeline, voice modal, compatibility, and non-visual state
  - blocked/generate-preview UI, preview queue, polling, route contracts, billing, final render, and backend behavior were unchanged
- Tests run:
  - `npm run test:ci -- client/components/story-editor/StoryboardSurface.test.tsx client/components/story-editor/StoryPreviewShell.test.tsx` - pass
  - `npm run test:ci -- client/screens/StoryEditorScreen.test.tsx` - pass
  - `npm run test:ci` - pass
  - `npm run check:types` - pass
  - `npx prettier --check <changed Phase 1D files>` - pass

### Studio Preview Polish Update

- Phase: Focused UI composition/style polish for the mobile Preview surface
- Date: 2026-04-29
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/screens/StoryEditorScreen.tsx`
  - `client/components/FlowTabsHeader.tsx`
  - `client/components/story-editor/StoryboardSurface.tsx`
  - `client/components/story-editor/StoryboardPreviewStage.tsx`
  - `client/components/story-editor/StoryTimelineRail.tsx`
  - `client/components/story-editor/StoryPreviewShell.tsx`
  - related component/screen tests
- What actually changed:
  - recomposed the unified Preview surface into a larger studio-monitor-style hero with in-frame status, dark layered gradients, and a single blocked-state primary CTA
  - kept CTA routing UI-only: voice-not-current/local-draft states open existing `Voice & Timing`; current-voice preview missing/stale/failed states call existing `onRequestPreview`
  - visually docked transport controls and the filmstrip rail to the monitor and changed selected beat treatment to a subtle blue ring/glow
  - added a subtle selected-tab glow only for the active `storyboard`/Preview tab
  - applied restrained visual consistency to the legacy `StoryPreviewShell` fallback without changing fallback playback behavior
- Guardrail confirmation:
  - no backend, API route, billing, preview generation, voice sync, polling, finalize, or render behavior changed
  - no direct sync handler was passed into the Preview surface
  - no React Native ready-preview caption overlay was reintroduced; `storyboard-preview-caption` remains absent
  - backend/mobile contract docs were not changed because caller/route truth stayed unchanged

### Second Preview Simplification Update

- Phase: Second focused Preview UI simplification pass
- Date: 2026-04-30
- Branch / PR: local working tree on `main`
- Files changed:
  - `client/screens/StoryEditorScreen.tsx`
  - `client/components/story-editor/StoryboardSurface.tsx`
  - `client/components/story-editor/StoryboardPreviewStage.tsx`
  - `client/components/story-editor/StoryTimelineRail.tsx`
  - `client/components/story-editor/StoryPreviewShell.tsx`
  - related component/screen tests
- What actually changed:
  - removed the large duplicate internal `Preview` heading from the unified and fallback Preview surfaces
  - flattened the unified surface so the monitor shell owns compact top chrome, a dedicated 9:16 viewport, and a docked rail area
  - kept status and `Voice & Timing` outside the ready video viewport so burned-in captions are not obscured by persistent controls
  - simplified blocked/requesting copy to one headline plus one primary action or disabled `Generating...` state
  - compacted the filmstrip/transport rail so it reads as docked monitor chrome rather than a separate bulky card
  - kept the restrained fallback path behavior unchanged while removing duplicate helper/status copy
- Guardrail confirmation:
  - no backend, API route, billing, preview generation, voice sync, polling, finalize, or render behavior changed
  - ready playback still uses backend `draftPreviewV1.artifact.url`
  - no React Native ready-preview caption overlay was reintroduced; `storyboard-preview-caption` remains absent
  - backend/mobile contract docs were not changed because caller/route truth stayed unchanged

## Current Open Questions

- The exact visual token system for the mockup is not defined in repo assets or design docs. Implementation should aim toward the attached mockup direction while staying inside existing mobile theme/token patterns.
- The unified Preview workspace remains behind `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE`. Checked-in config does not prove beta/release enables it, so the legacy fallback should stay free of local RN ready-preview captions until a later explicit phase removes or permanently enables the flag.

## Recommended Execution Order

1. Flow Truth And Preview Entry Point
2. Preview Workspace Header, Status, And Voice CTA
3. Connected Duration Filmstrip Rail
4. Voice Panel Copy, Docs, And Final Alignment
