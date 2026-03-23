import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";

import { storyFinalize, storyGet } from "@/api/client";
import {
  enrichFailureDiagnostic,
  recordClientDiagnostic,
} from "@/lib/diagnostics";
import {
  formatRenderTimeAmount,
  getEstimatedUsageSec,
  getSettledBilledSec,
} from "@/lib/renderUsage";
import {
  clearStoredStoryFinalizeAttempt,
  loadStoredStoryFinalizeAttempt,
  storeStoryFinalizeAttempt,
} from "@/lib/storyFinalizeAttemptStorage";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import type { StorySession } from "@/types/story";

import {
  getFinalizeAttemptId,
  getInsufficientRenderTimeMessage,
  getRenderRecovery,
  getRenderRecoveryShortId,
  isRenderRecoveryForAttempt,
  unwrapSession,
} from "./model";

const DEFAULT_RENDERING_MODAL_TITLE = "Rendering your video...";
const DEFAULT_RENDERING_MODAL_SUBTEXT = "This usually takes 2-5 minutes";
const RECOVERY_RENDERING_MODAL_TITLE = "Checking render status...";
const RECOVERY_RENDERING_MODAL_SUBTEXT =
  "Connection interrupted. We're checking the same render attempt.";
const RENDER_RECOVERY_POLL_DELAY_MS = 3000;
const RENDER_RECOVERY_MAX_ATTEMPTS = 20;

type StoryEditorNavProp = NativeStackNavigationProp<HomeStackParamList, "StoryEditor">;

interface UseStoryEditorFinalizeOptions {
  availableSec: number;
  estimatedSec: number | null;
  navigation: StoryEditorNavProp;
  refreshUsage: () => Promise<void>;
  session: StorySession | null;
  sessionId: string;
  setSession: (session: StorySession | null) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  usageLoaded: boolean;
  userId?: string | null;
}

function formatUuidFromBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

async function createRenderAttemptIdempotencyKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidFromBytes(bytes);
}

export function useStoryEditorFinalize({
  availableSec,
  estimatedSec,
  navigation,
  refreshUsage,
  session,
  sessionId,
  setSession,
  showError,
  showSuccess,
  showWarning,
  usageLoaded,
  userId,
}: UseStoryEditorFinalizeOptions) {
  const [isRendering, setIsRendering] = useState(false);
  const [showRenderingModal, setShowRenderingModal] = useState(false);
  const [renderingModalTitle, setRenderingModalTitle] = useState(
    DEFAULT_RENDERING_MODAL_TITLE
  );
  const [renderingModalSubtext, setRenderingModalSubtext] = useState(
    DEFAULT_RENDERING_MODAL_SUBTEXT
  );

  const activeRenderAttemptKeyRef = useRef<string | null>(null);
  const resumedStoredRenderAttemptRef = useRef<string | null>(null);

  const persistActiveRenderAttempt = useCallback(
    async (attemptId: string) => {
      activeRenderAttemptKeyRef.current = attemptId;
      if (!userId) return;
      try {
        await storeStoryFinalizeAttempt({
          uid: userId,
          sessionId,
          attemptId,
          startedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[story] persist finalize attempt failed:", error);
      }
    },
    [sessionId, userId]
  );

  const clearActiveRenderAttempt = useCallback(async () => {
    const previousAttemptId = activeRenderAttemptKeyRef.current;
    activeRenderAttemptKeyRef.current = null;
    resumedStoredRenderAttemptRef.current = null;
    if (!userId) return;
    try {
      await clearStoredStoryFinalizeAttempt(userId, sessionId);
    } catch (error) {
      console.error("[story] clear finalize attempt failed:", error);
      if (previousAttemptId) {
        activeRenderAttemptKeyRef.current = previousAttemptId;
      }
    }
  }, [sessionId, userId]);

  const completeRenderSuccess = useCallback(
    async (shortId: string, successMessage: string) => {
      await clearActiveRenderAttempt();
      setShowRenderingModal(false);
      showSuccess(successMessage);

      try {
        await refreshUsage();
      } catch (error) {
        console.warn("[story] Failed to refresh usage after render:", error);
      }

      const tabNavigator = navigation.getParent();
      if (__DEV__) {
        console.log("[nav-verify] parent routeNames:", tabNavigator?.getState?.()?.routeNames);
      }
      if (tabNavigator) {
        tabNavigator.navigate("LibraryTab", {
          screen: "ShortDetail",
          params: { shortId },
        });
      } else {
        console.warn("[story] Could not access tab navigator for cross-stack navigation");
        showError("Render succeeded, but navigation failed. Please check your Library.");
      }
    },
    [clearActiveRenderAttempt, navigation, refreshUsage, showError, showSuccess]
  );

  const recoverRenderAttempt = useCallback(
    async (
      attemptId: string,
      options?: { interrupted?: boolean }
    ): Promise<"done" | "failed" | "pending"> => {
      if (options?.interrupted) {
        setRenderingModalTitle(RECOVERY_RENDERING_MODAL_TITLE);
        setRenderingModalSubtext(RECOVERY_RENDERING_MODAL_SUBTEXT);
      } else {
        setRenderingModalTitle(DEFAULT_RENDERING_MODAL_TITLE);
        setRenderingModalSubtext(DEFAULT_RENDERING_MODAL_SUBTEXT);
      }

      for (
        let pollAttempt = 0;
        pollAttempt < RENDER_RECOVERY_MAX_ATTEMPTS;
        pollAttempt += 1
      ) {
        const res = await storyGet(sessionId);
        if (!res.ok) {
          enrichFailureDiagnostic(
            {
              route: `/api/story/${sessionId}`,
              requestId: res.requestId,
              status: res.status,
              code: res.code,
            },
            {
              sessionId,
              attemptId,
              pollAttempt,
              stage: "recovery_poll",
            }
          );
        }

        if (res.ok) {
          const recoveredSession = unwrapSession<StorySession>(res);
          setSession(recoveredSession);

          const renderRecovery = getRenderRecovery(recoveredSession);
          if (isRenderRecoveryForAttempt(renderRecovery, attemptId)) {
            if (renderRecovery?.state === "done") {
              const recoveredShortId = getRenderRecoveryShortId(
                recoveredSession,
                renderRecovery
              );
              if (recoveredShortId) {
                await completeRenderSuccess(recoveredShortId, "Video rendered successfully!");
                return "done";
              }
              showError(
                "Render finished, but the short is not ready yet. Please check your Library."
              );
              return "failed";
            }

            if (renderRecovery?.state === "failed") {
              showError(renderRecovery.message || "Render failed. Please try again.");
              return "failed";
            }
          }
        }

        if (pollAttempt < RENDER_RECOVERY_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, RENDER_RECOVERY_POLL_DELAY_MS)
          );
        }
      }

      recordClientDiagnostic({
        route: `/api/story/${sessionId}`,
        code: "RECOVERY_PENDING",
        message: "Render recovery remained pending after polling window.",
        context: {
          sessionId,
          attemptId,
          pollAttempts: RENDER_RECOVERY_MAX_ATTEMPTS,
        },
      });
      showWarning(
        "Render is still processing. Tap Render again to resume this same attempt, or check your Library shortly."
      );
      setShowRenderingModal(false);
      return "pending";
    },
    [completeRenderSuccess, sessionId, setSession, showError, showWarning]
  );

  useEffect(() => {
    if (isLoadingOrMissingSession(session, userId)) return;

    let cancelled = false;

    const resumeStoredFinalizeAttempt = async () => {
      const storedAttempt = await loadStoredStoryFinalizeAttempt(userId!, sessionId);
      if (cancelled || !storedAttempt) return;

      const storedAttemptId = storedAttempt.attemptId;
      const renderRecovery = getRenderRecovery(session);

      if (!isRenderRecoveryForAttempt(renderRecovery, storedAttemptId)) {
        await clearActiveRenderAttempt();
        return;
      }

      activeRenderAttemptKeyRef.current = storedAttemptId;

      if (renderRecovery?.state === "done") {
        const recoveredShortId = getRenderRecoveryShortId(session, renderRecovery);
        if (recoveredShortId) {
          const billedSec = getSettledBilledSec(session);
          const successMessage = billedSec
            ? `Video rendered successfully! Used ${formatRenderTimeAmount(billedSec)} of render time.`
            : "Video rendered successfully!";
          await completeRenderSuccess(recoveredShortId, successMessage);
          return;
        }
        await clearActiveRenderAttempt();
        showError(
          "Render finished, but the short is not ready yet. Please check your Library."
        );
        return;
      }

      if (renderRecovery?.state === "failed") {
        await clearActiveRenderAttempt();
        showError(renderRecovery.message || "Render failed. Please try again.");
        return;
      }

      if (renderRecovery?.state !== "pending") {
        await clearActiveRenderAttempt();
        return;
      }

      if (resumedStoredRenderAttemptRef.current === storedAttemptId || isRendering) {
        return;
      }

      resumedStoredRenderAttemptRef.current = storedAttemptId;
      setIsRendering(true);
      setShowRenderingModal(true);
      setRenderingModalTitle(RECOVERY_RENDERING_MODAL_TITLE);
      setRenderingModalSubtext(RECOVERY_RENDERING_MODAL_SUBTEXT);

      try {
        const recoveryResult = await recoverRenderAttempt(storedAttemptId, {
          interrupted: true,
        });
        if (cancelled) return;
        if (recoveryResult !== "pending") {
          await clearActiveRenderAttempt();
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
          setRenderingModalTitle(DEFAULT_RENDERING_MODAL_TITLE);
          setRenderingModalSubtext(DEFAULT_RENDERING_MODAL_SUBTEXT);
        }
      }
    };

    void resumeStoredFinalizeAttempt();

    return () => {
      cancelled = true;
    };
  }, [
    clearActiveRenderAttempt,
    completeRenderSuccess,
    isRendering,
    recoverRenderAttempt,
    session,
    sessionId,
    showError,
    userId,
  ]);

  const doRender = useCallback(
    async (reservedEstimateSec?: number | null) => {
      setIsRendering(true);
      setShowRenderingModal(true);
      setRenderingModalTitle(DEFAULT_RENDERING_MODAL_TITLE);
      setRenderingModalSubtext(DEFAULT_RENDERING_MODAL_SUBTEXT);

      let shouldClearActiveRenderAttemptKey = false;

      try {
        const idempotencyKey =
          activeRenderAttemptKeyRef.current ?? (await createRenderAttemptIdempotencyKey());
        activeRenderAttemptKeyRef.current = idempotencyKey;

        let result = await storyFinalize(
          { sessionId },
          { idempotencyKey }
        );
        let retryCount = 0;
        const maxRetries = 1;

        while (!result.ok && result.retryAfter && retryCount < maxRetries) {
          enrichFailureDiagnostic(
            {
              route: "/api/story/finalize",
              requestId: result.requestId,
              status: result.status,
              code: result.code,
            },
            {
              sessionId,
              attemptId: idempotencyKey,
              retryCount,
              retryAfterSec: result.retryAfter,
              stage: "server_busy_retry",
            }
          );
          showWarning(`Server busy. Retrying in ${result.retryAfter}s...`);
          await new Promise((resolve) => setTimeout(resolve, result.retryAfter! * 1000));
          result = await storyFinalize(
            { sessionId },
            { idempotencyKey }
          );
          retryCount += 1;
        }

        if (!result.ok) {
          const recoveryAttemptId = getFinalizeAttemptId(result.finalize, idempotencyKey);
          enrichFailureDiagnostic(
            {
              route: "/api/story/finalize",
              requestId: result.requestId,
              status: result.status,
              code: result.code,
            },
            {
              sessionId,
              attemptId: idempotencyKey,
              retryCount,
              stage: "finalize_result",
            }
          );

          if (
            result.code === "TIMEOUT" ||
            result.code === "NETWORK_ERROR" ||
            result.code === "IDEMPOTENT_IN_PROGRESS" ||
            result.code === "FINALIZE_ALREADY_ACTIVE" ||
            result.status === 0 ||
            result.status === 409
          ) {
            await persistActiveRenderAttempt(recoveryAttemptId);
            const recoveryResult = await recoverRenderAttempt(recoveryAttemptId, {
              interrupted: true,
            });
            shouldClearActiveRenderAttemptKey = recoveryResult !== "pending";
            if (recoveryResult !== "pending") {
              await clearActiveRenderAttempt();
              setShowRenderingModal(false);
            }
            return;
          }

          shouldClearActiveRenderAttemptKey = true;
          await clearActiveRenderAttempt();

          if (result.code === "INSUFFICIENT_RENDER_TIME" || result.status === 402) {
            const estimateForError =
              reservedEstimateSec ?? estimatedSec ?? getEstimatedUsageSec(session);
            showError(
              getInsufficientRenderTimeMessage(
                estimateForError ?? 0,
                availableSec
              )
            );
          } else if (result.code === "NOT_FOUND" || result.status === 404) {
            showError("Session not found. Please start a new video.");
            navigation.goBack();
          } else {
            showError(result.message || "Render failed. Please try again.");
          }
          setShowRenderingModal(false);
          return;
        }

        if (result.data) {
          setSession(result.data);
        }

        if (result.status === 202 && result.finalize?.state === "pending") {
          const recoveryAttemptId = getFinalizeAttemptId(result.finalize, idempotencyKey);
          await persistActiveRenderAttempt(recoveryAttemptId);
          const recoveryResult = await recoverRenderAttempt(recoveryAttemptId);
          shouldClearActiveRenderAttemptKey = recoveryResult !== "pending";
          if (recoveryResult !== "pending") {
            await clearActiveRenderAttempt();
            setShowRenderingModal(false);
          }
          return;
        }

        shouldClearActiveRenderAttemptKey = true;

        const resolvedShortId =
          result.shortId ||
          getRenderRecoveryShortId(result.data, getRenderRecovery(result.data));

        if (resolvedShortId) {
          const billedSec = getSettledBilledSec(result.data);
          const successMessage = billedSec
            ? `Video rendered successfully! Used ${formatRenderTimeAmount(billedSec)} of render time.`
            : "Video rendered successfully!";
          await completeRenderSuccess(resolvedShortId, successMessage);
          return;
        }

        showError(
          "Render finished, but the short is not ready yet. Please check your Library."
        );
        recordClientDiagnostic({
          route: "/api/story/finalize",
          code: "SHORT_ID_MISSING",
          message: "Finalize succeeded without a resolvable shortId.",
          requestId: result.requestId,
          context: {
            sessionId,
            attemptId: idempotencyKey,
          },
        });
        await clearActiveRenderAttempt();
        setShowRenderingModal(false);
      } catch (error) {
        const failedAttemptId = activeRenderAttemptKeyRef.current;
        shouldClearActiveRenderAttemptKey = true;
        await clearActiveRenderAttempt();
        recordClientDiagnostic({
          route: "/api/story/finalize",
          code: "UNEXPECTED_RENDER_EXCEPTION",
          message: error instanceof Error ? error.message : "Unknown render error",
          context: {
            sessionId,
            attemptId: failedAttemptId,
          },
        });
        console.error("[story] render error:", error);
        showError("An unexpected error occurred. Please try again.");
        setShowRenderingModal(false);
      } finally {
        if (shouldClearActiveRenderAttemptKey) {
          activeRenderAttemptKeyRef.current = null;
        }
        setIsRendering(false);
        setRenderingModalTitle(DEFAULT_RENDERING_MODAL_TITLE);
        setRenderingModalSubtext(DEFAULT_RENDERING_MODAL_SUBTEXT);
      }
    },
    [
      availableSec,
      clearActiveRenderAttempt,
      completeRenderSuccess,
      estimatedSec,
      navigation,
      persistActiveRenderAttempt,
      recoverRenderAttempt,
      session,
      sessionId,
      setSession,
      showError,
      showWarning,
    ]
  );

  const handleRender = useCallback(async () => {
    if (!usageLoaded) {
      showError("Render time is still loading. Please wait a moment and try again.");
      return;
    }
    if (!estimatedSec) {
      showError("Estimated usage is unavailable. Please reload this storyboard and try again.");
      return;
    }
    if (availableSec < estimatedSec) {
      showError(getInsufficientRenderTimeMessage(estimatedSec, availableSec));
      return;
    }
    Alert.alert("Render now?", `Estimated usage is ${formatRenderTimeAmount(estimatedSec)} of render time.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Render", onPress: () => void doRender(estimatedSec) },
    ]);
  }, [availableSec, doRender, estimatedSec, showError, usageLoaded]);

  return {
    handleRender,
    isRendering,
    renderingModalSubtext,
    renderingModalTitle,
    showRenderingModal,
  };
}

function isLoadingOrMissingSession(session: StorySession | null, userId?: string | null) {
  return !session || !userId;
}
