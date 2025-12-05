"use client";

import { useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Component that handles token exchange when navigating from splash page
 * Detects token in URL params and exchanges it for a session cookie
 * Safe implementation that doesn't depend on auth context
 */
export default function TokenExchange() {
  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const handleTokenExchange = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const userId = urlParams.get("userId");
        const email = urlParams.get("email");
        const earlyAccess = urlParams.get("earlyAccess");

        if (token && earlyAccess === "true") {
          const response = await fetch(
            `${API_BASE_URL}/api/auth/exchange-token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include", // IMPORTANT: Include cookies
              body: JSON.stringify({ token, userId, email }),
            }
          );

          if (response.ok) {
            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            url.searchParams.delete("userId");
            url.searchParams.delete("email");
            url.searchParams.delete("earlyAccess");
            window.history.replaceState({}, "", url.toString());

            // Refresh page to ensure all auth state is updated
            // The session cookie is now set, so the page reload will pick it up
            window.location.reload();
          } else {
            // Remove invalid token from URL even on failure
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            url.searchParams.delete("userId");
            url.searchParams.delete("email");
            url.searchParams.delete("earlyAccess");
            window.history.replaceState({}, "", url.toString());
            console.error("Token exchange failed:", response.statusText);
          }
        }
      } catch (error) {
        console.error("Token exchange error:", error);
        // Don't crash - just log and continue
        // Remove token from URL on error
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        url.searchParams.delete("userId");
        url.searchParams.delete("email");
        url.searchParams.delete("earlyAccess");
        window.history.replaceState({}, "", url.toString());
      }
    };

    handleTokenExchange();
  }, []);

  // This component doesn't render anything
  return null;
}
