import { useState, useEffect, useCallback, useMemo } from 'react';
import { WISP_CONFIG } from '@/lib/config';

export type DestroyReason = 'ttl' | 'burn' | 'manual' | 'panic';

export interface SenderHistoryItem {
  id: string; // the rawCode or sessionCode
  type: 'drop' | 'text' | 'clipboard';
  rawCode: string;
  dbLookupCode: string;
  filenames?: string[];
  nameOrSnippet?: string;
  expiresAt: string;
  createdAt: string;
  isDestroyed?: boolean;
  destroyedAt?: string;
  destroyReason?: DestroyReason;
  viewCount?: number;
  downloadCount?: number;
  lastAccessedAt?: string;
}

const STORAGE_KEY = WISP_CONFIG.STORAGE_KEYS.SENDER_HISTORY;
const LEGACY_STORAGE_KEY = 'phantom_sender_history';
const SYNC_CHANNEL_NAME = 'wisp_session_sync';

function readStoredHistory(): SenderHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        stored = legacyStored;
        localStorage.setItem(STORAGE_KEY, legacyStored);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load sender history', e);
  }
  return [];
}

export function useSenderHistory() {
  const [history, setHistory] = useState<SenderHistoryItem[]>(readStoredHistory);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadHistory = useCallback(() => {
    setHistory(readStoredHistory());
  }, []);

  const broadcastSync = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        channel.postMessage({ type: 'SYNC' });
        channel.close();
      }
    } catch {
      // Ignored if BroadcastChannel unsupported
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setIsLoaded(true);
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) {
        setHistory(readStoredHistory());
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = () => loadHistory();
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('storage', handleStorageChange);
      channel?.close();
    };
  }, [loadHistory]);

  const addHistoryItem = useCallback((item: SenderHistoryItem) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p.id !== item.id);
      const next = [{ ...item, viewCount: item.viewCount || 0, downloadCount: item.downloadCount || 0 }, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    broadcastSync();
  }, [broadcastSync]);

  const updateItemStats = useCallback((id: string, stats: { viewCount?: number; downloadCount?: number; isDestroyed?: boolean; destroyReason?: DestroyReason; lastAccessedAt?: string }) => {
    setHistory(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (p.id === id || p.dbLookupCode === id) {
          const nextView = stats.viewCount !== undefined ? stats.viewCount : p.viewCount;
          const nextDownload = stats.downloadCount !== undefined ? stats.downloadCount : p.downloadCount;
          const nextDestroyed = stats.isDestroyed !== undefined ? stats.isDestroyed : p.isDestroyed;
          const nextReason = stats.destroyReason !== undefined ? stats.destroyReason : p.destroyReason;
          const nextLastAccessed = stats.lastAccessedAt || p.lastAccessedAt;

          if (
            nextView !== p.viewCount ||
            nextDownload !== p.downloadCount ||
            nextDestroyed !== p.isDestroyed ||
            nextReason !== p.destroyReason ||
            nextLastAccessed !== p.lastAccessedAt
          ) {
            changed = true;
            return {
              ...p,
              viewCount: nextView,
              downloadCount: nextDownload,
              isDestroyed: nextDestroyed,
              destroyReason: nextReason,
              destroyedAt: nextDestroyed && !p.destroyedAt ? new Date().toISOString() : p.destroyedAt,
              lastAccessedAt: nextLastAccessed,
            };
          }
        }
        return p;
      });

      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      }
      return prev;
    });
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    broadcastSync();
  }, [broadcastSync]);

  const markAsDestroyed = useCallback((id: string, reason: DestroyReason = 'manual') => {
    setHistory(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (p.id === id || p.dbLookupCode === id) {
          if (!p.isDestroyed || (p.destroyReason !== reason && !p.destroyReason)) {
            changed = true;
            return {
              ...p,
              isDestroyed: true,
              destroyedAt: p.destroyedAt || new Date().toISOString(),
              destroyReason: p.destroyReason || reason,
            };
          }
        }
        return p;
      });

      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      }
      return prev;
    });
    broadcastSync();
  }, [broadcastSync]);

  const clearLog = useCallback(() => {
    setHistory(prev => {
      const activeOnly = prev.filter(p => !p.isDestroyed && new Date(p.expiresAt) > new Date());
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeOnly));
      } catch {
        // ignore
      }
      return activeOnly;
    });
    broadcastSync();
  }, [broadcastSync]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
    broadcastSync();
  }, [broadcastSync]);

  const activeItems = useMemo(() => {
    const now = new Date();
    return history.filter(item => !item.isDestroyed && new Date(item.expiresAt) > now);
  }, [history]);

  const logItems = useMemo(() => {
    const now = new Date();
    return history.filter(item => item.isDestroyed || new Date(item.expiresAt) <= now);
  }, [history]);

  return {
    history,
    activeItems,
    logItems,
    isLoaded,
    addHistoryItem,
    updateItemStats,
    removeHistoryItem,
    markAsDestroyed,
    clearLog,
    clearHistory,
  };
}
