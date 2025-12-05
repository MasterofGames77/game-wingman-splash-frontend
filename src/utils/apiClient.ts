/**
 * API Client with Offline Queue Support
 * 
 * Axios interceptor that automatically queues requests when offline.
 */

import axios from 'axios';
import { queueAction } from './offlineQueue';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT: Include cookies (HTTP-only cookies) with all requests
});

// Methods that should be queued when offline
const QUEUEABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Extract user ID from request data or headers
 */
const extractUserId = (config: any): string | undefined => {
  // Try to get from request data
  if (config.data && typeof config.data === 'object') {
    if (config.data.userId) return config.data.userId;
  }
  
  // Try to get from headers
  if (config.headers && config.headers['X-User-Id']) {
    return config.headers['X-User-Id'] as string;
  }
  
  return undefined;
};

/**
 * Request interceptor - queue requests when offline
 */
apiClient.interceptors.request.use(
  (config) => {
    // Only queue non-GET requests
    if (config.method && QUEUEABLE_METHODS.includes(config.method.toUpperCase())) {
      // Check if offline
      if (!navigator.onLine) {
        const method = config.method.toUpperCase();
        const endpoint = config.url 
          ? (config.baseURL ? `${config.baseURL}${config.url}` : config.url)
          : '';
        const userId = extractUserId(config);
        
        // Determine action type from endpoint
        let action = 'unknown';
        if (endpoint.includes('/forum-posts')) {
          if (method === 'POST') action = 'create_post';
          else if (method === 'PUT' || method === 'PATCH') action = 'update_post';
          else if (method === 'DELETE') action = 'delete_post';
        } else if (endpoint.includes('/like')) {
          action = 'like_post';
        } else if (endpoint.includes('/upload-image')) {
          action = 'upload_image';
        } else if (endpoint.includes('/signup')) {
          action = 'signup';
        }
        
        // Skip queuing for FormData (file uploads) - they're too large
        if (config.data instanceof FormData) {
          // Let the request fail normally for file uploads
          return config;
        }

        // Queue the action (fire and forget)
        queueAction(
          action,
          endpoint,
          method,
          config.data,
          config.headers as Record<string, string>,
          userId
        ).catch((err) => {
          console.error('[API Client] Failed to queue action:', err);
        });
        
        // Throw error to prevent the actual request
        const error: any = new Error('Request queued for offline processing');
        error.code = 'OFFLINE_QUEUED';
        error.config = config;
        throw error;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handle offline errors gracefully
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: any) => {
    // Handle queued requests
    if (error.code === 'OFFLINE_QUEUED') {
      // Return a special response indicating the request was queued
      return Promise.resolve({
        data: {
          success: false,
          queued: true,
          message: 'Request queued for processing when online',
        },
        status: 202,
        statusText: 'Accepted',
        headers: {},
        config: error.config || {},
      });
    }
    
    // Handle network errors
    if (!navigator.onLine || error.code === 'ERR_NETWORK') {
      // If it's a queueable request, it should have been caught by the request interceptor
      // But handle it here as a fallback
      if (error.config && error.config.method && QUEUEABLE_METHODS.includes(error.config.method.toUpperCase())) {
        const method = error.config.method.toUpperCase();
        const endpoint = error.config.url 
          ? (error.config.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config.url)
          : '';
        const userId = extractUserId(error.config);
        
        let action = 'unknown';
        if (endpoint.includes('/forum-posts')) {
          if (method === 'POST') action = 'create_post';
          else if (method === 'PUT' || method === 'PATCH') action = 'update_post';
          else if (method === 'DELETE') action = 'delete_post';
        } else if (endpoint.includes('/like')) {
          action = 'like_post';
        }
        
        queueAction(
          action,
          endpoint,
          method,
          error.config.data,
          error.config.headers as Record<string, string>,
          userId
        ).catch((queueError) => {
          console.error('[API Client] Failed to queue action:', queueError);
        });
        
        return Promise.resolve({
          data: {
            success: false,
            queued: true,
            message: 'Request queued for processing when online',
          },
          status: 202,
          statusText: 'Accepted',
          headers: {},
          config: error.config,
        });
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
