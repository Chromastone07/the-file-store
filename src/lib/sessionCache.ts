// Phantom - Client-Side Session Cache Engine
// Persists decrypted non-burn-after-reading drops & notes in origin-private IndexedDB
// Ensures files and notes remain accessible when receivers close the browser or switch apps

interface CachedDropFile {
  sessionId: string;
  index: number;
  buffer: ArrayBuffer;
  filename: string;
  fileType: string;
  textContent?: string;
  expiresAt: string;
  burnAfterReading: boolean;
  savedAt: number;
}

interface CachedTextSession {
  sessionId: string;
  title: string;
  text: string;
  expiresAt: string;
  burnAfterReading: boolean;
  savedAt: number;
}

const DB_NAME = 'phantom_session_vault';
const DB_VERSION = 1;
const STORE_FILES = 'decrypted_files';
const STORE_TEXTS = 'decrypted_texts';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES, { keyPath: ['sessionId', 'index'] });
        }
        if (!db.objectStoreNames.contains(STORE_TEXTS)) {
          db.createObjectStore(STORE_TEXTS, { keyPath: 'sessionId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('Phantom session cache: IndexedDB unavailable');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export const sessionCache = {
  /**
   * Save a decrypted drop file to IndexedDB (only if burnAfterReading is false)
   */
  async saveDropFile(
    sessionId: string,
    index: number,
    buffer: ArrayBuffer,
    filename: string,
    fileType: string,
    textContent: string,
    expiresAt: string,
    burnAfterReading: boolean
  ): Promise<void> {
    if (burnAfterReading) return; // Zero-trace for burn after reading

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const record: CachedDropFile = {
          sessionId,
          index,
          buffer,
          filename,
          fileType,
          textContent,
          expiresAt,
          burnAfterReading,
          savedAt: Date.now(),
        };
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Retrieve all cached files for a drop session
   */
  async getDropFiles(sessionId: string): Promise<CachedDropFile[]> {
    const db = await openDatabase();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.getAll();

        request.onsuccess = () => {
          const now = Date.now();
          const items: CachedDropFile[] = (request.result || [])
            .filter((item: CachedDropFile) => {
              if (item.sessionId !== sessionId) return false;
              if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
              return true;
            })
            .sort((a: CachedDropFile, b: CachedDropFile) => a.index - b.index);
          resolve(items);
        };
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  /**
   * Save a decrypted text session to IndexedDB (only if burnAfterReading is false)
   */
  async saveText(
    sessionId: string,
    title: string,
    text: string,
    expiresAt: string,
    burnAfterReading: boolean
  ): Promise<void> {
    if (burnAfterReading) return; // Zero-trace for burn after reading

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TEXTS, 'readwrite');
        const store = tx.objectStore(STORE_TEXTS);
        const record: CachedTextSession = {
          sessionId,
          title,
          text,
          expiresAt,
          burnAfterReading,
          savedAt: Date.now(),
        };
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Retrieve all valid cached text sessions
   */
  async getAllCachedTexts(): Promise<CachedTextSession[]> {
    const db = await openDatabase();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TEXTS, 'readonly');
        const store = tx.objectStore(STORE_TEXTS);
        const request = store.getAll();

        request.onsuccess = () => {
          const now = Date.now();
          const items: CachedTextSession[] = (request.result || []).filter((item: CachedTextSession) => {
            if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
            return true;
          });
          resolve(items);
        };
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  /**
   * Retrieve all valid cached drop sessions (grouped by sessionId)
   */
  async getAllCachedDrops(): Promise<Record<string, CachedDropFile[]>> {
    const db = await openDatabase();
    if (!db) return {};

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.getAll();

        request.onsuccess = () => {
          const now = Date.now();
          const groups: Record<string, CachedDropFile[]> = {};
          (request.result || []).forEach((item: CachedDropFile) => {
            if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return;
            if (!groups[item.sessionId]) groups[item.sessionId] = [];
            groups[item.sessionId].push(item);
          });
          // Sort items in each group by index
          Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.index - b.index);
          });
          resolve(groups);
        };
        request.onerror = () => resolve({});
      } catch {
        resolve({});
      }
    });
  },

  /**
   * Remove a specific session (files and text) from IndexedDB
   */
  async removeSession(sessionId: string): Promise<void> {
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_FILES, STORE_TEXTS], 'readwrite');
        const fileStore = tx.objectStore(STORE_FILES);
        const textStore = tx.objectStore(STORE_TEXTS);

        // Delete text
        textStore.delete(sessionId);

        // Delete files
        const fileReq = fileStore.getAll();
        fileReq.onsuccess = () => {
          (fileReq.result || []).forEach((f: CachedDropFile) => {
            if (f.sessionId === sessionId) {
              fileStore.delete([f.sessionId, f.index]);
            }
          });
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Clean up all expired records from IndexedDB
   */
  async cleanupExpired(): Promise<void> {
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_FILES, STORE_TEXTS], 'readwrite');
        const fileStore = tx.objectStore(STORE_FILES);
        const textStore = tx.objectStore(STORE_TEXTS);
        const now = Date.now();

        const fileReq = fileStore.getAll();
        fileReq.onsuccess = () => {
          (fileReq.result || []).forEach((f: CachedDropFile) => {
            if (f.expiresAt && new Date(f.expiresAt).getTime() <= now) {
              fileStore.delete([f.sessionId, f.index]);
            }
          });
        };

        const textReq = textStore.getAll();
        textReq.onsuccess = () => {
          (textReq.result || []).forEach((t: CachedTextSession) => {
            if (t.expiresAt && new Date(t.expiresAt).getTime() <= now) {
              textStore.delete(t.sessionId);
            }
          });
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Completely purge the IndexedDB database (used by panic wipe)
   */
  async clearAll(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      indexedDB.deleteDatabase(DB_NAME);
    } catch {
      // Ignore
    }
  },
};
