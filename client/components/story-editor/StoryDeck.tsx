import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { StorySession } from "@/types/story";
import type { CaptionPreviewMeta } from "@/api/client";

import { getSelectedShot, type Beat } from "@/screens/story-editor/model";

const ACTIVE_SCALE = 1.16;

interface StoryDeckProps {
  beats: Beat[];
  cardH: number;
  cardStep: number;
  cardW: number;
  deckListRef: React.RefObject<FlatList<Beat> | null>;
  keyboardVisible: boolean;
  isLoadingByIndex: Record<number, boolean>;
  onDeckLayout: (event: LayoutChangeEvent) => void;
  onDeckScroll: any;
  onPressBeat: (sentenceIndex: number) => void;
  onLongPressBeat: (sentenceIndex: number) => void;
  onVisibleBeatChange: (sentenceIndex: number) => void;
  previewByIndex: Record<number, CaptionPreviewMeta | null>;
  scrollX: SharedValue<number>;
  selectedSentenceIndex: number | null;
  session: StorySession | null;
  theme: {
    backgroundSecondary: string;
    link: string;
    tabIconDefault: string;
  };
  windowWidth: number;
}

interface DeckCardProps {
  backgroundSecondary: string;
  cardH: number;
  cardStep: number;
  cardW: number;
  index: number;
  isLoading: boolean;
  item: Beat;
  link: string;
  meta: CaptionPreviewMeta | null;
  onLongPress: (sentenceIndex: number) => void;
  onPress: (sentenceIndex: number) => void;
  scrollX: SharedValue<number>;
  selectedSentenceIndex: number | null;
  session: StorySession | null;
  tabIconDefault: string;
  totalBeats: number;
}

const DeckCard = React.memo(function DeckCard({
  backgroundSecondary,
  cardH,
  cardStep,
  cardW,
  index,
  isLoading,
  item,
  link,
  meta,
  onLongPress,
  onPress,
  scrollX,
  selectedSentenceIndex,
  session,
  tabIconDefault,
  totalBeats,
}: DeckCardProps) {
  const shot = session ? getSelectedShot(session, item.sentenceIndex) : null;
  const clip = shot?.selectedClip || null;
  const frameW = typeof meta?.frameW === "number" ? meta.frameW : 1080;
  const rasterW = typeof meta?.rasterW === "number" ? meta.rasterW : 0;
  const rasterH = typeof meta?.rasterH === "number" ? meta.rasterH : 0;
  const scaleMeta = cardW / frameW;
  const overlayW = rasterW * scaleMeta;
  const overlayH = rasterH * scaleMeta;
  const leftPx =
    (typeof meta?.xPx_png === "number"
      ? meta.xPx_png
      : (frameW - rasterW) / 2) * scaleMeta;
  const topPx = (typeof meta?.yPx_png === "number" ? meta.yPx_png : 0) * scaleMeta;
  const hasMeta = meta?.rasterUrl && overlayW > 0 && overlayH > 0;

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * cardStep, index * cardStep, (index + 1) * cardStep];
    const scale = interpolate(scrollX.value, inputRange, [0.92, ACTIVE_SCALE, 0.92]);
    const translateY = interpolate(scrollX.value, inputRange, [6, -10, 6]);
    const opacity = interpolate(scrollX.value, inputRange, [0.75, 1, 0.75]);
    const zIndex = Math.round(interpolate(scrollX.value, inputRange, [0, 10, 0]));

    return {
      opacity,
      transform: [{ scale }, { translateY }],
      zIndex,
    };
  });

  return (
    <Animated.View style={[{ width: cardStep, alignItems: "center" }, animatedStyle]}>
      <Pressable
        style={[
          styles.deckCard,
          { width: cardW, height: cardH, backgroundColor: backgroundSecondary },
        ]}
        onPress={() => onPress(item.sentenceIndex)}
        onLongPress={() => onLongPress(item.sentenceIndex)}
      >
        {selectedSentenceIndex === item.sentenceIndex && (
          <View style={styles.deckCardPill} pointerEvents="none">
            <ThemedText style={styles.deckCardPillText}>
              Beat {item.sentenceIndex + 1} / {totalBeats}
            </ThemedText>
          </View>
        )}
        {clip?.thumbUrl ? (
          <View style={styles.deckCardInner}>
            <Image
              source={{ uri: clip.thumbUrl }}
              style={[styles.deckThumbnail, { backgroundColor: backgroundSecondary }]}
              resizeMode="cover"
            />
            {hasMeta && (
              <View
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: overlayW,
                  height: overlayH,
                }}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: meta!.rasterUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="stretch"
                />
              </View>
            )}
            {isLoading && (
              <View style={styles.deckCaptionLoading} pointerEvents="none">
                <ActivityIndicator size="small" color={link} />
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.deckCardInner, styles.deckPlaceholder]}>
            <Feather name="video" size={24} color={tabIconDefault} />
            <ThemedText style={styles.deckPlaceholderText}>No clip</ThemedText>
            {hasMeta && meta?.rasterUrl && (
              <View
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: overlayW,
                  height: overlayH,
                }}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: meta.rasterUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="stretch"
                />
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

export function StoryDeck({
  beats,
  cardH,
  cardStep,
  cardW,
  deckListRef,
  keyboardVisible,
  isLoadingByIndex,
  onDeckLayout,
  onDeckScroll,
  onPressBeat,
  onLongPressBeat,
  onVisibleBeatChange,
  previewByIndex,
  scrollX,
  selectedSentenceIndex,
  session,
  theme,
  windowWidth,
}: StoryDeckProps) {
  const deckPadTop = Spacing["5xl"] + Spacing.lg;
  const deckPadBottom = Spacing.sm;

  return (
    <View style={styles.deckSection} onLayout={onDeckLayout}>
      <View style={styles.deckStageWrap}>
        <Animated.FlatList
          ref={deckListRef as React.RefObject<Animated.FlatList<Beat>>}
          data={beats}
          renderItem={({ item, index }) => (
            <DeckCard
              backgroundSecondary={theme.backgroundSecondary}
              cardH={cardH}
              cardStep={cardStep}
              cardW={cardW}
              index={index}
              isLoading={isLoadingByIndex[item.sentenceIndex] ?? false}
              item={item}
              link={theme.link}
              meta={previewByIndex[item.sentenceIndex] ?? null}
              onLongPress={onLongPressBeat}
              onPress={onPressBeat}
              scrollX={scrollX}
              selectedSentenceIndex={selectedSentenceIndex}
              session={session}
              tabIconDefault={theme.tabIconDefault}
              totalBeats={beats.length}
            />
          )}
          keyExtractor={(item) => `beat-${item.sentenceIndex}`}
          horizontal
          snapToInterval={cardStep}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: (windowWidth - cardW) / 2,
            paddingTop: deckPadTop,
            paddingBottom: deckPadBottom,
          }}
          removeClippedSubviews={false}
          onScroll={onDeckScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / cardStep);
            const clamped = Math.max(0, Math.min(index, beats.length - 1));
            onVisibleBeatChange(beats[clamped].sentenceIndex);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={keyboardVisible ? "none" : "on-drag"}
          scrollEnabled={!keyboardVisible}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={[styles.deckScrimTop, { zIndex: 5 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={[styles.deckScrimBottom, { zIndex: 5 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.deckScrimLeft, { zIndex: 5 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.45)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.deckScrimRight, { zIndex: 5 }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckCaptionLoading: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  deckCard: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  deckCardInner: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  deckCardPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  deckCardPillText: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.95,
    color: "#fff",
  },
  deckPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  deckPlaceholderText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  deckScrimBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Spacing["3xl"],
    pointerEvents: "none",
  },
  deckScrimLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: Spacing.xl,
    pointerEvents: "none",
  },
  deckScrimRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: Spacing.xl,
    pointerEvents: "none",
  },
  deckScrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Spacing["3xl"],
    pointerEvents: "none",
  },
  deckSection: {
    flex: 1,
    overflow: "visible",
  },
  deckStageWrap: {
    flex: 1,
    position: "relative",
  },
  deckThumbnail: {
    width: "100%",
    height: "100%",
  },
});
