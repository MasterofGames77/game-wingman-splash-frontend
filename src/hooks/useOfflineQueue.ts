/**
 * React Hook for Offline Queue Management
 */

import { useState, useEffect, useCallback } from 'react';
import { getQueueStatus, QueueStatus, clearCompletedActions, cleanupStaleActions, getQueuedActions, clearAllActions } from '../utils/offlineQueue';
import { setupQueueProcessor, registerBackgroundSync } from '../utils/queueProcessor';

export const useOfflineQueue = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  // Update queue status
  const updateStatus = useCallback(async () => {
    const status = await getQueueStatus();
    setQueueStatus(status);
  }, []);

  // Setup queue processor and event listeners
  useEffect(() => {
    // Setup online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup queue processor
    const cleanup = setupQueueProcessor();

    // Register background sync (optional - not all browsers support it)
    // Completely silent - don't log errors as this is expected in many browsers
    registerBackgroundSync().catch(() => {
      // Background sync is optional and not available in all browsers
      // Queue will still process on online event, so this is not an error
    });

    // Clean up old completed actions and stale pending actions on initialization
    clearCompletedActions();
    cleanupStaleActions();
    
    // If online, be aggressive about clearing stale actions
    // When online, any local pending actions are likely stale (should have been processed)
    if (navigator.onLine) {
      const localActions = getQueuedActions();
      const hasPending = localActions.some((a) => a.status === 'pending' || a.status === 'processing');
      
      // If we have pending actions when online, they're likely stale
      // Clear them immediately to prevent false notifications
      // This handles cases where service worker was unregistered or backend check will fail
      if (hasPending) {
        clearAllActions();
      }
    }
    
    // Initial status update (after cleanup to show clean state)
    updateStatus();
    
    // If online, verify with backend and clear any remaining stale local actions
    // Use a small delay to ensure service worker is ready if it exists
    if (navigator.onLine) {
      const verifyWithBackend = async () => {
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          
          // Create abort controller for timeout (more compatible than AbortSignal.timeout)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch(`${API_BASE_URL}/api/pwa/queue/status`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.pending === 0 && result.processing === 0) {
              // Backend says no pending actions - clear all local actions (they're stale)
              const { clearAllActions, getQueueStatus } = await import('../utils/offlineQueue');
              clearAllActions();
              // Update status after clearing
              const status = await getQueueStatus();
              setQueueStatus(status);
              return;
            }
          }
        } catch (error: any) {
          // If backend check fails when online, local actions are likely stale
          // Clear them to prevent false notifications
          // This can happen when service worker is unregistered or backend is temporarily unavailable
          if (navigator.onLine) {
            const { clearAllActions, getQueueStatus, getQueuedActions } = await import('../utils/offlineQueue');
            const localActions = getQueuedActions();
            const hasPending = localActions.some((a) => a.status === 'pending' || a.status === 'processing');
            
            // If we have pending actions but backend check failed, they're likely stale
            // Clear them to prevent false notifications
            if (hasPending) {
              clearAllActions();
              const status = await getQueueStatus();
              setQueueStatus(status);
            }
          }
        }
      };
      
      // Delay backend check slightly to allow service worker to initialize
      setTimeout(verifyWithBackend, 500);
    }
    
    // Also update status after a short delay to catch any processing that happened
    const initialDelayTimeout = setTimeout(() => {
      updateStatus();
    }, 2000);

    // Update status periodically
    const statusInterval = setInterval(updateStatus, 5000); // Every 5 seconds

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'QUEUE_PROCESSED') {
        updateStatus();
      }
    };

    // Listen for queue status updates from queue processor
    const handleQueueStatusUpdate = (event: Event) => {
      // Use the status from the event if available, otherwise fetch
      const customEvent = event as CustomEvent<QueueStatus>;
      if (customEvent.detail) {
        setQueueStatus(customEvent.detail);
      } else {
        updateStatus();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
    
    window.addEventListener('queueStatusUpdated', handleQueueStatusUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('queueStatusUpdated', handleQueueStatusUpdate);
      cleanup();
      clearInterval(statusInterval);
      clearTimeout(initialDelayTimeout);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [updateStatus]);

  return {
    queueStatus,
    isOnline,
    updateStatus,
  };
};
