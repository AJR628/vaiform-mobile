import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  storyDeleteBeat,
  storyGet,
  storyUpdateBeatText,
} from "@/api/client";
import { useActiveStorySession } from "@/contexts/ActiveStorySessionContext";
import type { StorySession } from "@/types/story";

import { extractBeats, type Beat, unwrapSession } from "./model";

const MAX_BEAT_CHARS = 160;
const MAX_TOTAL_CHARS = 850;

interface UseStoryEditorSessionOptions {
  sessionId: string;
  showError: (message: string) => void;
}

export function useStoryEditorSession({
  sessionId,
  showError,
}: UseStoryEditorSessionOptions) {
  const { setActiveSessionId } = useActiveStorySession();

  const [session, setSession] = useState<StorySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingByIndex, setSavingByIndex] = useState<Record<number, boolean>>({});
  const [beatTexts, setBeatTexts] = useState<Record<number, string>>({});
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);

  const loggedRef = useRef(false);
  const shouldRefreshRef = useRef(false);
  const savingRef = useRef<number | null>(null);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await storyGet(sessionId);
      if (!res.ok) {
        showError(res?.message || "Failed to load storyboard. Please try again.");
        setIsLoading(false);
        return;
      }

      const unwrappedSession = unwrapSession<StorySession>(res);
      setSession(unwrappedSession);

      const nextBeats = extractBeats(unwrappedSession);
      setBeatTexts((prev) => {
        const updated = { ...prev };
        nextBeats.forEach((beat) => {
          if (updated[beat.sentenceIndex] === undefined) {
            updated[beat.sentenceIndex] = beat.text;
          }
        });
        return updated;
      });

      if (__DEV__ && unwrappedSession && !loggedRef.current) {
        loggedRef.current = true;
        console.log("[story] session keys", Object.keys(unwrappedSession || {}));
        if (nextBeats.length > 0) {
          console.log("[story] beats found:", nextBeats.length, "sample:", nextBeats[0]);
        } else {
          console.log("[story] no beats found in session");
        }
        if (unwrappedSession?.shots?.[0]) {
          console.log("[story] shots[0] sample:", unwrappedSession.shots[0]);
        }
      }
    } catch (error) {
      console.error("[story] load error:", error);
      showError("Failed to load storyboard. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, showError]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useFocusEffect(
    useCallback(() => {
      if (!shouldRefreshRef.current || isLoading) return;
      shouldRefreshRef.current = false;

      const refreshSession = async () => {
        try {
          const res = await storyGet(sessionId);
          if (res.ok) {
            setSession(unwrapSession<StorySession>(res));
          }
        } catch (error) {
          console.error("[story] refresh error:", error);
        }
      };

      void refreshSession();
    }, [isLoading, sessionId])
  );

  const beats = useMemo<Beat[]>(() => (session ? extractBeats(session) : []), [session]);

  useEffect(() => {
    if (beats.length === 0) {
      setSelectedSentenceIndex(null);
      return;
    }

    if (selectedSentenceIndex === null) {
      setSelectedSentenceIndex(beats[0].sentenceIndex);
      return;
    }

    const exists = beats.some((beat) => beat.sentenceIndex === selectedSentenceIndex);
    if (!exists) {
      setSelectedSentenceIndex(beats[0].sentenceIndex);
    }
  }, [beats, selectedSentenceIndex, session]);

  useEffect(() => {
    setActiveSessionId(sessionId);
  }, [sessionId, setActiveSessionId]);

  const markShouldRefresh = useCallback(() => {
    shouldRefreshRef.current = true;
  }, []);

  const handleSaveBeat = useCallback(
    async (
      sentenceIndex: number,
      draftText: string,
      options?: { onSaved?: () => void }
    ) => {
      if (savingRef.current === sentenceIndex) return;

      const draft = draftText.trim();
      if (!draft) {
        showError("Beat text cannot be empty");
        return;
      }
      if (draft.length > MAX_BEAT_CHARS) {
        showError(`Beat text must stay under ${MAX_BEAT_CHARS} characters.`);
        return;
      }

      const beat = beats.find((item) => item.sentenceIndex === sentenceIndex);
      const committed = beatTexts[sentenceIndex] ?? beat?.text?.trim() ?? "";
      const nextSentences = beats
        .slice()
        .sort((left, right) => left.sentenceIndex - right.sentenceIndex)
        .map((item) => (item.sentenceIndex === sentenceIndex ? draft : item.text));
      const nextTotalChars = nextSentences.join("").length;
      if (nextTotalChars > MAX_TOTAL_CHARS) {
        showError(`Story must stay under ${MAX_TOTAL_CHARS} total characters.`);
        return;
      }
      if (draft === committed) {
        savingRef.current = sentenceIndex;
        Keyboard.dismiss();
        options?.onSaved?.();
        setTimeout(() => {
          savingRef.current = null;
        }, 0);
        return;
      }

      savingRef.current = sentenceIndex;
      setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: true }));

      try {
        const res = await storyUpdateBeatText({
          sessionId,
          sentenceIndex,
          text: draft,
        });

        if (!res.ok) {
          showError(res?.message || "Failed to update beat text");
          return;
        }

        setBeatTexts((prev) => ({ ...prev, [sentenceIndex]: draft }));
        const fresh = await storyGet(sessionId);
        if (fresh.ok) {
          setSession(unwrapSession<StorySession>(fresh));
        }
        Keyboard.dismiss();
        options?.onSaved?.();
      } catch (error) {
        console.error("[story] save beat error:", error);
        showError("Failed to update beat text. Please try again.");
      } finally {
        setSavingByIndex((prev) => ({ ...prev, [sentenceIndex]: false }));
        savingRef.current = null;
      }
    },
    [beatTexts, beats, sessionId, showError]
  );

  const handleDeleteBeat = useCallback(
    (
      deletedIndex: number,
      options?: {
        onDeleted?: () => void;
      }
    ) => {
      Alert.alert("Delete beat?", "This beat and its clip will be removed.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await storyDeleteBeat({ sessionId, sentenceIndex: deletedIndex });
            if (!res.ok) {
              showError(res?.message ?? "Failed to delete beat.");
              return;
            }

            const fresh = await storyGet(sessionId);
            if (!fresh.ok) {
              showError(fresh?.message ?? "Failed to reload storyboard.");
              return;
            }

            const unwrappedSession = unwrapSession<StorySession>(fresh);
            setSession(unwrappedSession);

            const nextBeats = extractBeats(unwrappedSession);
            setBeatTexts(Object.fromEntries(nextBeats.map((beat) => [beat.sentenceIndex, beat.text])));
            setSelectedSentenceIndex(
              nextBeats.length > 0
                ? nextBeats[Math.min(deletedIndex, nextBeats.length - 1)].sentenceIndex
                : null
            );
            options?.onDeleted?.();
          },
        },
      ]);
    },
    [sessionId, showError]
  );

  return {
    beats,
    beatTexts,
    handleDeleteBeat,
    handleSaveBeat,
    isLoading,
    markShouldRefresh,
    savingByIndex,
    selectedSentenceIndex,
    session,
    loadSession,
    setSelectedSentenceIndex,
    setSession,
  };
}
