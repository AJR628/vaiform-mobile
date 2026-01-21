import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const COLORS = {
  primary: "#4A5FFF",
  primaryEnd: "#7B68EE",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const STUB_FORMS = [
  {
    id: "1",
    name: "Customer Feedback",
    responses: 24,
    lastUpdated: "2 hours ago",
  },
  {
    id: "2",
    name: "Event Registration",
    responses: 156,
    lastUpdated: "Yesterday",
  },
  {
    id: "3",
    name: "Contact Form",
    responses: 8,
    lastUpdated: "3 days ago",
  },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const handleFormPress = (formId: string) => {
    console.log("Form pressed:", formId);
  };

  const handleCreateForm = () => {
    console.log("Create form pressed");
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
        {STUB_FORMS.length > 0 ? (
          STUB_FORMS.map((form) => (
            <Pressable
              key={form.id}
              onPress={() => handleFormPress(form.id)}
              style={({ pressed }) => [pressed && styles.cardPressed]}
            >
              <Card style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <View style={styles.formIconContainer}>
                    <Feather
                      name="file-text"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.formInfo}>
                    <ThemedText style={styles.formName}>{form.name}</ThemedText>
                    <ThemedText style={styles.formMeta}>
                      {form.responses} responses
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={COLORS.textTertiary}
                  />
                </View>
                <View style={styles.formFooter}>
                  <ThemedText style={styles.lastUpdated}>
                    Updated {form.lastUpdated}
                  </ThemedText>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="folder" size={64} color={COLORS.primary} />
            </View>
            <ThemedText style={styles.emptyTitle}>
              Your form library is empty
            </ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Forms you create will appear here.
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
        onPress={handleCreateForm}
        testID="button-create-form"
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
  formCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  formIconContainer: {
    width: 40,
    height: 40,
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
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  formMeta: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
