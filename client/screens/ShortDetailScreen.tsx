import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ShortMediaViewer } from "@/components/shorts/ShortMediaViewer";
import { useToast } from "@/contexts/ToastContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

import { formatShortDate, isImageUrl, isVideoUrl } from "@/screens/short-detail/model";
import { useMediaReachability } from "@/screens/short-detail/useMediaReachability";
import { useShortDetailAvailability } from "@/screens/short-detail/useShortDetailAvailability";

const COLORS = {
  primary: "#4A5FFF",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
};

type ShortDetailRouteProp = RouteProp<LibraryStackParamList, "ShortDetail">;

export default function ShortDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ShortDetailRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showError } = useToast();

  const params = route.params ?? {};
  const shortParam = params.short ?? null;
  const shortId = params.shortId ?? null;

  const {
    didRetryTimeout,
    handleRetryFetch,
    isLoadingDetail,
    isPendingAvailability,
    retryCount,
    short,
  } = useShortDetailAvailability({
    navigation,
    shortId,
    shortParam,
    showError,
  });

  const mediaUrl = short?.videoUrl ?? null;
  const isVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;
  const isImage = mediaUrl ? isImageUrl(mediaUrl) : false;

  useMediaReachability({
    isImage,
    isVideo,
    mediaUrl,
    short,
    shortId,
    shortParamPresent: !!shortParam,
  });

  return (
    <SafeAreaView style={styles.container} edges={[]}>
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
          {isLoadingDetail && isPendingAvailability ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <ThemedText style={styles.loadingText}>Finalizing your render...</ThemedText>
            </View>
          ) : isLoadingDetail ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <ThemedText style={styles.loadingText}>Loading short details...</ThemedText>
            </View>
          ) : !short && didRetryTimeout ? (
            <View style={styles.noVideoContainer}>
              <Feather name="clock" size={48} color={COLORS.textTertiary} />
              <ThemedText style={styles.noVideoText}>
                Still finalizing. This may take a moment.
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
                onPress={() => {
                  const tabNavigator = navigation.getParent();
                  if (tabNavigator) {
                    tabNavigator.navigate("LibraryTab", { screen: "Library" });
                  } else {
                    navigation.goBack();
                  }
                }}
              >
                <ThemedText style={styles.retryButtonText}>Back to Library</ThemedText>
              </Pressable>
            </View>
          ) : !short ? (
            <View style={styles.noVideoContainer}>
              <Feather name="alert-circle" size={48} color={COLORS.textTertiary} />
              <ThemedText style={styles.noVideoText}>Short not found</ThemedText>
            </View>
          ) : (
            <>
              <ShortMediaViewer
                isImage={isImage}
                isVideo={isVideo}
                mediaUrl={mediaUrl}
                onRetryFetch={handleRetryFetch}
                retryCount={retryCount}
                short={short}
              />

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
                    {formatShortDate(short.createdAt)}
                  </ThemedText>
                </View>
              </Card>
            </>
          )}
        </KeyboardAwareScrollViewCompat>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 200,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: Spacing.md,
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
