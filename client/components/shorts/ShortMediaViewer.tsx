import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { BorderRadius, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { ShortItem } from "@/api/client";

const COLORS = {
  primary: "#4A5FFF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
  textTertiary: "#9CA3AF",
  white: "#FFFFFF",
};

interface ShortMediaViewerProps {
  isImage: boolean;
  isVideo: boolean;
  mediaUrl: string | null;
  onRetryFetch: () => void;
  retryCount: number;
  short: ShortItem | null;
}

export function ShortMediaViewer({
  isImage,
  isVideo,
  mediaUrl,
  onRetryFetch,
  retryCount,
  short,
}: ShortMediaViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoRef = React.useRef<Video>(null);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      setIsLoading(false);
      const errorMessage = typeof status.error === "string" ? status.error : "Unknown error";
      setVideoError(`Playback failed: ${errorMessage}`);
    }
  };

  const handleVideoError = (event: any) => {
    const errorMessage =
      event?.error?.localizedDescription ||
      event?.error?.message ||
      JSON.stringify(event);
    console.error("[shorts] Video playback error:", {
      error: event?.error,
      fullEvent: event,
      message: errorMessage,
    });
    setVideoError(`Playback failed: ${errorMessage}`);
    setIsLoading(false);
  };

  const handleOpenInBrowser = async () => {
    if (!mediaUrl) return;

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      if (Platform.OS === "web") {
        window.open(mediaUrl, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(mediaUrl);
      }
    } catch (error) {
      console.error("[shorts] Failed to open in browser:", error);
      await Linking.openURL(mediaUrl);
    }
  };

  if (!short) return null;

  if (!mediaUrl) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <ThemedText style={styles.loadingText}>Finalizing video...</ThemedText>
        {retryCount < 2 && (
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={onRetryFetch}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      {isVideo && !videoError ? (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: mediaUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={handleVideoError}
            onLoad={() => {
              console.log("[shorts] Video onLoad fired", mediaUrl.substring(0, 60));
              setIsLoading(false);
            }}
            onReadyForDisplay={() => {
              console.log("[shorts] Video onReadyForDisplay fired");
              setIsLoading(false);
            }}
            posterSource={
              short.thumbUrl || short.coverImageUrl
                ? { uri: short.thumbUrl || short.coverImageUrl }
                : undefined
            }
            usePoster={!!(short.thumbUrl || short.coverImageUrl)}
          />
          {isLoading && !videoError && (
            <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.white} />
            </View>
          )}
        </View>
      ) : isImage ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: mediaUrl }} style={styles.image} resizeMode="contain" />
        </View>
      ) : (
        <View style={styles.noVideoContainer}>
          <Feather name={mediaUrl ? "play-circle" : "video-off"} size={48} color={COLORS.textTertiary} />
          <ThemedText style={styles.noVideoText}>
            {videoError || "Tap below to open in browser"}
          </ThemedText>
        </View>
      )}

      {mediaUrl && videoError ? (
        <Pressable
          style={({ pressed }) => [
            styles.browserButton,
            pressed && styles.browserButtonPressed,
          ]}
          onPress={handleOpenInBrowser}
        >
          <Feather name="external-link" size={18} color={COLORS.primary} />
          <ThemedText style={styles.browserButtonText}>Open in Browser</ThemedText>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  browserButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
  },
  browserButtonPressed: {
    opacity: 0.7,
  },
  browserButtonText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 200,
  },
  loadingOverlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  noVideoContainer: {
    width: "100%",
    height: 200,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noVideoText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
    position: "relative",
  },
});
