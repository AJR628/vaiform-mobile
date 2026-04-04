# MOBILE_RELEASE_RUNBOOK

Last verified against repo code: 2026-04-04.

Purpose: repo-scoped release/build guidance for the mobile app's store-build and OTA policy surfaces.

## Scope

- `app.json` release policy for runtime compatibility and update behavior
- `eas.json` preview versus production build-profile policy
- Release preflight and verification steps that are provable from repo state

## Current repo-owned release surface

- `app.json` owns the app version, package identifiers, runtime-version policy, and update behavior for the Expo app.
- `eas.json` owns the preview and production EAS Build profile names plus their channel names.
- `.github/workflows/mobile-ci.yml` is the current repo-owned CI lane; it now enforces the minimum release gate of `npm run check:types` and `npm run test:ci`.
- `.replit`, `server/README.md`, and `replit.md` remain local Replit/cloud deployment surfaces only; they are not the store-release lane for this repo.

## Release policy encoded in repo

- `app.json` now uses `runtimeVersion.policy = "appVersion"`.
- `app.json` now uses explicit `updates` behavior: enabled, `ON_LOAD`, and `fallbackToCacheTimeout = 0`.
- `eas.json` defines a `preview` build profile for internal distribution on the `preview` channel.
- `eas.json` defines a `production` build profile on the `production` channel.
- The profile names and channel names are repo policy only. They do not prove a linked Expo/EAS project, a configured update URL, or remote channel state.

## Preflight checklist

1. Confirm mobile docs front door still points to this doc and to `docs/MOBILE_USED_SURFACES.md`.
2. Confirm the current CI lane is green or rerun the repo's current checks (`npm run check:types` and `npm run test:ci`).
3. If a new binary is required, bump `expo.version` in `app.json` before building. The current runtime-version policy keys off app version.
4. Confirm the iOS bundle identifier and Android package name in `app.json` are still the intended store identifiers.
5. Confirm external operator prerequisites separately: Expo/EAS project linkage, signing credentials, and store account access.

## Preview build lane

1. Start from the repo root.
2. Confirm Expo/EAS authentication and project linkage outside repo state before running any build.
3. Build with the `preview` profile using the EAS CLI.
4. Treat the `preview` channel as the only OTA channel for non-production validation.
5. Record the produced artifact/build identifiers outside the repo; this repo does not track them.

## Production build lane

1. Repeat the preflight checklist with the exact commit intended for release.
2. Confirm whether the release needs a new binary or only an OTA update.
3. Build with the `production` profile using the EAS CLI for any new store binary.
4. Publish production OTA updates only after confirming the remote EAS project/channel wiring outside repo state.
5. Record the released commit SHA, build identifiers, and operator notes outside the repo.

## Verification standard

- `app.json` contains explicit `runtimeVersion` and `updates` keys.
- `eas.json` contains explicit `preview` and `production` build profiles.
- `docs/DOCS_INDEX.md` points here as the active mobile release/runbook doc.
- Local Replit/cloud deployment docs remain separate from store-release guidance.

## Explicit external unknowns

- Expo/EAS project linkage and remote channel wiring
- Apple App Store / Google Play account state
- Signing credentials and who holds them
- Store submission approval flow
- Whether a live preview build, production build, or OTA publish has been rehearsed
