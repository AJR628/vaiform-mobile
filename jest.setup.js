/* eslint-env jest */
/* eslint-disable react/display-name */
/* global jest, beforeEach, afterEach */

global.__DEV__ = false;

process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.test.local";
process.env.EXPO_PUBLIC_FIREBASE_API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "test-api-key";
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN =
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "test.firebaseapp.com";
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "test-project";
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET =
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "test.appspot.com";
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890";
process.env.EXPO_PUBLIC_FIREBASE_APP_ID =
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:test";
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "google-client-id";

require("react-native-gesture-handler/jestSetup");

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: null,
  },
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }) =>
      React.createElement(View, props, children),
  };
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(async (length) =>
    Uint8Array.from({ length }, (_, index) => index + 1),
  ),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(),
}));

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn(() => "vaiform://auth"),
  AuthRequest: jest.fn(function MockAuthRequest() {
    return { promptAsync: jest.fn() };
  }),
  ResponseType: {
    IdToken: "id_token",
  },
}));

jest.mock("expo-av", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ResizeMode: {
      CONTAIN: "contain",
    },
    Video: React.forwardRef((props, ref) =>
      React.createElement(View, {
        ...props,
        ref,
        testID: props.testID || "mock-video",
      }),
    ),
  };
});

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react");
  const { ScrollView } = require("react-native");
  return {
    KeyboardProvider: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    KeyboardAwareScrollView: React.forwardRef((props, ref) =>
      React.createElement(ScrollView, { ...props, ref }, props.children),
    ),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { cleanup } = require("@testing-library/react-native");
const { clearDiagnostics } = require("./client/lib/diagnostics");

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(async () => {
  cleanup();
  clearDiagnostics();
  jest.clearAllMocks();
  if (AsyncStorage.clear) {
    await AsyncStorage.clear();
  }
});
