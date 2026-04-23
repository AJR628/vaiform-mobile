# PREVIEW_FLOW_REFACTOR_PLAN

- Status: Planned
- Owner repo: mobile
- Purpose: Single source of truth for the mobile Preview-flow refactor so phased implementation stays aligned with approved UX direction, current repo architecture, and existing backend/mobile behavior.
- Last verified against repo: 2026-04-23
- Current phase: Phase 1 completed; Phase 2 not started

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

- `StoryEditorScreen` owns workspace state, preview playback orchestration, render gating, and the voice-sync modal flow. Evidence: `client/screens/StoryEditorScreen.tsx:91-92`, `client/screens/StoryEditorScreen.tsx:151-193`, `client/screens/StoryEditorScreen.tsx:194-218`, `client/screens/StoryEditorScreen.tsx:452-460`, `client/screens/StoryEditorScreen.tsx:704-748`.
- `FlowTabsHeader` currently exposes `storyboard` and `speech` as peer visible steps. Evidence: `client/components/FlowTabsHeader.tsx:6-14`, `client/components/FlowTabsHeader.tsx:53-73`.
- `StoryEditorScreen` currently wires the visible `Speech` pill to `openVoiceSyncModal()` instead of a routed screen. Evidence: `client/screens/StoryEditorScreen.tsx:452-455`, `client/screens/StoryEditorScreen.tsx:468-481`.
- `StoryboardSurface` is already the unified Step 3 Preview workspace render surface, composing `StoryboardPreviewStage` and `StoryTimelineRail`. Evidence: `client/components/story-editor/StoryboardSurface.tsx:15-49`, `client/components/story-editor/StoryboardSurface.tsx:89-128`.
- `StoryTimelineRail` already remains the rail owner and already derives tile width from `durationSec`, but renders disconnected portrait cards today. Evidence: `client/components/story-editor/StoryTimelineRail.tsx:40-44`, `client/components/story-editor/StoryTimelineRail.tsx:125-187`, `client/components/story-editor/StoryTimelineRail.tsx:224-233`.
- `useStep3SessionModel` remains the composition point for preview playback state plus voice sync state. Evidence: `client/screens/story-editor/useStep3SessionModel.ts:40-57`, `client/screens/story-editor/useStep3SessionModel.ts:59-111`.
- `Step3BeatRailItem` remains the rail data contract and already contains `startTimeSec`, `endTimeSec`, `durationSec`, `clipThumbUrl`, `clipUrl`, `sentenceIndex`, and `text`. Evidence: `client/screens/story-editor/step3.ts:36-45`, `client/screens/story-editor/step3.ts:314-349`.
- Unified Step 3 is still behind the feature flag `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE === "1"`. Evidence: `client/screens/story-editor/featureFlags.ts:1-3`, `client/screens/StoryEditorScreen.tsx:82`, `client/screens/StoryEditorScreen.tsx:541-639`, `client/screens/StoryEditorScreen.test.tsx:217-279`.
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

## Current Open Questions

- The exact visual token system for the mockup is not defined in repo assets or design docs. Implementation should aim toward the attached mockup direction while staying inside existing mobile theme/token patterns.
- The unified Preview workspace remains behind `EXPO_PUBLIC_STEP3_UNIFIED_SURFACE`. This plan preserves that rollout boundary unless a later explicit phase changes it.

## Recommended Execution Order

1. Flow Truth And Preview Entry Point
2. Preview Workspace Header, Status, And Voice CTA
3. Connected Duration Filmstrip Rail
4. Voice Panel Copy, Docs, And Final Alignment
