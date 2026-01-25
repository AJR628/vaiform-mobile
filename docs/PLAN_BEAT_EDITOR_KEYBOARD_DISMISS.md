# Beat Editor Keyboard — Final Verify + Implementation Plan

## Reconfirm requirements

- **Input above keyboard:** Active beat TextInput must stay visible above the keyboard. Keyboard may cover thumbnails.
- **Enter = Save + dismiss:** Enter/Done saves and dismisses keyboard; must **not** insert a newline.
- **Tap-away:** Blur can save too.
- **No double-save:** Submit → blur must not cause two API calls.

**Constraints:** Do not touch unrelated files/endpoints. Keep `sessionId` + `sentenceIndex` semantics. Only modify `client/screens/StoryEditorScreen.tsx`.

---

# Step 1 — Verify Enter submission (with logs)

**Purpose:** Confirm that with `multiline` removed, Enter triggers `onSubmitEditing` on iOS and Android. If Android is flaky, use the fallback (multiline + strip `\n` in `onChangeText`).

## 1.1 Add temporary logs

**File:** `client/screens/StoryEditorScreen.tsx`

**A) On the beat-edit TextInput** (lines 513–537):

- Add (keep existing `onBlur` logic; merge with log):
  ```tsx
  onFocus={() => console.log("[beat] focus", selectedSentenceIndex)}
  onKeyPress={(e) => console.log("[beat] key", e.nativeEvent.key)}
  onSubmitEditing={() => console.log("[beat] submit")}
  ```
- In `onBlur`: log first, then existing logic:
  ```tsx
  onBlur={() => {
    console.log("[beat] blur");
    if (selectedSentenceIndex !== null) handleSaveBeat(selectedSentenceIndex);
  }}
  ```

**B) At the very start of `handleSaveBeat`** (after the `async` line, before any other logic):

- Add: `console.log("[beat] save start", sentenceIndex);`

**C) Temporarily** (for this step only): remove `multiline` and add `returnKeyType="done"`, `blurOnSubmit={true}`, and `onSubmitEditing` as above. This is only to test Enter behavior.

## 1.2 Run on device

1. Clean run: `npx expo start -c` (or full rebuild); open Story Editor on **iOS** and **Android**.
2. Tap a beat → focus TextInput → type → press **Done**.
3. Check logs:
   - **iOS:** Does Enter log `[beat] submit`? **Y / N**
   - **Android:** Does Enter log `[beat] submit`? **Y / N**
   - Does Enter insert a newline? **Y / N** (should be N with multiline removed)

## 1.3 Choose Enter strategy

- **If both platforms fire submit reliably:** Use **A2** (single-line submit) in Step 3.
- **If Android submit is flaky or missing:** Use **Fallback** (multiline + strip `\n` in `onChangeText`) in Step 3.

**Record:** iOS submit fires? ___ | Android submit fires? ___ → Strategy: **A2** / **Fallback**

---

# Step 2 — Implement B1 (floating editor above keyboard)

**File:** `client/screens/StoryEditorScreen.tsx`

## 2.1 Imports

- Add `Keyboard` to the `react-native` import (line 2).

## 2.2 State and listeners

- Add state:  
  `const [keyboardHeight, setKeyboardHeight] = useState(0);`
- Add `useEffect` for keyboard listeners:
  ```ts
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  ```

## 2.3 Remove inline beat input from preview section

- **Delete** the entire block  
  `{/* Selected beat text input */} {selectedBeat && ( <View style={styles.inputContainer}> ... </View> )}`  
  from inside `View (previewSection)` (currently lines 506–545). The preview section should only contain `View (previewContainer)` with the thumbnail.

## 2.4 Render beat input as absolute overlay

- **After** `</View>` that closes `previewSection`, and **before** `{/* Timeline section */}`, add a **sibling** block (still inside `ThemedView`):
  ```tsx
  {selectedBeat && (
    <View
      style={[
        styles.inputContainer,
        {
          position: "absolute",
          left: Spacing.md,
          right: Spacing.md,
          bottom: keyboardHeight,
          zIndex: 1000,
          backgroundColor: theme.backgroundRoot,
          paddingVertical: Spacing.sm,
        },
      ]}
    >
      <ThemedText style={styles.beatLabel}>
        Beat {selectedBeat.sentenceIndex + 1}
      </ThemedText>
      <TextInput ... />
      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={theme.link} />
        </View>
      )}
    </View>
  )}
  ```
- Reuse the same `TextInput` and saving indicator as before. The `TextInput` props (value, `onChangeText`, etc.) will be updated in Step 3. The overlay sits above thumbnails/timeline; keyboard may cover them.

## 2.5 Styles

- Ensure `inputContainer` in StyleSheet still has `position: "relative"` (or remove it for the overlay; we override with `position: "absolute"` inline). The overlay style above overrides as needed.

---

# Step 3 — Implement Enter = Save

**File:** `client/screens/StoryEditorScreen.tsx` (beat-edit `TextInput` inside the overlay)

## Option A2 (single-line submit) — use if Step 1 shows submit fires on both platforms

- **Remove** `multiline` from the `TextInput`.
- **Add**  
  `returnKeyType="done"`  
  `blurOnSubmit={true}`  
  `ref={textInputRef}`  
  `onSubmitEditing={() => handleSaveBeat(selectedBeat.sentenceIndex, "submit")}`  
  `onBlur={() => handleSaveBeat(selectedBeat.sentenceIndex, "blur")}`  
  (guard in `handleSaveBeat` prevents double-save when Done triggers blur.)

## Fallback (multiline + Enter as submit) — use if Android submit is flaky

- **Keep** `multiline={true}`.
- **Do not** add `onSubmitEditing` / `blurOnSubmit` / `returnKeyType` for submit.
- In **`onChangeText`**:
  - If `text` contains `\n`:
    - Replace newlines: `const cleaned = text.replace(/\n/g, " ").trim()` (or similar; preserve single spaces if desired).
    - `setBeatTexts` with the cleaned string for that `sentenceIndex`.
    - Call `handleSaveBeat(selectedBeat.sentenceIndex, "submit", cleaned)` (or extend `handleSaveBeat` to accept an optional `draftOverride` and use it instead of `beatTexts[sentenceIndex]` when provided — since `setState` is async, the save must use the cleaned value explicitly).
    - `textInputRef.current?.blur();` and `Keyboard.dismiss();`
  - Else: update `beatTexts` as today.
- **Keep** `onBlur` → `handleSaveBeat(selectedBeat.sentenceIndex, "blur")`.
- Add `ref={textInputRef}`.

---

# Step 4 — Prevent double-save + avoid unnecessary API calls

**File:** `client/screens/StoryEditorScreen.tsx`

## 4.1 Refs

- Add `const textInputRef = useRef<TextInput>(null);`
- Add `const savingRef = useRef<number | null>(null);`

## 4.2 Update `handleSaveBeat`

- **Signature:** `handleSaveBeat(sentenceIndex: number, _source?: "submit" | "blur", draftOverride?: string)`.
  - When **Fallback** calls from `onChangeText` (Enter path), pass the cleaned string as `draftOverride` so the save uses it despite async `setState`.
- **At top:**  
  `if (savingRef.current === sentenceIndex) return;`
- **Draft:**  
  `const draft = (draftOverride ?? beatTexts[sentenceIndex] ?? "").trim();`  
  if `!draft` → `showError("Beat text cannot be empty"); return;`
- **No-changes short-circuit:**  
  `const beat = beats.find((b) => b.sentenceIndex === sentenceIndex);`  
  `const original = beat?.text?.trim() ?? "";`  
  if `draft === original`:  
  - `savingRef.current = sentenceIndex;`  
  - `textInputRef.current?.blur();`  
  - `Keyboard.dismiss();`  
  - `setTimeout(() => { savingRef.current = null; }, 0);`  
  - `return;`
- **Before API call:**  
  `savingRef.current = sentenceIndex;`  
  `setSavingByIndex(...)`  
  then `await storyUpdateBeatText({ sessionId, sentenceIndex, text: draft });`
- **On success:**  
  `textInputRef.current?.blur();`  
  `Keyboard.dismiss();`  
  optionally `setSelectedSentenceIndex(null);`
- **`finally`:**  
  `setSavingByIndex(..., false);`  
  `savingRef.current = null;`
- **Continue** using only `sessionId` and `sentenceIndex` for the API.

---

# Summary: exact code edits

| # | Location | Action |
|---|----------|--------|
| 1 | RN import | Add `Keyboard`. |
| 2 | State | Add `keyboardHeight`; add `useEffect` for `keyboardDidShow` / `keyboardDidHide` + cleanup. |
| 3 | Refs | Add `textInputRef`, `savingRef`. |
| 4 | `handleSaveBeat` | Guard, no-changes short-circuit, `savingRef` set/clear, success blur + dismiss; `_source?` param. |
| 5 | Preview section | Remove inline beat input block (label + TextInput + saving indicator). |
| 6 | Layout (sibling of preview) | Add absolute overlay `View` when `selectedBeat`, with `bottom: keyboardHeight`, padding, `zIndex`. |
| 7 | Overlay `TextInput` | Implement A2 **or** Fallback per Step 1; add `ref`, `onBlur`; ensure no double-save. |
| 8 | FlatList | Add `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`. |

**Remove before ship:** All `[beat]` console logs added in Step 1.

---

# Enter strategy: which and why

- **A2:** Use if Step 1 shows **both** iOS and Android fire `onSubmitEditing` when Done is pressed (with `multiline` removed). Simpler and standard.
- **Fallback:** Use if **Android** does not reliably fire `onSubmitEditing`. Keeps `multiline`; treats Enter as submit by stripping `\n` in `onChangeText` and calling save + blur + dismiss there.

**Output:** After Step 1, record “Strategy: A2” or “Strategy: Fallback” and implement the matching Option in Step 3.

---

# Manual test checklist

1. **Clean run** → Story Editor → tap a beat. Keyboard opens.
2. **Input above keyboard:** Beat TextInput remains **visible above** the keyboard (thumbnails may be covered). **Pass / Fail**
3. **Enter = Save:** Type → press **Done** → **one** save, keyboard dismisses, **no** newline. **Pass / Fail**
4. **No-changes Done:** Focus → **don’t** type → **Done** → keyboard dismisses, **no** API call. **Pass / Fail**
5. **Tap-away:** Type → tap timeline → save runs, keyboard dismisses. **Pass / Fail**
6. **No double-save:** Monitor `[beat] save start` or network; **Done** must **not** trigger two `storyUpdateBeatText` calls. **Pass / Fail**
7. Repeat on **iOS** and **Android** if both are in scope.

---

# Final build plan (order of work)

1. **Step 1:** Add logs, temporarily remove `multiline` and add submit props, run on iOS + Android, record results, choose **A2** or **Fallback**.
2. **Step 2:** Add `Keyboard`, `keyboardHeight`, listeners; remove inline beat input; add absolute overlay; wire overlay `TextInput` + saving UI.
3. **Step 3:** Implement chosen Enter strategy (A2 or Fallback) in overlay `TextInput`.
4. **Step 4:** Add `textInputRef`, `savingRef`; update `handleSaveBeat` (guard, no-changes, `savingRef` lifecycle, success blur + dismiss).
5. **FlatList:** Add `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`.
6. **Verify:** Run manual test checklist; confirm no double-save.
7. **Cleanup:** Remove all `[beat]` temporary logs.

**Do not** change unrelated files or API contracts. Keep `sessionId` + `sentenceIndex` semantics throughout.

---

*End of final verify + implementation plan.*
