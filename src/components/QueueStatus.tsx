"use client";

import React from "react";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

/**
 * Queue Status Component
 * Shows pending actions in the offline queue
 */
const QueueStatus: React.FC = () => {
  const { queueStatus, isOnline } = useOfflineQueue();

  // Don't show if no pending actions
  if (queueStatus.pending === 0 && queueStatus.processing === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        backgroundColor: isOnline ? "#4CAF50" : "#FF9800",
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        zIndex: 1000,
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "300px",
      }}
    >
      <span style={{ fontSize: "18px" }}>{isOnline ? "🟢" : "🟠"}</span>
      <div>
        {!isOnline && (
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Offline</div>
        )}
        {queueStatus.processing > 0 && (
          <div>
            Processing {queueStatus.processing} action
            {queueStatus.processing !== 1 ? "s" : ""}...
          </div>
        )}
        {queueStatus.pending > 0 && (
          <div>
            {queueStatus.pending} action{queueStatus.pending !== 1 ? "s" : ""}{" "}
            queued
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueStatus;
