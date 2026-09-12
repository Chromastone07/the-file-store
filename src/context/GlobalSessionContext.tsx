"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type UploadPhase = 'idle' | 'stripping' | 'encrypting' | 'uploading' | 'finalizing' | 'done' | 'error';

export interface UploadResult {
  sessionCode: string;
  shareLink: string;
  keyBase64: string;
  expiresAt: string;
  filenames?: string[];
}

export interface ChatMessage {
  id: string;
  text: string;
  type: 'sent' | 'received' | 'system';
  timestamp: Date;
}

export interface ChatSessionConfig {
  sessionCode: string;
  maxUsers: number;
  expiresAt: Date;
  isCreator: boolean;
}

// For active sessions tracking
export type ActiveSession = 
  | { type: 'drop'; id: string; title: string; files: any[] } // files: DecryptedFile[]
  | { type: 'text'; id: string; title: string; text: string }
  | { type: 'chat'; id: string; title: string; config: ChatSessionConfig; connected: boolean };

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
  sendChatMessage: (sessionId: string, text: string) => void;

  // Session Viewer
  viewingSessionId: string | null;
  setViewingSessionId: (id: string | null) => void;
}

const GlobalSessionContext = createContext<GlobalSessionState | undefined>(undefined);

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
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const channelsRef = useRef<Record<string, any>>({});

  const addActiveSession = useCallback((session: ActiveSession) => {
    setActiveSessions(prev => {
      if (prev.some(s => s.id === session.id)) return prev;
      return [...prev, session];
    });
  }, []);

  const removeActiveSession = useCallback((id: string) => {
    setActiveSessions(prev => {
      const session = prev.find(s => s.id === id);
      if (!session) return prev;
      
      // Cleanup
      if (id === viewingSessionId) setViewingSessionId(null);

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
    
    setChatHistories(prev => ({ ...prev, [id]: [] }));

    if (channelsRef.current[id]) {
      supabase.removeChannel(channelsRef.current[id]);
    }

    const newChannel = supabase.channel(`clipboard:${id}`); // keeping channel name same for DB compatibility if needed
    
    newChannel
      .on('broadcast', { event: 'clipboard' }, (payload) => {
        if (payload.payload?.text) {
          setChatHistories(prev => ({
            ...prev,
            [id]: [...(prev[id] || []), {
              id: Math.random().toString(36).substring(2, 9),
              text: payload.payload.text,
              type: 'received',
              timestamp: new Date()
            }]
          }));
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const currentCount = Object.keys(newChannel.presenceState()).length;
        if (currentCount > config.maxUsers) {
          if (!config.isCreator) {
            toast.error('Session is full.');
            removeActiveSession(id);
            return;
          }
        }

        const newlyJoinedId = newPresences[0]?.user || 'A user';
        
        setActiveSessions(prev => prev.map(s => s.id === id && s.type === 'chat' ? { ...s, connected: true } : s));

        if (!config.isCreator) {
          toast.success('Joined secure chat.');
        } else {
          toast.success(`${newlyJoinedId} connected.`);
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

  const sendChatMessage = useCallback((sessionId: string, text: string) => {
    const channel = channelsRef.current[sessionId];
    if (!channel) return;
    
    channel.send({
      type: 'broadcast',
      event: 'clipboard',
      payload: { text }
    });

    setChatHistories(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), {
        id: Math.random().toString(36).substring(2, 9),
        text,
        type: 'sent',
        timestamp: new Date()
      }]
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(channelsRef.current).forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const value: GlobalSessionState = {
    dropPhase, dropProgress, dropError, dropResult,
    setDropPhase, setDropProgress, setDropError, setDropResult, resetDrop,
    textPhase, textProgress, textError, textResult,
    setTextPhase, setTextProgress, setTextError, setTextResult, resetText,
    activeSessions, addActiveSession, removeActiveSession,
    chatHistories, connectToChat, sendChatMessage,
    viewingSessionId, setViewingSessionId
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
