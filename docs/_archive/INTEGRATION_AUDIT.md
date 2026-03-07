- Status: ARCHIVE
- Owner repo: mobile
- Source of truth for: historical investigation context only; not active contract or usage truth
- Canonical counterpart/source: docs/MOBILE_USED_SURFACES.md and backend canonical docs in ../vaiform-1/docs/
- Last verified against: historical repo state only

# Vaiform Mobile Integration Audit Report

**Generated:** January 2026  
**Spec Reference:** `vaiform-mobile-spec-sheet`  
**Status:** Partial Integration - Foundation Complete, Core Features Missing

---

## Executive Summary

The mobile app has a solid foundation with authentication, API client infrastructure, and shorts library viewing implemented. However, **the core Article Explainer pipeline (story creation, editing, rendering) is completely missing**. This represents the primary feature gap that needs to be addressed.

**Completion Status:**
- âœ… **Infrastructure & Auth:** ~90% complete
- âœ… **Shorts Library:** ~80% complete (viewing works, missing some polish)
- âŒ **Story Pipeline:** 0% complete (not started)
- âŒ **Voice/TTS:** 0% complete (not started)
- âš ï¸ **Profile/Settings:** ~10% complete (stubs only)

---

## 1. What's Wired In âœ…

### 1.1 Authentication & User Management

**Status:** âœ… **Fully Implemented**

**Implemented:**
- âœ… Firebase Authentication integration (`client/lib/firebase.ts`)
- âœ… Google Sign-In (web + native via OAuth)
- âœ… Email/Password sign-in
- âœ… `POST /api/users/ensure` - Called automatically on auth state change
- âœ… Token management with caching (`getIdToken`, `clearTokenCache`)
- âœ… Auth context with user profile state (`AuthContext.tsx`)
- âœ… Login screen with error handling (`LoginScreen.tsx`)

**Location:**
- `client/contexts/AuthContext.tsx` - Full auth flow
- `client/screens/LoginScreen.tsx` - UI
- `client/lib/firebase.ts` - Firebase config
- `client/api/client.ts` - Token injection in API calls

**Notes:**
- Auth flow correctly calls `ensureUser()` after Firebase sign-in
- Token caching prevents excessive token refresh calls
- Error handling maps Firebase errors to user-friendly messages

---

### 1.2 API Client Infrastructure

**Status:** âœ… **Fully Implemented**

**Implemented:**
- âœ… Base API client with normalized response handling (`client/api/client.ts`)
- âœ… Automatic token injection via `Authorization: Bearer <token>`
- âœ… `x-client: mobile` header on all requests
- âœ… Response normalization for both `{ success: true, data }` and `{ ok: true, data }` patterns
- âœ… Error handling with typed `ApiError` interface
- âœ… Network error detection and handling
- âœ… Health check endpoint (`GET /health`)

**Location:**
- `client/api/client.ts` - Core API client (354 lines)

**Key Functions:**
- `apiRequest<T>()` - Throws on HTTP errors
- `apiRequestNormalized<T>()` - Returns `{ ok: true/false, data/error }`
- `normalizeResponse<T>()` - Handles both response envelopes
- `getIdToken()` - Token management with caching

**Notes:**
- Client correctly handles both response envelope patterns from backend
- Token expiration handled gracefully
- Error types include `isAuthError`, `isRateLimited`, `isServerError` flags

---

### 1.3 Credits System

**Status:** âœ… **Partially Implemented** (Backend wired, UI missing)

**Implemented:**
- âœ… `GET /credits` endpoint function (`getCredits()`)
- âœ… Credits stored in `AuthContext.userProfile.credits`
- âœ… `refreshCredits()` function available in AuthContext

**Missing:**
- âŒ Credit balance display in UI (not shown anywhere)
- âŒ Credit check before render operations
- âŒ "Buy Credits" deep link to web

**Location:**
- `client/api/client.ts` - `getCredits()` function
- `client/contexts/AuthContext.tsx` - `refreshCredits()` method

**Notes:**
- Credits are fetched and stored but never displayed to user
- Need to add credit display to header/navigation
- Need to check credits before allowing render operations

---

### 1.4 Shorts Library (Viewing)

**Status:** âœ… **Mostly Implemented**

**Implemented:**
- âœ… `GET /api/shorts/mine` - List user's shorts with pagination
- âœ… `GET /api/shorts/:id` - Get short detail (function exists, not used in detail screen)
- âœ… Library screen with grid/list view (`LibraryScreen.tsx`)
- âœ… Short detail screen with video player (`ShortDetailScreen.tsx`)
- âœ… Pagination support (cursor-based)
- âœ… Status badges (ready, processing, failed)
- âœ… Video playback using Expo AV
- âœ… Empty state handling
- âœ… Loading states

**Location:**
- `client/api/client.ts` - `getMyShorts()`, `getShortDetail()`
- `client/screens/LibraryScreen.tsx` - List view
- `client/screens/ShortDetailScreen.tsx` - Detail view with video player

**Missing/Issues:**
- âš ï¸ `ShortDetailScreen` receives `short` via route params but doesn't fetch fresh data via `getShortDetail()`
- âš ï¸ No share functionality
- âš ï¸ No delete functionality
- âš ï¸ No pull-to-refresh (only manual "Load More")

**Notes:**
- Video player correctly handles Firebase Storage URLs
- Status filtering works (blocks navigation to non-ready shorts)
- Pagination cursor handling is correct

---

### 1.5 Navigation Structure

**Status:** âœ… **Basic Structure Complete**

**Implemented:**
- âœ… Tab navigation (Home, Library, Settings)
- âœ… Stack navigators for each tab
- âœ… Library stack with ShortDetail screen
- âœ… Root stack with auth gating

**Location:**
- `client/navigation/MainTabNavigator.tsx`
- `client/navigation/HomeStackNavigator.tsx`
- `client/navigation/LibraryStackNavigator.tsx`
- `client/navigation/RootStackNavigator.tsx`

**Missing:**
- âŒ Story Editor screen (not in navigation)
- âŒ Create/Input screen (not in navigation)
- âŒ Clip Search modal (not in navigation)

---

### 1.6 UI Components & Theming

**Status:** âœ… **Foundation Complete**

**Implemented:**
- âœ… Themed components (`ThemedView`, `ThemedText`)
- âœ… Toast system (`ToastContext`, `Toast` component)
- âœ… Card component
- âœ… Button component
- âœ… Error boundary
- âœ… Keyboard-aware scroll view
- âœ… Theme system with dark mode support

**Location:**
- `client/components/` - All reusable components
- `client/contexts/ToastContext.tsx` - Toast management
- `client/constants/theme.ts` - Theme constants

---

## 2. What's NOT Wired In âŒ

### 2.1 Story Pipeline (Core Feature)

**Status:** âŒ **0% Complete - Not Started**

**Missing Endpoints:**
- âŒ `POST /api/story/start` - Create new story session
- âŒ `POST /api/story/generate` - Generate script from input
- âŒ `POST /api/story/plan` - Generate visual shot plan
- âŒ `POST /api/story/search` - Search clips for all shots
- âŒ `POST /api/story/search-shot` - Search clips for single shot
- âŒ `POST /api/story/update-shot` - Swap selected clip
- âŒ `POST /api/story/update-script` - Update all sentences
- âŒ `POST /api/story/update-beat-text` - Edit single beat text
- âŒ `POST /api/story/insert-beat` - Insert new beat
- âŒ `POST /api/story/delete-beat` - Delete beat
- âŒ `POST /api/story/finalize` - Render final video (20 credits)
- âŒ `GET /api/story/:sessionId` - Get session state

**Missing Screens:**
- âŒ Create/Input Screen - User enters link/idea/paragraph
- âŒ Editor Screen - Edit beats, select clips, manage story
- âŒ Clip Search Modal - Browse and select video clips
- âŒ Rendering Modal - Show progress during video render

**Missing Types:**
- âŒ `StorySession` interface
- âŒ `ShotPlan` interface
- âŒ `Shot` interface
- âŒ `Clip` interface

**Impact:**
- **CRITICAL** - This is the core feature of the app. Without this, users cannot create videos.

---

### 2.2 Voice & TTS

**Status:** âŒ **0% Complete - Not Started**

**Missing Endpoints:**
- âŒ `GET /api/voice/voices` - List available voices
- âŒ `POST /api/voice/preview` - Preview voice with sample
- âŒ `POST /api/tts/preview` - Generate TTS audio

**Missing UI:**
- âŒ Voice picker component
- âŒ Voice preview player
- âŒ TTS preview functionality

**Impact:**
- **HIGH** - Voice selection is part of the story creation flow. Required for MVP.

---

### 2.3 User Profile

**Status:** âš ï¸ **10% Complete - Stub Only**

**Implemented:**
- âœ… Profile screen exists (`ProfileScreen.tsx`)

**Missing:**
- âŒ `GET /api/user/me` - Fetch full user profile
- âŒ Credit balance display
- âŒ Plan badge display
- âŒ "Buy Credits" button with deep link
- âŒ Sign out button
- âŒ User avatar/email display

**Location:**
- `client/screens/ProfileScreen.tsx` - Currently empty stub

**Impact:**
- **MEDIUM** - Users need to see credits and manage account. Can be added later but should be in MVP.

---

### 2.4 Home Screen (Create Flow)

**Status:** âš ï¸ **5% Complete - Stub Only**

**Current State:**
- HomeScreen shows stub content (stats, activity, backend test)
- No story creation UI
- No input form for link/idea/paragraph
- No "Create" button that starts story flow

**Missing:**
- âŒ Input type selector (Link / Idea / Write)
- âŒ Text input area
- âŒ "Create" button
- âŒ Integration with `POST /api/story/start`
- âŒ Navigation to Editor screen after creation

**Impact:**
- **CRITICAL** - This is the entry point for story creation. Must be implemented.

---

### 2.5 Error Handling & Toast Messages

**Status:** âš ï¸ **Partially Implemented**

**Implemented:**
- âœ… Toast system exists
- âœ… Basic error handling in API client

**Missing:**
- âŒ Error code â†’ user message mapping (per spec section 7)
- âŒ Specific handling for:
  - `402 INSUFFICIENT_CREDITS` â†’ Show "Buy Credits" CTA
  - `429 RATE_LIMIT_EXCEEDED` â†’ Disable button for 60s
  - `429 SCRIPT_LIMIT_REACHED` â†’ Show upgrade CTA
  - `503 SERVER_BUSY` â†’ Auto-retry with delay
  - `404 NOT_FOUND` (session expired) â†’ Navigate back with message
- âŒ Toast actions (e.g., "Buy Credits" button in toast)

**Impact:**
- **MEDIUM** - Better UX, but basic error handling works for now.

---

### 2.6 Session Management

**Status:** âŒ **Not Implemented**

**Missing:**
- âŒ Session persistence (store sessionId in AsyncStorage)
- âŒ Resume editing flow (check for existing sessions on app launch)
- âŒ Session expiration handling (48-hour expiry)
- âŒ Polling for render status (if needed)

**Impact:**
- **MEDIUM** - Users should be able to resume editing. Can be added after MVP.

---

## 3. Implementation Plan

### Phase 1: Core Story Pipeline (MVP) ðŸ”´ **PRIORITY**

**Goal:** Enable users to create a story from input and render a video.

**Tasks:**

1. **Create Input Screen** (`CreateScreen.tsx`)
   - Input type selector (Link / Idea / Write)
   - Text input area (1-2000 chars)
   - Style selector (default/hype/cozy) - optional for MVP
   - "Create" button
   - Call `POST /api/story/start`
   - Navigate to Editor with `sessionId`

2. **API Client - Story Endpoints** (`client/api/client.ts`)
   - Add `startStory(input, inputType, styleKey?)` â†’ `POST /api/story/start`
   - Add `generateStory(sessionId)` â†’ `POST /api/story/generate`
   - Add `planStory(sessionId)` â†’ `POST /api/story/plan`
   - Add `searchClips(sessionId)` â†’ `POST /api/story/search`
   - Add `updateShot(sessionId, sentenceIndex, clipId)` â†’ `POST /api/story/update-shot`
   - Add `finalizeStory(sessionId)` â†’ `POST /api/story/finalize`
   - Add `getStorySession(sessionId)` â†’ `GET /api/story/:sessionId`
   - Add TypeScript interfaces: `StorySession`, `ShotPlan`, `Shot`, `Clip`

3. **Editor Screen** (`EditorScreen.tsx`)
   - Load session via `GET /api/story/:sessionId`
   - Auto-trigger `plan` and `search` if status is `story_generated`
   - Display beats (sentences) with clip thumbnails
   - "Select Clip" button per beat â†’ opens Clip Search Modal
   - "Render" button (bottom) â†’ checks credits, calls `finalize`
   - Show loading states during API calls

4. **Clip Search Modal** (`ClipSearchModal.tsx`)
   - Search input (optional - can use server's search query)
   - Grid of clip thumbnails (2 columns)
   - "Load More" button for pagination
   - Tap clip â†’ call `update-shot`, close modal, refresh editor

5. **Rendering Modal** (`RenderingModal.tsx`)
   - Full-screen modal with spinner
   - "Rendering your video..." message
   - Estimated time: "This usually takes 2-5 minutes"
   - Handle long request (15-minute timeout)
   - On success â†’ navigate to ShortDetail with `shortId`
   - On error â†’ show error, allow retry

6. **Navigation Updates**
   - Add `CreateScreen` to HomeStack
   - Add `EditorScreen` to HomeStack (or separate stack)
   - Add `ClipSearchModal` as modal
   - Update HomeScreen to navigate to CreateScreen

**Estimated Time:** 3-5 days

**Dependencies:**
- None (can start immediately)

---

### Phase 2: Voice Selection & TTS ðŸ”µ **HIGH PRIORITY**

**Goal:** Allow users to select voice and preview TTS.

**Tasks:**

1. **API Client - Voice Endpoints** (`client/api/client.ts`)
   - Add `getVoices()` â†’ `GET /api/voice/voices`
   - Add `previewVoice(voiceId, text?)` â†’ `POST /api/voice/preview`
   - Add `previewTTS(text, voiceId, options?)` â†’ `POST /api/tts/preview`
   - Add TypeScript interfaces: `Voice`, `VoicePreviewResponse`

2. **Voice Picker Component** (`VoicePicker.tsx`)
   - List of voices (grouped by category: male/female)
   - Play button per voice â†’ calls `previewVoice`
   - Selected state
   - Audio playback using Expo AV

3. **Integrate into Editor**
   - Add voice picker section in Editor
   - Store selected `voiceId` in session state
   - Pass `voiceId` to `finalize` (if backend supports it)

**Estimated Time:** 1-2 days

**Dependencies:**
- Phase 1 (Editor Screen must exist)

---

### Phase 3: Beat Editing ðŸ”µ **MEDIUM PRIORITY**

**Goal:** Allow users to edit, add, and delete beats.

**Tasks:**

1. **API Client - Beat Endpoints** (`client/api/client.ts`)
   - Add `updateBeatText(sessionId, sentenceIndex, text)` â†’ `POST /api/story/update-beat-text`
   - Add `insertBeat(sessionId, insertAfterIndex, text)` â†’ `POST /api/story/insert-beat`
   - Add `deleteBeat(sessionId, sentenceIndex)` â†’ `POST /api/story/delete-beat`

2. **Editor Screen Updates**
   - Make beat text editable (inline edit or modal)
   - "Add Beat" button â†’ opens input modal
   - Delete button per beat â†’ confirmation, then delete
   - Auto-refresh session after edits

**Estimated Time:** 1-2 days

**Dependencies:**
- Phase 1 (Editor Screen must exist)

---

### Phase 4: Profile & Credits Display ðŸŸ¡ **MEDIUM PRIORITY**

**Goal:** Show user profile, credits, and account management.

**Tasks:**

1. **API Client - User Endpoint** (`client/api/client.ts`)
   - Add `getUserProfile()` â†’ `GET /api/user/me`

2. **Profile Screen** (`ProfileScreen.tsx`)
   - Display user avatar, email, plan badge
   - Large credit balance display
   - "Buy Credits" button â†’ deep link to web
   - Sign out button

3. **Credit Display in Navigation**
   - Add credit badge to header (Home, Library screens)
   - Update on credit changes

**Estimated Time:** 1 day

**Dependencies:**
- None (can be done in parallel)

---

### Phase 5: Error Handling & Polish ðŸŸ¢ **LOW PRIORITY**

**Goal:** Improve error handling and user experience.

**Tasks:**

1. **Error Code Mapping**
   - Create error code â†’ user message mapping (per spec section 7)
   - Handle specific codes: 402, 429, 503, 404
   - Toast actions (e.g., "Buy Credits" button)

2. **Session Management**
   - Store `sessionId` in AsyncStorage
   - Resume editing on app launch
   - Handle session expiration (48 hours)

3. **Pull-to-Refresh**
   - Add to Library screen
   - Add to Editor screen (refresh session state)

4. **Share Functionality**
   - Add share button to ShortDetail
   - Use React Native Share API

**Estimated Time:** 2-3 days

**Dependencies:**
- Phase 1, Phase 4

---

## 4. Suggested Integration Rules

To maintain consistency and alignment with the backend spec, follow these rules throughout the integration:

### 4.1 API Contract Rules

**Rule 1: Use Spec Endpoints Exactly**
- Use endpoint paths exactly as specified in the spec (e.g., `/api/story/start`, not `/story/create`)
- Use request/response field names exactly as specified (e.g., `sessionId`, not `session_id` or `storyId`)
- Do not rename fields from backend responses

**Rule 2: Response Normalization**
- Always use `apiRequestNormalized<T>()` for new endpoints
- Handle both `{ success: true, data }` and `{ ok: true, data }` patterns
- Extract `data` field when present, otherwise use whole object (for `/credits`)

**Rule 3: Error Handling**
- Check `result.ok` before accessing `result.data`
- Map error codes to user-friendly messages (per spec section 7)
- Show toast with appropriate action (e.g., "Buy Credits" for 402)
- Never throw unhandled errors to user

**Rule 4: Authentication**
- All endpoints (except `/health`) require `Authorization: Bearer <token>`
- Token is automatically injected by `apiRequest` / `apiRequestNormalized`
- On 401, clear token cache, sign out, navigate to login

---

### 4.2 Type Safety Rules

**Rule 5: TypeScript Interfaces**
- Define interfaces matching backend response shapes exactly
- Use interfaces from spec section 8 as reference
- Export interfaces from `client/api/client.ts` for reuse

**Rule 6: Type Naming**
- Use PascalCase for types: `StorySession`, `ShotPlan`, `Clip`
- Suffix response types with `Response`: `ShortsListResponse`, `StorySessionResponse`
- Suffix request types with `Request`: `StartStoryRequest` (if needed)

---

### 4.3 State Management Rules

**Rule 7: Session State**
- Store `sessionId` in component state or navigation params
- Fetch session via `GET /api/story/:sessionId` on screen mount
- Update local state after mutations (update-shot, insert-beat, etc.)
- Optionally refetch session to ensure consistency

**Rule 8: Loading States**
- Always show loading indicator during API calls
- Disable buttons during operations
- Use skeleton screens for initial loads

---

### 4.4 Navigation Rules

**Rule 9: Screen Naming**
- Use spec screen names: `CreateScreen`, `EditorScreen`, `ShortDetailScreen`
- Keep navigation param types in stack navigator files
- Pass `sessionId` or `short` object via route params

**Rule 10: Deep Linking**
- Use `Linking.openURL()` for "Buy Credits" â†’ web checkout
- Use navigation params for internal deep links (e.g., `shortId` â†’ ShortDetail)

---

### 4.5 UI/UX Rules

**Rule 11: Credit Checks**
- Check `userProfile.credits >= 20` before allowing render
- Show "Buy Credits" CTA if insufficient
- Display credit balance in header/navigation

**Rule 12: Long Operations**
- Show full-screen modal for render operations (2-10 minutes)
- Set HTTP timeout to 15 minutes for `finalize`
- Show progress indicator and estimated time
- Handle 503 `SERVER_BUSY` with auto-retry

**Rule 13: Empty States**
- Show helpful empty states (e.g., "Create your first short")
- Include CTA buttons in empty states
- Use illustrations/icons for visual interest

---

### 4.6 Code Organization Rules

**Rule 14: API Functions Location**
- All API functions in `client/api/client.ts`
- Group by feature: User, Story, Shorts, Voice, TTS
- Export types alongside functions

**Rule 15: Screen Organization**
- One screen per file in `client/screens/`
- Use `KeyboardAwareScrollViewCompat` for scrollable screens
- Use `ThemedView`, `ThemedText` for theming
- Extract reusable components to `client/components/`

**Rule 16: Constants**
- API base URL: `process.env.EXPO_PUBLIC_API_BASE_URL`
- Colors, spacing, etc. in `client/constants/theme.ts`
- No magic numbers or hardcoded strings

---

### 4.7 Testing & Debugging Rules

**Rule 17: Logging**
- Use consistent log prefixes: `[story]`, `[shorts]`, `[auth]`
- Log API calls: `[api] POST /api/story/start 200`
- Log user actions: `[story] USER_TAP_RENDER sessionId=xyz`
- Remove debug logs before production

**Rule 18: Error Logging**
- Log errors with context: `[story] FINALIZE_FAILED sessionId=xyz error=...`
- Include request/response in error logs (sanitize tokens)
- Use console.error for errors, console.log for info

---

### 4.8 Backend Alignment Rules

**Rule 19: Field Names**
- Use backend field names verbatim: `sessionId`, `sentenceIndex`, `clipId`
- Do not camelCase backend snake_case (if any)
- Do not rename fields for "consistency"

**Rule 20: Status Values**
- Use exact status strings: `"draft"`, `"story_generated"`, `"plan_generated"`, `"clips_searched"`, `"rendered"`
- Check status before operations (e.g., only render if `clips_searched`)

**Rule 21: Rate Limits**
- Respect rate limits: 300/day for script generation, 5/min for TTS
- Show user-friendly messages when limits hit
- Disable buttons when rate limited

---

## 5. Semantic & Language Cohesion Checklist

When implementing new features, ensure:

- [ ] Endpoint paths match spec exactly
- [ ] Request/response field names match spec exactly
- [ ] TypeScript interfaces match backend response shapes
- [ ] Error codes match spec (e.g., `INSUFFICIENT_CREDITS`, not `NOT_ENOUGH_CREDITS`)
- [ ] Status values match spec (e.g., `"story_generated"`, not `"script_ready"`)
- [ ] Screen names match spec (e.g., `EditorScreen`, not `StoryEditorScreen`)
- [ ] User-facing messages match spec tone (e.g., "Not enough credits. You need 20 credits to render.")
- [ ] Navigation param names match (e.g., `sessionId`, not `storyId`)

---

## 6. Next Steps

1. **Immediate:** Start Phase 1 (Core Story Pipeline)
   - Begin with API client functions and types
   - Then CreateScreen
   - Then EditorScreen
   - Then ClipSearchModal
   - Finally RenderingModal

2. **Parallel:** Add credit display to navigation header (quick win)

3. **After Phase 1:** Implement Phase 2 (Voice Selection)

4. **Polish:** Add error handling improvements (Phase 5) as you go

---

## 7. Notes & Risks

**Risks:**
- Long render times (2-10 minutes) may cause timeouts on mobile networks
- Session expiration (48 hours) may frustrate users if not handled gracefully
- Rate limits may block power users (300/day script generation)

**Considerations:**
- Consider adding session persistence (AsyncStorage) early
- Consider adding optimistic UI updates for beat edits
- Consider adding retry logic for network failures
- Consider adding offline detection and messaging

**Questions to Resolve:**
- Does backend support voice selection in `finalize` request? (Check spec)
- Can we poll for render status instead of blocking? (Spec says synchronous)
- Should we show clip search results immediately after `search`, or wait for user action?

---

**End of Audit Report**
