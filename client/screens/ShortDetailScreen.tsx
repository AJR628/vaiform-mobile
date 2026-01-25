import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";
import { getShortDetail, ShortDetail, ShortItem, getMyShorts } from "@/api/client";
import { useToast } from "@/contexts/ToastContext";

const COLORS = {
  primary: "#4A5FFF",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F8F9FB",
  white: "#FFFFFF",
  error: "#EF4444",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ShortDetailRouteProp = RouteProp<LibraryStackParamList, "ShortDetail">;

function isVideoUrl(url: string): boolean {
  // Strip query string and hash
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  
  // Fallback: check for known video extensions anywhere in the URL
  // (handles cases where lastDot parsing might fail or extension is in path)
  if (clean.includes(".mp4") || clean.includes(".mov") || clean.includes(".m4v") || clean.includes(".webm") || clean.includes(".avi")) {
    return true;
  }
  
  // Extract extension from end
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) {
    // No extension - check for known patterns in path
    return clean.includes("/story.mp4") || clean.includes("/short.mp4");
  }
  
  const ext = clean.slice(lastDot);
  const videoExtensions = [".mp4", ".mov", ".m4v", ".webm", ".avi"];
  return videoExtensions.some((e) => ext === e);
}

function isImageUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  
  // Fallback: check for known image extensions anywhere in the URL
  if (clean.includes(".png") || clean.includes(".jpg") || clean.includes(".jpeg") || clean.includes(".webp") || clean.includes(".gif")) {
    return true;
  }
  
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return false;
  
  const ext = clean.slice(lastDot);
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  return imageExtensions.some((e) => ext === e);
}

export default function ShortDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ShortDetailRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showError } = useToast();

  // Safe route params extraction (handles undefined params edge case)
  const params = route.params ?? {};
  const shortParam = params.short ?? null;
  const shortId = params.shortId ?? null;

  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shortDetail, setShortDetail] = useState<ShortDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const escapeHatchRanRef = useRef(false);

  // Retry state for 404 pending availability
  const [isPendingAvailability, setIsPendingAvailability] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [didRetryTimeout, setDidRetryTimeout] = useState(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const fallbackInFlightRef = useRef(false);

  // Unmount cleanup: prevent state updates and clear timers
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  // Escape hatch: navigate away if neither param exists
  useEffect(() => {
    if (!shortParam && !shortId && !escapeHatchRanRef.current) {
      escapeHatchRanRef.current = true;
      console.error("[shorts] ShortDetail requires either short or shortId param - navigating back");
      // Prefer goBack, fallback to Library tab
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        const tabNavigator = navigation.getParent();
        if (tabNavigator) {
          tabNavigator.navigate("LibraryTab", { screen: "Library" });
        }
      }
    }
  }, [shortParam, shortId, navigation]);

  // Fetch short detail from server if shortId provided and short not provided
  // Includes retry logic for 404 (pending availability / eventual consistency)
  useEffect(() => {
    // Only for the post-render path: shortId present, shortParam absent
    if (!shortId || shortParam) return;

    // Retry configuration
    const RETRY_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 13000, 21000]; // 7 attempts
    const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

    // Reset state for new shortId
    if (isMountedRef.current) {
      setIsLoadingDetail(true);
      setIsPendingAvailability(false);
      setRetryAttempt(0);
      setDidRetryTimeout(false);
      setShortDetail(null);
    }

    // Clear any prior scheduled retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let cancelled = false;

    const attemptFetch = async (attemptIndex: number) => {
      if (cancelled || !isMountedRef.current) return;

      if (__DEV__) {
        console.log(
          `[ShortDetail] attempt ${attemptIndex + 1}/${MAX_ATTEMPTS} shortId=${shortId}`
        );
      }

      const result = await getShortDetail(shortId);

      if (cancelled || !isMountedRef.current) return;

      // SUCCESS
      if (result.ok && result.data) {
        if (isMountedRef.current) {
          setShortDetail(result.data);
          setIsPendingAvailability(false);
          setDidRetryTimeout(false);
          setIsLoadingDetail(false);
          setRetryAttempt(0);
          // Reset retry count on successful fetch
          setRetryCount(0);
        }

        if (__DEV__ && attemptIndex > 0) {
          console.log(
            `[ShortDetail] available after ${attemptIndex + 1} attempts shortId=${shortId}`
          );
        }
        return;
      }

      // 404 = pending availability (eventual consistency) OR backend mismatch
      if (!result.ok && result.status === 404) {
        if (isMountedRef.current) {
          setIsPendingAvailability(true);
          setRetryAttempt(attemptIndex);
          // Keep isLoadingDetail true while retrying (shows "Finalizing..." UI)
          setIsLoadingDetail(true);
        }

        // Try library list fallback on attempts 1, 3, 5 (indices 0, 2, 4)
        // This catches the short early instead of waiting 30s
        // attemptIndex: 0, 1, 2, 3, 4, 5, 6
        // Fallback on: 0, 2, 4 (attempts 1, 3, 5)
        if (attemptIndex % 2 === 0 && attemptIndex <= 4) {
          const tryLibraryFallback = async () => {
            // Prevent overlapping fallback calls
            if (fallbackInFlightRef.current || cancelled || !isMountedRef.current || !shortId) {
              return;
            }

            fallbackInFlightRef.current = true;

            try {
              // Use higher limit to catch newly created short
              const listResult = await getMyShorts(undefined, 50);
              if (cancelled || !isMountedRef.current) return;

              // Verified: getMyShorts returns NormalizedResponse<ShortsListResponse>
              // ShortsListResponse = { items: ShortItem[], nextCursor?: string, hasMore: boolean }
              if (listResult.ok && listResult.data?.items) {
                const foundShort = listResult.data.items.find(
                  (item) => item.id === shortId && item.status === "ready" && item.videoUrl
                );

                if (foundShort) {
                  if (isMountedRef.current) {
                    // Clear all pending/timeout flags BEFORE setParams
                    // This ensures UI state updates correctly
                    setIsPendingAvailability(false);
                    setDidRetryTimeout(false);
                    setIsLoadingDetail(false);
                    setRetryAttempt(0);

                    // Update route params to use { short } instead of { shortId }
                    // This bypasses detail fetch and uses instant path
                    navigation.setParams({ short: foundShort, shortId: undefined });

                    if (__DEV__) {
                      console.log(
                        `[ShortDetail] fallback success: found short in library list on attempt ${attemptIndex + 1}, id=${shortId}`
                      );
                    }
                  }
                  return;
                }
              }

              if (__DEV__) {
                console.log(
                  `[ShortDetail] fallback attempt ${attemptIndex + 1}: short not found in library list yet, shortId=${shortId}`
                );
              }
            } catch (error) {
              if (__DEV__) {
                console.error(`[ShortDetail] fallback error on attempt ${attemptIndex + 1}:`, error);
              }
            } finally {
              fallbackInFlightRef.current = false;
            }
          };

          // Try fallback in parallel (don't block retry loop)
          tryLibraryFallback();
        }

        // If this was the last attempt, stop retrying but remain "pending"
        if (attemptIndex >= MAX_ATTEMPTS - 1) {
          if (isMountedRef.current) {
            setDidRetryTimeout(true);
            setIsLoadingDetail(false);
          }

          if (__DEV__) {
            console.log(
              `[ShortDetail] timeout after ${MAX_ATTEMPTS} attempts shortId=${shortId}`
            );
          }
          return;
        }

        // Schedule next attempt (continues retry loop as backup)
        const delay = RETRY_DELAYS_MS[attemptIndex];
        retryTimeoutRef.current = setTimeout(() => {
          if (!cancelled && isMountedRef.current) {
            attemptFetch(attemptIndex + 1);
          }
          retryTimeoutRef.current = null;
        }, delay);

        return;
      }

      // NON-404 ERROR = terminal
      if (isMountedRef.current) {
        setIsPendingAvailability(false);
        setDidRetryTimeout(false);
        setIsLoadingDetail(false);
        showError(result.message || "Failed to load short details");
      }

      if (__DEV__) {
        console.log(
          `[ShortDetail] terminal error shortId=${shortId} status=${result.status} code=${result.code}`
        );
      }
    };

    // Kick off attempt #0 immediately
    attemptFetch(0);

    // Cleanup when shortId changes or screen unmounts
    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // Reset fallback guard on cleanup
      fallbackInFlightRef.current = false;
    };
  }, [shortId, shortParam, showError, navigation]);

  // Auto-retry if fetch succeeded but videoUrl is missing (max 2 retries with backoff)
  useEffect(() => {
    if (shortDetail && !shortDetail.videoUrl && shortId && retryCount < 2) {
      const delays = [600, 1200]; // ms
      const timeoutId = setTimeout(() => {
        console.log(`[shorts] Auto-retry ${retryCount + 1}/2 for missing videoUrl`);
        setRetryCount((prev) => prev + 1);
        getShortDetail(shortId)
          .then((result) => {
            if (result.ok && result.data) {
              setShortDetail(result.data);
            }
          })
          .catch((error) => {
            console.error("[shorts] retry fetch error:", error);
          });
      }, delays[retryCount]);
      return () => clearTimeout(timeoutId);
    }
  }, [shortDetail, shortId, retryCount]);

  // Use shortDetail if fetched, otherwise use shortParam (backward compatible)
  const short: ShortItem | null = shortParam
    ? shortParam
    : shortDetail
    ? {
        // Adapter: convert ShortDetail to ShortItem-like shape for display
        id: shortDetail.id,
        ownerId: "", // Not in ShortDetail
        status: "ready", // Assume ready if fetched
        videoUrl: shortDetail.videoUrl,
        thumbUrl: shortDetail.coverImageUrl,
        coverImageUrl: shortDetail.coverImageUrl,
        durationSec: shortDetail.durationSec,
        quoteText: shortDetail.usedQuote?.text,
        template: shortDetail.usedTemplate,
        mode: undefined,
        voiceover: undefined,
        captionMode: undefined,
        watermark: undefined,
        createdAt: shortDetail.createdAt,
        completedAt: undefined,
        failedAt: undefined,
        errorMessage: undefined,
      }
    : null;

  // Null-safe mediaUrl access (prevents crash when short is null)
  const mediaUrl = short?.videoUrl ?? null;
  const isVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;
  const isImage = mediaUrl ? isImageUrl(mediaUrl) : false;

  // Log media type detection
  useEffect(() => {
    if (short) {
      console.log(`[shorts] detail id=${short.id} mediaUrl=${mediaUrl?.substring(0, 60)}... isVideo=${isVideo} isImage=${isImage}`);
    }
    if (__DEV__) {
      console.log(`[ShortDetail] params short? ${!!shortParam} shortId? ${!!shortId} short=${!!short} mediaUrl=${!!mediaUrl}`);
    }
  }, [short?.id, mediaUrl, isVideo, isImage, shortParam, shortId, short]);

  // Native-only reachability check
  useEffect(() => {
    if (Platform.OS !== "web" && mediaUrl) {
      // Fast signal: is it the URL or the player?
      fetch(mediaUrl, { method: "HEAD" })
        .then((res) => {
          console.log("[shorts] Video URL reachable:", {
            status: res.status,
            contentType: res.headers.get("content-type"),
            contentLength: res.headers.get("content-length"),
          });
        })
        .catch((err) => {
          // Fallback to GET with Range header (Firebase sometimes blocks HEAD)
          console.warn("[shorts] HEAD failed, trying Range request:", err.message);
          fetch(mediaUrl, {
            headers: { Range: "bytes=0-1" },
          })
            .then((res) => {
              console.log("[shorts] Video URL reachable (Range):", {
                status: res.status,
                contentType: res.headers.get("content-type"),
              });
            })
            .catch((rangeErr) => {
              console.error("[shorts] Video URL NOT reachable:", rangeErr.message);
            });
        });
    }
  }, [mediaUrl]);

  // Web debug logging
  useEffect(() => {
    if (Platform.OS === "web" && isVideo && mediaUrl) {
      setTimeout(() => {
        const v = document.querySelector("video");
        if (v) {
          console.log("[shorts] Video element found:", {
            src: v.currentSrc,
            readyState: v.readyState,
            networkState: v.networkState,
            error: v.error,
          });
        } else {
          console.warn("[shorts] Video element NOT found in DOM");
        }
      }, 100);
    }
  }, [isVideo, mediaUrl]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      setIsLoading(false);
      const errorMsg = status.error.localizedDescription || status.error.message || "Unknown error";
      setVideoError(`Playback failed: ${errorMsg}`);
    }
  };

  const handleVideoError = (e: any) => {
    // Read correct shape (event object)
    const errorMsg = e?.error?.localizedDescription || e?.error?.message || JSON.stringify(e);
    console.error("[shorts] Video playback error:", {
      error: e?.error,
      fullEvent: e,
      message: errorMsg,
    });
    setVideoError(`Playback failed: ${errorMsg}`);
    setIsLoading(false);
  };

  const handleVideoLoad = () => {
    console.log("[shorts] Video onLoad fired", mediaUrl?.substring(0, 60));
    setIsLoading(false);
  };

  const handleReadyForDisplay = () => {
    console.log("[shorts] Video onReadyForDisplay fired");
    setIsLoading(false);
  };

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleOpenInBrowser = async () => {
    if (!mediaUrl) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      if (Platform.OS === "web") {
        window.open(mediaUrl, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(mediaUrl);
      }
    } catch (error) {
      console.error("[shorts] Failed to open in browser:", error);
      await Linking.openURL(mediaUrl);
    }
  };

  const handleRetryFetch = async () => {
    if (!shortId) return;
    setIsLoadingDetail(true);
    setRetryCount((prev) => prev + 1);
    try {
      const result = await getShortDetail(shortId);
      if (result.ok && result.data) {
        setShortDetail(result.data);
      } else {
        showError(result.message || "Failed to load short details");
      }
    } catch (error) {
      console.error("[shorts] retry fetch error:", error);
      showError("Failed to load short details");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ThemedView style={styles.container}>
        <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {isLoadingDetail && isPendingAvailability ? (
          // Pending availability: retrying 404
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>Finalizing your render...</ThemedText>
          </View>
        ) : isLoadingDetail ? (
          // Initial fetch (non-404)
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>Loading short details...</ThemedText>
          </View>
        ) : !short && didRetryTimeout ? (
          // Retry window exhausted, still pending
          <View style={styles.noVideoContainer}>
            <Feather name="clock" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              Still finalizing. This may take a moment.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
              onPress={() => {
                const tabNavigator = navigation.getParent();
                if (tabNavigator) {
                  tabNavigator.navigate("LibraryTab", { screen: "Library" });
                } else {
                  navigation.goBack();
                }
              }}
            >
              <ThemedText style={styles.retryButtonText}>Back to Library</ThemedText>
            </Pressable>
          </View>
        ) : !short ? (
          // Terminal (non-404) missing short
          <View style={styles.noVideoContainer}>
            <Feather name="alert-circle" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              Short not found
            </ThemedText>
          </View>
        ) : short && !mediaUrl ? (
          // Finalizing state: fetch succeeded but videoUrl is missing
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>Finalizing video...</ThemedText>
            {retryCount < 2 && (
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
                onPress={handleRetryFetch}
              >
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {isVideo && mediaUrl && !videoError ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls={true}
              shouldPlay={true}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={handleVideoError}
              onLoad={handleVideoLoad}
              onReadyForDisplay={handleReadyForDisplay}
              posterSource={
                short.thumbUrl || short.coverImageUrl
                  ? { uri: short.thumbUrl || short.coverImageUrl }
                  : undefined
              }
              usePoster={!!(short.thumbUrl || short.coverImageUrl)}
            />
            {isLoading && !videoError && (
              <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]} pointerEvents="none">
                <ActivityIndicator size="large" color={COLORS.white} />
              </View>
            )}
          </View>
        ) : isImage && mediaUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        ) : mediaUrl ? (
          <View style={styles.noVideoContainer}>
            <Feather name="play-circle" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              {videoError || "Tap below to open in browser"}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.noVideoContainer}>
            <Feather name="video-off" size={48} color={COLORS.textTertiary} />
            <ThemedText style={styles.noVideoText}>
              No media available
            </ThemedText>
          </View>
        )}

        {mediaUrl && videoError ? (
          <Pressable
            style={({ pressed }) => [
              styles.browserButton,
              pressed && styles.browserButtonPressed,
            ]}
            onPress={handleOpenInBrowser}
          >
            <Feather name="external-link" size={18} color={COLORS.primary} />
            <ThemedText style={styles.browserButtonText}>
              Open in Browser
            </ThemedText>
          </Pressable>
        ) : null}

            {short.quoteText ? (
              <Card style={styles.quoteCard}>
                <ThemedText style={styles.quoteText}>"{short.quoteText}"</ThemedText>
              </Card>
            ) : null}

            <Card style={styles.metaCard}>
              <ThemedText style={styles.sectionTitle}>Details</ThemedText>

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaLabel}>ID</ThemedText>
                <ThemedText style={styles.metaValue} numberOfLines={1}>
                  {short.id}
                </ThemedText>
              </View>

              {short.durationSec ? (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Duration</ThemedText>
                  <ThemedText style={styles.metaValue}>
                    {Math.round(short.durationSec)} seconds
                  </ThemedText>
                </View>
              ) : null}

              {short.template ? (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Template</ThemedText>
                  <ThemedText style={styles.metaValue}>{short.template}</ThemedText>
                </View>
              ) : null}

              {short.mode ? (
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>Mode</ThemedText>
                  <ThemedText style={styles.metaValue}>{short.mode}</ThemedText>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaLabel}>Status</ThemedText>
                <ThemedText style={styles.metaValue}>{short.status}</ThemedText>
              </View>

              <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                <ThemedText style={styles.metaLabel}>Created</ThemedText>
                <ThemedText style={styles.metaValue}>
                  {formatDate(short.createdAt)}
                </ThemedText>
              </View>
            </Card>
          </>
        )}
        </KeyboardAwareScrollViewCompat>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 9/16, // Portrait videos
    maxHeight: SCREEN_WIDTH * 1.5, // Reasonable max
    minHeight: 200, // Ensure not rendered at 0 height
    backgroundColor: "#000",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
    position: "relative",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 9/16, // Portrait aspect ratio
    maxHeight: SCREEN_WIDTH * 1.5,
    minHeight: 200,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noVideoContainer: {
    width: "100%",
    height: 200,
    backgroundColor: COLORS.surface,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noVideoText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  browserButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
  },
  browserButtonPressed: {
    opacity: 0.7,
  },
  browserButtonText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  quoteCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: "italic",
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BorderRadius.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: Spacing.md,
  },
  loadingOverlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 200,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
});
