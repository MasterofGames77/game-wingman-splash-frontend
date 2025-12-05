"use client";

import React from "react";
import { AuthProvider } from "../context/authContext";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import QueueStatus from "./QueueStatus";
import TokenExchange from "./TokenExchange";

/**
 * Client-side providers wrapper
 * This component wraps all client-side providers and components
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TokenExchange />
      {children}
      <QueueStatus />
      <ServiceWorkerRegistration />
    </AuthProvider>
  );
}

