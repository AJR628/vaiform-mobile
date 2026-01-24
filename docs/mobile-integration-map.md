# Mobile Integration Map + Next Wiring Plan (SSOT)

**Generated:** Repo audit, SSOT semantics only  
**References:** `docs/INTEGRATION_AUDIT.md`, `docs/PHASE_0_AUDIT.md`, `vaiform-mobile-spec-sheet`  
**Scope:** vaiform-mobile client; no backend changes.

> **⚠️ SSOT Guardrails:** See `docs/PHASE_0_AUDIT.md` for canonical functions/files that must not be duplicated. Key SSOT: `client/api/client.ts` (API wrappers), `extractBeats`/`getSelectedShot` (StoryEditorScreen), `unwrapSession` (currently duplicated, needs consolidation).

---

## 1. Current Integration Snapshot (What's wired today)

- **Ensure user on sign-in:** `AuthContext` calls `ensureUser()` once per UID after Firebase auth. Verified: `client/contexts/AuthContext.tsx` (lines 63–76), `client/api/client.ts` → `POST /api/users/ensure` (lines 299–312).
- **Start → generate → plan → search → StoryEditor:** `HomeScreen` runs `storyStart` → `storyGenerate` → `storyPlan` → `storySearchAll`, then `navigation.navigate("StoryEditor", { sessionId })`. Verified: `client/screens/HomeScreen.tsx` (lines 59–130).
- **StoryEditor load:** `StoryEditorScreen` loads session via `storyGet(sessionId)` on mount, uses `unwrapSession` / `extractBeats` / `getSelectedShot` for display. Verified: `client/screens/StoryEditorScreen.tsx` (lines 124–186, 209, 283–296, 361–363).
- **Update beat text:** `StoryEditorScreen` calls `storyUpdateBeatText({ sessionId, sentenceIndex, text })` on beat blur. Verified: `client/screens/StoryEditorScreen.tsx` (lines 248–281), `client/api/client.ts` (lines 433–444).
- **Replace clip flow:** Header/menu "Replace Clip" sets `replaceModalForIndex`, then navigates to `ClipSearch` with `{ sessionId, sentenceIndex, initialQuery }`. `ClipSearchModal` calls `storySearchShot` then `storyUpdateShot` on clip tap, then `goBack()`. Verified: `client/screens/StoryEditorScreen.tsx` (lines 283–293, 366–447), `client/screens/ClipSearchModal.tsx` (lines 58–114), `client/navigation/HomeStackNavigator.tsx` (lines 12–16, 40–46).
- **Refresh-after-clip-swap:** `handleReplaceClip` sets `shouldRefreshRef.current = true` before navigating to ClipSearch. `useFocusEffect` on StoryEditor refetches via `storyGet` only when that flag is set, then clears it. Verified: `client/screens/StoryEditorScreen.tsx` (lines 122, 189–207, 284–286).
- **Shorts library:** `LibraryScreen` fetches via `getMyShorts(cursor, 24)`, shows list, "Load More" with `nextCursor`. Tap navigates to `ShortDetail` with `{ short }` (list item). Verified: `client/screens/LibraryScreen.tsx` (lines 79–141, 166–194, 240–248), `client/api/client.ts` (lines 328–341).
- **Short detail playback:** `ShortDetailScreen` receives `short` from route params, uses `short.videoUrl` / `short.thumbUrl` etc. for playback. No `getShortDetail` call. Verified: `client/screens/ShortDetailScreen.tsx` (lines 84–101, 250–254), `client/navigation/LibraryStackNavigator.tsx` (lines 12–14, 40–45).
- **Credits fetch:** `getCredits()` exists; `AuthContext` uses it in `refreshCredits()`. Credits stored in `userProfile.credits`. Not shown in UI. Verified: `client/api/client.ts` (lines 316–323), `client/contexts/AuthContext.tsx` (lines 87–103).
- **API base URL:** `process.env.EXPO_PUBLIC_API_BASE_URL` with fallback `https://your-vaiform-backend.com`. Verified: `client/api/client.ts` (lines 5–7).
- **Auth token:** `getIdToken()` in `client/api/client.ts` reads `auth.currentUser`, caches token, injects `Authorization: Bearer <token>` and `x-client: mobile` for authed requests. Verified: `client/api/client.ts` (lines 12–37, 125–139, 179–193, 483–493).

---

## 2. End-to-End Wiring Map (Backend → Mobile)

### Ensure user
- **Backend route:** `POST /api/users/ensure`
- **Mobile callsite(s):** `AuthContext.tsx` → `ensureUser()` (on auth state change, once per UID).
- **Auth path:** Token from `getIdToken()` → `Authorization` and `x-client` in `apiRequestNormalized` (used by `ensureUser`).
- **Data mapping:** No request body. Response `{ success, data }` → `normalizeResponse` → `data` as `UserProfile`; `AuthContext` sets `userProfile` from `result.data`.
- **Semantics:** `uid`, `email`, `plan`, `credits`, etc. from backend.
- **Notes:** `ensureUser` uses `apiRequestNormalized` (see `client/api/client.ts` 301–312). Ensured UID guarded by `ensuredUidRef` to avoid duplicate calls.

### Start story session
- **Backend route:** `POST /api/story/start`
- **Mobile callsite(s):** `HomeScreen.tsx` → `handleCreateStoryboard` → `storyStart(...)` (lines 61–64).
- **Auth path:** Same as above via `apiRequestNormalized`.
- **Data mapping:** Request: `{ input, inputType }`. `inputType` is `"link" | "idea"` only in UI (no "paragraph"). Response → `data`; `sessionId = startResult.data?.id`.
- **Semantics:** `sessionId` used for all downstream story calls.
- **Notes:** `styleKey` supported in API but not sent from HomeScreen.

### Generate story
- **Backend route:** `POST /api/story/generate`
- **Mobile callsite(s):** `HomeScreen.tsx` → `storyGenerate({ sessionId })` (lines 86–87).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId }`. Response → normalized `data`; session shape with `story.sentences` etc.
- **Semantics:** `sessionId`.

### Plan story
- **Backend route:** `POST /api/story/plan`
- **Mobile callsite(s):** `HomeScreen.tsx` → `storyPlan({ sessionId })` (lines 100–101).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId }`. Response → normalized `data`.
- **Semantics:** `sessionId`.

### Search clips (all shots)
- **Backend route:** `POST /api/story/search`
- **Mobile callsite(s):** `HomeScreen.tsx` → `storySearchAll({ sessionId })` (lines 114–115).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId }`. Response → normalized `data` (session with `shots`).
- **Semantics:** `sessionId`.
- **Notes:** Only used in Home create flow before navigating to StoryEditor. Editor does not auto-trigger plan/search when `status === "story_generated"`.

### Get session
- **Backend route:** `GET /api/story/:sessionId`
- **Mobile callsite(s):** `StoryEditorScreen.tsx` → `storyGet(sessionId)` in `loadSession` (useEffect) and in `useFocusEffect` refresh (lines 126, 194–195).
- **Auth path:** Same.
- **Data mapping:** No body. Response → `unwrapSession(res)` → `res.data` when `res.ok` or `res.success`; then `extractBeats` / `getSelectedShot` for UI.
- **Semantics:** `sessionId` from route params.
- **Notes:** Refresh only when `shouldRefreshRef.current` is true (e.g. after returning from ClipSearch).

### Update beat text
- **Backend route:** `POST /api/story/update-beat-text`
- **Mobile callsite(s):** `StoryEditorScreen.tsx` → `handleSaveBeat` → `storyUpdateBeatText({ sessionId, sentenceIndex, text })` (lines 258–266).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId, sentenceIndex, text }`. Response → normalized; UI keeps local `beatTexts` in sync, no refetch on success.
- **Semantics:** `sessionId`, `sentenceIndex`, `text`.

### Search clips for a shot
- **Backend route:** `POST /api/story/search-shot`
- **Mobile callsite(s):** `ClipSearchModal.tsx` → `handleSearch` → `storySearchShot({ sessionId, sentenceIndex, query, page: 1 })` (lines 62–68).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId, sentenceIndex, query?, page? }`. Response → `unwrapSession`; `shot = unwrapped.shot`, `candidates = shot.candidates`, `page`, `hasMore`. State: `candidates`, `page`, `hasMore`.
- **Semantics:** `sessionId`, `sentenceIndex`, `query`, `page`.
- **Notes:** Search always uses `page: 1`. `hasMore` is stored but no "Load More" / pagination implemented.

### Update shot / replace clip
- **Backend route:** `POST /api/story/update-shot`
- **Mobile callsite(s):** `ClipSearchModal.tsx` → `handleSelectClip` → `storyUpdateShot({ sessionId, sentenceIndex, clipId })` (lines 94–99).
- **Auth path:** Same.
- **Data mapping:** Request: `{ sessionId, sentenceIndex, clipId }`. Response → check `res.ok` / `res.success`; on success, `navigation.goBack()`. StoryEditor refreshes via `useFocusEffect` when `shouldRefreshRef` was set.
- **Semantics:** `sessionId`, `sentenceIndex`, `clipId`.

### Get credits
- **Backend route:** `GET /credits`
- **Mobile callsite(s):** `AuthContext.tsx` → `refreshCredits` → `getCredits()` (lines 90–92). No UI calls.
- **Auth path:** Same.
- **Data mapping:** Response may have top-level `credits`; `normalizeResponse` uses `obj.data ?? obj` when `success`. `CreditsResponse`: `uid`, `email`, `credits`.
- **Semantics:** `credits` merged into `userProfile` in AuthContext.

### Get shorts list
- **Backend route:** `GET /api/shorts/mine?limit=24&cursor=...`
- **Mobile callsite(s):** `LibraryScreen.tsx` → `fetchShorts` → `getMyShorts(cursor, 24)` (lines 79–106, 109–111).
- **Auth path:** Same.
- **Data mapping:** Response → `items`, `nextCursor`, `hasMore`. List uses `ShortItem`; navigation passes `short` (list item) to ShortDetail.
- **Semantics:** `cursor`, `limit`; list item `id` used as key (spec also mentions `jobId` for detail).

### Get short detail (API only)
- **Backend route:** `GET /api/shorts/:jobId` (spec). Client uses `GET /api/shorts/${id}`.
- **Mobile callsite(s):** `getShortDetail(id)` exists in `client/api/client.ts` (lines 347–354). **No screen calls it.** ShortDetail uses list-item `short` from route params only.
- **Auth path:** Same.
- **Data mapping:** N/A for current UI.
- **Notes:** Spec "Get single short details". Repo: **NOT USED**; ShortDetail is list-item-only.

### Finalize / render (API only)
- **Backend route:** `POST /api/story/finalize`
- **Mobile callsite(s):** `storyFinalize` implemented in `client/api/client.ts` (lines 476–553). **No screen calls it.** No Render button, no rendering modal.
- **Auth path:** Custom fetch in `storyFinalize`; `getIdToken()` → `Authorization` + `x-client`.
- **Data mapping:** Request: `{ sessionId }`. Response: `success`, `data`, top-level `shortId`; 503 → `Retry-After` header. `normalizeResponse` used; `shortId` and `retryAfter` merged into return. No 15‑minute timeout in fetch.
- **Semantics:** `sessionId`; success → `shortId` (= `finalVideo.jobId`).
- **Notes:** **SPEC REQUIRED, NOT WIRED IN UI.** Render flow (credit check, modal, navigate to ShortDetail on success) missing.

---

## 3. SSOT Semantics Table

| Concept | Exact repo term | Where defined / used |
|--------|------------------|----------------------|
| Session identifier | `sessionId` | `HomeStackParamList.StoryEditor`, `ClipSearch` params; `HomeScreen`, `StoryEditorScreen`, `ClipSearchModal`; all story API bodies |
| Shot / beat index | `sentenceIndex` | `StoryEditorScreen` (Beat, getSelectedShot, handleSaveBeat, handleReplaceClip); `ClipSearchModal` route params and API; story API `update-beat-text`, `search-shot`, `update-shot` |
| Clip identifier | `clipId` | `storyUpdateShot` body; `ClipSearchModal` `handleSelectClip(item.id)` |
| Story session type | `StorySession` | `client/types/story.ts` (currently `any`); `client/api/client.ts` story helpers |
| Unwrap response | `unwrapSession(res)` | `StoryEditorScreen.tsx` (lines 41–45, 136, 196–197); `ClipSearchModal.tsx` (lines 36–40, 75) |
| Extract beats | `extractBeats(session)` | `StoryEditorScreen.tsx` (lines 51–78, 142, 161, 209) |
| Shot for beat | `getSelectedShot(session, sentenceIndex)` | `StoryEditorScreen.tsx` (lines 83–96, 284, 296, 361) |
| Refresh after swap | `shouldRefreshRef` | `StoryEditorScreen.tsx` (lines 122, 191–192, 286) |
| List short id | `short.id` | `LibraryScreen`, `ShortDetailScreen`; `getShortDetail` uses `id` in path |
| API base URL | `EXPO_PUBLIC_API_BASE_URL` | `client/api/client.ts` (lines 5–7) |

---

## 4. Source-of-Truth Code Paths

- **API wrapper:** `client/api/client.ts`. All story/shorts/credits/ensure calls go through `apiRequestNormalized` or `apiRequest` (or custom fetch in `storyFinalize`). **SSOT:** single place for base URL, headers, and response normalization.
- **Auth token helper:** `getIdToken()` in `client/api/client.ts` (lines 12–32). Uses `auth.currentUser` from `@/lib/firebase`. **SSOT:** token fetch and cache; all authed requests use this.
- **Session unwrap:** `unwrapSession(res)` is defined **twice** — in `StoryEditorScreen.tsx` (lines 41–45) and `ClipSearchModal.tsx` (lines 36–40). Logic is identical. **SSOT:** should be single shared helper; today both are local.
- **Beat extraction:** `extractBeats(session)` only in `StoryEditorScreen.tsx` (lines 51–78). **SSOT:** canonical derivation of beats from session (`story.sentences` → fallbacks `sentences` / `beats`).
- **Shot selection:** `getSelectedShot(session, sentenceIndex)` only in `StoryEditorScreen.tsx` (lines 83–96). **SSOT:** canonical mapping from session + `sentenceIndex` to shot (array or map).

---

## 5. Gaps vs Mobile Spec (What is NOT wired yet)

### 5.1 Render flow (finalize)
- **Spec:** Screen Map 5.3 Editor — "Render" button; check credits ≥ 20; full-screen "Rendering..." modal; `POST /api/story/finalize`; on success navigate to Short Detail with `shortId`. Polling & Job Model: 15‑minute timeout, 503 retry with `Retry-After`.
- **Repo:** **PARTIAL.** `storyFinalize` exists; no Render button, no modal, no credit check, no navigation to ShortDetail, no timeout, no 503 retry.
- **Files:** `client/screens/StoryEditorScreen.tsx`, `client/api/client.ts` (storyFinalize).
- **Next:** Add Render button; gate on `userProfile.credits >= 20`; add rendering modal; call `storyFinalize`; on success navigate to ShortDetail (by `shortId`); handle 402/503 per spec; add 15‑min timeout and retry logic.

### 5.2 ShortDetail from finalize
- **Spec:** Use `shortId` → `GET /api/shorts/:jobId` for detail; or navigate with enough data to play.
- **Repo:** **PARTIAL.** ShortDetail currently receives list `short` only. Post-render we have `shortId` but no fetch. `getShortDetail(id)` exists but is unused.
- **Files:** `client/screens/ShortDetailScreen.tsx`, `client/navigation/LibraryStackNavigator.tsx`, `client/api/client.ts`.
- **Next:** Either (a) navigate to ShortDetail with `shortId` and fetch via `getShortDetail(shortId)` on mount, or (b) add a distinct route that accepts `shortId` and loads detail. Keep `ShortItem` flow for Library list.

### 5.3 Insert beat
- **Spec:** Canonical Endpoints — `POST /api/story/insert-beat`; Screen Map 5.3 "Add Beat" button.
- **Repo:** **NOT FOUND.** No API helper, no UI.
- **Files:** `client/api/client.ts`, `client/screens/StoryEditorScreen.tsx`.
- **Next:** Add `storyInsertBeat({ sessionId, insertAfterIndex, text })`; add "Add Beat" UI; refetch or update local state per spec.

### 5.4 Delete beat
- **Spec:** `POST /api/story/delete-beat`; Editor "delete" per beat.
- **Repo:** **NOT FOUND.** No API helper, no UI.
- **Files:** `client/api/client.ts`, `client/screens/StoryEditorScreen.tsx`.
- **Next:** Add `storyDeleteBeat({ sessionId, sentenceIndex })`; add delete affordance and confirmation; refetch or update local state.

### 5.5 Editor auto plan/search
- **Spec:** Flow (Initial Load) — if `status === "story_generated"`, call plan then search.
- **Repo:** **NOT FOUND.** Editor only fetches session; no status-based plan/search.
- **Files:** `client/screens/StoryEditorScreen.tsx`.
- **Next:** After `storyGet`, if `session.status === "story_generated"`, call `storyPlan` then `storySearchAll`, then update session state. Avoid duplicate work when status already `plan_generated` / `clips_searched`.

### 5.6 Clip Search "Load More"
- **Spec:** Screen Map 5.4 — "Load more" for pagination.
- **Repo:** **PARTIAL.** `page` and `hasMore` state exist; search always uses `page: 1`; no Load More UI.
- **Files:** `client/screens/ClipSearchModal.tsx`.
- **Next:** Add "Load More"; on press call `storySearchShot` with `page: page + 1` (or next from response); append to `candidates`.

### 5.7 Input type "paragraph"
- **Spec:** `inputType`: "link" | "idea" | "paragraph".
- **Repo:** **PARTIAL.** API supports it; HomeScreen only uses "link" | "idea".
- **Files:** `client/screens/HomeScreen.tsx`.
- **Next:** Add "paragraph" to segment control and state; pass through to `storyStart`.

### 5.8 Credits in UI
- **Spec:** Credit balance display; check before render.
- **Repo:** **PARTIAL.** Credits fetched and stored; not displayed; no render-time check.
- **Files:** `client/contexts/AuthContext.tsx`, `client/screens/StoryEditorScreen.tsx` (and any future header component).
- **Next:** Show credits (e.g. header); before finalize, enforce `userProfile.credits >= 20` and show "Buy Credits" CTA when insufficient.

### 5.9 Profile / user/me
- **Spec:** `GET /api/user/me`; Profile screen with avatar, email, credits, "Buy Credits", sign out.
- **Repo:** **NOT FOUND.** No `getUserProfile` / `GET /api/user/me`; Profile screen exists but is stub. Main tabs use Home, Library, Settings (no Profile).
- **Files:** `client/api/client.ts`, `client/screens/ProfileScreen.tsx`, `client/navigation/MainTabNavigator.tsx`, `SettingsStackNavigator`.
- **Next:** Add `getUserProfile()`; implement ProfileScreen; add Profile to tabs or Settings stack per product choice.

### 5.10 Voice / TTS
- **Spec:** `GET /api/voice/voices`, `POST /api/voice/preview`, `POST /api/tts/preview`; voice picker; preview playback.
- **Repo:** **NOT FOUND.** No voice/TTS API helpers, no VoicePicker, no integration in editor.
- **Files:** `client/api/client.ts`, new `VoicePicker` component, `StoryEditorScreen.tsx`.
- **Next:** Add API helpers; implement VoicePicker; integrate in editor per spec.

### 5.11 Error code → UI mapping
- **Spec:** Section 7 — 401 → logout + login; 402 → "Buy Credits" CTA; 429 → back off; 503 → retry with delay; etc.
- **Repo:** **PARTIAL.** Generic toasts and API error handling exist; no specific 402/429/503 UX.
- **Files:** `client/api/client.ts`, toast/error handling at call sites.
- **Next:** Map error codes to messages and actions (e.g. 402 → "Buy Credits" CTA) per spec.

---

## 6. Integration Plan (Next steps in order)

### Step 1: Render button + credit check
- **Touch:** `client/screens/StoryEditorScreen.tsx`.
- **Add:** "Render" button (bottom). Use `useAuth().userProfile.credits`; if `credits < 20`, disable and show "Not enough credits" / "Buy Credits".
- **Extend:** Existing layout below timeline; no new endpoints.
- **Semantics:** `sessionId` from route params; reuse `storyFinalize` body shape.
- **Test:** Log `[story] USER_TAP_RENDER sessionId=... credits=...`; confirm button disabled when credits < 20.
- **Stop conditions:** Button visible and disabled when insufficient credits; enabled when ≥ 20. No semantic renames; no extra `storyGet` calls.

### Step 2: Rendering modal + finalize call
- **Touch:** `client/screens/StoryEditorScreen.tsx` (and optionally a small `RenderingModal` component).
- **Add:** Full-screen modal with "Rendering your video...", "This usually takes 2–5 minutes", spinner. On Render tap, show modal, call `storyFinalize({ sessionId })`.
- **Extend:** `storyFinalize` usage; optionally add `AbortSignal.timeout(900_000)` (15 min) in `client/api/client.ts` for the finalize fetch.
- **Semantics:** `sessionId`; success → `result.shortId`.
- **Test:** Trigger render; confirm modal appears and `[api] POST /api/story/finalize` logs.
- **Stop conditions:** Modal shows during request; no duplicate finalize calls; no useFocusEffect on finalize.

### Step 3: Navigate to ShortDetail on success
- **Touch:** `client/screens/StoryEditorScreen.tsx`, `client/navigation/LibraryStackNavigator.tsx` (and/or Root/Home stack if ShortDetail lives elsewhere).
- **Add:** On `storyFinalize` success, read `shortId`; navigate to ShortDetail. ShortDetail must support either (a) `shortId` param and fetch via `getShortDetail(shortId)`, or (b) a preloaded `short` from finalize response if available.
- **Extend:** Library stack param list if new route shape (e.g. `ShortDetail: { short?: ShortItem; shortId?: string }`). Use `getShortDetail` when only `shortId` is passed.
- **Semantics:** `shortId` = `finalVideo.jobId`; `/api/shorts/:jobId` uses same id.
- **Test:** Render → success → ShortDetail mounts with correct video.
- **Stop conditions:** Navigation occurs only on success; no navigation on 402/404/503 without explicit UX.

### Step 4: 503 retry and 402 handling
- **Touch:** `client/api/client.ts` (`storyFinalize`) and/or StoryEditor render flow.
- **Add:** On 503, read `Retry-After` (or `retryAfter` from body); wait then retry finalize (e.g. once or per spec). On 402, close modal, show toast with "Buy Credits" action (e.g. `Linking.openURL` to pricing).
- **Extend:** `storyFinalize` already returns `retryAfter`; implement retry loop and 402 UX in UI.
- **Test:** Simulate 503 (or 402) and confirm retry / CTA behavior.
- **Stop conditions:** No infinite retry; no swallowing 402.

### Step 5: Insert beat API + UI
- **Touch:** `client/api/client.ts`, `client/screens/StoryEditorScreen.tsx`.
- **Add:** `storyInsertBeat({ sessionId, insertAfterIndex, text })` → `POST /api/story/insert-beat`. "Add Beat" button; modal or inline input for `text`; choose `insertAfterIndex` (e.g. after selected beat). Refetch session or update local state from response.
- **Semantics:** Spec `insertAfterIndex` (-1 = insert at start).
- **Test:** Add beat → API called with correct body → beats list updates.
- **Stop conditions:** Use only `sessionId`, `insertAfterIndex`, `text`; no new backend semantics.

### Step 6: Delete beat API + UI
- **Touch:** `client/api/client.ts`, `client/screens/StoryEditorScreen.tsx`.
- **Add:** `storyDeleteBeat({ sessionId, sentenceIndex })` → `POST /api/story/delete-beat`. Delete affordance per beat; confirmation; then API call and refetch or local update.
- **Semantics:** `sentenceIndex` only.
- **Test:** Delete beat → API called → list updates.
- **Stop conditions:** No duplicate delete; preserve `sentenceIndex` semantics.

### Step 7: Editor plan/search when `story_generated`
- **Touch:** `client/screens/StoryEditorScreen.tsx`.
- **Add:** After `storyGet` success, if `session.status === "story_generated"`, call `storyPlan({ sessionId })` then `storySearchAll({ sessionId })`, then set session from last response (or refetch).
- **Extend:** `loadSession` effect logic.
- **Test:** Deep-link or resume to editor with `story_generated` session → plan + search run once → UI shows clips.
- **Stop conditions:** Only when status is `story_generated`; no plan/search when already `clips_searched`; no GET spam.

### Step 8: Clip Search Load More
- **Touch:** `client/screens/ClipSearchModal.tsx`.
- **Add:** "Load More" button; when pressed, `storySearchShot` with `page: page + 1` (or `nextPage` from response if different). Append new `candidates` to state.
- **Semantics:** `page`; preserve `sessionId`, `sentenceIndex`, `query`.
- **Test:** Search → Load More → more candidates appear.
- **Stop conditions:** No overwriting existing `candidates`; respect `hasMore`.

### Step 9: Credits in UI + Profile (minimal)
- **Touch:** Header component or relevant screens, `ProfileScreen.tsx`, `client/api/client.ts` if adding `getUserProfile`.
- **Add:** Display `userProfile.credits` in header or Profile. Optionally `GET /api/user/me` and Profile layout (avatar, email, credits, "Buy Credits", sign out) per spec.
- **Test:** Credits visible; Profile shows user info.
- **Stop conditions:** Use existing `userProfile` / `getCredits` where possible; no new semantics.

### Step 10: Voice picker (spec required)
- **Touch:** `client/api/client.ts`, new `VoicePicker` component, `StoryEditorScreen.tsx`.
- **Add:** `getVoices`, `previewVoice`, `previewTTS`; VoicePicker UI; wire into editor. Follow spec for request/response shapes.
- **Test:** List voices; preview plays; selection stored for finalize if backend supports.
- **Stop conditions:** Use spec endpoints and field names only.

---

## 7. Quick Verification Commands / Checks

### Grep (rerun to verify)
```bash
rg "ensureUser|storyStart|storyGenerate|storyPlan|storySearchAll|storyGet|storyUpdateBeatText|storySearchShot|storyUpdateShot|storyFinalize|getCredits|getMyShorts|getShortDetail" client/
rg "sessionId|sentenceIndex|clipId" client/
rg "unwrapSession|extractBeats|getSelectedShot" client/
rg "useFocusEffect|shouldRefreshRef" client/
rg "api/users/ensure|api/story/|/credits|api/shorts" client/
rg "getIdToken|Authorization|Bearer|x-client" client/
rg "EXPO_PUBLIC_API_BASE_URL|API_BASE_URL" client/
```

### Manual checks
1. **Auth → ensure:** Sign in → confirm `[auth] SIGNED_IN` and `[api] POST /api/users/ensure 200`.
2. **Create flow:** Home → enter link/idea → Create → confirm start/generate/plan/search logs → StoryEditor with beats and thumbnails.
3. **Beat edit:** Change beat text → blur → confirm `[api] POST /api/story/update-beat-text` and no refetch spam.
4. **Replace clip:** StoryEditor → Replace Clip → ClipSearch → search → select clip → goBack → confirm `[api] POST /api/story/update-shot` and single refetch via useFocusEffect.
5. **Library:** Library tab → Load More → confirm `GET /api/shorts/mine` with cursor; tap short → ShortDetail plays.

### curl (optional)
- Health: `curl -s "${EXPO_PUBLIC_API_BASE_URL}/health"`.
- Authed endpoints: use `Authorization: Bearer <token>` and `x-client: mobile`; token from Firebase ID token.

### UNVERIFIED / follow-up
- **healthCheck:** Exported from `client/api/client.ts`; no in-repo callsite found. Grep: `healthCheck`.
- **ShortDetail from finalize:** Navigation target and `getShortDetail` usage for `shortId` not yet implemented; verify after Step 3.
- **`unwrapSession` duplication:** Logic in both StoryEditor and ClipSearchModal; consider extracting to shared util and re-grep for usages.

---

*End of Mobile Integration Map.*
