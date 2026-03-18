import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

import { auth } from "@/lib/firebase";
import {
  clearTokenCache,
  ensureUser,
  getUsage,
  UserProfile,
  UsageSnapshot,
} from "@/api/client";
import {
  enrichFailureDiagnostic,
  recordClientDiagnostic,
} from "@/lib/diagnostics";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  usageSnapshot: UsageSnapshot | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const BOOTSTRAP_ERROR_MESSAGE = "Couldn't finish account setup. Please sign in again.";

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensuredUidRef = useRef<string | null>(null);
  const authChangeIdRef = useRef(0);
  const userProfileRef = useRef<UserProfile | null>(null);
  const usageSnapshotRef = useRef<UsageSnapshot | null>(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    usageSnapshotRef.current = usageSnapshot;
  }, [usageSnapshot]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const authChangeId = ++authChangeIdRef.current;
      const isStale = () => authChangeId !== authChangeIdRef.current;

      if (!firebaseUser) {
        ensuredUidRef.current = null;
        setUser(null);
        setUserProfile(null);
        setUsageSnapshot(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      if (
        ensuredUidRef.current === firebaseUser.uid &&
        userProfileRef.current &&
        usageSnapshotRef.current
      ) {
        setUser(firebaseUser);
        setIsLoading(false);
        return;
      }

      const failBootstrap = async (
        logLabel: string,
        requestId: string | null | undefined,
        detail: string
      ) => {
        if (isStale()) return;
        const requestIdSuffix = requestId ? ` requestId=${requestId}` : "";
        console.error(`${logLabel}${requestIdSuffix}: ${detail}`);
        clearTokenCache();
        ensuredUidRef.current = null;
        setUser(null);
        setUserProfile(null);
        setUsageSnapshot(null);
        setError(BOOTSTRAP_ERROR_MESSAGE);
        try {
          await firebaseSignOut(auth);
        } catch (signOutError) {
          console.error("[auth] bootstrap signOut failed:", signOutError);
        }
        if (!isStale()) {
          setIsLoading(false);
        }
      };

      try {
        const result = await ensureUser();
        if (isStale()) return;

        if (!result.ok) {
          enrichFailureDiagnostic(
            {
              route: "/api/users/ensure",
              requestId: result.requestId,
              status: result.status,
              code: result.code,
            },
            {
              uid: firebaseUser.uid,
              authChangeId,
              stage: "ensureUser",
            }
          );
          await failBootstrap(
            "[auth] ensureUser failed",
            result.requestId,
            `${result.code} ${result.message}`
          );
          return;
        }

        const usageResult = await getUsage();
        if (isStale()) return;

        if (!usageResult.ok) {
          enrichFailureDiagnostic(
            {
              route: "/api/usage",
              requestId: usageResult.requestId,
              status: usageResult.status,
              code: usageResult.code,
            },
            {
              uid: firebaseUser.uid,
              authChangeId,
              stage: "getUsage",
            }
          );
          await failBootstrap(
            "[auth] getUsage failed",
            usageResult.requestId,
            `${usageResult.code} ${usageResult.message}`
          );
          return;
        }

        ensuredUidRef.current = firebaseUser.uid;
        setUser(firebaseUser);
        setUserProfile(result.data);
        setUsageSnapshot(usageResult.data);
        setIsLoading(false);
      } catch (err) {
        if (isStale()) return;
        const detail = err instanceof Error ? err.message : "Unknown error";
        recordClientDiagnostic({
          route: "auth.bootstrap",
          code: "BOOTSTRAP_EXCEPTION",
          message: detail,
          context: {
            uid: firebaseUser.uid,
            authChangeId,
          },
        });
        await failBootstrap("[auth] ensureUser/getUsage error", null, detail);
      }
    });

    return () => {
      authChangeIdRef.current += 1;
      unsubscribe();
    };
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    try {
      const result = await getUsage();
      if (result.ok) {
        setUsageSnapshot(result.data);
        return;
      }
      enrichFailureDiagnostic(
        {
          route: "/api/usage",
          requestId: result.requestId,
          status: result.status,
          code: result.code,
        },
        {
          uid: user.uid,
          stage: "refreshUsage",
        }
      );

      const requestIdSuffix = result.requestId ? ` requestId=${result.requestId}` : "";
      console.error(
        `[auth] refreshUsage failed${requestIdSuffix}: ${result.code} ${result.message}`
      );
      throw new Error(result.message);
    } catch (err) {
      console.error("[auth] refreshUsage error:", err);
      throw err;
    }
  }, [user]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
      setIsLoading(false);
      throw err;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
      setIsLoading(false);
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return;
      }

      if (!GOOGLE_WEB_CLIENT_ID) {
        setError("Google Sign-In is not configured. Please add your Google client IDs.");
        setIsLoading(false);
        return;
      }

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: "vaiform",
      });

      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
      };

      const authRequest = new AuthSession.AuthRequest({
        clientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
      });

      const result = await authRequest.promptAsync(discovery);

      if (result.type === "success" && result.params.id_token) {
        const credential = GoogleAuthProvider.credential(result.params.id_token);
        await signInWithCredential(auth, credential);
        return;
      }

      if (result.type === "cancel") {
        setIsLoading(false);
        return;
      }

      throw new Error("Google sign-in failed");
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError("Google sign-in failed. Please try again.");
      setIsLoading(false);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      clearTokenCache();
      ensuredUidRef.current = null;
      setUsageSnapshot(null);
      await firebaseSignOut(auth);
    } catch (err: any) {
      setError("Sign out failed. Please try again.");
      setIsLoading(false);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        usageSnapshot,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        refreshUsage,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection.";
    case "auth/invalid-credential":
      return "Invalid email or password.";
    default:
      return "An error occurred. Please try again.";
  }
}
