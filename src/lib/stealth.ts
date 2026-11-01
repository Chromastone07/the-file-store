import { PHANTOM_CONFIG, WISP_CONFIG } from '@/lib/config';
import { secureWipe } from '@/lib/crypto';
import { sessionCache } from '@/lib/sessionCache';

export class StealthEngine {
  private blobUrls: string[] = [];
  private buffers: ArrayBuffer[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive: boolean = false;

  private readonly TIMEOUT_MS = WISP_CONFIG.INACTIVITY_TIMEOUT_MS || 90 * 1000;

  constructor() {
    this.handleActivity = this.handleActivity.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.handleActivity);
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('scroll', this.handleActivity);
      window.addEventListener('click', this.handleActivity);
    }

    this.resetInactivityTimer();
  }

  public deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.handleActivity);
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('scroll', this.handleActivity);
      window.removeEventListener('click', this.handleActivity);
    }

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  public trackBlobUrl(url: string): void {
    if (!this.blobUrls.includes(url)) {
      this.blobUrls.push(url);
    }
  }

  public trackBuffer(buffer: ArrayBuffer): void {
    if (!this.buffers.includes(buffer)) {
      this.buffers.push(buffer);
    }
  }

  public createSafeBlobUrl(data: ArrayBuffer | Blob, type?: string): string {
    let blob: Blob;
    if (data instanceof ArrayBuffer) {
      this.trackBuffer(data);
      blob = new Blob([data], { type: type || 'application/octet-stream' });
    } else {
      blob = data;
    }

    const url = URL.createObjectURL(blob);
    this.trackBlobUrl(url);
    return url;
  }

  public wipeMemory(): void {
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe
      }
    }
    this.blobUrls = [];

    for (const buffer of this.buffers) {
      try {
        secureWipe(buffer);
      } catch {
        new Uint8Array(buffer).fill(0);
      }
    }
    this.buffers = [];
  }

  public wipeAll(): void {
    // Revoke all blob URLs
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Error revoking blob URL', e);
      }
    }
    this.blobUrls = [];

    // Zero-fill all tracked buffers
    for (const buffer of this.buffers) {
      try {
        // Try to securely wipe using crypto utility if it supports ArrayBuffer
        secureWipe(buffer);
      } catch {
        // Fallback zero-fill
        new Uint8Array(buffer).fill(0);
      }
    }
    this.buffers = [];

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.clear();
        window.localStorage.removeItem(PHANTOM_CONFIG.STORAGE_KEYS.SENDER_HISTORY);
        window.localStorage.removeItem(PHANTOM_CONFIG.STORAGE_KEYS.SESSION_DOCK);
        window.localStorage.removeItem('phantom_sender_history');
        window.localStorage.removeItem('phantom_active_dock');
        window.localStorage.removeItem('wisp_sender_history');
        window.localStorage.removeItem('wisp_active_dock');
        sessionCache.clearAll().catch(() => {});
      } catch (e) {
        console.error('Error clearing storage', e);
      }
    }
  }

  public panic(): void {
    if (typeof window !== 'undefined') {
      try {
        // Collect active codes before wiping local stores
        const historyJson = localStorage.getItem(PHANTOM_CONFIG.STORAGE_KEYS.SENDER_HISTORY) || localStorage.getItem('phantom_sender_history');
        const dockJson = localStorage.getItem(PHANTOM_CONFIG.STORAGE_KEYS.SESSION_DOCK) || localStorage.getItem('phantom_active_dock');

        const dropCodes: string[] = [];
        const textCodes: string[] = [];
        const chatCodes: string[] = [];

        if (historyJson) {
          try {
            const items = JSON.parse(historyJson);
            if (Array.isArray(items)) {
              for (const item of items) {
                if (!item.isDestroyed) {
                  if (item.type === 'drop') dropCodes.push(item.dbLookupCode || item.rawCode);
                  else if (item.type === 'text') textCodes.push(item.dbLookupCode || item.rawCode);
                  else if (item.type === 'clipboard' || item.type === 'chat') chatCodes.push(item.rawCode);
                }
              }
            }
          } catch {}
        }

        if (dockJson) {
          try {
            const dockSessions = JSON.parse(dockJson);
            if (Array.isArray(dockSessions)) {
              for (const s of dockSessions) {
                if (s.type === 'drop' || s.type === 'sent_drop') dropCodes.push(s.id);
                else if (s.type === 'text' || s.type === 'sent_text') textCodes.push(s.id);
                else if (s.type === 'chat') chatCodes.push(s.id);
              }
            }
          } catch {}
        }

        // Send beacon/fetch with keepalive so server purges remote blobs & records
        if (dropCodes.length > 0 || textCodes.length > 0 || chatCodes.length > 0) {
          fetch('/api/cleanup/panic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dropCodes: Array.from(new Set(dropCodes)),
              textCodes: Array.from(new Set(textCodes)),
              chatCodes: Array.from(new Set(chatCodes)),
            }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Remote panic dispatch error:', err);
      }
    }

    this.wipeAll();
    if (typeof window !== 'undefined') {
      window.location.replace(PHANTOM_CONFIG.PANIC_REDIRECT_URL || '/');
    }
  }

  public resetInactivityTimer(): void {
    if (!this.isActive) return;

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.panic();
    }, this.TIMEOUT_MS);
  }

  public isStealthActive(): boolean {
    return this.isActive;
  }

  private handleActivity(): void {
    this.resetInactivityTimer();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.resetInactivityTimer();
    
    // Panic on Ctrl+Shift+X
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      this.panic();
    }
  }
}

export const stealth = new StealthEngine();

export function setupAntiCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}
