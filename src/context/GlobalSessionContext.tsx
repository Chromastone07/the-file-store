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
  filenames?: string[]; // Added this so we can show filenames on the success screen
}

export interface ClipboardMessage {
  id: string;
  text: string;
  type: 'sent' | 'received' | 'system';
  timestamp: Date;
}

export interface ClipboardSessionConfig {
  sessionCode: string;
  maxUsers: number;
  expiresAt: Date;
  isCreator: boolean;
}

interface GlobalSessionState {
  // Drop Session State
  dropPhase: UploadPhase;
  dropProgress: number;
  dropError: string | null;
  dropResult: UploadResult | null;
  setDropPhase: (phase: UploadPhase) => void;
  setDropProgress: (progress: number) => void;
  setDropError: (error: string | null) => void;
  setDropResult: (result: UploadResult | null) => void;
  resetDrop: () => void;

  // Text Session State
  textPhase: UploadPhase;
  textProgress: number;
  textError: string | null;
  textResult: UploadResult | null;
  setTextPhase: (phase: UploadPhase) => void;
  setTextProgress: (progress: number) => void;
  setTextError: (error: string | null) => void;
  setTextResult: (result: UploadResult | null) => void;
  resetText: () => void;

  // Clipboard Chat State
  clipboardConfig: ClipboardSessionConfig | null;
  clipboardConnected: boolean;
  clipboardHistory: ClipboardMessage[];
  connectToClipboard: (config: ClipboardSessionConfig) => void;
  sendClipboardMessage: (text: string) => void;
  leaveClipboardSession: () => void;
}

const GlobalSessionContext = createContext<GlobalSessionState | undefined>(undefined);

export function GlobalSessionProvider({ children }: { children: React.ReactNode }) {
  // --- Drop State ---
  const [dropPhase, setDropPhase] = useState<UploadPhase>('idle');
  const [dropProgress, setDropProgress] = useState(0);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropResult, setDropResult] = useState<UploadResult | null>(null);

  const resetDrop = useCallback(() => {
    setDropPhase('idle');
    setDropProgress(0);
    setDropError(null);
    setDropResult(null);
  }, []);

  // --- Text State ---
  const [textPhase, setTextPhase] = useState<UploadPhase>('idle');
  const [textProgress, setTextProgress] = useState(0);
  const [textError, setTextError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<UploadResult | null>(null);

  const resetText = useCallback(() => {
    setTextPhase('idle');
    setTextProgress(0);
    setTextError(null);
    setTextResult(null);
  }, []);

  // Listen to cross-window or cross-component purges
  useEffect(() => {
    const handleHistoryChange = () => {
      try {
        const stored = localStorage.getItem('phantom_sender_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          
          if (dropResult) {
            const dropItem = parsed.find((p: any) => p.rawCode === dropResult.sessionCode);
            if (dropItem?.isDestroyed) {
              toast.info('Session purged successfully', { id: `purge-drop` });
              resetDrop();
            }
          }
          
          if (textResult) {
            const textItem = parsed.find((p: any) => p.rawCode === textResult.sessionCode);
            if (textItem?.isDestroyed) {
              toast.info('Session purged successfully', { id: `purge-text` });
              resetText();
            }
          }
        }
      } catch (e) {}
    };

    window.addEventListener('phantom_history_changed', handleHistoryChange);
    return () => window.removeEventListener('phantom_history_changed', handleHistoryChange);
  }, [dropResult, textResult, resetDrop, resetText]);

  // --- Clipboard State ---
  const [clipboardConfig, setClipboardConfig] = useState<ClipboardSessionConfig | null>(null);
  const [clipboardConnected, setClipboardConnected] = useState(false);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardMessage[]>([]);
  const channelRef = useRef<any>(null);

  const connectToClipboard = useCallback((config: ClipboardSessionConfig) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    
    setClipboardConfig(config);
    setClipboardHistory([]);

    const newChannel = supabase.channel(`clipboard:${config.sessionCode}`);
    
    newChannel
      .on('broadcast', { event: 'clipboard' }, (payload) => {
        if (payload.payload?.text) {
          setClipboardHistory(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            text: payload.payload.text,
            type: 'received',
            timestamp: new Date()
          }]);
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Enforce max users check locally
        const currentCount = Object.keys(newChannel.presenceState()).length;
        if (currentCount > config.maxUsers) {
          if (!config.isCreator) {
            toast.error('Session is full.');
            leaveClipboardSession();
            return;
          }
        }

        setClipboardConnected(true);
        if (!config.isCreator) {
          toast.success('Joined secure session.');
        } else {
          toast.success('Peer connected to your session.');
        }
        
        setClipboardHistory(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          text: 'User joined the secure session.',
          type: 'system',
          timestamp: new Date()
        }]);
      })
      .on('presence', { event: 'leave' }, () => {
        toast.warning('Peer disconnected');
        setClipboardHistory(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          text: 'User left the session.',
          type: 'system',
          timestamp: new Date()
        }]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await newChannel.track({ online: true, user: config.isCreator ? 'creator' : 'joiner' });
          if (!config.isCreator) setClipboardConnected(true);
        }
      });

    channelRef.current = newChannel;
  }, []);

  const sendClipboardMessage = useCallback((text: string) => {
    if (!channelRef.current) return;
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'clipboard',
      payload: { text }
    });

    setClipboardHistory(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      text,
      type: 'sent',
      timestamp: new Date()
    }]);
  }, []);

  const leaveClipboardSession = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setClipboardConfig(null);
    setClipboardConnected(false);
    setClipboardHistory([]);
    toast.info('Left the secure session.');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const value: GlobalSessionState = {
    dropPhase, dropProgress, dropError, dropResult,
    setDropPhase, setDropProgress, setDropError, setDropResult, resetDrop,
    textPhase, textProgress, textError, textResult,
    setTextPhase, setTextProgress, setTextError, setTextResult, resetText,
    clipboardConfig, clipboardConnected, clipboardHistory,
    connectToClipboard, sendClipboardMessage, leaveClipboardSession
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
