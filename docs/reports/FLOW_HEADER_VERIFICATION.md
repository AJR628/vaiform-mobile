- Status: WORKING_REPORT
- Owner repo: mobile
- Source of truth for: point-in-time verification or planning context only; not canonical route truth
- Canonical counterpart/source: docs/MOBILE_USED_SURFACES.md and backend canonical docs in ../vaiform-1/docs/
- Last verified against: mobile repo state at time of report creation

# FlowTabsHeader persistence â€” verification audits

Run after implementing the FlowTabsHeader SSOT + Render confirm plan.

## 1. headerBackVisible / headerBackTitleVisible types

- **Check**: `headerBackVisible` and `headerBackTitleVisible` are valid on `NativeStackNavigationOptions` with `@react-navigation/native-stack@7.3.16`.
- **Result**: Used in HomeStackNavigator (Home, Script, StoryEditor) and in StoryEditorScreen setOptions. Linter reports no errors. Run `npm run check:types` to confirm tsc accepts them.

## 2. useScreenOptions() and back behavior

- **Check**: useScreenOptions() does not set any conflicting back behavior that would override per-screen options.
- **Result**: Confirmed. [useScreenOptions.ts](client/hooks/useScreenOptions.ts) returns only `headerTitleAlign`, `headerTransparent`, `headerBlurEffect`, `headerTintColor`, `headerStyle`, `gestureEnabled`, `gestureDirection`, `fullScreenGestureEnabled`, `contentStyle`. It does **not** set `headerBackVisible`, `headerBackTitleVisible`, or `headerLeft`. Per-screen options merge and win.

## 3. StoryEditor header flicker

- **Check**: StoryEditor shows a momentary "Storyboard Editor" title before its setOptions runs (header flicker).
- **Result**: Yes â€” Stack previously set `headerTitle: "Storyboard Editor"` so the initial paint showed that string until the screenâ€™s useLayoutEffect ran. **Mitigation applied**: StoryEditorâ€™s Stack options now use `headerTitle: () => null` so the initial paint shows an empty title; setOptions then applies FlowTabsHeader. No "Storyboard Editor" flash.

## 4. Script â†” Storyboard via replace()

- **Check**: Switching Script â†” Storyboard via replace() preserves the bottom tabs and does not create duplicate stack entries.
- **Result**: Confirmed. `navigation.replace("StoryEditor", { sessionId })` and `navigation.replace("Script", { sessionId })` replace the current screen on the **Home stack**; the stack stays [Home, Script] or [Home, StoryEditor]. The bottom tab bar is owned by the tab navigator, not the stack, so tabs are preserved. No duplicate stack entries.
