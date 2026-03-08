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
import { clearTokenCache, ensureUser, getCredits, UserProfile } from "@/api/client";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const BOOTSTRAP_ERROR_MESSAGE = "Couldn't finish account setup. Please sign in again.";

function buildProfileFromCredits(
  firebaseUser: User,
  credits: number,
  previousProfile: UserProfile | null,
  emailOverride?: string | null
): UserProfile {
  return {
    uid: firebaseUser.uid,
    email: emailOverride || firebaseUser.email || previousProfile?.email || "",
    plan: previousProfile?.plan || "free",
    isMember: previousProfile?.isMember ?? false,
    subscriptionStatus: previousProfile?.subscriptionStatus ?? null,
    credits,
    freeShortsUsed: previousProfile?.freeShortsUsed ?? 0,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensuredUidRef = useRef<string | null>(null);
  const authChangeIdRef = useRef(0);
  const userProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const authChangeId = ++authChangeIdRef.current;
      const isStale = () => authChangeId !== authChangeIdRef.current;

      if (!firebaseUser) {
        ensuredUidRef.current = null;
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      if (ensuredUidRef.current === firebaseUser.uid && userProfileRef.current) {
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
          await failBootstrap(
            "[auth] ensureUser failed",
            result.requestId,
            `${result.code} ${result.message}`
          );
          return;
        }

        ensuredUidRef.current = firebaseUser.uid;
        setUser(firebaseUser);
        setUserProfile(result.data);
        setIsLoading(false);
      } catch (err) {
        if (isStale()) return;
        const detail = err instanceof Error ? err.message : "Unknown error";
        await failBootstrap("[auth] ensureUser error", null, detail);
      }
    });

    return () => {
      authChangeIdRef.current += 1;
      unsubscribe();
    };
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      const result = await getCredits();
      if (result.ok) {
        setUserProfile((prev) =>
          prev
            ? { ...prev, credits: result.data.credits }
            : buildProfileFromCredits(user, result.data.credits, null, result.data.email)
        );
        return;
      }

      const requestIdSuffix = result.requestId ? ` requestId=${result.requestId}` : "";
      console.error(
        `[auth] refreshCredits failed${requestIdSuffix}: ${result.code} ${result.message}`
      );
      throw new Error(result.message);
    } catch (err) {
      console.error("[auth] refreshCredits error:", err);
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
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        refreshCredits,
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