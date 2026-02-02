import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export type FlowStep = "create" | "script" | "storyboard" | "speech" | "render";

const STEPS: { key: FlowStep; label: string }[] = [
  { key: "create", label: "Create" },
  { key: "script", label: "Script" },
  { key: "storyboard", label: "Storyboard" },
  { key: "speech", label: "Speech" },
  { key: "render", label: "Render" },
];

export interface FlowTabsHeaderProps {
  currentStep: FlowStep;
  onRenderPress: () => void;
  onScriptPress?: () => void;
  onCreatePress?: () => void;
  onSpeechPress?: () => void;
  renderDisabled: boolean;
}

export function FlowTabsHeader({
  currentStep,
  onRenderPress,
  onScriptPress,
  onCreatePress,
  onSpeechPress,
  renderDisabled,
}: FlowTabsHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {STEPS.map(({ key, label }) => {
        const isCurrent = key === currentStep;
        const isRender = key === "render";
        const isSpeech = key === "speech";
        const isScript = key === "script";
        const isCreate = key === "create";

        const disabled = isRender && renderDisabled;
        const onPress = () => {
          if (isRender && !renderDisabled) onRenderPress();
          else if (isScript && onScriptPress) onScriptPress();
          else if (isCreate && onCreatePress) onCreatePress();
          else if (isSpeech && onSpeechPress) onSpeechPress();
        };

        return (
          <Pressable
            key={key}
            onPress={onPress}
            disabled={disabled}
            style={[
              styles.tab,
              {
                backgroundColor: isCurrent ? theme.backgroundSecondary : theme.backgroundTertiary,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 0,
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
