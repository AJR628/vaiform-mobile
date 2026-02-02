import React, { useState, useLayoutEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, TextInput, Alert } from "react-native";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useActiveStorySession } from "@/contexts/ActiveStorySessionContext";
import { FlowTabsHeader } from "@/components/FlowTabsHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storyStart, storyGenerate } from "@/api/client";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";

const COLORS = {
  primary: "#4A5FFF",
  primaryEnd: "#7B68EE",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
  white: "#FFFFFF",
};

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, "Home">;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showError } = useToast();
  const navigation = useNavigation<HomeNavProp>();
  const { activeSessionId, isHydrated, setActiveSessionId, clearActiveSessionId } = useActiveStorySession();

  const [inputType, setInputType] = useState<"link" | "idea">("link");
  const [inputText, setInputText] = useState("");
  const [progressText, setProgressText] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateStoryboard = async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      showError("Please enter a link or idea");
      return;
    }

    if (activeSessionId) {
      Alert.alert(
        "Start new project?",
        "This will replace your current script and storyboard.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "OK",
            onPress: () => {
              clearActiveSessionId();
              runCreateFlow(trimmedInput);
            },
          },
        ]
      );
      return;
    }

    runCreateFlow(trimmedInput);
  };

  const runCreateFlow = async (trimmedInput: string) => {
    setIsCreating(true);
    setProgressText("Starting…");

    try {
      // Step 1: Start story session
      const startResult = await storyStart({
        input: trimmedInput,
        inputType: inputType,
      });

      if (!startResult.ok) {
        const errorMsg = startResult.code
          ? `Failed to create storyboard: ${startResult.code}`
          : `Failed to create storyboard: ${startResult.message}`;
        showError(errorMsg);
        setIsCreating(false);
        setProgressText(null);
        return;
      }

      const sessionId = startResult.data?.id;
      if (!sessionId) {
        console.error("[story] Missing sessionId in start response:", startResult.data);
        showError("Failed to create storyboard: Invalid response");
        setIsCreating(false);
        setProgressText(null);
        return;
      }

      // Step 2: Generate script
      setProgressText("Writing script…");
      const generateResult = await storyGenerate({ sessionId });

      if (!generateResult.ok) {
        const errorMsg = generateResult.code
          ? `Failed to generate script: ${generateResult.code}`
          : `Failed to generate script: ${generateResult.message}`;
        showError(errorMsg);
        setIsCreating(false);
        setProgressText(null);
        return;
      }

      // Success - persist session and navigate to script screen
      setIsCreating(false);
      setProgressText(null);
      setActiveSessionId(sessionId);
      navigation.navigate("Script", { sessionId });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to create storyboard: ${errorMessage}`);
      setIsCreating(false);
      setProgressText(null);
    }
  };

  const inputPlaceholder =
    inputType === "link"
      ? "Paste article URL..."
      : "Describe your idea...";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <FlowTabsHeader
          currentStep="create"
          onCreatePress={undefined}
          onScriptPress={() => {
            if (!isHydrated || !activeSessionId) {
              if (isHydrated) showError("Create a script first");
              return;
            }
            navigation.navigate("Script", { sessionId: activeSessionId });
          }}
          onStoryboardPress={() => {
            if (!isHydrated || !activeSessionId) {
              if (isHydrated) showError("Create a script first");
              return;
            }
            navigation.navigate("StoryEditor", { sessionId: activeSessionId });
          }}
          disabledSteps={{
            script: !isHydrated || !activeSessionId,
            storyboard: !isHydrated || !activeSessionId,
          }}
          renderDisabled={true}
        />
      ),
      headerLeft: () => null,
    });
  }, [navigation, activeSessionId, isHydrated, showError]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl + 100,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card style={styles.inputCard}>
          <ThemedText style={styles.cardTitle}>Create Script</ThemedText>

          {/* Segmented Control */}
          <View style={styles.segmentedControl}>
            <Pressable
              style={({ pressed }) => [
                styles.segment,
                inputType === "link" && styles.segmentActive,
                pressed && styles.segmentPressed,
              ]}
              onPress={() => setInputType("link")}
              disabled={isCreating}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  inputType === "link" && styles.segmentTextActive,
                ]}
              >
                Link
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.segment,
                inputType === "idea" && styles.segmentActive,
                pressed && styles.segmentPressed,
              ]}
              onPress={() => setInputType("idea")}
              disabled={isCreating}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  inputType === "idea" && styles.segmentTextActive,
                ]}
              >
                Idea
              </ThemedText>
            </Pressable>
          </View>

          {/* Text Input */}
          <TextInput
            style={[
              styles.textInput,
              { color: theme.text, borderColor: COLORS.border },
            ]}
            placeholder={inputPlaceholder}
            placeholderTextColor={COLORS.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isCreating}
            textAlignVertical="top"
          />

          {/* Progress Display */}
          {progressText && (
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressText}>{progressText}</ThemedText>
            </View>
          )}
        </Card>

        {/* Create Button */}
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            (isCreating || !inputText.trim()) && styles.createButtonDisabled,
            pressed && !isCreating && inputText.trim() && styles.createButtonPressed,
          ]}
          onPress={handleCreateStoryboard}
          disabled={isCreating || !inputText.trim()}
        >
          <LinearGradient
            colors={
              isCreating || !inputText.trim()
                ? [COLORS.textTertiary, COLORS.textTertiary]
                : [COLORS.primary, COLORS.primaryEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButtonGradient}
          >
            {isCreating ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <ThemedText style={styles.createButtonText}>
                Create script
              </ThemedText>
            )}
          </LinearGradient>
        </Pressable>
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
  inputCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: Spacing.lg,
  },
  segmentedControl: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.xs,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.white,
  },
  textInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  createButton: {
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  createButtonGradient: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});
