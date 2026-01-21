import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
import { clearTokenCache } from "@/api/client";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

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
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
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
