"use client";

import { useEffect } from "react";
import {
  setupQueueProcessor,
  registerBackgroundSync,
} from "../utils/queueProcessor";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
      // Note: In development, service workers work but may have limitations
      // For production, ensure process.env.NODE_ENV === "production"
    ) {
      // Register service worker
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log(
            "[Service Worker] Registration successful:",
            registration.scope
          );

          // Setup queue processor
          setupQueueProcessor();

          // Register background sync (optional - not all browsers support it)
          registerBackgroundSync().catch(() => {
            // Silently handle - background sync is optional
            // Queue will still process on online event
          });

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Handle service worker updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  console.log(
                    "[Service Worker] New version available. Reload to update."
                  );
                  // Optionally show a notification to the user
                  if (
                    confirm("A new version is available. Reload to update?")
                  ) {
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[Service Worker] Registration failed:", error);
        });

      // Handle service worker controller change (when new SW takes over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
