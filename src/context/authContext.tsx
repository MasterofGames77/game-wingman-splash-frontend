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
import { AuthContextType } from "../../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);

  // Check authentication status via API (since we use HTTP-only cookies)
  useEffect(() => {
    // Only run on client side - double check
    if (typeof window === "undefined" || typeof fetch === "undefined") {
      setIsCheckingAuth(false);
      return;
    }

    // Use a small delay to ensure we're fully on the client
    const timeoutId = setTimeout(() => {
      const checkAuth = async () => {
        try {
          // Verify session by calling an auth endpoint
          // The backend will verify the HTTP-only cookie
          const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: "GET",
            credentials: "include", // Include cookies
          });

          if (response.ok) {
            const data = await response.json();
            // Check the authenticated field from the response
            // Splash page returns { authenticated: false } even with 200 OK
            setIsAuthenticated(data.authenticated === true);
            // If backend returns a token (for backward compatibility), store it
            if (data.token) {
              setToken(data.token);
            } else {
              setToken(null);
            }
          } else {
            // Backend returned an error - user is not authenticated
            setIsAuthenticated(false);
            setToken(null);
          }
        } catch (error) {
          // Backend is not available or network error
          // Silently fail - don't show errors if backend is down
          // This is expected when backend is not running
          // Only log in development mode for debugging
          if (process.env.NODE_ENV === "development") {
            // Silently handle - backend may not be running
          }
          setIsAuthenticated(false);
          setToken(null);
        } finally {
          setIsCheckingAuth(false);
        }
      };

      checkAuth();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Memoize the setAuth callback
  // Note: With HTTP-only cookies, we don't store tokens in localStorage
  // This is kept for backward compatibility if needed
  const setAuth = useCallback((newToken: string | null) => {
    setToken(newToken);
    setIsAuthenticated(Boolean(newToken));
    // Re-verify auth status via API
    if (newToken) {
      // If a token is provided, verify it
      fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: "GET",
        credentials: "include",
      })
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            // Check the authenticated field from the response
            setIsAuthenticated(data.authenticated === true);
          } else {
            setIsAuthenticated(false);
            setToken(null);
          }
        })
        .catch(() => {
          setIsAuthenticated(false);
          setToken(null);
        });
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // Memoize the clearAuth callback
  const clearAuth = useCallback(async () => {
    try {
      // Call logout endpoint to clear HTTP-only cookie
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setToken(null);
      setIsAuthenticated(false);
    }
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
