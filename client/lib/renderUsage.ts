export function formatRenderTimeAmount(totalSec: number | null | undefined): string {
  const numeric = Number(totalSec);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0s";

  const wholeSec = Math.ceil(numeric);
  const minutes = Math.floor(wholeSec / 60);
  const seconds = wholeSec % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function formatRenderTimeLeft(totalSec: number | null | undefined): string {
  const numeric = Number(totalSec);
  if (!Number.isFinite(numeric) || numeric < 0) return "—";
  return `${formatRenderTimeAmount(numeric)} left`;
}

export function getEstimatedUsageSec(session: any): number | null {
  const estimatedSec = Number(session?.billingEstimate?.estimatedSec);
  if (!Number.isFinite(estimatedSec) || estimatedSec <= 0) {
    return null;
  }
  return Math.ceil(estimatedSec);
}

export function getSettledBilledSec(session: any): number | null {
  const billedSec = Number(session?.billing?.billedSec);
  if (!Number.isFinite(billedSec) || billedSec <= 0) {
    return null;
  }
  return Math.ceil(billedSec);
}
