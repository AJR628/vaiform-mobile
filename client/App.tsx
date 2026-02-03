import React from "react";
import { StyleSheet } from "react-native";
import { DarkTheme as NavDarkTheme, NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ActiveStorySessionProvider } from "@/contexts/ActiveStorySessionContext";
import { Colors } from "@/constants/theme";

const vaiformNavDarkColors = {
  primary: Colors.dark.link,
  background: Colors.dark.backgroundRoot,
  card: Colors.dark.backgroundDefault,
  text: Colors.dark.text,
  border: Colors.dark.backgroundTertiary,
  notification: Colors.dark.link,
};

const VaiformNavDarkTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    ...vaiformNavDarkColors,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <NavigationContainer theme={VaiformNavDarkTheme}>
                  <ToastProvider>
                    <ActiveStorySessionProvider>
                      <RootStackNavigator />
                    </ActiveStorySessionProvider>
                  </ToastProvider>
                </NavigationContainer>
                <StatusBar style="light" />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
