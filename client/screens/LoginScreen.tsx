import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const COLORS = {
  primary: "#4A5FFF",
  primaryEnd: "#7B68EE",
  surface: "#F8F9FB",
  surfaceSecondary: "#ECEEF3",
  textPrimary: "#1A1D29",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  error: "#EF4444",
  white: "#FFFFFF",
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { signInWithEmail, signInWithGoogle, error, clearError, isLoading } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const isFormValid = email.length > 0 && password.length >= 6;

  const handleEmailSignIn = async () => {
    if (!isFormValid) return;

    clearError();
    setLocalLoading(true);

    try {
      await signInWithEmail(email.trim(), password);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleCreateAccount = () => {
    Alert.alert(
      "Create Account",
      "Account creation flow will be implemented in a future update.",
      [{ text: "OK" }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <ThemedText style={styles.title}>Sign in to Vaiform</ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            { backgroundColor: theme.backgroundDefault },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGoogleSignIn}
          testID="button-google-signin"
        >
          <View style={styles.googleIconContainer}>
            <Feather name="chrome" size={20} color={COLORS.textPrimary} />
          </View>
          <ThemedText style={styles.googleButtonText}>
            Continue with Google
          </ThemedText>
        </Pressable>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <ThemedText style={styles.dividerText}>or</ThemedText>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: COLORS.surface, borderColor: COLORS.border },
            ]}
            placeholder="Email"
            placeholderTextColor={COLORS.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            testID="input-email"
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: COLORS.surface, borderColor: COLORS.border },
            ]}
            placeholder="Password"
            placeholderTextColor={COLORS.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            testID="input-password"
          />
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={COLORS.textSecondary}
            />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather
              name="alert-circle"
              size={16}
              color={COLORS.error}
              style={styles.errorIcon}
            />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.signInButton,
            !isFormValid && styles.signInButtonDisabled,
            pressed && isFormValid && styles.buttonPressed,
          ]}
          onPress={handleEmailSignIn}
          disabled={!isFormValid || localLoading || isLoading}
          testID="button-signin"
        >
          <LinearGradient
            colors={
              isFormValid
                ? [COLORS.primary, COLORS.primaryEnd]
                : [COLORS.surfaceSecondary, COLORS.surfaceSecondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.signInGradient}
          >
            {localLoading || isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <ThemedText
                style={[
                  styles.signInButtonText,
                  !isFormValid && styles.signInButtonTextDisabled,
                ]}
              >
                Sign In
              </ThemedText>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          style={styles.createAccountButton}
          onPress={handleCreateAccount}
          testID="button-create-account"
        >
          <ThemedText style={styles.createAccountText}>
            Create Account
          </ThemedText>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  googleIconContainer: {
    marginRight: Spacing.md,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: Spacing["2xl"],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: Spacing.lg,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  inputContainer: {
    width: "100%",
    marginBottom: Spacing.lg,
    position: "relative",
  },
  input: {
    width: "100%",
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  passwordToggle: {
    position: "absolute",
    right: Spacing.md,
    top: 14,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  errorIcon: {
    marginRight: Spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    flex: 1,
  },
  signInButton: {
    width: "100%",
    height: 48,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
  signInButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  createAccountButton: {
    marginTop: Spacing["2xl"],
    paddingVertical: Spacing.sm,
  },
  createAccountText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});
