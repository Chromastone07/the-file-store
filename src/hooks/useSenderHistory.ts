import { useState, useEffect } from 'react';

export interface SenderHistoryItem {
  id: string; // the rawCode or sessionCode
  type: 'drop' | 'text' | 'clipboard';
  rawCode: string;
  dbLookupCode: string;
  filenames?: string[];
  expiresAt: string;
  createdAt: string;
  isDestroyed?: boolean;
  destroyedAt?: string;
}

const STORAGE_KEY = 'phantom_sender_history';

export function useSenderHistory() {
  const [history, setHistory] = useState<SenderHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SenderHistoryItem[] = JSON.parse(stored);
        // Keep all items (including expired) so manage page can show full history
        setHistory(parsed);
      }
    } catch (e) {
      console.error('Failed to load sender history', e);
    }
  };

  useEffect(() => {
    loadHistory();
    setIsLoaded(true);

    // Listen to cross-tab localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadHistory();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addHistoryItem = (item: SenderHistoryItem) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p.id !== item.id);
      const next = [item, ...filtered];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTimeout(() => window.dispatchEvent(new Event('phantom_history_changed')), 0);
  };

  const removeHistoryItem = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTimeout(() => window.dispatchEvent(new Event('phantom_history_changed')), 0);
  };

  const markAsDestroyed = (id: string) => {
    setHistory(prev => {
      const next = prev.map(p => p.id === id ? { ...p, isDestroyed: true, destroyedAt: new Date().toISOString() } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTimeout(() => window.dispatchEvent(new Event('phantom_history_changed')), 0);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('phantom_history_changed'));
  };

  // Listen to same-window custom events
  useEffect(() => {
    const handleCustomChange = () => loadHistory();
    window.addEventListener('phantom_history_changed', handleCustomChange);
    return () => window.removeEventListener('phantom_history_changed', handleCustomChange);
  }, []);

  return { history, isLoaded, addHistoryItem, removeHistoryItem, markAsDestroyed, clearHistory };
}
