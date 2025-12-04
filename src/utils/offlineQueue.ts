/**
 * Offline Queue Utility
 * 
 * Queues actions when offline and processes them when online.
 * Integrates with backend /api/pwa/queue endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const QUEUE_STORAGE_KEY = "pwa_offline_queue";
const MAX_QUEUE_SIZE = 100;

export interface QueuedAction {
  id: string;
  action: string; // 'create', 'update', 'delete', 'like', etc.
  endpoint: string; // Full URL or path
  method: string; // 'POST', 'PUT', 'DELETE', etc.
  data: any; // Request body
  headers?: Record<string, string>;
  userId?: string;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Get all queued actions from storage
 */
export const getQueuedActions = (): QueuedAction[] => {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("[Offline Queue] Error reading queue:", error);
    return [];
  }
};

/**
 * Save queued actions to storage
 */
const saveQueuedActions = (actions: QueuedAction[]): void => {
  if (typeof window === "undefined") return;
  
  try {
    // Limit queue size
    const limitedActions = actions.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(limitedActions));
  } catch (error) {
    console.error("[Offline Queue] Error saving queue:", error);
  }
};

/**
 * Generate a unique ID for a queued action
 */
const generateActionId = (): string => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a hash for duplicate detection
 */
const createActionHash = (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries' | 'status'>): string => {
  return `${action.method}_${action.endpoint}_${JSON.stringify(action.data)}`;
};

/**
 * Queue an action for offline processing
 */
export const queueAction = async (
  action: string,
  endpoint: string,
  method: string,
  data: any,
  headers?: Record<string, string>,
  userId?: string
): Promise<QueuedAction> => {
  // Check if online - if so, try to send directly
  if (navigator.onLine) {
    try {
      // Try to send the request directly
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify(data) : undefined,
      });

      if (response.ok) {
        // Request succeeded, no need to queue
        return {
          id: generateActionId(),
          action,
          endpoint,
          method,
          data,
          headers,
          userId,
          timestamp: Date.now(),
          retries: 0,
          status: 'completed',
        };
      }
    } catch (error) {
      // Network error, will queue below
      console.log("[Offline Queue] Network error, queuing action:", error);
    }
  }

  // Create queued action
  const queuedAction: QueuedAction = {
    id: generateActionId(),
    action,
    endpoint,
    method,
    data,
    headers,
    userId,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  // Check for duplicates
  const existingActions = getQueuedActions();
  const actionHash = createActionHash(queuedAction);
  const isDuplicate = existingActions.some(
    (existing) => createActionHash(existing) === actionHash && existing.status === 'pending'
  );

  if (isDuplicate) {
    console.log("[Offline Queue] Duplicate action detected, skipping:", actionHash);
    return queuedAction;
  }

  // Add to queue
  existingActions.push(queuedAction);
  saveQueuedActions(existingActions);

  // Send to backend queue endpoint if online (for backend tracking)
  if (navigator.onLine) {
    try {
      await fetch(`${API_BASE_URL}/api/pwa/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          endpoint,
          method,
          data,
          userId,
        }),
      });
    } catch (error) {
      console.warn("[Offline Queue] Failed to sync with backend queue:", error);
      // Continue anyway - action is stored locally
    }
  }

  console.log("[Offline Queue] Action queued:", queuedAction.id);
  return queuedAction;
};

/**
 * Process a single queued action
 */
export const processQueuedAction = async (action: QueuedAction): Promise<boolean> => {
  if (!navigator.onLine) {
    console.log("[Offline Queue] Cannot process action, offline:", action.id);
    return false;
  }

  // Update status to processing
  const allActions = getQueuedActions();
  const actionIndex = allActions.findIndex((a) => a.id === action.id);
  if (actionIndex === -1) {
    console.warn("[Offline Queue] Action not found:", action.id);
    return false;
  }

  allActions[actionIndex].status = 'processing';
  saveQueuedActions(allActions);

  try {
    // Try to execute the action
    const response = await fetch(action.endpoint, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers,
      },
      body: action.method !== 'GET' ? JSON.stringify(action.data) : undefined,
    });

    if (response.ok) {
      // Success - mark as completed
      allActions[actionIndex].status = 'completed';
      saveQueuedActions(allActions);
      console.log("[Offline Queue] Action processed successfully:", action.id);
      return true;
    } else {
      // Failed - increment retries
      allActions[actionIndex].retries += 1;
      if (allActions[actionIndex].retries >= 3) {
        allActions[actionIndex].status = 'failed';
        console.error("[Offline Queue] Action failed after 3 retries:", action.id);
      } else {
        allActions[actionIndex].status = 'pending';
        console.warn("[Offline Queue] Action failed, will retry:", action.id);
      }
      saveQueuedActions(allActions);
      return false;
    }
  } catch (error) {
    // Network error - reset to pending for retry
    allActions[actionIndex].retries += 1;
    if (allActions[actionIndex].retries >= 3) {
      allActions[actionIndex].status = 'failed';
      console.error("[Offline Queue] Action failed after 3 retries:", action.id);
    } else {
      allActions[actionIndex].status = 'pending';
      console.warn("[Offline Queue] Network error, will retry:", action.id);
    }
    saveQueuedActions(allActions);
    return false;
  }
};

/**
 * Process all pending queued actions
 */
export const processQueuedActions = async (): Promise<{ processed: number; failed: number }> => {
  if (!navigator.onLine) {
    console.log("[Offline Queue] Cannot process queue, offline");
    return { processed: 0, failed: 0 };
  }

  const allActions = getQueuedActions();
  const pendingActions = allActions.filter((a) => a.status === 'pending');

  if (pendingActions.length === 0) {
    return { processed: 0, failed: 0 };
  }

  console.log(`[Offline Queue] Processing ${pendingActions.length} queued actions`);

  // Try to process via backend first (if available)
  try {
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
        // Backend processed successfully - clear local queue
        const remainingActions = allActions.filter(
          (a) => a.status !== 'completed' && a.status !== 'processing'
        );
        saveQueuedActions(remainingActions);
        return { processed: result.processed || pendingActions.length, failed: 0 };
      }
    }
  } catch (error) {
    console.warn("[Offline Queue] Backend processing failed, processing locally:", error);
  }

  // Process locally
  let processed = 0;
  let failed = 0;

  for (const action of pendingActions) {
    const success = await processQueuedAction(action);
    if (success) {
      processed++;
    } else if (action.status === 'failed') {
      failed++;
    }
  }

  // Clean up completed and failed actions immediately (don't keep them for 24 hours)
  // Only keep pending and processing actions
  const cleanedActions = allActions.filter(
    (a) => a.status === 'pending' || a.status === 'processing'
  );
  saveQueuedActions(cleanedActions);

  return { processed, failed };
};

/**
 * Get queue status
 */
export const getQueueStatus = async (): Promise<QueueStatus> => {
  const allActions = getQueuedActions();

  // Also try to get status from backend
  if (navigator.onLine) {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${API_BASE_URL}/api/pwa/queue/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // If backend says no pending actions, clear ALL local actions (they're stale)
          if (result.pending === 0 && result.processing === 0) {
            // Backend is source of truth - if it says no pending, clear everything local
            const localPending = allActions.filter((a) => a.status === 'pending' || a.status === 'processing');
            if (localPending.length > 0) {
              // Backend says no pending, but we have local pending - they're stale, clear them
              clearAllActions();
            } else {
              // Just clear completed/failed
              clearCompletedActions();
            }
            cleanupStaleActions();
          }
          
          // Return backend status (it's the source of truth)
          return {
            total: result.total || 0,
            pending: result.pending || 0,
            processing: result.processing || 0,
            completed: 0, // Don't show completed in status
            failed: 0, // Don't show failed in status
          };
        }
      }
    } catch (error: any) {
      // If backend check fails when online, local pending actions might be stale
      // But we can't clear them here because this function is called from multiple places
      // The hook's initialization will handle clearing stale actions
      // Silently fail - will use local status instead
    }
  }

  // Clean up stale actions before counting
  cleanupStaleActions();
  
  // Re-fetch after cleanup
  const cleanedActions = getQueuedActions();
  
  // If online, try to sync with backend to verify actions are still valid
  // (This helps catch cases where actions were processed but localStorage wasn't cleared)
  if (navigator.onLine && cleanedActions.length > 0) {
    // Check if we have pending actions but backend might have already processed them
    const hasPending = cleanedActions.some((a) => a.status === 'pending' || a.status === 'processing');
    if (hasPending) {
      // Quick check: if we're online and have pending actions, they might be stale
      // We'll verify with backend in the next status check
      // For now, just return the local count
    }
  }
  
  // Return local status (only count pending and processing, not completed/failed)
  const pendingActions = cleanedActions.filter((a) => a.status === 'pending');
  const processingActions = cleanedActions.filter((a) => a.status === 'processing');
  
  return {
    total: pendingActions.length + processingActions.length,
    pending: pendingActions.length,
    processing: processingActions.length,
    completed: 0, // Don't show completed in status
    failed: 0, // Don't show failed in status
  };
};

/**
 * Clear completed actions from queue
 */
export const clearCompletedActions = (): void => {
  const allActions = getQueuedActions();
  const activeActions = allActions.filter(
    (a) => a.status !== 'completed' && a.status !== 'failed'
  );
  saveQueuedActions(activeActions);
};

/**
 * Clean up stale actions (pending actions older than 7 days)
 */
export const cleanupStaleActions = (): void => {
  const allActions = getQueuedActions();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  // Remove actions that are:
  // 1. Completed or failed (always remove)
  // 2. Pending but older than 7 days (stale)
  const validActions = allActions.filter((a) => {
    if (a.status === 'completed' || a.status === 'failed') {
      return false;
    }
    // Remove pending actions older than 7 days
    if (a.status === 'pending' && a.timestamp < sevenDaysAgo) {
      return false;
    }
    return true;
  });
  
  if (validActions.length !== allActions.length) {
    saveQueuedActions(validActions);
    console.log(`[Offline Queue] Cleaned up ${allActions.length - validActions.length} stale actions`);
  }
};

/**
 * Clear all actions from queue
 */
export const clearAllActions = (): void => {
  saveQueuedActions([]);
};
