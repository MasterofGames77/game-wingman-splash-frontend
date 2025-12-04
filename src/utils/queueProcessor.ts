/**
 * Queue Processor
 * 
 * Handles processing of queued actions when online.
 * Integrates with Background Sync API.
 */

import { processQueuedActions, getQueueStatus } from './offlineQueue';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Register background sync for queue processing
 */
export const registerBackgroundSync = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    // Check if sync API is available first
    if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check registration exists and is valid
    if (!registration || typeof registration !== 'object') {
      return;
    }
    
    // Check if sync property exists on registration
    if (!('sync' in registration)) {
      return;
    }
    
    // Register sync event
    const syncManager = (registration as any).sync;
    if (syncManager && typeof syncManager.register === 'function') {
      await syncManager.register('process-queue');
      console.log('[Queue Processor] Background sync registered');
    }
  } catch (error) {
    // Completely silent - background sync is optional and not available in all browsers
    // Queue will still process on online event
  }
};

/**
 * Process queue when online
 */
export const processQueueWhenOnline = async (): Promise<void> => {
  if (!navigator.onLine) {
    console.log('[Queue Processor] Offline, cannot process queue');
    return;
  }

  try {
    // Try to process via backend first
    const response = await fetch(`${API_BASE_URL}/api/pwa/queue/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processAll: true,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('[Queue Processor] Backend processed queue:', result);
        
        // Clear completed actions from local queue immediately
        const { clearCompletedActions, getQueueStatus } = await import('./offlineQueue');
        clearCompletedActions();
        
        // Get updated status and notify components
        const status = await getQueueStatus();
        window.dispatchEvent(new CustomEvent('queueStatusUpdated', { detail: status }));
        
        // Notify service worker to clear local queue
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'QUEUE_PROCESSED',
            processed: result.processed || 0,
          });
        }
        return;
      }
    }
  } catch (error) {
    console.warn('[Queue Processor] Backend processing failed, processing locally:', error);
  }

  // Process locally
  const result = await processQueuedActions();
  console.log('[Queue Processor] Processed queue locally:', result);

  // Clear completed actions after processing
  const { clearCompletedActions, getQueueStatus } = await import('./offlineQueue');
  clearCompletedActions();
  
  // Get updated status and notify components
  const status = await getQueueStatus();
  window.dispatchEvent(new CustomEvent('queueStatusUpdated', { detail: status }));

  // Notify service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'QUEUE_PROCESSED',
      processed: result.processed,
      failed: result.failed,
    });
  }
};

/**
 * Setup online/offline event listeners
 */
export const setupQueueProcessor = (): (() => void) => {
  const handleOnline = async () => {
    console.log('[Queue Processor] Online, processing queue...');
    await processQueueWhenOnline();
    
    // Update status immediately after processing and notify components
    const { getQueueStatus } = await import('./offlineQueue');
    const status = await getQueueStatus();
    
    // Notify all components via custom event
    window.dispatchEvent(new CustomEvent('queueStatusUpdated', { detail: status }));
  };

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // Process queue when tab becomes visible and online
      await processQueueWhenOnline();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Process immediately if already online
  if (navigator.onLine) {
    processQueueWhenOnline().then(() => {
      // Update status after processing
      import('./offlineQueue').then(({ getQueueStatus }) => {
        getQueueStatus().then((status) => {
          window.dispatchEvent(new CustomEvent('queueStatusUpdated', { detail: status }));
        });
      });
    });
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

/**
 * Get queue status and update UI
 */
export const updateQueueStatus = async () => {
  const { getQueueStatus } = await import('./offlineQueue');
  return await getQueueStatus();
};
