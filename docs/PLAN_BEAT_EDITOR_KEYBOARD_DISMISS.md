# Beat Editor Keyboard Dismissal — Plan (Verified + Implemented)

## Goal

- Restore original UX: no `KeyboardAvoidingView` (no whole-page push).
- Enter/Done key saves beat text and dismisses keyboard.
- Tap-away (blur) still saves.
- No double-save when Done → blur fires.

---

## 1. Remove KeyboardAvoidingView

- Remove `KeyboardAvoidingView` wrapper; restore `ThemedView` as root.
- Remove `Platform` import; keep `Keyboard` import.
- Keeps layout as before (no screen push).

## 2. TextInput: Enter = Save

- **Remove** `multiline` so Enter submits instead of newline.
- **Add**:
  - `returnKeyType="done"`
  - `blurOnSubmit={true}`
  - `onSubmitEditing={() => handleSaveBeat(selectedBeat.sentenceIndex, "submit")}`
- **Keep** `onBlur={() => handleSaveBeat(selectedBeat.sentenceIndex, "blur")}` and `ref={textInputRef}`.
- Use `selectedBeat.sentenceIndex` (we’re inside the selected-beat block).

## 3. In-Flight Guard (Prevent Double-Save)

**Gotcha:** Done → `onSubmitEditing` runs → we blur → `onBlur` runs → `handleSaveBeat` again → double API call.

- Add `savingRef = useRef<number | null>(null)`.
- At start of `handleSaveBeat`: **if `savingRef.current === sentenceIndex` → return.**
- Before awaiting API: `savingRef.current = sentenceIndex`.
- In `finally`: `savingRef.current = null`.

## 4. No-Changes Short-Circuit

- Compare draft `beatTexts[sentenceIndex]?.trim()` to original `beat?.text?.trim()`.
- **If equal:** blur + `Keyboard.dismiss()`, then return (no API call).
- To avoid double handling when Done with no changes (blur still fires):
  - Set `savingRef.current = sentenceIndex` before blur.
  - `setTimeout(0, () => { savingRef.current = null })` after blur/dismiss so `onBlur` no-ops.

## 5. `handleSaveBeat(sentenceIndex, source?)`

- Optional `_source?: "submit" | "blur"` (kept for clarity; guard is ref-based).
- Order:
  1. In-flight guard return.
  2. Empty draft → `showError`, return.
  3. No-changes → set ref, blur, dismiss, `setTimeout` clear ref, return.
  4. Set `savingRef`, `setSavingByIndex`, call API.
  5. On success: `blur`, `Keyboard.dismiss()`, `setSelectedSentenceIndex(null)`.
  6. `finally`: clear `savingByIndex` and `savingRef`.

## 6. Keep Unchanged

- FlatList: `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`.
- API: `sessionId` + `sentenceIndex` only.

---

## Sanity Checks

| Scenario | Expected |
|----------|----------|
| Tap beat → edit → press Done | Saves once, keyboard dismisses, list visible. |
| Edit nothing → press Done | Keyboard dismisses, no network call. |
| Type → tap outside | Saves, keyboard dismisses (or blur + drag still works). |

---

## Files Touched

- `client/screens/StoryEditorScreen.tsx`: imports, `savingRef`, `handleSaveBeat`, TextInput props, remove KAV.
