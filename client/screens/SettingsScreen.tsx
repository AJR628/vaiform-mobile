import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const COLORS = {
  primary: "#4A5FFF",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  error: "#EF4444",
  surface: "#F8F9FB",
  white: "#FFFFFF",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, userProfile, signOut, refreshCredits } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isRefreshingCredits, setIsRefreshingCredits] = useState(false);

  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const handleRefreshCredits = async () => {
    setIsRefreshingCredits(true);
    try {
      await refreshCredits();
      showSuccess("Credits refreshed!");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh credits";
      showError(message);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsRefreshingCredits(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }
        },
      },
    ]);
  };

  const userInitials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "VA";

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
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <ThemedText style={styles.avatarText}>{userInitials}</ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>
                {user?.displayName || "Vaiform User"}
              </ThemedText>
              <ThemedText style={styles.profileEmail}>
                {user?.email || "user@example.com"}
              </ThemedText>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <Card style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsIconContainer}>
                <Feather name="credit-card" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.settingsContent}>
                <ThemedText style={styles.settingsLabel}>Credits</ThemedText>
                <ThemedText style={styles.settingsValue}>
                  {userProfile?.credits ?? "—"} credits
                </ThemedText>
              </View>
              <Pressable
                onPress={handleRefreshCredits}
                disabled={isRefreshingCredits}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={({ pressed }) => [
                  styles.refreshButton,
                  pressed && styles.refreshButtonPressed,
                ]}
                testID="button-refresh-credits"
              >
                {isRefreshingCredits ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Feather name="refresh-cw" size={18} color={COLORS.primary} />
                )}
              </Pressable>
            </View>
          </Card>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
          onPress={handleSignOut}
          testID="button-signout"
        >
          <Feather
            name="log-out"
            size={18}
            color={COLORS.error}
            style={styles.signOutIcon}
          />
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </Pressable>

        <View style={styles.versionContainer}>
          <ThemedText style={styles.versionText}>
            Vaiform Mobile v{appVersion}
          </ThemedText>
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
  profileCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
  settingsCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsContent: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  settingsValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}10`,
  },
  refreshButtonPressed: {
    opacity: 0.7,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xl,
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutIcon: {
    marginRight: Spacing.sm,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
