"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { DropRecord, SecureTextRecord } from '@/lib/supabase';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/crypto';
import { toast } from 'sonner';
import { sessionCache } from '@/lib/sessionCache';

export type UploadPhase = 'idle' | 'stripping' | 'encrypting' | 'uploading' | 'finalizing' | 'done' | 'error';

export interface UploadResult {
  sessionCode: string;
  shareLink: string;
  keyBase64: string;
  expiresAt: string;
  filenames?: string[];
  isDestroyed?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  type: 'sent' | 'received' | 'system';
  timestamp: Date;
  alias?: string;
  color?: string;
  senderId?: string;
}

export interface ChatSessionConfig {
  sessionCode: string;
  maxUsers: number;
  expiresAt: Date;
  isCreator: boolean;
  alias?: string;
  color?: string;
}

export interface DecryptedFile {
  drop: DropRecord;
  dropId?: string;
  blobUrl: string;
  textContent: string;
}

// For active sessions tracking
export type ActiveSession = 
  | { type: 'drop'; id: string; title: string; files: DecryptedFile[]; expiresAt?: string; burnAfterReading?: boolean }
  | { type: 'text'; id: string; title: string; text: string; expiresAt?: string; burnAfterReading?: boolean; drop?: DropRecord | SecureTextRecord | Record<string, unknown> }
  | { type: 'chat'; id: string; title: string; config: ChatSessionConfig; connected: boolean; onlineCount?: number; expiresAt?: string; burnAfterReading?: boolean }
  | { type: 'sent_drop'; id: string; title: string; result: UploadResult; expiresAt?: string; burnAfterReading?: boolean }
  | { type: 'sent_text'; id: string; title: string; result: UploadResult; expiresAt?: string; burnAfterReading?: boolean };

interface GlobalSessionState {
  // Drop Session State (Uploading)
  dropPhase: UploadPhase;
  dropProgress: number;
  dropError: string | null;
  dropResult: UploadResult | null;
  setDropPhase: (phase: UploadPhase) => void;
  setDropProgress: (progress: number) => void;
  setDropError: (error: string | null) => void;
  setDropResult: (result: UploadResult | null) => void;
  resetDrop: () => void;

  // Text Session State (Uploading)
  textPhase: UploadPhase;
  textProgress: number;
  textError: string | null;
  textResult: UploadResult | null;
  setTextPhase: (phase: UploadPhase) => void;
  setTextProgress: (progress: number) => void;
  setTextError: (error: string | null) => void;
  setTextResult: (result: UploadResult | null) => void;
  resetText: () => void;

  // Global Active Sessions (Dock)
  activeSessions: ActiveSession[];
  addActiveSession: (session: ActiveSession) => void;
  removeActiveSession: (id: string) => void;

  // Chat Specifics
  chatHistories: Record<string, ChatMessage[]>;
  connectToChat: (config: ChatSessionConfig) => void;
  sendChatMessage: (sessionId: string, text: string, senderInfo?: { alias?: string; color?: string; senderId?: string }) => void;

  // Session Viewer & Dock
  viewingSessionId: string | null;
  setViewingSessionId: (id: string | null) => void;
  isDockOpen: boolean;
  setIsDockOpen: (open: boolean) => void;

  // QR Scanner Modal
  isQRScannerOpen: boolean;
  openQRScanner: (callback?: (data: string) => void) => void;
  closeQRScanner: () => void;
  qrScannerCallback: ((data: string) => void) | null;
}

const GlobalSessionContext = createContext<GlobalSessionState | undefined>(undefined);

async function getChatCryptoKey(sessionCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(`WISP-CHAT-${sessionCode}`));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function getLegacyChatCryptoKey(sessionCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(`PHANTOM-CHAT-${sessionCode}`));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function GlobalSessionProvider({ children }: { children: React.ReactNode }) {
  // --- Upload States ---
  const [dropPhase, setDropPhase] = useState<UploadPhase>('idle');
  const [dropProgress, setDropProgress] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropResult, setDropResult] = useState<UploadResult | null>(null);
  const resetDrop = useCallback(() => { setDropPhase('idle'); setDropProgress(0); setDropError(null); setDropResult(null); }, []);

  const [textPhase, setTextPhase] = useState<UploadPhase>('idle');
  const [textProgress, setTextProgress] = useState(0);
  const [textError, setTextError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<UploadResult | null>(null);
  const resetText = useCallback(() => { setTextPhase('idle'); setTextProgress(0); setTextError(null); setTextResult(null); }, []);

  // --- Active Sessions & Chat ---
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const channelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});

  // --- Global QR Scanner Modal ---
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrScannerCallback, setQrScannerCallback] = useState<((data: string) => void) | null>(null);

  const openQRScanner = useCallback((callback?: (data: string) => void) => {
    setQrScannerCallback(() => callback || null);
    setIsQRScannerOpen(true);
  }, []);

  const closeQRScanner = useCallback(() => {
    setIsQRScannerOpen(false);
    setQrScannerCallback(null);
  }, []);

  // Restore active sessions on initial mount from sessionStorage, localStorage, and IndexedDB cache
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreAllSessions = async () => {
      try {
        await sessionCache.cleanupExpired();

        const baseSessionsMap = new Map<string, ActiveSession>();

        // 1. Check sessionStorage
        const savedSession = sessionStorage.getItem('phantom_active_sessions');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (Array.isArray(parsed)) {
              const now = Date.now();
              parsed.forEach((s: ActiveSession) => {
                if (s.type === 'chat' && s.config?.expiresAt && new Date(s.config.expiresAt).getTime() <= now) return;
                if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) return;
                baseSessionsMap.set(s.id, s);
              });
            }
          } catch {
            // Ignore parse error
          }
        }

        // 2. Check localStorage metadata backup for mobile reliability
        const savedMeta = localStorage.getItem('phantom_active_sessions_meta');
        if (savedMeta) {
          try {
            const parsedMeta = JSON.parse(savedMeta);
            if (Array.isArray(parsedMeta)) {
              const now = Date.now();
              parsedMeta.forEach((s: ActiveSession) => {
                if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) return;
                if (!baseSessionsMap.has(s.id)) {
                  baseSessionsMap.set(s.id, s);
                }
              });
            }
          } catch {
            // Ignore
          }
        }

        // 3. Hydrate cached drop files from IndexedDB
        const cachedDrops = await sessionCache.getAllCachedDrops();
        Object.entries(cachedDrops).forEach(([sessionId, files]) => {
          if (!files || files.length === 0) return;
          const first = files[0];
          const restoredFiles: DecryptedFile[] = files.map(f => {
            const blob = new Blob([f.buffer], { type: f.fileType || 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            return {
              drop: {
                id: f.sessionId,
                session_code: f.sessionId,
                group_code: null,
                storage_path: '',
                encrypted_filename: f.filename,
                file_type: f.fileType,
                file_size: f.buffer.byteLength,
                encryption_iv: '',
                encryption_salt: null,
                has_password: false,
                burn_after_reading: false,
                max_views: null,
                view_count: 1,
                expires_at: f.expiresAt,
                is_destroyed: false,
                created_at: new Date(f.savedAt).toISOString(),
              },
              blobUrl,
              textContent: f.textContent || '',
            };
          });

          let sessionTitle = first.filename || 'FILE DROP';
          if (files.length > 1) {
            sessionTitle += ` +${files.length - 1}`;
          }

          baseSessionsMap.set(sessionId, {
            type: 'drop',
            id: sessionId,
            title: sessionTitle,
            files: restoredFiles,
            expiresAt: first.expiresAt,
            burnAfterReading: false,
          });
        });

        // 4. Hydrate cached texts from IndexedDB
        const cachedTexts = await sessionCache.getAllCachedTexts();
        cachedTexts.forEach(t => {
          baseSessionsMap.set(t.sessionId, {
            type: 'text',
            id: t.sessionId,
            title: t.title || `SECURE NOTE (${t.sessionId})`,
            text: t.text,
            expiresAt: t.expiresAt,
            burnAfterReading: false,
          });
        });

        const allValid = Array.from(baseSessionsMap.values());
        if (allValid.length > 0) {
          setActiveSessions(allValid);
        }
      } catch (err) {
        console.error('Session restoration error:', err);
      }
    };

    restoreAllSessions();
  }, []);

  // Sync active sessions to sessionStorage and persistent metadata backup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const serializable = activeSessions.map(s => {
        if (s.type === 'drop') {
          return {
            ...s,
            files: s.files ? s.files.map(f => ({ ...f, blobUrl: '' })) : []
          };
        }
        return s;
      });
      sessionStorage.setItem('phantom_active_sessions', JSON.stringify(serializable));

      // Save non-burn-after-reading metadata to localStorage for mobile app restarts
      const persistentMeta = serializable.filter(s => {
        if (s.type === 'drop' && s.burnAfterReading) return false;
        if (s.type === 'text' && s.burnAfterReading) return false;
        return true;
      });
      localStorage.setItem('phantom_active_sessions_meta', JSON.stringify(persistentMeta));
    } catch {
      // Storage quota or error
    }
  }, [activeSessions]);

  const addActiveSession = useCallback((session: ActiveSession) => {
    setActiveSessions(prev => {
      const existingIdx = prev.findIndex(s => s.id === session.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = session;
        return updated;
      }
      return [...prev, session];
    });
  }, []);

  const removeActiveSession = useCallback((id: string) => {
    sessionCache.removeSession(id).catch(() => {});
    setActiveSessions(prev => {
      const session = prev.find(s => s.id === id);
      if (!session) return prev;
      
      // Cleanup
      setViewingSessionId(currentId => currentId === id ? null : currentId);

      if (session.type === 'drop') {
        session.files.forEach(f => {
          if (f.blobUrl) URL.revokeObjectURL(f.blobUrl);
        });
      } else if (session.type === 'chat') {
        const channel = channelsRef.current[id];
        if (channel) {
          supabase.removeChannel(channel);
          delete channelsRef.current[id];
        }
        setChatHistories(h => {
          const newH = { ...h };
          delete newH[id];
          return newH;
        });
      }
      return prev.filter(s => s.id !== id);
    });
  }, []);

  const connectToChat = useCallback((config: ChatSessionConfig) => {
    const id = config.sessionCode;
    
    // Add to active sessions if not there
    setActiveSessions(prev => {
      if (prev.some(s => s.id === id)) return prev;
      return [...prev, { type: 'chat', id, title: 'Secure Chat', config, connected: false }];
    });
    
    setChatHistories(prev => ({ ...prev, [id]: prev[id] || [] }));

    if (channelsRef.current[id]) {
      supabase.removeChannel(channelsRef.current[id]);
    }

    const newChannel = supabase.channel(`clipboard:${id}`);
    
    newChannel
      .on('broadcast', { event: 'clipboard' }, async (payload) => {
        if (payload.payload?.ciphertext && payload.payload?.iv) {
          try {
            let key = await getChatCryptoKey(id);
            const cipherBuffer = base64ToArrayBuffer(payload.payload.ciphertext);
            const ivBuffer = base64ToArrayBuffer(payload.payload.iv);
            let decrypted: ArrayBuffer;
            try {
              decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBuffer as BufferSource },
                key,
                cipherBuffer
              );
            } catch {
              key = await getLegacyChatCryptoKey(id);
              decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBuffer as BufferSource },
                key,
                cipherBuffer
              );
            }
            const decryptedText = new TextDecoder().decode(decrypted);
            setChatHistories(prev => ({
              ...prev,
              [id]: [...(prev[id] || []), {
                id: Math.random().toString(36).substring(2, 9),
                text: decryptedText,
                type: 'received',
                timestamp: new Date(),
                alias: payload.payload.alias,
                color: payload.payload.color,
                senderId: payload.payload.senderId,
              }]
            }));
          } catch (err) {
            console.error('Failed to decrypt chat message', err);
          }
        } else if (payload.payload?.text) {
          // Plaintext fallback
          setChatHistories(prev => ({
            ...prev,
            [id]: [...(prev[id] || []), {
              id: Math.random().toString(36).substring(2, 9),
              text: payload.payload.text,
              type: 'received',
              timestamp: new Date(),
              alias: payload.payload.alias,
              color: payload.payload.color,
              senderId: payload.payload.senderId,
            }]
          }));
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const currentCount = Object.keys(newChannel.presenceState()).length;
        if (currentCount > config.maxUsers) {
          if (!config.isCreator) {
            toast.error('Session is full.', { id: `full-${id}`, duration: 2500 });
            removeActiveSession(id);
            return;
          }
        }

        const newlyJoinedId = newPresences[0]?.user || 'A user';
        
        setActiveSessions(prev => prev.map(s => s.id === id && s.type === 'chat' ? { ...s, connected: true } : s));

        if (!config.isCreator) {
          toast.success('Joined secure chat', { id: `presence-${id}`, duration: 1800 });
        } else {
          toast.success(`${newlyJoinedId} connected`, { id: `presence-${id}`, duration: 1800 });
        }
        
        setChatHistories(prev => ({
          ...prev,
          [id]: [...(prev[id] || []), {
            id: Math.random().toString(36).substring(2, 9),
            text: `${newlyJoinedId} joined the secure session.`,
            type: 'system',
            timestamp: new Date()
          }]
        }));
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftId = leftPresences[0]?.user || 'A user';
        setChatHistories(prev => ({
          ...prev,
          [id]: [...(prev[id] || []), {
            id: Math.random().toString(36).substring(2, 9),
            text: `${leftId} left the session.`,
            type: 'system',
            timestamp: new Date()
          }]
        }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const randomId = 'User-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          await newChannel.track({ online: true, user: randomId });
          if (!config.isCreator) {
            setActiveSessions(prev => prev.map(s => s.id === id && s.type === 'chat' ? { ...s, connected: true } : s));
          }
        }
      });

    channelsRef.current[id] = newChannel;
  }, [removeActiveSession]);

  const sendChatMessage = useCallback(async (
    sessionId: string, 
    text: string, 
    senderInfo?: { alias?: string; color?: string; senderId?: string }
  ) => {
    const channel = channelsRef.current[sessionId];
    if (!channel) return;
    
    try {
      const key = await getChatCryptoKey(sessionId);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
      
      const payload = {
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)),
        alias: senderInfo?.alias,
        color: senderInfo?.color,
        senderId: senderInfo?.senderId,
      };

      channel.send({
        type: 'broadcast',
        event: 'clipboard',
        payload,
      });

      setChatHistories(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), {
          id: Math.random().toString(36).substring(2, 9),
          text,
          type: 'sent',
          timestamp: new Date(),
          alias: senderInfo?.alias,
          color: senderInfo?.color,
          senderId: senderInfo?.senderId,
        }]
      }));
    } catch (e) {
      console.error('Failed to encrypt and send chat message', e);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const currentChannels = channelsRef.current;
    return () => {
      Object.values(currentChannels).forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const value: GlobalSessionState = {
    dropPhase, dropProgress, dropError, dropResult,
    setDropPhase, setDropProgress, setDropError, setDropResult, resetDrop,
    textPhase, textProgress, textError, textResult,
    setTextPhase, setTextProgress, setTextError, setTextResult, resetText,
    activeSessions, addActiveSession, removeActiveSession,
    chatHistories, connectToChat, sendChatMessage,
    viewingSessionId, setViewingSessionId,
    isDockOpen, setIsDockOpen,
    isQRScannerOpen, openQRScanner, closeQRScanner, qrScannerCallback
  };

  return (
    <GlobalSessionContext.Provider value={value}>
      {children}
    </GlobalSessionContext.Provider>
  );
}

export function useGlobalSession() {
  const context = useContext(GlobalSessionContext);
  if (context === undefined) {
    throw new Error('useGlobalSession must be used within a GlobalSessionProvider');
  }
  return context;
}
