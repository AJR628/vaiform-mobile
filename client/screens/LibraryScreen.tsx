import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getMyShorts, ShortItem } from "@/api/client";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

const COLORS = {
  primary: "#4A5FFF",
  primaryEnd: "#7B68EE",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  white: "#FFFFFF",
  warning: "#F59E0B",
  success: "#10B981",
  error: "#EF4444",
};

type LibraryNavProp = NativeStackNavigationProp<LibraryStackParamList, "Library">;

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ready":
      return COLORS.success;
    case "processing":
    case "pending":
      return COLORS.warning;
    case "failed":
      return COLORS.error;
    default:
      return COLORS.textTertiary;
  }
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showError, showWarning } = useToast();
  const navigation = useNavigation<LibraryNavProp>();

  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchShorts = useCallback(async (cursor?: string) => {
    const isInitial = !cursor;
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await getMyShorts(cursor, 24);
      if (result.ok) {
        if (isInitial) {
          setShorts(result.data.items);
        } else {
          setShorts((prev) => [...prev, ...result.data.items]);
        }
        setNextCursor(result.data.nextCursor);
        setHasMore(result.data.hasMore);
      } else {
        showError(result.message || "Failed to load shorts");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load shorts";
      showError(message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  const handleLoadMore = () => {
    if (hasMore && nextCursor && !isLoadingMore) {
      fetchShorts(nextCursor);
    }
  };

  const handleShortPress = (short: ShortItem) => {
    console.log(`[shorts] CARD_PRESS id=${short.id}`);
    const videoUrlPrefix = short.videoUrl ? short.videoUrl.substring(0, 60) : "null";
    console.log(`[shorts] TAP id=${short.id} status=${short.status} hasVideoUrl=${!!short.videoUrl} videoUrl=${videoUrlPrefix}...`);
    
    if (short.status !== "ready") {
      console.log(`[shorts] BLOCKED id=${short.id} reason=status_not_ready`);
      showWarning("Still processing. Please wait.");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }
    
    if (!short.videoUrl) {
      console.log(`[shorts] BLOCKED id=${short.id} reason=missing_videoUrl`);
      showWarning("No video available for this item.");
      return;
    }
    
    console.log(`[shorts] open id=${short.id} status=${short.status} hasVideoUrl=true`);
    navigation.navigate("ShortDetail", { short });
  };

  const handleCreateShort = () => {
    console.log("Create short pressed");
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl + 80,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>Loading shorts...</ThemedText>
          </View>
        ) : shorts.length > 0 ? (
          <>
            {shorts.map((short) => (
              <Card
                key={short.id}
                onPress={() => handleShortPress(short)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.formCard}
              >
                  <View style={styles.formCardHeader}>
                    {short.thumbUrl || short.coverImageUrl ? (
                      <Image
                        source={{ uri: short.thumbUrl || short.coverImageUrl }}
                        style={styles.thumbnail}
                      />
                    ) : (
                      <View style={styles.formIconContainer}>
                        <Feather
                          name="video"
                          size={20}
                          color={COLORS.primary}
                        />
                      </View>
                    )}
                    <View style={styles.formInfo}>
                      <ThemedText style={styles.formName} numberOfLines={2}>
                        {short.quoteText || `Short ${short.id.slice(0, 8)}`}
                      </ThemedText>
                      <View style={styles.metaRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: `${getStatusColor(short.status)}20` },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: getStatusColor(short.status) },
                            ]}
                          />
                          <ThemedText
                            style={[
                              styles.statusText,
                              { color: getStatusColor(short.status) },
                            ]}
                          >
                            {short.status}
                          </ThemedText>
                        </View>
                        {short.durationSec && (
                          <ThemedText style={styles.duration}>
                            {Math.round(short.durationSec)}s
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={COLORS.textTertiary}
                    />
                  </View>
                  <View style={styles.formFooter}>
                    <ThemedText style={styles.lastUpdated}>
                      {formatDate(short.createdAt)}
                    </ThemedText>
                  </View>
                </Card>
            ))}
            {hasMore && (
              <Pressable
                style={({ pressed }) => [
                  styles.loadMoreButton,
                  pressed && styles.loadMoreButtonPressed,
                ]}
                onPress={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <ThemedText style={styles.loadMoreText}>Load More</ThemedText>
                )}
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="video" size={64} color={COLORS.primary} />
            </View>
            <ThemedText style={styles.emptyTitle}>
              Your library is empty
            </ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Shorts you create will appear here.
            </ThemedText>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: tabBarHeight + 20 },
          pressed && styles.fabPressed,
        ]}
        onPress={handleCreateShort}
        testID="button-create-short"
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Feather name="plus" size={24} color={COLORS.white} />
        </LinearGradient>
      </Pressable>
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
  loadingContainer: {
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
  formCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.md,
    backgroundColor: COLORS.border,
  },
  formIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  formInfo: {
    flex: 1,
  },
  formName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  duration: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  formFooter: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
  },
  loadMoreButtonPressed: {
    opacity: 0.7,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  fabGradient: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
