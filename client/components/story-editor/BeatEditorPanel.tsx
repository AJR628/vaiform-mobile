import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { Beat, CaptionPlacement } from "@/screens/story-editor/model";
import { CAPTION_PLACEMENTS } from "@/screens/story-editor/model";

interface BeatEditorPanelProps {
  captionPlacement: CaptionPlacement;
  draftText: string;
  editorCollapsed: boolean;
  editorTranslateY: Animated.Value;
  isSaving: boolean;
  onChangeDraftText: (text: string) => void;
  onFocus: () => void;
  onLayout: (height: number) => void;
  onPlacementChange: (placement: CaptionPlacement) => void;
  onSave: (text: string) => void;
  onShowActions: (sentenceIndex: number) => void;
  onToggleCollapsed: () => void;
  selectedBeat: Beat;
  textInputRef: React.RefObject<TextInput | null>;
  theme: {
    backgroundSecondary: string;
    buttonText: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
}

export function BeatEditorPanel({
  captionPlacement,
  draftText,
  editorCollapsed,
  editorTranslateY,
  isSaving,
  onChangeDraftText,
  onFocus,
  onLayout,
  onPlacementChange,
  onSave,
  onShowActions,
  onToggleCollapsed,
  selectedBeat,
  textInputRef,
  theme,
}: BeatEditorPanelProps) {
  return (
    <Animated.View
      style={[
        styles.inputContainer,
        { zIndex: 50, transform: [{ translateY: editorTranslateY }] },
      ]}
      onLayout={(event) => {
        onLayout(event.nativeEvent.layout.height);
      }}
    >
      <View
        style={[
          styles.beatLabelRow,
          editorCollapsed && styles.beatLabelRowCollapsed,
          editorCollapsed && { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <ThemedText style={styles.beatLabel}>Beat {selectedBeat.sentenceIndex + 1}</ThemedText>
        <View style={styles.beatLabelActions}>
          <Pressable
            onPress={() => onShowActions(selectedBeat.sentenceIndex)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="shuffle" size={18} color={theme.tabIconDefault} />
          </Pressable>
          {!editorCollapsed && (
            <Pressable
              onPress={() => onSave(draftText)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [styles.doneButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ThemedText style={[styles.doneButtonText, { color: theme.link }]}>
                Done
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            onPress={onToggleCollapsed}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather
              name={editorCollapsed ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.tabIconDefault}
            />
          </Pressable>
        </View>
      </View>
      {!editorCollapsed && (
        <>
          <View
            style={[styles.placementRow, { backgroundColor: theme.backgroundSecondary }]}
          >
            {CAPTION_PLACEMENTS.map((placement) => {
              const isActive = captionPlacement === placement;
              const label =
                placement === "top"
                  ? "Top"
                  : placement === "center"
                    ? "Center"
                    : "Bottom";
              return (
                <Pressable
                  key={placement}
                  onPress={() => onPlacementChange(placement)}
                  style={({ pressed }) => [
                    styles.placementButton,
                    isActive && { backgroundColor: theme.link },
                    pressed && !isActive ? { opacity: 0.7 } : null,
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <ThemedText
                    style={[
                      styles.placementButtonText,
                      { color: isActive ? theme.buttonText : theme.text },
                    ]}
                  >
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                color: theme.text,
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            value={draftText}
            onFocus={onFocus}
            onBlur={() => onSave(draftText)}
            onChangeText={(text) => {
              if (text.includes("\n")) {
                const cleaned = text.replace(/\n/g, " ").trim();
                onChangeDraftText(cleaned);
                onSave(cleaned);
                textInputRef.current?.blur();
                Keyboard.dismiss();
              } else {
                onChangeDraftText(text);
              }
            }}
            multiline
            editable={!isSaving}
            placeholderTextColor={theme.tabIconDefault}
          />
          {isSaving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={theme.link} />
            </View>
          )}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  beatLabel: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  beatLabelActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  beatLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  beatLabelRowCollapsed: {
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    marginBottom: 0,
  },
  doneButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  iconButton: {
    padding: Spacing.xs,
    borderRadius: 6,
  },
  inputContainer: {
    position: "relative",
  },
  placementButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  placementButtonText: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.92,
  },
  placementRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: Spacing.sm,
  },
  savingIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  textInput: {
    minHeight: 64,
    padding: Spacing.md,
    borderRadius: 8,
    fontSize: 16,
    textAlignVertical: "top",
  },
});
