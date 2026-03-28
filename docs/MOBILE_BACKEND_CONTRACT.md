# MOBILE_BACKEND_CONTRACT

- Status: CONSUMER_NOTE
- Owner repo: mobile
- Source of truth for: mobile-side pointer to backend-owned contract docs and local alignment rules for this repo
- Canonical counterpart/source: ../vaiform-1-clean/docs/SCRIPT_CONTROL_PREIMPLEMENTATION_AUDIT.md, ../vaiform-1-clean/docs/MOBILE_BACKEND_CONTRACT.md, ../vaiform-1-clean/docs/MOBILE_HARDENING_PLAN.md, ../vaiform-1-clean/docs/LEGACY_WEB_SURFACES.md
- Last verified against: both repos on 2026-03-24

This file is not a second canonical contract document. The backend repo owns backend/mobile contract truth.

## Canonical Backend Truth

Use these backend docs as the canonical source before changing any mobile-used route behavior:

- ../vaiform-1-clean/docs/SCRIPT_CONTROL_PREIMPLEMENTATION_AUDIT.md for the current script-writing user-control verification freeze
- ../vaiform-1-clean/docs/MOBILE_BACKEND_CONTRACT.md
- ../vaiform-1-clean/docs/MOBILE_HARDENING_PLAN.md
- ../vaiform-1-clean/docs/LEGACY_WEB_SURFACES.md

## Mobile Repo Rule

The mobile repo keeps one canonical usage doc only:

- docs/MOBILE_USED_SURFACES.md for what the mobile app currently calls, sends, and reads.

If backend route behavior changes, update the backend canonical docs first. Update docs/MOBILE_USED_SURFACES.md in this repo only when actual mobile usage changes.

## Current Local Alignment Note

- Active billing path used by mobile is GET /api/usage.
- Current mobile readers are AuthContext bootstrap + refreshUsage(), surfaced by SettingsScreen and post-render refresh in StoryEditorScreen.
- Current billing fields read by mobile are `data.usage.availableSec` and session `billingEstimate.estimatedSec`.
- StoryEditorScreen reads the current backend-owned session `billingEstimate.estimatedSec` when presenting render confirmation and does not call any separate estimate-refresh route before render.
- Current `/api/users/ensure` profile shape used by mobile is `{ uid, email, plan, freeShortsUsed }`.
- Do not reintroduce GET /credits, backend aliases, or a global /api base-URL convention in this repo.
- Auth bootstrap remains ensureUser()-driven in this repo, but app readiness now also depends on the canonical usage fetch.
