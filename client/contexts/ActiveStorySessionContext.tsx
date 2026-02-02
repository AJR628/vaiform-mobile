import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@vaiform/activeStorySessionId";

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
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!cancelled) {
        setActiveSessionIdState(stored || null);
        setIsHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
    if (id) {
      AsyncStorage.setItem(STORAGE_KEY, id);
    } else {
      AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearActiveSessionId = useCallback(() => {
    setActiveSessionIdState(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

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
