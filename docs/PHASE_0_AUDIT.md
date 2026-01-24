# Phase 0 Audit: SSOT Wiring & Guardrails

**Date:** 2026-01-23  
**Purpose:** Lock semantics and prevent drift before adding new endpoints/UI  
**Status:** ✅ Audit Complete

---

## Executive Summary

This audit verifies Single Source of Truth (SSOT) patterns, confirms guardrails are in place, and documents which functions/files are canonical to prevent duplication in future phases.

**Key Findings:**
- ✅ `x-client: mobile` header attached to all API calls
- ⚠️ `unwrapSession` duplicated (needs consolidation in future phase)
- ✅ `getShortDetail` and `storyFinalize` exist but are not yet called (as expected per spec)
- ✅ Core API wrapper (`client/api/client.ts`) is SSOT for all requests

---

## 1. SSOT Functions & Files (DO NOT DUPLICATE)

### 1.1 API Request Layer (SSOT)

**File:** `client/api/client.ts`

**Functions:**
- `apiRequest<T>()` - Base request wrapper (throws on HTTP errors)
- `apiRequestNormalized<T>()` - Normalized response wrapper (returns `{ ok, data }` or `{ ok: false, ... }`)
- `getIdToken()` - Token fetch and cache (SSOT for auth token)
- `normalizeResponse<T>()` - Response normalization (handles both `{ success: true, data }` and `{ ok: true, data }`)

**Guardrails:**
- ✅ All requests include `x-client: mobile` header (lines 129, 184, 487)
- ✅ All authed requests use `getIdToken()` → `Authorization: Bearer <token>`
- ✅ Base URL: `EXPO_PUBLIC_API_BASE_URL` with fallback (line 5-7)

**Rule:** Do not create duplicate API wrappers. All API calls must go through `apiRequest` or `apiRequestNormalized`.

---

### 1.2 Session Unwrap Logic (DUPLICATED - Needs Consolidation)

**Current State:** `unwrapSession` exists in two places with identical logic:
- `client/screens/StoryEditorScreen.tsx` (lines 41-46)
- `client/screens/ClipSearchModal.tsx` (lines 36-41)

**Logic:**
```typescript
function unwrapSession(res: any): any {
  if (res?.data && (res?.ok === true || res?.success === true)) return res.data;
  return res;
}
```

**Action Required (Future Phase):**
- Extract to shared utility (e.g., `client/lib/session-helpers.ts`)
- Import in both files
- Remove local definitions

**Rule:** Do not add more `unwrapSession` implementations. Use the shared helper once extracted.

---

### 1.3 Beat Extraction (SSOT)

**File:** `client/screens/StoryEditorScreen.tsx` (lines 51-78)

**Function:** `extractBeats(session: any): Beat[]`

**Logic:**
- Primary: `session.story.sentences` → map to beats
- Fallback: `session.sentences` or `session.beats`

**Rule:** This is the canonical beat extraction. Do not duplicate elsewhere.

---

### 1.4 Shot Selection (SSOT)

**File:** `client/screens/StoryEditorScreen.tsx` (lines 83-96)

**Function:** `getSelectedShot(session: any, sentenceIndex: number): any | null`

**Logic:**
- Handles both array (`shots[sentenceIndex]`) and map (`shots[sentenceIndex]`) shapes
- Returns `selectedClip` or first candidate

**Rule:** This is the canonical shot lookup. Do not duplicate elsewhere.

---

## 2. Header Verification

### 2.1 `x-client: mobile` Header

**Status:** ✅ Verified

**Locations:**
- `apiRequest()` - line 129
- `apiRequestNormalized()` - line 184
- `storyFinalize()` - line 487 (custom fetch)

**Verification:**
```bash
rg "x-client" client/
# Found 3 matching lines - all set to "mobile"
```

**Rule:** All API requests must include `x-client: mobile`. The core wrappers already enforce this.

---

### 2.2 Authorization Header

**Status:** ✅ Verified

**Implementation:**
- `getIdToken()` fetches and caches Firebase ID token
- All authed requests call `getIdToken()` and inject `Authorization: Bearer <token>`
- `requireAuth: true` is default in both `apiRequest` and `apiRequestNormalized`

**Rule:** Do not bypass `getIdToken()`. Do not add custom token fetch logic.

---

## 3. Unused Endpoints (As Expected)

### 3.1 `getShortDetail(id: string)`

**Status:** ✅ Exists but not called (per spec)

**Location:** `client/api/client.ts` (lines 349-356)

**Verification:**
```bash
rg "getShortDetail\(" client/
# Only found function definition, no callsites
```

**Current Usage:**
- `ShortDetailScreen` receives `short` from route params (list item)
- No server fetch on mount

**Future Phase:** Will be called when navigating from `storyFinalize` success with `shortId`.

---

### 3.2 `storyFinalize(body: { sessionId: string })`

**Status:** ✅ Exists but not called (per spec)

**Location:** `client/api/client.ts` (lines 480-552)

**Verification:**
```bash
rg "storyFinalize\(" client/
# Only found function definition, no callsites
```

**Current Usage:**
- No Render button in `StoryEditorScreen`
- No rendering modal
- No credit check before render

**Future Phase:** Will be called when Render button is implemented.

**Special Handling:**
- Custom fetch (not using `apiRequestNormalized`) to extract `shortId` and `retryAfter`
- Includes 15-minute timeout support (not yet implemented)
- Handles 503 `Retry-After` header

---

## 4. SSOT Semantics Table

| Concept | Exact Term | SSOT Location | Notes |
|---------|------------|--------------|-------|
| Session ID | `sessionId` | Route params, API bodies | Used consistently across all story endpoints |
| Beat/Shot index | `sentenceIndex` | StoryEditorScreen, ClipSearchModal, API bodies | Do not rename to `beatIndex` or `shotIndex` |
| Clip ID | `clipId` | `storyUpdateShot` body | Used in clip selection |
| API base URL | `EXPO_PUBLIC_API_BASE_URL` | `client/api/client.ts` | Single env var, fallback to placeholder |
| Auth token | `getIdToken()` | `client/api/client.ts` | Cached, refreshed on expiry |
| Response normalization | `normalizeResponse()` | `client/api/client.ts` | Handles `{ success, data }` and `{ ok, data }` |

---

## 5. Guardrails Checklist

### ✅ Implemented

- [x] `x-client: mobile` header on all requests
- [x] `Authorization: Bearer <token>` on all authed requests
- [x] Response normalization handles both envelope shapes
- [x] Base URL from env var with fallback
- [x] Token caching and refresh logic

### ⚠️ Needs Attention (Future Phases)

- [ ] Extract `unwrapSession` to shared utility
- [ ] Add 15-minute timeout to `storyFinalize` fetch
- [ ] Implement error code → UI mapping (402, 429, 503 per spec)
- [ ] Add credit check before render (gate on `userProfile.credits >= 20`)

---

## 6. Verification Commands

### Grep Checks

```bash
# Verify x-client header
rg "x-client" client/

# Verify unwrapSession locations
rg "unwrapSession" client/

# Verify getShortDetail callsites (should be none)
rg "getShortDetail\(" client/

# Verify storyFinalize callsites (should be none)
rg "storyFinalize\(" client/

# Verify Authorization header usage
rg "Authorization.*Bearer" client/

# Verify API base URL usage
rg "EXPO_PUBLIC_API_BASE_URL|API_BASE_URL" client/
```

### Expected Results

- `x-client`: 3 matches (all set to "mobile")
- `unwrapSession`: 5 matches (2 definitions + 3 usages)
- `getShortDetail(`: 1 match (definition only)
- `storyFinalize(`: 1 match (definition only)
- `Authorization.*Bearer`: Multiple matches (all via `getIdToken()`)
- `API_BASE_URL`: 1 match (single source in `client.ts`)

---

## 7. Rules for Future Phases

### Do Not:

1. ❌ Create duplicate API wrappers (use `apiRequest` / `apiRequestNormalized`)
2. ❌ Add new `unwrapSession` implementations (extract to shared helper first)
3. ❌ Rename `sessionId` → `storyId` or `sentenceIndex` → `beatIndex`
4. ❌ Bypass `getIdToken()` for auth tokens
5. ❌ Hardcode API base URL (use `EXPO_PUBLIC_API_BASE_URL`)
6. ❌ Create duplicate beat extraction or shot selection logic

### Do:

1. ✅ Use `apiRequestNormalized` for all new API calls
2. ✅ Reuse `extractBeats` and `getSelectedShot` from StoryEditorScreen
3. ✅ Follow exact spec semantics (`sessionId`, `sentenceIndex`, `clipId`)
4. ✅ Include `x-client: mobile` (already enforced by wrappers)
5. ✅ Use `normalizeResponse` pattern for response handling

---

## 8. Next Steps (Post-Audit)

**Phase 1:** Render Flow
- Add Render button with credit check
- Implement rendering modal
- Call `storyFinalize` on button tap
- Navigate to ShortDetail with `shortId` (will require `getShortDetail` call)

**Phase 2:** Consolidation
- Extract `unwrapSession` to shared utility
- Update StoryEditorScreen and ClipSearchModal to import shared helper

**Phase 3:** Error Handling
- Implement error code → UI mapping (402, 429, 503)
- Add retry logic for 503 responses
- Add "Buy Credits" CTA for 402 errors

---

**End of Phase 0 Audit**
