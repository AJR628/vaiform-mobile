import { useEffect } from "react";
import { Platform } from "react-native";

import type { ShortItem } from "@/api/client";

interface UseMediaReachabilityOptions {
  isImage: boolean;
  isVideo: boolean;
  mediaUrl: string | null;
  short: ShortItem | null;
  shortId?: string | null;
  shortParamPresent: boolean;
}

export function useMediaReachability({
  isImage,
  isVideo,
  mediaUrl,
  short,
  shortId,
  shortParamPresent,
}: UseMediaReachabilityOptions) {
  useEffect(() => {
    if (short) {
      console.log(
        `[shorts] detail id=${short.id} mediaUrl=${mediaUrl?.substring(0, 60)}... isVideo=${isVideo} isImage=${isImage}`
      );
    }
    if (__DEV__) {
      console.log(
        `[ShortDetail] params short? ${shortParamPresent} shortId? ${!!shortId} short=${!!short} mediaUrl=${!!mediaUrl}`
      );
    }
  }, [isImage, isVideo, mediaUrl, short, shortId, shortParamPresent]);

  useEffect(() => {
    if (Platform.OS !== "web" && mediaUrl) {
      fetch(mediaUrl, { method: "HEAD" })
        .then((response) => {
          console.log("[shorts] Video URL reachable:", {
            status: response.status,
            contentType: response.headers.get("content-type"),
            contentLength: response.headers.get("content-length"),
          });
        })
        .catch((error) => {
          console.warn("[shorts] HEAD failed, trying Range request:", error.message);
          fetch(mediaUrl, {
            headers: { Range: "bytes=0-1" },
          })
            .then((response) => {
              console.log("[shorts] Video URL reachable (Range):", {
                status: response.status,
                contentType: response.headers.get("content-type"),
              });
            })
            .catch((rangeError) => {
              console.error("[shorts] Video URL NOT reachable:", rangeError.message);
            });
        });
    }
  }, [mediaUrl]);

  useEffect(() => {
    if (Platform.OS === "web" && isVideo && mediaUrl) {
      setTimeout(() => {
        const videoElement = document.querySelector("video");
        if (videoElement) {
          console.log("[shorts] Video element found:", {
            src: videoElement.currentSrc,
            readyState: videoElement.readyState,
            networkState: videoElement.networkState,
            error: videoElement.error,
          });
        } else {
          console.warn("[shorts] Video element NOT found in DOM");
        }
      }, 100);
    }
  }, [isVideo, mediaUrl]);
}
