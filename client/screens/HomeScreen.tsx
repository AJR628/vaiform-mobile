import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { healthCheck, isApiError, getApiBaseUrl } from "@/api/client";

const COLORS = {
  primary: "#4A5FFF",
  primaryEnd: "#7B68EE",
  success: "#10B981",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
  white: "#FFFFFF",
};

const STUB_STATS = [
  { label: "Active Forms", value: "3", icon: "file-text" as const },
  { label: "Responses Today", value: "12", icon: "inbox" as const },
];

const STUB_ACTIVITY = [
  { id: "1", message: "New response on Customer Feedback", time: "2 min ago" },
  { id: "2", message: "Form 'Event Registration' published", time: "1 hour ago" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [healthResponse, setHealthResponse] = useState<string | null>(null);

  const handleTestBackend = async () => {
    setIsTestingBackend(true);
    setHealthResponse(null);

    try {
      const response = await healthCheck();
      setHealthResponse(JSON.stringify(response, null, 2));
      showSuccess("Backend is healthy!");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      if (isApiError(error)) {
        if (error.isAuthError) {
          showError("Authentication error (401). Please sign in again.");
        } else if (error.isRateLimited) {
          showWarning("Rate limited (429). Please try again later.");
        } else if (error.isServerError) {
          showError(`Server error (${error.status}). Please try again later.`);
        } else {
          showError(`Error: ${error.message}`);
        }
        setHealthResponse(`Error ${error.status}: ${error.message}`);
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        showError(`Failed to connect: ${errorMessage}`);
        setHealthResponse(`Connection failed: ${errorMessage}`);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsTestingBackend(false);
    }
  };

  const userName = user?.displayName || user?.email?.split("@")[0] || "there";

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card style={styles.welcomeCard}>
          <ThemedText style={styles.welcomeText}>
            Welcome back, {userName}
          </ThemedText>
          <ThemedText style={styles.welcomeSubtext}>
            Here's what's happening with your forms.
          </ThemedText>
        </Card>

        <View style={styles.statsRow}>
          {STUB_STATS.map((stat, index) => (
            <Card key={stat.label} style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name={stat.icon} size={20} color={COLORS.primary} />
              </View>
              <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
              <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Backend Test</ThemedText>
          <Card style={styles.testCard}>
            <ThemedText style={styles.testDescription}>
              Test connection to your Vaiform backend at:
            </ThemedText>
            <ThemedText style={styles.apiUrl}>{getApiBaseUrl()}</ThemedText>

            <Pressable
              style={({ pressed }) => [
                styles.testButton,
                pressed && styles.testButtonPressed,
              ]}
              onPress={handleTestBackend}
              disabled={isTestingBackend}
              testID="button-test-backend"
            >
              {isTestingBackend ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <>
                  <Feather
                    name="activity"
                    size={18}
                    color={COLORS.primary}
                    style={styles.testButtonIcon}
                  />
                  <ThemedText style={styles.testButtonText}>
                    Test Backend
                  </ThemedText>
                </>
              )}
            </Pressable>

            {healthResponse ? (
              <View style={styles.responseContainer}>
                <ThemedText style={styles.responseLabel}>Response:</ThemedText>
                <View style={styles.responseBox}>
                  <ThemedText style={styles.responseText}>
                    {healthResponse}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
          {STUB_ACTIVITY.map((activity) => (
            <Card key={activity.id} style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <ThemedText style={styles.activityMessage}>
                    {activity.message}
                  </ThemedText>
                  <ThemedText style={styles.activityTime}>
                    {activity.time}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ))}
        </View>
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
  welcomeCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: Spacing.xs,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  testCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  testDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: Spacing.xs,
  },
  apiUrl: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    color: COLORS.primary,
    marginBottom: Spacing.lg,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
  },
  testButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  testButtonIcon: {
    marginRight: Spacing.sm,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  responseContainer: {
    marginTop: Spacing.lg,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  responseBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  responseText: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    color: COLORS.textPrimary,
  },
  activityCard: {
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginTop: 6,
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
