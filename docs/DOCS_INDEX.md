# DOCS_INDEX

- Status: CONSUMER_NOTE
- Owner repo: mobile
- Source of truth for: active mobile-repo docs ownership and where canonical backend/mobile truth lives
- Canonical counterpart/source: ../vaiform-1/docs/MOBILE_BACKEND_CONTRACT.md, ../vaiform-1/docs/MOBILE_HARDENING_PLAN.md, ../vaiform-1/docs/LEGACY_WEB_SURFACES.md
- Last verified against: both repos on 2026-03-07

## Active Root Docs

- docs/MOBILE_USED_SURFACES.md — CANONICAL in the mobile repo for exact current mobile usage.
- docs/MOBILE_BACKEND_CONTRACT.md — CONSUMER_NOTE only; points back to backend-owned canonical contract docs.
- docs/DOCS_INDEX.md — CONSUMER_NOTE for ownership and navigation only.

## Backend Canonical Truth

Canonical backend/mobile contract and hardening truth lives in the backend repo:

- ../vaiform-1/docs/MOBILE_BACKEND_CONTRACT.md
- ../vaiform-1/docs/MOBILE_HARDENING_PLAN.md
- ../vaiform-1/docs/LEGACY_WEB_SURFACES.md

## Non-Canonical Historical Material

- docs/reports/ contains working reports and verification notes that may still be useful but are not contract truth.
- docs/_archive/ contains superseded audits, plans, and stale spec-era documents kept only for history.

## Drift Rule

If two docs overlap, keep contract truth in the backend repo and keep current caller truth in docs/MOBILE_USED_SURFACES.md. Do not maintain duplicate route-contract docs in this repo.