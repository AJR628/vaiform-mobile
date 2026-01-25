# Vaiform Mobile Integration Audit - Full Report

**Generated:** January 24, 2026  
**Spec Reference:** `vaiform-mobile-spec-sheet`  
**Status:** Core Pipeline Complete, Secondary Features Missing

---

## Executive Summary

The mobile app has successfully implemented the **core Article Explainer pipeline** (story creation, editing, rendering) which represents the primary feature. Authentication, API infrastructure, and shorts library viewing are fully functional. However, several secondary features remain unimplemented, including beat insertion/deletion, voice/TTS selection, and profile management.

**Overall Completion Status:**
- ✅ **Core Story Pipeline:** ~85% complete (render flow implemented)
- ✅ **Authentication & Infrastructure:** ~95% complete
- ✅ **Shorts Library:** ~90% complete (viewing + detail with retry logic)
- ❌ **Beat Editing (Insert/Delete):** 0% complete
- ❌ **Voice & TTS:** 0% complete
- ⚠️ **Profile/Settings:** ~5% complete (stub only)
- ⚠️ **Error Handling:** ~60% complete (basic handling, missing specific code mappings)

---

## 1. Implemented Integration Points ✅

### 1.1 Authentication & User Management

**Status:** ✅ **Fully Implemented**

**Endpoints:**
- ✅ `POST /api/users/ensure` - `ensureUser()` in `client/api/client.ts:301-312`
- ✅ `GET /credits` - `getCredits()` in `client/api/client.ts:318-323`

**Implementation Details:**
- **Location:** `client/contexts/AuthContext.tsx`
- **Flow:** Firebase auth state change → `ensureUser()` → stores `UserProfile` in context
- **Token Management:** `getIdToken()` with caching (1-hour TTL) in `client/api/client.ts:12-33`
- **Credits:** Fetched via `refreshCredits()` and stored in `userProfile.credits`
- **Semantics:** Uses `uid`, `email`, `plan`, `credits`, `isMember` from backend response

**Verification:**
```typescript
// AuthContext.tsx:63-76
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser && ensuredUidRef.current !== firebaseUser.uid) {
    const result = await ensureUser();
    if (result.ok) {
      setUserProfile(result.data);
    }
  }
});
```

---

### 1.2 Story Pipeline - Core Flow

**Status:** ✅ **Fully Implemented**

**Endpoints Implemented:**
- ✅ `POST /api/story/start` - `storyStart()` in `client/api/client.ts:365-375`
- ✅ `POST /api/story/generate` - `storyGenerate()` in `client/api/client.ts:380-390`
- ✅ `POST /api/story/plan` - `storyPlan()` in `client/api/client.ts:395-403`
- ✅ `POST /api/story/search` - `storySearchAll()` in `client/api/client.ts:408-416`
- ✅ `GET /api/story/:sessionId` - `storyGet()` in `client/api/client.ts:421-428`
- ✅ `POST /api/story/update-beat-text` - `storyUpdateBeatText()` in `client/api/client.ts:433-443`
- ✅ `POST /api/story/search-shot` - `storySearchShot()` in `client/api/client.ts:448-459`
- ✅ `POST /api/story/update-shot` - `storyUpdateShot()` in `client/api/client.ts:464-474`
- ✅ `POST /api/story/finalize` - `storyFinalize()` in `client/api/client.ts:480-572`

**Implementation Flow:**

1. **Create Flow (HomeScreen):**
   - User enters link/idea → `storyStart()` → `storyGenerate()` → `storyPlan()` → `storySearchAll()`
   - Navigates to `StoryEditor` with `sessionId`
   - **Location:** `client/screens/HomeScreen.tsx:49-141`

2. **Editor Load (StoryEditorScreen):**
   - Loads session via `storyGet(sessionId)` on mount
   - Extracts beats using `extractBeats(session)` helper
   - Displays timeline with clip thumbnails
   - **Location:** `client/screens/StoryEditorScreen.tsx:132-193`

3. **Beat Editing:**
   - Inline text editing → `storyUpdateBeatText()` on blur
   - Optimistic UI updates (no refetch on success)
   - **Location:** `client/screens/StoryEditorScreen.tsx:257-288`

4. **Clip Replacement:**
   - "Replace Clip" button → navigates to `ClipSearch` modal
   - `ClipSearchModal` calls `storySearchShot()` then `storyUpdateShot()` on selection
   - Returns to editor, refreshes via `useFocusEffect` when `shouldRefreshRef.current` is true
   - **Location:** `client/screens/StoryEditorScreen.tsx:290-299`, `client/screens/ClipSearchModal.tsx:58-114`

5. **Render Flow:**
   - "Render" button with credit check (`credits >= 20`)
   - Full-screen rendering modal
   - Calls `storyFinalize()` with 15-minute timeout
   - Handles 503 retry with `Retry-After` header
   - On success: navigates to `ShortDetail` with `shortId`
   - **Location:** `client/screens/StoryEditorScreen.tsx:301-378`

**Semantics Used:**
- `sessionId` - Consistent across all story endpoints
- `sentenceIndex` - Used for beat/shot identification
- `clipId` - Used in `update-shot` request
- `shortId` - Extracted from `finalize` response (`finalVideo.jobId`)

---

### 1.3 Shorts Library

**Status:** ✅ **Fully Implemented with Advanced Features**

**Endpoints:**
- ✅ `GET /api/shorts/mine` - `getMyShorts()` in `client/api/client.ts:330-342`
- ✅ `GET /api/shorts/:id` - `getShortDetail()` in `client/api/client.ts:349-356`

**Implementation:**

1. **Library Screen:**
   - Fetches shorts with pagination (cursor-based)
   - "Load More" button for additional items
   - Status badges (ready, processing, failed)
   - Navigates to `ShortDetail` with `short` object
   - **Location:** `client/screens/LibraryScreen.tsx:80-142`

2. **Short Detail Screen:**
   - **Dual Path Support:**
     - **Path 1:** Receives `short` from route params (list item) - instant display
     - **Path 2:** Receives `shortId` from route params (post-render) - fetches via `getShortDetail()`
   - **Retry Logic:** Handles 404 with exponential backoff (7 attempts) for eventual consistency
   - **Library Fallback:** On 404, checks library list on attempts 1, 3, 5 to catch newly created shorts early
   - Video playback using Expo AV
   - **Location:** `client/screens/ShortDetailScreen.tsx:84-333`

**Semantics:**
- List items use `id` field (not `jobId`)
- Detail endpoint uses `id` in path: `/api/shorts/${id}`
- `shortId` from finalize response maps to `id` for detail fetch

---

### 1.4 API Client Infrastructure

**Status:** ✅ **Fully Implemented**

**Key Features:**
- ✅ Base URL: `EXPO_PUBLIC_API_BASE_URL` with fallback (line 5-7)
- ✅ Token injection: `Authorization: Bearer <token>` via `getIdToken()`
- ✅ Client header: `x-client: mobile` on all requests (lines 129, 184, 487)
- ✅ Response normalization: Handles both `{ success: true, data }` and `{ ok: true, data }` patterns
- ✅ Error handling: Typed `ApiError` with `isAuthError`, `isRateLimited`, `isServerError` flags
- ✅ Network error detection

**Functions:**
- `apiRequest<T>()` - Throws on HTTP errors
- `apiRequestNormalized<T>()` - Returns `{ ok: true/false, data/error }`
- `normalizeResponse<T>()` - Handles both response envelopes
- `getIdToken()` - Token management with caching

**Location:** `client/api/client.ts`

---

### 1.5 Navigation Structure

**Status:** ✅ **Complete**

**Structure:**
- Tab Navigator: Home, Library, Settings
- Home Stack: Home → StoryEditor → ClipSearch
- Library Stack: Library → ShortDetail
- Root Stack: Auth gating

**Navigation Params:**
- `StoryEditor: { sessionId: string }`
- `ClipSearch: { sessionId: string, sentenceIndex: number, initialQuery?: string }`
- `ShortDetail: { short?: ShortItem, shortId?: string }` (dual path support)

**Location:** `client/navigation/`

---

### 1.6 UI Components & Theming

**Status:** ✅ **Foundation Complete**

**Components:**
- Themed components (`ThemedView`, `ThemedText`)
- Toast system (`ToastContext`, `Toast` component)
- Card, Button, ErrorBoundary
- Keyboard-aware scroll view
- Theme system with dark mode support

**Location:** `client/components/`, `client/contexts/ToastContext.tsx`

---

## 2. Missing Integration Points ❌

### 2.1 Beat Editing - Insert/Delete

**Status:** ❌ **Not Implemented**

**Missing Endpoints:**
- ❌ `POST /api/story/insert-beat` - No `storyInsertBeat()` function
- ❌ `POST /api/story/delete-beat` - No `storyDeleteBeat()` function

**Missing UI:**
- ❌ "Add Beat" button in StoryEditor
- ❌ Delete affordance per beat
- ❌ Insert beat modal/input

**Impact:** **MEDIUM** - Users cannot add or remove beats from stories. Core editing flow works but lacks flexibility.

**Required Implementation:**
- Add API functions in `client/api/client.ts`
- Add UI controls in `StoryEditorScreen.tsx`
- Refetch session or update local state after mutations

---

### 2.2 Voice & TTS Selection

**Status:** ❌ **Not Implemented**

**Missing Endpoints:**
- ❌ `GET /api/voice/voices` - No `getVoices()` function
- ❌ `POST /api/voice/preview` - No `previewVoice()` function
- ❌ `POST /api/tts/preview` - No `previewTTS()` function

**Missing UI:**
- ❌ Voice picker component
- ❌ Voice preview player
- ❌ Integration in editor

**Impact:** **HIGH** - Voice selection is part of story creation flow per spec. Required for MVP if backend supports voice selection in `finalize`.

**Required Implementation:**
- Add API functions in `client/api/client.ts`
- Create `VoicePicker` component
- Integrate in `StoryEditorScreen` (if backend supports voice in finalize)

---

### 2.3 Profile Screen

**Status:** ⚠️ **Stub Only (5% Complete)**

**Current State:**
- Empty screen with only layout structure
- No user data display
- No "Buy Credits" button
- No sign out button

**Missing:**
- ❌ `GET /api/user/me` - No `getUserProfile()` function
- ❌ User avatar/email display
- ❌ Credit balance display
- ❌ Plan badge
- ❌ "Buy Credits" deep link
- ❌ Sign out button

**Impact:** **MEDIUM** - Users need to see credits and manage account. Can be added later but should be in MVP.

**Location:** `client/screens/ProfileScreen.tsx` (currently empty)

---

### 2.4 Input Type "Paragraph"

**Status:** ⚠️ **Partially Implemented**

**Current State:**
- API supports `inputType: "link" | "idea" | "paragraph"`
- HomeScreen only offers "link" and "idea" in segmented control
- "paragraph" option missing from UI

**Impact:** **LOW** - Nice-to-have feature. Users can still create stories with link/idea.

**Required:** Add "paragraph" segment to `HomeScreen.tsx:164-202`

---

### 2.5 Clip Search Pagination

**Status:** ⚠️ **Partially Implemented**

**Current State:**
- `page` and `hasMore` state exist in `ClipSearchModal`
- Search always uses `page: 1`
- No "Load More" button
- No pagination logic

**Impact:** **LOW** - Users can search but cannot load additional pages of results.

**Required:** Add "Load More" button and increment `page` on press in `ClipSearchModal.tsx`

---

### 2.6 Editor Auto Plan/Search

**Status:** ⚠️ **Not Implemented**

**Spec Requirement:**
- If `status === "story_generated"` on editor load, auto-trigger `plan` then `search`

**Current State:**
- Editor only fetches session
- No status-based auto-trigger
- Plan/search only happens in HomeScreen create flow

**Impact:** **LOW** - Users can manually trigger plan/search if needed, but spec requires auto-trigger.

**Required:** Add status check in `StoryEditorScreen.tsx:132-193` after `storyGet` success

---

### 2.7 Credits Display in UI

**Status:** ⚠️ **Partially Implemented**

**Current State:**
- Credits fetched and stored in `AuthContext.userProfile.credits`
- Used for render gate check (`credits >= 20`)
- **Not displayed anywhere in UI**

**Impact:** **MEDIUM** - Users cannot see their credit balance. Should be displayed in header or profile.

**Required:** Add credit display to header component or navigation

---

### 2.8 Error Code → UI Mapping

**Status:** ⚠️ **Partially Implemented**

**Current State:**
- Generic error handling exists
- Basic toast messages
- **Missing specific mappings per spec section 7:**
  - `402 INSUFFICIENT_CREDITS` → "Buy Credits" CTA (partially implemented in render flow)
  - `429 RATE_LIMIT_EXCEEDED` → Disable button for 60s
  - `429 SCRIPT_LIMIT_REACHED` → Show upgrade CTA
  - `503 SERVER_BUSY` → Auto-retry with delay (implemented in render flow)
  - `404 NOT_FOUND` (session expired) → Navigate back with message

**Impact:** **MEDIUM** - Better UX, but basic error handling works for now.

---

## 3. Semantic & Language Cohesion

### 3.1 SSOT (Single Source of Truth) Semantics

| Concept | Exact Term | Where Defined/Used | Notes |
|---------|------------|-------------------|-------|
| Session identifier | `sessionId` | Route params, API bodies, all story endpoints | Consistent across codebase |
| Beat/Shot index | `sentenceIndex` | StoryEditorScreen, ClipSearchModal, API bodies | Do not rename to `beatIndex` or `shotIndex` |
| Clip identifier | `clipId` | `storyUpdateShot` body, `ClipSearchModal` | Used in clip selection |
| Short ID (list) | `id` | LibraryScreen, ShortItem type | List items use `id`, not `jobId` |
| Short ID (detail) | `shortId` | Finalize response, ShortDetail navigation | Maps to `id` for detail fetch |
| API base URL | `EXPO_PUBLIC_API_BASE_URL` | `client/api/client.ts:5-7` | Single env var with fallback |
| Auth token | `getIdToken()` | `client/api/client.ts:12-33` | Cached, refreshed on expiry |

### 3.2 Helper Functions (SSOT)

**Session Unwrapping:**
- **Status:** ⚠️ **DUPLICATED** - Needs consolidation
- **Locations:**
  - `StoryEditorScreen.tsx:43-48`
  - `ClipSearchModal.tsx:36-41`
- **Logic:** Identical in both files
- **Action Required:** Extract to shared utility (e.g., `client/lib/session-helpers.ts`)

**Beat Extraction:**
- **Status:** ✅ **SSOT** - Single implementation
- **Location:** `StoryEditorScreen.tsx:53-80`
- **Function:** `extractBeats(session: any): Beat[]`
- **Logic:** Primary: `session.story.sentences`, Fallback: `session.sentences` or `session.beats`

**Shot Selection:**
- **Status:** ✅ **SSOT** - Single implementation
- **Location:** `StoryEditorScreen.tsx:85-99`
- **Function:** `getSelectedShot(session: any, sentenceIndex: number): any | null`
- **Logic:** Handles both array and map shapes for `shots`

### 3.3 API Response Envelopes

**Patterns Handled:**
- `{ success: true, data: T }` - Most endpoints
- `{ ok: true, data: T }` - Some endpoints (e.g., `/api/user/me`)
- Top-level fields (e.g., `/credits` returns `{ success: true, credits: number }`)

**Normalization:**
- `normalizeResponse<T>()` in `client/api/client.ts:90-117`
- Handles all patterns and returns `{ ok: true, data }` or `{ ok: false, status, code, message }`

### 3.4 Status Values

**Story Session Status:**
- `"draft"` - Initial state
- `"story_generated"` - After generate
- `"plan_generated"` - After plan
- `"clips_searched"` - After search
- `"rendered"` - After finalize

**Short Status:**
- `"ready"` - Video available
- `"processing"` / `"pending"` - In progress
- `"failed"` - Render failed

**Usage:** Status checks used for UI gating (e.g., only render if `clips_searched`, only navigate to ShortDetail if `ready`)

---

## 4. Integration Points Summary

### 4.1 Fully Implemented Endpoints

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/api/users/ensure` | `ensureUser()` | ✅ |
| GET | `/credits` | `getCredits()` | ✅ |
| POST | `/api/story/start` | `storyStart()` | ✅ |
| POST | `/api/story/generate` | `storyGenerate()` | ✅ |
| POST | `/api/story/plan` | `storyPlan()` | ✅ |
| POST | `/api/story/search` | `storySearchAll()` | ✅ |
| GET | `/api/story/:sessionId` | `storyGet()` | ✅ |
| POST | `/api/story/update-beat-text` | `storyUpdateBeatText()` | ✅ |
| POST | `/api/story/search-shot` | `storySearchShot()` | ✅ |
| POST | `/api/story/update-shot` | `storyUpdateShot()` | ✅ |
| POST | `/api/story/finalize` | `storyFinalize()` | ✅ |
| GET | `/api/shorts/mine` | `getMyShorts()` | ✅ |
| GET | `/api/shorts/:id` | `getShortDetail()` | ✅ |

**Total: 13/19 endpoints (68%)**

### 4.2 Missing Endpoints

| Method | Path | Function | Priority |
|--------|------|----------|----------|
| POST | `/api/story/insert-beat` | `storyInsertBeat()` | MEDIUM |
| POST | `/api/story/delete-beat` | `storyDeleteBeat()` | MEDIUM |
| GET | `/api/voice/voices` | `getVoices()` | HIGH |
| POST | `/api/voice/preview` | `previewVoice()` | HIGH |
| POST | `/api/tts/preview` | `previewTTS()` | HIGH |
| GET | `/api/user/me` | `getUserProfile()` | MEDIUM |

**Total: 6/19 endpoints (32%)**

---

## 5. Code Quality & Architecture

### 5.1 Strengths

1. **Consistent API Wrapper:** Single source of truth for all API calls
2. **Type Safety:** TypeScript interfaces for responses
3. **Error Handling:** Typed errors with flags for specific error types
4. **Token Management:** Caching prevents excessive token refresh
5. **Response Normalization:** Handles multiple backend response patterns
6. **Retry Logic:** Advanced retry with exponential backoff in ShortDetail
7. **Dual Path Support:** ShortDetail handles both list item and `shortId` navigation

### 5.2 Areas for Improvement

1. **Code Duplication:** `unwrapSession` duplicated in two files
2. **Missing Types:** `StorySession` is `any` type (should be properly typed)
3. **Error Mapping:** Missing specific error code → UI action mappings
4. **Session Management:** No persistence (AsyncStorage) for resuming sessions
5. **Credit Display:** Fetched but never shown to user

---

## 6. Recommendations

### 6.1 Immediate Priorities

1. **Extract `unwrapSession` to shared utility** - Consolidate duplicate code
2. **Add credit display to header** - Show user their balance
3. **Implement insert/delete beat** - Complete editing functionality
4. **Add voice/TTS endpoints** - If backend supports voice selection

### 6.2 Future Enhancements

1. **Session persistence** - Store `sessionId` in AsyncStorage for resume
2. **Error code mapping** - Implement spec section 7 mappings
3. **Profile screen** - Complete user profile display
4. **Clip search pagination** - Add "Load More" functionality
5. **Editor auto plan/search** - Auto-trigger when status is `story_generated`

---

## 7. Verification Checklist

### 7.1 Core Flow Verification

- [x] Auth → ensure user on sign-in
- [x] Home → create storyboard (start → generate → plan → search)
- [x] Editor → load session and display beats
- [x] Editor → edit beat text
- [x] Editor → replace clip (search → select)
- [x] Editor → render video (credit check → finalize → navigate)
- [x] Library → list shorts with pagination
- [x] Library → view short detail (dual path: list item + `shortId`)

### 7.2 Missing Features Verification

- [ ] Editor → insert beat
- [ ] Editor → delete beat
- [ ] Editor → voice selection (if supported)
- [ ] Profile → display user info
- [ ] Profile → buy credits link
- [ ] Profile → sign out
- [ ] Clip Search → load more pagination
- [ ] Home → paragraph input type

---

## 8. Conclusion

The mobile app has successfully implemented the **core Article Explainer pipeline**, which is the primary feature. Users can create stories, edit beats, select clips, and render videos. The implementation follows the spec semantics closely and maintains consistency across the codebase.

**Key Achievements:**
- ✅ Complete story creation and editing flow
- ✅ Render pipeline with credit checking and retry logic
- ✅ Advanced ShortDetail retry with library fallback
- ✅ Robust API client infrastructure

**Remaining Work:**
- Beat insertion/deletion (medium priority)
- Voice/TTS selection (high priority if backend supports)
- Profile screen completion (medium priority)
- Error code mapping improvements (low priority)

The foundation is solid, and the remaining features can be added incrementally without major refactoring.

---

**End of Audit Report**
