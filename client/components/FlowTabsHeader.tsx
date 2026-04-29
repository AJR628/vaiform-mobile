import React, { useRef, useCallback } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

export type FlowStep = "create" | "script" | "storyboard" | "speech" | "render";

const STEPS: { key: FlowStep; label: string }[] = [
  { key: "create", label: "Create" },
  { key: "script", label: "Script" },
  { key: "storyboard", label: "Preview" },
  { key: "speech", label: "Speech" },
  { key: "render", label: "Render" },
];

const NAV_COOLDOWN_MS = 150;

export interface FlowTabsHeaderProps {
  currentStep: FlowStep;
  onRenderPress?: () => void;
  onScriptPress?: () => void;
  onCreatePress?: () => void;
  onSpeechPress?: () => void;
  onStoryboardPress?: () => void;
  renderDisabled?: boolean;
  disabledSteps?: Partial<Record<FlowStep, boolean>>;
}

export function FlowTabsHeader({
  currentStep,
  onRenderPress,
  onScriptPress,
  onCreatePress,
  onSpeechPress,
  onStoryboardPress,
  renderDisabled = true,
  disabledSteps,
}: FlowTabsHeaderProps) {
  const { theme } = useTheme();
  const navBusyRef = useRef(false);

  const runNav = useCallback((fn: () => void) => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    fn();
    setTimeout(() => {
      navBusyRef.current = false;
    }, NAV_COOLDOWN_MS);
  }, []);

  return (
    <View style={styles.container}>
      {STEPS.filter(({ key }) => key !== "speech").map(({ key, label }) => {
        const isCurrent = key === currentStep;
        const isRender = key === "render";
        const isSpeech = key === "speech";
        const isScript = key === "script";
        const isCreate = key === "create";
        const isStoryboard = key === "storyboard";

        const disabled =
          (isRender && (renderDisabled || !onRenderPress)) ||
          (isSpeech && !onSpeechPress) ||
          !!disabledSteps?.[key];

        const onPress = () => {
          if (disabled) return;
          if (isRender && onRenderPress) runNav(onRenderPress);
          else if (isScript && onScriptPress) runNav(onScriptPress);
          else if (isCreate && onCreatePress) runNav(onCreatePress);
          else if (isStoryboard && onStoryboardPress) runNav(onStoryboardPress);
          else if (isSpeech && onSpeechPress) runNav(onSpeechPress);
        };

        return (
          <Pressable
            key={key}
            onPress={onPress}
            disabled={disabled}
            style={[
              styles.tab,
              isCurrent && isStoryboard && styles.previewTabActive,
              {
                backgroundColor: isCurrent
                  ? theme.backgroundSecondary
                  : theme.backgroundTertiary,
                borderColor:
                  isCurrent && isStoryboard
                    ? "rgba(10,132,255,0.55)"
                    : "transparent",
                opacity: disabled ? 0.6 : 1,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <ThemedText
              style={[
                styles.tabLabel,
                isCurrent && styles.tabLabelCurrent,
                { color: theme.text },
              ]}
              numberOfLines={1}
            >
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  tab: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 0,
  },
  previewTabActive: {
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.9,
  },
  tabLabelCurrent: {
    fontWeight: "600",
    opacity: 1,
  },
});
