# MOBILE_USED_SURFACES

- Status: CANONICAL
- Owner repo: mobile
- Source of truth for: exact current mobile callers, payloads sent, response fields read, and known unwired spec endpoints in this repo
- Canonical counterpart/source: backend contract truth lives in ../vaiform-1/docs/MOBILE_BACKEND_CONTRACT.md, ../vaiform-1/docs/MOBILE_HARDENING_PLAN.md, and ../vaiform-1/docs/LEGACY_WEB_SURFACES.md
- Last verified against: both repos on 2026-03-13

Generated from source on 2026-03-13.

Scope: exact current mobile repo behavior only. This file describes what the app actually calls today, what it sends, what it reads back, and which spec-sheet endpoints are still unwired. It does not describe intended behavior unless the repo already implements it.

## Ground Rules

- Authenticated API traffic is centralized in `client/api/client.ts`. Current live calls use `Authorization: Bearer <Firebase ID token>`, `Content-Type: application/json`, and `x-client: mobile`, and normalized responses now preserve backend `requestId` (`client/api/client.ts:147-260`).
- The app-wide React Query client exists, but no screen currently issues requests through `client/lib/query-client.ts`; the live surface is the hand-written API client plus a few direct media URL probes (`client/App.tsx:36-57`, `client/lib/query-client.ts`).
- Auth bootstrap no longer treats Firebase auth alone as app-ready. `AuthContext` now waits for `POST /api/users/ensure` before exposing the signed-in app state, and signs back out on provisioning failure (`client/contexts/AuthContext.tsx:82-149`, `client/navigation/RootStackNavigator.tsx:20-60`).
- Persisted active story session state is now scoped by UID, so sign-out/account-switch does not reuse another account's active session (`client/contexts/ActiveStorySessionContext.tsx:28-89`, `client/navigation/HomeStackNavigator.tsx:30-57`).
- `ShortDetailScreen` also probes returned media URLs with `HEAD` and fallback `Range` requests. Those hit the asset URL returned by shorts endpoints, not a Vaiform API route (`client/screens/ShortDetailScreen.tsx:397-425`).

## Shared / Context-Mediated Surfaces

### Auth bootstrap (`AuthContext`)

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `POST /api/users/ensure` | Firebase auth state change after sign-in; runs once per UID before the app leaves bootstrap loading | No body | On success, stores `{ uid, email, plan, freeShortsUsed }` in context for auth/account bootstrap. Billing UI uses `/api/usage` for account state. Error path reads `ok`, `code`, `message`, `requestId`, and bootstrap signs back out instead of entering the app half-provisioned. | `client/contexts/AuthContext.tsx:78-170`, `client/api/client.ts:509-514`, `client/api/client.ts:77-145` |
| `GET /api/usage` | Auth bootstrap immediately after successful `ensureUser()`, plus `refreshUsage()` used from `SettingsScreen` and after successful render in `StoryEditorScreen` | No body | Reads `data.plan`, `data.membership`, and `data.usage.availableSec`. Context stores the whole usage snapshot; billing screens read server-owned usage state rather than credits. Error path reads `ok`, `code`, `message`, `requestId`. | `client/contexts/AuthContext.tsx:129-190`, `client/api/client.ts:519-527`, `client/api/client.ts:77-145` |

## Screen-by-Screen Backend Usage

### `HomeScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `POST /api/story/start` | `runCreateFlow()` after input validation and optional "replace current project" confirmation | `{ input: trimmedInput, inputType }`; current UI only ever sends `inputType: "link"` or `"idea"` | Reads `data.id` as `sessionId`. Error path reads `ok`, `code`, `message`. The returned session payload is otherwise ignored here. | `client/screens/HomeScreen.tsx:79-107`, `client/api/client.ts:524-537` |
| `POST /api/story/generate` | Immediately after successful `/api/story/start` | `{ sessionId }` | Reads only `ok`, `code`, `message` for control flow. Returned session data is ignored here. | `client/screens/HomeScreen.tsx:109-127`, `client/api/client.ts:539-552` |

### `ScriptScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `GET /api/story/:sessionId` | Initial load | No body | Unwraps `data`, then reads `story.sentences` with fallbacks to `sentences` / `beats` via `extractBeats()`. Also reads `shots` only as a presence/length check to decide whether to show the "Generate Storyboard" CTA. Error path reads `ok`, `success`, `message`. | `client/screens/ScriptScreen.tsx:64-84`, `client/lib/storySession.ts:14-19`, `client/lib/storySession.ts:25-52`, `client/screens/ScriptScreen.tsx:88-96`, `client/api/client.ts:580-590` |
| `POST /api/story/plan` | "Generate Storyboard" CTA, step 1 | `{ sessionId }` | Reads only `ok` and `message`. Returned session data is ignored. | `client/screens/ScriptScreen.tsx:126-159`, `client/api/client.ts:554-565` |
| `POST /api/story/search` | "Generate Storyboard" CTA, step 2, after successful `/plan` | `{ sessionId }` | Reads only `ok` and `message`. Returned session data is ignored. | `client/screens/ScriptScreen.tsx:141-159`, `client/api/client.ts:567-578` |
| `POST /api/story/update-beat-text` | Saving an edited beat | `{ sessionId, sentenceIndex, text: cleaned }` | Unwraps the partial `{ sentences, shots }` payload and stores it; the screen then re-reads beats from top-level `sentences` / fallback paths. Error path reads `ok`, `success`, `message`. | `client/screens/ScriptScreen.tsx:162-209`, `client/lib/storySession.ts:25-52`, `client/api/client.ts:592-605` |
| `POST /api/story/delete-beat` | Delete confirmation on a beat | `{ sessionId, sentenceIndex }` | Reads only `ok`, `success`, `message`; immediately refetches `GET /api/story/:sessionId` for fresh SSOT data. | `client/screens/ScriptScreen.tsx:222-235`, `client/api/client.ts:607-622` |

### `StoryEditorScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `GET /api/story/:sessionId` | Initial load, focus refresh after clip replacement or beat deletion, and finalize recovery polling after timeout/network/409 states | No body | Unwraps `data`, then reads beats from `story.sentences` / fallback paths, reads `shots` to render deck cards and clip search entry state, reads `overlayCaption.placement` to seed caption placement, reads additive `billingEstimate.estimatedSec` for render gating/copy, reads `shot.selectedClip.thumbUrl` for thumbnails, reads `shot.searchQuery` when opening clip search, and during finalize recovery reads additive `renderRecovery.state`, `attemptId`, and `shortId`. Recovery logic only trusts `renderRecovery` when `attemptId` matches the active finalize attempt. Error path reads `ok`, `success`, `message`. | `client/screens/StoryEditorScreen.tsx:122-165`, `client/screens/StoryEditorScreen.tsx:371-521`, `client/screens/StoryEditorScreen.tsx:954-1009`, `client/api/client.ts:603-610` |
| `POST /api/caption/preview` | Selected beat preview and one-time beat prefetch via `useCaptionPreview` | Current caller sends `{ ssotVersion: 3, mode: "raster", measure: "server", text, frameW: 1080, frameH: 1920, placement, yPct }`. `style` is supported by the hook/client but is not populated by current `StoryEditorScreen` callsites. | Reads `data.meta.rasterUrl`, `rasterW`, `rasterH`, `xPx_png` when present, `yPx_png`, and `frameW` when present via the meta bag. These drive overlay sizing/position on the deck cards. | `client/screens/StoryEditorScreen.tsx:507-533`, `client/hooks/useCaptionPreview.ts:59-120`, `client/api/client.ts:342-454`, `client/screens/StoryEditorScreen.tsx:175-186`, `client/screens/StoryEditorScreen.tsx:229-273` |
| `POST /api/story/update-beat-text` | Saving the currently selected beat from the inline editor | `{ sessionId, sentenceIndex, text: draft }` | Reads only `ok`, `success`, `message`; on success it updates local `beatTexts` and does not consume the returned partial `{ sentences, shots }` payload. | `client/screens/StoryEditorScreen.tsx:679-701`, `client/api/client.ts:592-605` |
| `POST /api/story/delete-beat` | Delete confirmation from the beat actions modal | `{ sessionId, sentenceIndex: deletedIndex }` | Reads only `ok`, `success`, `message`; immediately refetches `GET /api/story/:sessionId`, then rebuilds local beat text state from the refetched session. | `client/screens/StoryEditorScreen.tsx:715-749`, `client/api/client.ts:607-622` |
| `POST /api/story/update-caption-style` | User taps Top / Center / Bottom placement control | `{ sessionId, overlayCaption: { placement, yPct } }` | Reads only `ok`, `success`, `message`. The returned `overlayCaption` is not consumed; the screen relies on local optimistic state and fallback refs. | `client/screens/StoryEditorScreen.tsx:765-820`, `client/api/client.ts:655-670` |
| `POST /api/story/finalize` | Render confirmation in the storyboard header | Body stays exactly `{ sessionId }`. Header includes `X-Idempotency-Key`, generated when a real finalize attempt begins, stored in a stable ref for the active attempt, and reused for the built-in 503 retry and recovery path. | Reads `ok`, `retryAfter`, `code`, `status`, `message`, and `shortId`. On success it also reads additive `data.billing.billedSec` when present for success messaging, refreshes usage, and cross-navigates to `LibraryTab -> ShortDetail` with `{ shortId }`. On `TIMEOUT`, `NETWORK_ERROR`, or `IDEMPOTENT_IN_PROGRESS`, the screen now switches to backend-backed recovery via `GET /api/story/:sessionId`, keeps the same active attempt key, and only clears it after a same-attempt terminal `renderRecovery` state. | `client/screens/StoryEditorScreen.tsx:1012-1139`, `client/api/client.ts:716-804` |
| `GET /api/usage` | Indirect, after successful finalize, via `refreshUsage()` | No body | Reads `data.usage.availableSec` through `AuthContext.refreshUsage()`. | `client/screens/StoryEditorScreen.tsx:926-951`, `client/contexts/AuthContext.tsx:172-190`, `client/api/client.ts:519-527` |

### `ClipSearchModal`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `POST /api/story/search-shot` | Search submit and initial auto-search from `initialQuery` | `{ sessionId, sentenceIndex, query, page: 1 }` | Unwraps response, then reads `shot.candidates`, `page`, and `hasMore`. Candidate cards read `id`, `thumbUrl`, `provider`, and `duration`. `hasMore` is stored in state but current UI does not render a "load more" control. | `client/screens/ClipSearchModal.tsx:49-80`, `client/screens/ClipSearchModal.tsx:107-145`, `client/api/client.ts:624-638` |
| `POST /api/story/update-shot` | User taps a candidate clip | `{ sessionId, sentenceIndex, clipId }` | Reads only `ok`, `success`, `message`; on success it simply closes the modal. Returned session data is ignored. | `client/screens/ClipSearchModal.tsx:83-104`, `client/api/client.ts:640-653` |

### `LibraryScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `GET /api/shorts/mine?limit=24[&cursor=...]` | Initial load and explicit "Load More" press | No body; query string is `limit=24` and optional `cursor=<nextCursor>` | Reads `data.items`, `data.nextCursor`, `data.hasMore`. For each short card, reads `id`, `status`, `videoUrl`, `thumbUrl`, `coverImageUrl`, `quoteText`, `durationSec`, and `createdAt`. Only items with `status === "ready"` and `videoUrl` navigate through to detail. | `client/screens/LibraryScreen.tsx:80-118`, `client/screens/LibraryScreen.tsx:120-142`, `client/screens/LibraryScreen.tsx:168-245`, `client/api/client.ts:487-504`, `client/api/client.ts:265-289` |

### `ShortDetailScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `GET /api/shorts/:id` | When route params contain `shortId` and not `short`; also manual retry; also auto-retry when detail lacks `videoUrl` | No body | On success, stores `ShortDetail`, then adapts it into a `ShortItem`-like object by reading `id`, `videoUrl`, `coverImageUrl`, `durationSec`, `usedQuote.text`, `usedTemplate`, and `createdAt`. Backend detail now also returns compatibility `jobId`, but the screen still reads `id` and ignores `jobId`. Error path reads `ok`, `status`, `code`, `message`. | `client/screens/ShortDetailScreen.tsx:143-333`, `client/screens/ShortDetailScreen.tsx:335-380`, `client/screens/ShortDetailScreen.tsx:513-529`, `client/api/client.ts:291-307`, `client/api/client.ts:506-518` |
| `GET /api/shorts/mine?limit=50` | Fallback during post-render eventual consistency: every other 404 attempt while waiting for `/api/shorts/:id` to become available | No body; query string is `limit=50` | Reads `data.items`, then filters by `item.id === shortId && item.status === "ready" && item.videoUrl`. If found, swaps route params to `{ short }` and stops using `/api/shorts/:id`. | `client/screens/ShortDetailScreen.tsx:212-276`, `client/api/client.ts:487-504` |

Current `ShortDetailScreen` UI reads these fields from the resolved `short` object, whether it came from `LibraryScreen` or from the adapted detail response: `videoUrl`, `thumbUrl`, `coverImageUrl`, `quoteText`, `id`, `durationSec`, `template`, `mode`, `status`, and `createdAt` (`client/screens/ShortDetailScreen.tsx:382-425`, `client/screens/ShortDetailScreen.tsx:612-727`).

### `SettingsScreen`

| Endpoint | Trigger | Payload sent | Response fields read now | Evidence |
|---|---|---|---|---|
| `GET /api/usage` | "Refresh render time" button, via `refreshUsage()` | No body | Reads `data.usage.availableSec` through `AuthContext`, then renders a render-time balance label in the settings card. | `client/screens/SettingsScreen.tsx:43-59`, `client/screens/SettingsScreen.tsx:122-150`, `client/contexts/AuthContext.tsx:172-190`, `client/api/client.ts:519-527` |

## Live Endpoints Missing From `vaiform-mobile-spec-sheet`

These endpoints are live in the repo but are not listed in the spec sheet's canonical endpoint inventory.

| Endpoint | Current usage | Evidence |
|---|---|---|
| `POST /api/caption/preview` | Used by `StoryEditorScreen` through `useCaptionPreview` for server-measured caption raster previews and deck overlay placement. | `client/hooks/useCaptionPreview.ts:59-120`, `client/api/client.ts:342-454`, `client/screens/StoryEditorScreen.tsx:507-533` |
| `POST /api/story/update-caption-style` | Used by `StoryEditorScreen` to persist `overlayCaption.placement` and `yPct`. | `client/screens/StoryEditorScreen.tsx:765-820`, `client/api/client.ts:655-670` |

## Spec Endpoints Currently Unwired

These routes are present in `vaiform-mobile-spec-sheet` but have no current screen/context callsite in this repo.

| Spec endpoint | Current repo state | Evidence |
|---|---|---|
| `GET /api/user/me` | No wrapper in `client/api/client.ts`; no import/callsite in `client/`. | `vaiform-mobile-spec-sheet:112`, `vaiform-mobile-spec-sheet:243` |
| `POST /api/story/update-script` | No wrapper; no callsite. Current editing uses `POST /api/story/update-beat-text` instead. | `vaiform-mobile-spec-sheet:125` |
| `POST /api/story/insert-beat` | No wrapper; no callsite. | `vaiform-mobile-spec-sheet:127`, `vaiform-mobile-spec-sheet:770` |
| `GET /api/voice/voices` | No wrapper; no callsite. | `vaiform-mobile-spec-sheet:143`, `vaiform-mobile-spec-sheet:1072` |
| `POST /api/voice/preview` | No wrapper; no callsite. | `vaiform-mobile-spec-sheet:144`, `vaiform-mobile-spec-sheet:1126` |
| `POST /api/tts/preview` | No wrapper; no callsite. | `vaiform-mobile-spec-sheet:145`, `vaiform-mobile-spec-sheet:1186` |
| `GET /health` | Wrapper exists as `healthCheck()`, but there is no current caller. | `vaiform-mobile-spec-sheet:149`, `client/api/client.ts:237-239` |

## Screens With No Vaiform API Traffic

- `LoginScreen` has no direct Vaiform API call. It only invokes Firebase auth helpers from `AuthContext`; the first Vaiform API hit happens later in `AuthContext` via `POST /api/users/ensure` (`client/screens/LoginScreen.tsx`, `client/contexts/AuthContext.tsx:58-85`).
- `ProfileScreen` has no Vaiform API traffic (`client/screens/ProfileScreen.tsx`).
- `ModalScreen` has no Vaiform API traffic (`client/screens/ModalScreen.tsx`).

## Notes On Naming Mismatch In Shorts Detail

- The spec sheet names the detail route as `GET /api/shorts/:jobId` (`vaiform-mobile-spec-sheet:137`, `vaiform-mobile-spec-sheet:1024`).
- The current mobile client wrapper is `getShortDetail(id)` and calls `GET /api/shorts/${id}` (`client/api/client.ts:506-518`).
- Current screen code treats `short.id`, `shortId`, and the spec's `jobId` as the same identifier for navigation and fetch purposes (`client/screens/LibraryScreen.tsx:140-141`, `client/screens/StoryEditorScreen.tsx:887-891`, `client/screens/ShortDetailScreen.tsx:92-95`, `client/screens/ShortDetailScreen.tsx:233-248`).
