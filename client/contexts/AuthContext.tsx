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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which UID we've already ensured to avoid duplicate calls
  const ensuredUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);

      // Call ensureUser once per unique UID
      if (firebaseUser && ensuredUidRef.current !== firebaseUser.uid) {
        console.log(`[auth] SIGNED_IN uid=${firebaseUser.uid}`);
        ensuredUidRef.current = firebaseUser.uid;
        try {
          const result = await ensureUser();
          if (result.ok) {
            setUserProfile(result.data);
          } else {
            console.error("[auth] ensureUser failed:", result.code, result.message);
          }
        } catch (err) {
          console.error("[auth] ensureUser error:", err);
        }
      } else if (!firebaseUser) {
        // User signed out
        ensuredUidRef.current = null;
        setUserProfile(null);
      }
    });

    return unsubscribe;
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      const result = await getCredits();
      if (result.ok) {
        setUserProfile((prev) =>
          prev ? { ...prev, credits: result.data.credits } : null
        );
      } else {
        console.error("[auth] refreshCredits failed:", result.code, result.message);
        throw new Error(result.message);
      }
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        if (!GOOGLE_WEB_CLIENT_ID) {
          setError("Google Sign-In is not configured. Please add your Google client IDs.");
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
        } else if (result.type === "cancel") {
          return;
        } else {
          throw new Error("Google sign-in failed");
        }
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError("Google sign-in failed. Please try again.");
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      clearTokenCache();
      ensuredUidRef.current = null;
      setUserProfile(null);
      await firebaseSignOut(auth);
    } catch (err: any) {
      setError("Sign out failed. Please try again.");
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
