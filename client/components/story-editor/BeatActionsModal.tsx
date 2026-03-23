import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

interface BeatActionsModalProps {
  onClose: () => void;
  onDeleteBeat: (sentenceIndex: number) => void;
  onReplaceClip: (sentenceIndex: number) => void;
  selectedSentenceIndex: number | null;
  theme: {
    backgroundDefault: string;
    backgroundSecondary: string;
    buttonText: string;
    link: string;
  };
}

export function BeatActionsModal({
  onClose,
  onDeleteBeat,
  onReplaceClip,
  selectedSentenceIndex,
  theme,
}: BeatActionsModalProps) {
  return (
    <Modal
      visible={selectedSentenceIndex !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
          onPress={(event) => event.stopPropagation()}
        >
          <ThemedText style={styles.modalTitle}>
            Beat {selectedSentenceIndex !== null ? selectedSentenceIndex + 1 : ""}
          </ThemedText>
          <View style={styles.modalButtons}>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalButtonCancel,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={onClose}
            >
              <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalButtonPrimary,
                { backgroundColor: theme.link },
              ]}
              onPress={() => {
                if (selectedSentenceIndex !== null) {
                  onReplaceClip(selectedSentenceIndex);
                }
              }}
            >
              <ThemedText style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Replace Clip
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                if (selectedSentenceIndex !== null) {
                  onDeleteBeat(selectedSentenceIndex);
                }
              }}
            >
              <ThemedText style={[styles.modalButtonText, { color: theme.link }]}>
                Delete Beat
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {},
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalContent: {
    borderRadius: 12,
    padding: Spacing.xl,
    minWidth: 280,
    maxWidth: "80%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
});
