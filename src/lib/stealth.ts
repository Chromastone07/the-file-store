import { PHANTOM_CONFIG } from '@/lib/config';
import { secureWipe } from '@/lib/crypto';

export class StealthEngine {
  private blobUrls: string[] = [];
  private buffers: ArrayBuffer[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive: boolean = false;

  private readonly TIMEOUT_MS = 90 * 1000;

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
      } catch (e) {
        // Fallback zero-fill
        new Uint8Array(buffer).fill(0);
      }
    }
    this.buffers = [];

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.clear();
      } catch (e) {
        console.error('Error clearing sessionStorage', e);
      }
    }
  }

  public panic(): void {
    this.wipeAll();
    if (typeof window !== 'undefined') {
      window.location.replace(PHANTOM_CONFIG.PANIC_REDIRECT_URL || 'https://www.wikipedia.org');
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
