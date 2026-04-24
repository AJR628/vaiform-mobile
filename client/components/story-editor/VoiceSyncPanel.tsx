import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { formatRenderTimeAmount } from "@/lib/renderUsage";
import type { StoryVoiceOption, StoryVoiceSync } from "@/types/story";

interface VoiceSyncPanelProps {
  currentCaptionText: string | null;
  currentPreviewBeatLabel: string | null;
  draftVoicePreset: string;
  hasLocalVoiceDraft: boolean;
  isPreviewAvailable: boolean;
  isPreviewPlaying: boolean;
  isSyncing: boolean;
  onClose: () => void;
  onSelectVoice: (voicePreset: string) => void;
  onSync: () => void;
  onTogglePreview: () => void;
  previewDurationSec: number | null;
  previewPositionSec: number;
  renderEstimateSec: number | null;
  syncEstimateSec: number | null;
  theme: {
    backgroundDefault: string;
    backgroundSecondary: string;
    border: string;
    buttonText: string;
    link: string;
    tabIconDefault: string;
    text: string;
  };
  voiceOptions: StoryVoiceOption[];
  voiceSync: StoryVoiceSync | null;
}

function getStatusCopy(
  voiceSync: StoryVoiceSync | null,
  hasLocalVoiceDraft: boolean,
): string {
  if (hasLocalVoiceDraft)
    return "Voice changed. Sync to update preview timing.";
  const state = voiceSync?.state ?? "never_synced";
  if (state === "current") return "Preview timing is locked to this voice.";
  if (state === "stale")
    return "Voice or script changed. Re-sync to update preview timing.";
  return "Choose a voice and sync timing to unlock the final preview.";
}

function formatBeatList(indices: number[] | undefined): string | null {
  if (!Array.isArray(indices) || indices.length === 0) return null;
  return indices.map((index) => index + 1).join(", ");
}

export function VoiceSyncPanel({
  currentCaptionText,
  currentPreviewBeatLabel,
  draftVoicePreset,
  hasLocalVoiceDraft,
  isPreviewAvailable,
  isPreviewPlaying,
  isSyncing,
  onClose,
  onSelectVoice,
  onSync,
  onTogglePreview,
  previewDurationSec,
  previewPositionSec,
  renderEstimateSec,
  syncEstimateSec,
  theme,
  voiceOptions,
  voiceSync,
}: VoiceSyncPanelProps) {
  const staleBeats = formatBeatList(voiceSync?.staleBeatIndices);
  const lastChargeSec = voiceSync?.lastChargeSec ?? null;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText type="h4">Voice & Timing</ThemedText>
          <ThemedText
            style={[styles.subtleText, { color: theme.tabIconDefault }]}
          >
            {getStatusCopy(voiceSync, hasLocalVoiceDraft)}
          </ThemedText>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <ThemedText style={[styles.closeText, { color: theme.link }]}>
            Close
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <View style={styles.infoRow}>
            <ThemedText
              style={[styles.infoLabel, { color: theme.tabIconDefault }]}
            >
              Next sync charge
            </ThemedText>
            <ThemedText>{formatRenderTimeAmount(syncEstimateSec)}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText
              style={[styles.infoLabel, { color: theme.tabIconDefault }]}
            >
              Render charge
            </ThemedText>
            <ThemedText>{formatRenderTimeAmount(renderEstimateSec)}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText
              style={[styles.infoLabel, { color: theme.tabIconDefault }]}
            >
              Synced duration
            </ThemedText>
            <ThemedText>
              {formatRenderTimeAmount(voiceSync?.totalDurationSec ?? null)}
            </ThemedText>
          </View>
          {lastChargeSec ? (
            <View style={styles.infoRow}>
              <ThemedText
                style={[styles.infoLabel, { color: theme.tabIconDefault }]}
              >
                Last sync used
              </ThemedText>
              <ThemedText>{formatRenderTimeAmount(lastChargeSec)}</ThemedText>
            </View>
          ) : null}
          {voiceSync?.staleScope === "full" ? (
            <ThemedText
              style={[styles.subtleText, { color: theme.tabIconDefault }]}
            >
              Full re-sync required.
            </ThemedText>
          ) : staleBeats ? (
            <ThemedText
              style={[styles.subtleText, { color: theme.tabIconDefault }]}
            >
              Stale beats: {staleBeats}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Voice</ThemedText>
          <View style={styles.voiceGrid}>
            {voiceOptions.map((voice) => {
              const selected = draftVoicePreset === voice.key;
              return (
                <Pressable
                  key={voice.key}
                  onPress={() => onSelectVoice(voice.key)}
                  style={[
                    styles.voiceOption,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: selected ? theme.link : theme.border,
                    },
                  ]}
                >
                  <ThemedText style={styles.voiceName}>{voice.name}</ThemedText>
                  <ThemedText
                    style={[styles.voiceMeta, { color: theme.tabIconDefault }]}
                  >
                    {[voice.gender, voice.emotion]
                      .filter(Boolean)
                      .join(" - ") || "Preset voice"}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.previewHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>
                Preview controls
              </ThemedText>
              <ThemedText
                style={[styles.subtleText, { color: theme.tabIconDefault }]}
              >
                Use these controls to review the synced preview.
              </ThemedText>
            </View>
            <Pressable
              onPress={onTogglePreview}
              disabled={!isPreviewAvailable}
              style={[
                styles.previewButton,
                {
                  backgroundColor: isPreviewAvailable
                    ? theme.link
                    : theme.backgroundSecondary,
                  opacity: isPreviewAvailable ? 1 : 0.5,
                },
              ]}
            >
              <ThemedText style={{ color: theme.buttonText }}>
                {isPreviewPlaying ? "Pause" : "Play"}
              </ThemedText>
            </Pressable>
          </View>
          <View
            style={[
              styles.previewCard,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              style={[styles.previewBeat, { color: theme.tabIconDefault }]}
            >
              {currentPreviewBeatLabel ?? "Preview state will appear here"}
            </ThemedText>
            <ThemedText>
              {currentCaptionText ?? "Use the inline preview once sync is ready."}
            </ThemedText>
            <ThemedText
              style={[styles.subtleText, { color: theme.tabIconDefault }]}
            >
              {isPreviewAvailable
                ? `${formatRenderTimeAmount(previewPositionSec)} / ${formatRenderTimeAmount(
                    previewDurationSec,
                  )}`
                : "Sync voice and timing to unlock preview playback."}
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      <Button onPress={onSync} disabled={isSyncing} style={styles.syncButton}>
        {isSyncing ? "Syncing..." : "Sync Voice & Timing"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  closeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  container: {
    borderRadius: BorderRadius.xl,
    maxHeight: "86%",
    padding: Spacing.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewBeat: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  previewButton: {
    alignItems: "center",
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    minWidth: 76,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  previewCard: {
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  scrollContent: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    gap: Spacing.sm,
  },
  subtleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  syncButton: {
    marginTop: Spacing.sm,
  },
  voiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  voiceMeta: {
    fontSize: 12,
  },
  voiceName: {
    fontSize: 14,
    fontWeight: "600",
  },
  voiceOption: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
    minWidth: "47%",
    padding: Spacing.md,
  },
});
