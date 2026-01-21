import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

const COLORS = {
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  info: "#4A5FFF",
  white: "#FFFFFF",
  textPrimary: "#1A1D29",
};

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
}

export function Toast({
  visible,
  message,
  type = "info",
  duration = 4000,
  onHide,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });

      if (Platform.OS !== "web") {
        if (type === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  const hideToast = () => {
    translateY.value = withSpring(-100, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onHide)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return COLORS.success;
      case "error":
        return COLORS.error;
      case "warning":
        return COLORS.warning;
      case "info":
      default:
        return COLORS.info;
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "alert-circle";
      case "warning":
        return "alert-triangle";
      case "info":
      default:
        return "info";
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + Spacing.md,
          backgroundColor: getBackgroundColor(),
        },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <Feather
          name={getIcon()}
          size={20}
          color={COLORS.white}
          style={styles.icon}
        />
        <ThemedText style={styles.message} numberOfLines={2}>
          {message}
        </ThemedText>
        <Pressable
          onPress={hideToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={COLORS.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.sm,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  icon: {
    marginRight: Spacing.md,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
