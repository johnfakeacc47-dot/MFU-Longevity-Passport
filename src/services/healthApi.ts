import type { LongevityBreakdown } from '../utils/longevityScore';

export const API_URL = import.meta.env.VITE_API_URL as string;

export const isApiConfigured = Boolean(API_URL);

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('authToken');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

// --- Offline-First Sync Logic ---
interface OfflineRequest {
  id: string;
  path: string;
  method: string;
  body: Record<string, unknown>;
  timestamp: number;
}

const getOfflineQueue = (): OfflineRequest[] => {
  try {
    const queue = localStorage.getItem('offlineQueue');
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue: OfflineRequest[]) => {
  localStorage.setItem('offlineQueue', JSON.stringify(queue));
};

const addToOfflineQueue = (path: string, options: RequestInit) => {
  if (options.method !== 'GET' && options.body) {
    const queue = getOfflineQueue();
    queue.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      path,
      method: options.method as string,
      body: JSON.parse(options.body as string),
      timestamp: Date.now(),
    });
    saveOfflineQueue(queue);
    console.log(`[Offline Sync] Added ${options.method} ${path} to offline queue.`);
    
    // Dispatch an event to notify the UI that we're offline and a change is pending sync
    window.dispatchEvent(new CustomEvent('offlineRequestQueued'));
  }
};

let syncInProgress = false;
export const syncOfflineData = async () => {
  if (syncInProgress) return;
  if (!navigator.onLine) return;
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  
  syncInProgress = true;
  console.log(`[Offline Sync] Synchronizing ${queue.length} pending requests...`);
  
  const remainingQueue: OfflineRequest[] = [];
  
  for (const req of queue) {
    try {
      if (!API_URL) continue;
      await fetch(`${API_URL}${req.path}`, {
        method: req.method,
        headers: getHeaders(),
        body: JSON.stringify(req.body),
      });
      console.log(`[Offline Sync] Successfully synced ${req.method} ${req.path}`);
    } catch (error) {
      console.error(`[Offline Sync] Failed to sync ${req.method} ${req.path}`, error);
      remainingQueue.push(req); // Keep in queue for next time
    }
  }
  
  saveOfflineQueue(remainingQueue);
  if (queue.length > remainingQueue.length) {
    window.dispatchEvent(new CustomEvent('offlineDataSynced'));
    // Trigger health data refresh
    window.dispatchEvent(new Event('healthDataUpdated'));
  }
  syncInProgress = false;
};

// Set up listeners for online recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineData);
  // Also try syncing periodically while online
  setInterval(() => {
    if (navigator.onLine && getOfflineQueue().length > 0) {
      syncOfflineData();
    }
  }, 60000); // Check every minute
}
// --------------------------------

export const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  if (!API_URL) {
    throw new Error('API is not configured');
  }

  try {
    console.log(`[API] Making ${options.method || 'GET'} request to ${API_URL}${path}`);
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    });

    console.log(`[API] Response status: ${response.status}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] Error response: ${text}`);
      throw new Error(text || 'Request failed');
    }

    const data = await response.json() as Promise<T>;
    console.log(`[API] Response data:`, data);
    return data;
  } catch (error) {
    // If it's a network error (TypeError due to fetch failing to connect)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn(`[API] Network error. Treating as offline for ${path}`);
      addToOfflineQueue(path, options);
      
      // Return a spoofed successful response for POST/PUT/DELETE
      // GET requests will still fail naturally since we don't have up-to-date data, 
      // but writes should appear to succeed immediately to the UI
      if (options.method && options.method !== 'GET') {
        return { success: true, offlineQueued: true } as T;
      }
    }
    throw error;
  }
};

export const healthApi = {
  logMeal: (payload: {
    name: string;
    portionSize?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    imageUrl?: string | null;
    confidence?: number;
    healthScore?: number;
  }) =>
    request('/health/meals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logActivity: (payload: {
    type: string;
    duration: number;
    intensity?: string;
    caloriesBurned?: number;
  }) =>
    request('/health/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getActivityHistory: (from: string, to: string) =>
    request(`/health/activities/history?from=${from}&to=${to}`),

  logSleep: (payload: {
    bedtime?: string;
    waketime?: string;
    duration?: number;
    quality?: number;
  }) =>
    request('/health/sleep', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSleepHistory: (from: string, to: string) =>
    request(`/health/sleep/history?from=${from}&to=${to}`),

  startFasting: (payload: { protocol?: string; startTime?: string }) =>
    request('/health/fasting/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  stopFasting: () =>
    request('/health/fasting/stop', {
      method: 'POST',
    }),

  getTodayScore: () => request<LongevityBreakdown>('/health/score/today'),
};
