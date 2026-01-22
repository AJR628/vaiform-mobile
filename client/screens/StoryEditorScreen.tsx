import React from "react";
import { View, StyleSheet } from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

type StoryEditorRouteProp = RouteProp<HomeStackParamList, "StoryEditor">;

export default function StoryEditorScreen() {
  const route = useRoute<StoryEditorRouteProp>();
  const { sessionId } = route.params;
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText style={styles.title}>Storyboard Editor</ThemedText>
        <ThemedText style={styles.sessionId}>Session ID: {sessionId}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  sessionId: {
    fontSize: 14,
    opacity: 0.7,
  },
});
