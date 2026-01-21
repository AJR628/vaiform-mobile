import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  Image,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

const COLORS = {
  primary: "#4A5FFF",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
  white: "#FFFFFF",
  error: "#EF4444",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_HEIGHT = (SCREEN_WIDTH - Spacing.lg * 2) * (16 / 9);

type ShortDetailRouteProp = RouteProp<LibraryStackParamList, "ShortDetail">;

function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".mov", ".m4v", ".webm", ".avi"];
  const lowerUrl = url.toLowerCase().split("?")[0];
  return videoExtensions.some((ext) => lowerUrl.endsWith(ext));
}

function isImageUrl(url: string): boolean {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const lowerUrl = url.toLowerCase().split("?")[0];
  return imageExtensions.some((ext) => lowerUrl.endsWith(ext));
}

export default function ShortDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ShortDetailRouteProp>();
  const { theme } = useTheme();

  const { short } = route.params;

  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const mediaUrl = short.videoUrl;
  const isVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;
  const isImage = mediaUrl ? isImageUrl(mediaUrl) : false;

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  };

  const handleVideoError = (error: string) => {
    console.error("[shorts] Video playback error:", error);
    setVideoError("Video playback failed");
  };

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleOpenInBrowser = async () => {
    if (!mediaUrl) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {isVideo && mediaUrl && !videoError ? (
          <Pressable onPress={handlePlayPause} style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={(e) => handleVideoError(e)}
              posterSource={
                short.thumbUrl || short.coverImageUrl
                  ? { uri: short.thumbUrl || short.coverImageUrl }
                  : undefined
              }
              usePoster={!!(short.thumbUrl || short.coverImageUrl)}
            />
          </Pressable>
        ) : isImage && mediaUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        ) : mediaUrl ? (
          <View style={styles.noVideoContainer}>
            <Feather name="play-circle" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              {videoError || "Tap below to open in browser"}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.noVideoContainer}>
            <Feather name="video-off" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              No media available
            </ThemedText>
          </View>
        )}

        {mediaUrl ? (
          <Pressable
            style={({ pressed }) => [
              styles.browserButton,
              pressed && styles.browserButtonPressed,
            ]}
            onPress={handleOpenInBrowser}
          >
            <Feather name="external-link" size={18} color={COLORS.primary} />
            <ThemedText style={styles.browserButtonText}>
              Open in Browser
            </ThemedText>
          </Pressable>
        ) : null}

        {short.quoteText ? (
          <Card style={styles.quoteCard}>
            <ThemedText style={styles.quoteText}>"{short.quoteText}"</ThemedText>
          </Card>
        ) : null}

        <Card style={styles.metaCard}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>ID</ThemedText>
            <ThemedText style={styles.metaValue} numberOfLines={1}>
              {short.id}
            </ThemedText>
          </View>

          {short.durationSec ? (
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Duration</ThemedText>
              <ThemedText style={styles.metaValue}>
                {Math.round(short.durationSec)} seconds
              </ThemedText>
            </View>
          ) : null}

          {short.template ? (
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Template</ThemedText>
              <ThemedText style={styles.metaValue}>{short.template}</ThemedText>
            </View>
          ) : null}

          {short.mode ? (
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Mode</ThemedText>
              <ThemedText style={styles.metaValue}>{short.mode}</ThemedText>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Status</ThemedText>
            <ThemedText style={styles.metaValue}>{short.status}</ThemedText>
          </View>

          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <ThemedText style={styles.metaLabel}>Created</ThemedText>
            <ThemedText style={styles.metaValue}>
              {formatDate(short.createdAt)}
            </ThemedText>
          </View>
        </Card>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  videoContainer: {
    width: "100%",
    height: VIDEO_HEIGHT,
    maxHeight: 500,
    backgroundColor: "#000",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  imageContainer: {
    width: "100%",
    height: VIDEO_HEIGHT,
    maxHeight: 500,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: "100%",
    height: "100%",
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
  quoteCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: "italic",
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: Spacing.md,
  },
});
