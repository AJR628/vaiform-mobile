import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getShortDetail, ShortDetail } from "@/api/client";
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

export default function ShortDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ShortDetailRouteProp>();
  const { theme } = useTheme();
  const { showError } = useToast();

  const { jobId } = route.params;

  const videoRef = useRef<Video>(null);
  const [detail, setDetail] = useState<ShortDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getShortDetail(jobId);
      if (result.ok) {
        setDetail(result.data);
      } else {
        if (result.code === "NOT_FOUND") {
          setError("Video not ready yet");
        } else {
          setError(result.message || "Failed to load short details");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load short details";
      setError(message);
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [jobId]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
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

  const handleRefresh = () => {
    fetchDetail();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <View style={styles.errorIconContainer}>
              <Feather name="alert-circle" size={48} color={COLORS.error} />
            </View>
            <ThemedText style={styles.errorTitle}>{error}</ThemedText>
            <ThemedText style={styles.errorSubtitle}>
              The video may still be processing.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.refreshButtonPressed,
              ]}
              onPress={handleRefresh}
            >
              <Feather name="refresh-cw" size={18} color={COLORS.primary} />
              <ThemedText style={styles.refreshButtonText}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : detail ? (
          <>
            {/* Video Player */}
            {detail.videoUrl ? (
              <Pressable onPress={handlePlayPause} style={styles.videoContainer}>
                <Video
                  ref={videoRef}
                  source={{ uri: detail.videoUrl }}
                  style={styles.video}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  posterSource={
                    detail.coverImageUrl ? { uri: detail.coverImageUrl } : undefined
                  }
                  usePoster={!!detail.coverImageUrl}
                />
              </Pressable>
            ) : (
              <View style={styles.noVideoContainer}>
                <Feather name="video-off" size={48} color={COLORS.textTertiary} />
                <ThemedText style={styles.noVideoText}>
                  No video available
                </ThemedText>
              </View>
            )}

            {/* Quote */}
            {detail.usedQuote?.text && (
              <Card style={styles.quoteCard}>
                <ThemedText style={styles.quoteText}>
                  "{detail.usedQuote.text}"
                </ThemedText>
                {detail.usedQuote.author && (
                  <ThemedText style={styles.quoteAuthor}>
                    — {detail.usedQuote.author}
                  </ThemedText>
                )}
              </Card>
            )}

            {/* Metadata */}
            <Card style={styles.metaCard}>
              <ThemedText style={styles.sectionTitle}>Details</ThemedText>

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaLabel}>Job ID</ThemedText>
                <ThemedText style={styles.metaValue} numberOfLines={1}>
                  {detail.jobId}
                </ThemedText>
              </View>

              {detail.durationSec && (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Duration</ThemedText>
                  <ThemedText style={styles.metaValue}>
                    {Math.round(detail.durationSec)} seconds
                  </ThemedText>
                </View>
              )}

              {detail.usedTemplate && (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Template</ThemedText>
                  <ThemedText style={styles.metaValue}>
                    {detail.usedTemplate}
                  </ThemedText>
                </View>
              )}

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaLabel}>Created</ThemedText>
                <ThemedText style={styles.metaValue}>
                  {formatDate(detail.createdAt)}
                </ThemedText>
              </View>

              {detail.credits && (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Credits Used</ThemedText>
                  <ThemedText style={styles.metaValue}>
                    {detail.credits.cost ?? 1}
                  </ThemedText>
                </View>
              )}
            </Card>
          </>
        ) : null}
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
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.error}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
  },
  refreshButtonPressed: {
    opacity: 0.7,
  },
  refreshButtonText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  videoContainer: {
    width: "100%",
    height: VIDEO_HEIGHT,
    maxHeight: 500,
    backgroundColor: "#000",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  video: {
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
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noVideoText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: COLORS.textTertiary,
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
  quoteAuthor: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "right",
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
