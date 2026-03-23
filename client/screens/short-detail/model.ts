import type { ShortDetail, ShortItem } from "@/api/client";

export function isVideoUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();

  if (
    clean.includes(".mp4") ||
    clean.includes(".mov") ||
    clean.includes(".m4v") ||
    clean.includes(".webm") ||
    clean.includes(".avi")
  ) {
    return true;
  }

  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) {
    return clean.includes("/story.mp4") || clean.includes("/short.mp4");
  }

  const ext = clean.slice(lastDot);
  const videoExtensions = [".mp4", ".mov", ".m4v", ".webm", ".avi"];
  return videoExtensions.some((extension) => ext === extension);
}

export function isImageUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();

  if (
    clean.includes(".png") ||
    clean.includes(".jpg") ||
    clean.includes(".jpeg") ||
    clean.includes(".webp") ||
    clean.includes(".gif")
  ) {
    return true;
  }

  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return false;

  const ext = clean.slice(lastDot);
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  return imageExtensions.some((extension) => ext === extension);
}

export function adaptShortDetailToShortItem(shortDetail: ShortDetail): ShortItem {
  return {
    id: shortDetail.id,
    ownerId: "",
    status: "ready",
    videoUrl: shortDetail.videoUrl,
    thumbUrl: shortDetail.coverImageUrl,
    coverImageUrl: shortDetail.coverImageUrl,
    durationSec: shortDetail.durationSec,
    quoteText: shortDetail.usedQuote?.text,
    template: shortDetail.usedTemplate,
    mode: undefined,
    voiceover: undefined,
    captionMode: undefined,
    watermark: undefined,
    createdAt: shortDetail.createdAt,
    completedAt: undefined,
    failedAt: undefined,
    errorMessage: undefined,
  };
}

export function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleString();
}
