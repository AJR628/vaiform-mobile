# DOCS_INDEX

- Status: CONSUMER_NOTE
- Owner repo: mobile
- Source of truth for: active mobile-repo docs ownership and where canonical backend/mobile truth lives
- Canonical counterpart/source: backend repo `docs/CROSS_REPO_PRODUCTION_HARDENING_PLAN.md`, backend repo `docs/MOBILE_BACKEND_CONTRACT.md`, backend repo `docs/MOBILE_HARDENING_PLAN.md`, backend repo `docs/LEGACY_WEB_SURFACES.md`
- Last verified against: both repos on 2026-03-23

## Active Root Docs

- README.md - repo front door; points here first.
- docs/MOBILE_RELEASE_RUNBOOK.md - active mobile release/config doc for store-build policy and OTA/update discipline.
- docs/MOBILE_USED_SURFACES.md - CANONICAL in the mobile repo for exact current mobile usage.
- docs/MOBILE_BACKEND_CONTRACT.md - CONSUMER_NOTE only; points back to backend-owned canonical contract docs.
- docs/DOCS_INDEX.md - CONSUMER_NOTE for ownership and navigation only.

## Active Docs Map

Trust these first for current work:

- mobile repo `README.md`
- mobile repo `docs/DOCS_INDEX.md`
- mobile repo `docs/MOBILE_RELEASE_RUNBOOK.md`
- mobile repo `docs/MOBILE_USED_SURFACES.md`
- backend repo `docs/CROSS_REPO_PRODUCTION_HARDENING_PLAN.md`
- backend repo `docs/MOBILE_BACKEND_CONTRACT.md`
- backend repo `docs/MOBILE_HARDENING_PLAN.md`
- backend repo `docs/LEGACY_WEB_SURFACES.md`

Do not start from reports, archives, or the root spec sheet unless one of the docs above sends you there.

## Transport Ownership

- `client/api/client.ts` is the active transport owner for the current mobile-used backend flows.
- React Query is no longer part of the active mobile runtime path in this repo.
- Do not introduce a second client-side transport owner unless a later intentional migration plan says otherwise.

## Local Server / Build Surface

- `server/` is local build/deployment support for Expo/Replit flows in this repo.
- It is not backend contract truth and it is not the Vaiform backend repo.
- For the current local classification and entrypoints, see `server/README.md`.

## Release Surface

- `app.json` is the repo-owned source for mobile runtime-version and update behavior.
- `eas.json` is the repo-owned source for preview versus production build-profile names and channel names.
- `.github/workflows/mobile-ci.yml` is the current CI test lane; it is not a store submission or release automation lane.
- `.replit`, `server/README.md`, and `replit.md` stay classified as local Replit/cloud deployment support, not store-release docs.

## Backend Canonical Truth

Canonical backend/mobile contract and hardening truth lives in the backend repo:

- backend repo `docs/CROSS_REPO_PRODUCTION_HARDENING_PLAN.md`
- backend repo `docs/MOBILE_BACKEND_CONTRACT.md`
- backend repo `docs/MOBILE_HARDENING_PLAN.md`
- backend repo `docs/LEGACY_WEB_SURFACES.md`

## Non-Canonical Historical Material

- `vaiform-mobile-spec-sheet` is a stale root-level spec retained only for historical context and gap tracking.
- `replit.md` is retained for historical/tooling context only. It is not canonical for current transport ownership or backend-contract truth.
- docs/reports/ contains working reports and verification notes that may still be useful but are not contract truth.
- docs/_archive/ contains superseded audits, plans, and stale spec-era documents kept only for history.

## Drift Rule

If two docs overlap, keep contract truth in the backend repo and keep current caller truth in docs/MOBILE_USED_SURFACES.md. Do not maintain duplicate route-contract docs in this repo.
