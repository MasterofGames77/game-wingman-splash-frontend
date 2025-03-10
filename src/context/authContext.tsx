"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
} from "react";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string | null) => void;
  clearAuth: () => void;
}

const AUTH_TOKEN_KEY = "auth_token";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
  });

  // Memoize the isAuthenticated value
  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  // Memoize the setAuth callback
  const setAuth = useCallback((newToken: string | null) => {
    setToken(newToken);
    if (typeof window !== "undefined") {
      if (newToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, newToken);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
  }, []);

  // Memoize the clearAuth callback
  const clearAuth = useCallback(() => {
    setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  // Handle storage events for multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_KEY) {
        setToken(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Memoize the context value
  const contextValue = useMemo(
    () => ({
      token,
      isAuthenticated,
      setAuth,
      clearAuth,
    }),
    [token, isAuthenticated, setAuth, clearAuth]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
