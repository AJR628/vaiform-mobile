import type { StorySession } from "@/types/story";

function formatSeconds(value: number, fractionDigits = 1): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(fractionDigits).replace(/\.0$/, "");
}

export function formatRenderTimeAmount(totalSec: number | null | undefined): string {
  const numeric = Number(totalSec);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0s";

  if (numeric < 60) {
    return `${formatSeconds(numeric)}s`;
  }

  const minutes = Math.floor(numeric / 60);
  const seconds = numeric - minutes * 60;
  if (seconds <= 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${formatSeconds(seconds)}s`;
}

export function formatRenderTimeLeft(totalSec: number | null | undefined): string {
  const numeric = Number(totalSec);
  if (!Number.isFinite(numeric) || numeric < 0) return "—";
  return `${formatRenderTimeAmount(numeric)} left`;
}

export function getEstimatedUsageSec(session: StorySession | null | undefined): number | null {
  const estimatedSec = Number(session?.billingEstimate?.estimatedSec);
  if (!Number.isFinite(estimatedSec) || estimatedSec <= 0) {
    return null;
  }
  return Number(estimatedSec.toFixed(3));
}

export function getSettledBilledSec(session: StorySession | null | undefined): number | null {
  const billedSec = Number(session?.billing?.billedSec);
  if (!Number.isFinite(billedSec) || billedSec <= 0) {
    return null;
  }
  return Number(billedSec.toFixed(3));
}
