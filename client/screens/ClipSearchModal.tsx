import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Pressable,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing } from "@/constants/theme";
import { storySearchShot, storyUpdateShot } from "@/api/client";

type ClipSearchRouteProp = RouteProp<HomeStackParamList, "ClipSearch">;

interface Clip {
  id: string;
  url: string;
  thumbUrl: string;
  duration: number;
  photographer?: string;
  provider: string;
}

/**
 * Unwrap session from NormalizedResponse shape
 */
function unwrapSession(res: any): any {
  // Prefer normalized shape first (apiRequestNormalized returns { ok: true, data: T })
  if (res?.data && (res?.ok === true || res?.success === true)) return res.data;
  // Some wrappers return session directly (defensive fallback)
  return res;
}

export default function ClipSearchModal() {
  const route = useRoute<ClipSearchRouteProp>();
  const navigation = useNavigation();
  const { sessionId, sentenceIndex, initialQuery } = route.params;
  const { theme } = useTheme();
  const { showError } = useToast();

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Clip[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectingClipId, setSelectingClipId] = useState<string | null>(null);
  const autoSearchedRef = useRef(false);

  const handleSearch = async (qOverride?: string) => {
    const q = (qOverride ?? query).trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const res = await storySearchShot({
        sessionId,
        sentenceIndex,
        query: q || undefined,
        page: 1,
      });

      if (!res?.ok && res?.success !== true) {
        showError(res?.message || "Failed to search clips");
        return;
      }

      const unwrapped = unwrapSession(res);
      const shot = unwrapped?.shot;
      const foundCandidates = shot?.candidates || [];
      const pageNum = unwrapped?.page || 1;
      const hasMoreResults = unwrapped?.hasMore || false;

      setCandidates(foundCandidates);
      setPage(pageNum);
      setHasMore(hasMoreResults);
    } catch (error) {
      console.error("[clip-search] search error:", error);
      showError("Failed to search clips. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectClip = async (clipId: string) => {
    setSelectingClipId(clipId);
    try {
      const res = await storyUpdateShot({
        sessionId,
        sentenceIndex,
        clipId,
      });

      if (!res?.ok && res?.success !== true) {
        showError(res?.message || "Failed to update clip");
        return;
      }

      // Success: close modal
      navigation.goBack();
    } catch (error) {
      console.error("[clip-search] select error:", error);
      showError("Failed to update clip. Please try again.");
    } finally {
      setSelectingClipId(null);
    }
  };

  // Auto-search on mount if initialQuery is provided
  useEffect(() => {
    const initial = initialQuery;
    if (initial && !autoSearchedRef.current) {
      autoSearchedRef.current = true;
      setQuery(initial);
      handleSearch(initial);
    }
  }, []); // mount-only; do not add route.params or handleSearch to deps

  const renderCandidate = ({ item }: { item: Clip }) => {
    const isSelecting = selectingClipId === item.id;

    return (
      <Card
        elevation={1}
        style={styles.candidateCard}
        onPress={() => !isSelecting && handleSelectClip(item.id)}
      >
        <View style={styles.candidateContent}>
          {item.thumbUrl ? (
            <Image
              source={{ uri: item.thumbUrl }}
              style={[
                styles.candidateThumbnail,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.candidateThumbnail,
                { backgroundColor: theme.backgroundSecondary },
                styles.thumbnailPlaceholder,
              ]}
            >
              <Feather name="video" size={24} color={theme.textTertiary} />
            </View>
          )}
          <View style={styles.candidateInfo}>
            <ThemedText style={styles.candidateProvider}>
              {item.provider}
            </ThemedText>
            {item.duration && (
              <ThemedText style={styles.candidateDuration}>
                {item.duration}s
              </ThemedText>
            )}
          </View>
        </View>
        {isSelecting && (
          <View style={styles.selectingOverlay}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        )}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              color: theme.textPrimary,
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.backgroundTertiary,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search clips..."
          placeholderTextColor={theme.textTertiary}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable
          style={[
            styles.searchButton,
            {
              backgroundColor: theme.link,
              opacity: isSearching ? 0.5 : 1,
            },
          ]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Feather name="search" size={20} color={theme.buttonText} />
          )}
        </Pressable>
      </View>

      {candidates.length === 0 && !isSearching ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            {query.trim() ? "No clips found. Try a different search." : "Enter a search query to find clips."}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={candidates}
          renderItem={renderCandidate}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  candidateCard: {
    marginBottom: Spacing.md,
  },
  candidateContent: {
    gap: Spacing.sm,
  },
  candidateThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailPlaceholder: {
    opacity: 0.5,
  },
  candidateInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  candidateProvider: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: "capitalize",
  },
  candidateDuration: {
    fontSize: 12,
    opacity: 0.7,
  },
  selectingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
});
