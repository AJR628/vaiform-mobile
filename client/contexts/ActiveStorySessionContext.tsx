import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY_PREFIX = "@vaiform/activeStorySessionId:";

interface ActiveStorySessionContextType {
  activeSessionId: string | null;
  isHydrated: boolean;
  setActiveSessionId: (id: string | null) => void;
  clearActiveSessionId: () => void;
}

const ActiveStorySessionContext = createContext<ActiveStorySessionContextType | undefined>(undefined);

interface ActiveStorySessionProviderProps {
  children: ReactNode;
}

export function ActiveStorySessionProvider({ children }: ActiveStorySessionProviderProps) {
  const { user } = useAuth();
  const storageKey = user?.uid ? `${STORAGE_KEY_PREFIX}${user.uid}` : null;
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!storageKey) {
      setActiveSessionIdState(null);
      setIsHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    setIsHydrated(false);
    setActiveSessionIdState(null);

    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (!cancelled) {
          setActiveSessionIdState(stored || null);
          setIsHydrated(true);
        }
      })
      .catch((error) => {
        console.error("[active-session] hydrate failed:", error);
        if (!cancelled) {
          setActiveSessionIdState(null);
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setActiveSessionId = useCallback(
    (id: string | null) => {
      setActiveSessionIdState(id);
      if (!storageKey) return;

      const request = id
        ? AsyncStorage.setItem(storageKey, id)
        : AsyncStorage.removeItem(storageKey);
      request.catch((error) => {
        console.error("[active-session] persist failed:", error);
      });
    },
    [storageKey]
  );

  const clearActiveSessionId = useCallback(() => {
    setActiveSessionIdState(null);
    if (!storageKey) return;
    AsyncStorage.removeItem(storageKey).catch((error) => {
      console.error("[active-session] clear failed:", error);
    });
  }, [storageKey]);

  return (
    <ActiveStorySessionContext.Provider
      value={{
        activeSessionId,
        isHydrated,
        setActiveSessionId,
        clearActiveSessionId,
      }}
    >
      {children}
    </ActiveStorySessionContext.Provider>
  );
}

export function useActiveStorySession() {
  const context = useContext(ActiveStorySessionContext);
  if (context === undefined) {
    throw new Error("useActiveStorySession must be used within an ActiveStorySessionProvider");
  }
  return context;
}