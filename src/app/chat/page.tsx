"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGlobalSession, ActiveSession, ChatMessage } from '@/context/GlobalSessionContext';
import { generateFriendlyAlias } from '@/lib/crypto';
import { WISP_CONFIG } from '@/lib/config';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import ExpiryControl from '@/components/ui/ExpiryControl';
import SpotlightCard from '@/components/ui/SpotlightCard';
import QRCode from 'qrcode';
import { 
  MessageSquare, 
  Send, 
  Shield, 
  Users, 
  PlusCircle, 
  LogOut, 
  Copy, 
  Check, 
  X, 
  Share2, 
  ArrowDown,
  QrCode as QrCodeIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function ChatPage() {
  const { 
    activeSessions,
    chatHistories, 
    connectToChat, 
    sendChatMessage,
    removeActiveSession,
    openQRScanner
  } = useGlobalSession();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [inputText, setInputText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Settings for creator
  const [durationSeconds, setDurationSeconds] = useState(5 * 60);
  const [maxUsers, setMaxUsers] = useState(2);
  const [isCustomMaxUsers, setIsCustomMaxUsers] = useState(false);
  const [customMaxUsers, setCustomMaxUsers] = useState<number | string>(25);

  // Participant identity
  const [myAlias, setMyAlias] = useState<{ name: string; color: string } | null>(null);
  const [participantToken, setParticipantToken] = useState<string>('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [showMobileInvite, setShowMobileInvite] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isCreatingNewRoom, setIsCreatingNewRoom] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(null);

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const joinParam = searchParams?.get('join');
  const isNewParam = searchParams?.get('new') === '1';

  // Active chat sessions
  const activeChatSessions = useMemo(() => {
    return activeSessions.filter(
      (s): s is Extract<ActiveSession, { type: 'chat' }> => s.type === 'chat'
    );
  }, [activeSessions]);

  // Determine active chat room ID
  const effectiveChatId = useMemo(() => {
    if (isNewParam || isCreatingNewRoom) {
      return null;
    }
    if (joinParam) {
      return joinParam;
    }
    if (selectedRoomCode && activeChatSessions.some(s => s.id === selectedRoomCode)) {
      return selectedRoomCode;
    }
    if (activeChatSessions.length > 0) {
      return activeChatSessions[0].id;
    }
    return null;
  }, [isNewParam, isCreatingNewRoom, joinParam, selectedRoomCode, activeChatSessions]);

  const activeChatSession = activeSessions.find(
    s => s.id === effectiveChatId && s.type === 'chat'
  ) as Extract<ActiveSession, { type: 'chat' }> | undefined;

  const rawHistory = effectiveChatId ? chatHistories[effectiveChatId] : undefined;
  const chatHistory = useMemo(() => rawHistory || [], [rawHistory]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or restore participant identity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = WISP_CONFIG.STORAGE_KEYS.CHAT_PARTICIPANT;
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem(key, token);
    }
    setParticipantToken(token);
    setMyAlias(generateFriendlyAlias(token));
  }, []);

  // Sync URL when effectiveChatId is determined from active sessions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (effectiveChatId && !joinParam && !isNewParam && !isCreatingNewRoom) {
      window.history.replaceState({}, '', `/chat?join=${effectiveChatId}`);
    }
  }, [effectiveChatId, joinParam, isNewParam, isCreatingNewRoom]);

  // Handle auto-join from URL param
  useEffect(() => {
    if (!effectiveChatId || !participantToken) return;
    if (activeSessions.some(s => s.id === effectiveChatId)) return;

    const autoJoin = async () => {
      setIsProcessing(true);
      try {
        const alias = generateFriendlyAlias(participantToken);
        const res = await fetch('/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'join',
            roomCode: effectiveChatId,
            participantToken,
            alias: alias.name,
            color: alias.color,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to join chat room');
          window.history.replaceState({}, '', '/chat');
          setSelectedRoomCode(null);
          return;
        }

        const data = await res.json();
        connectToChat({
          sessionCode: effectiveChatId,
          maxUsers: data.maxUsers || 2,
          expiresAt: new Date(data.expiresAt),
          isCreator: data.isHost,
          alias: data.alias,
          color: data.color,
        });
        setOnlineCount(data.onlineCount || 1);
      } catch {
        toast.error('Network error joining room');
      } finally {
        setIsProcessing(false);
      }
    };

    autoJoin();
  }, [effectiveChatId, participantToken, activeSessions, connectToChat]);

  // Generate QR code when in active room
  useEffect(() => {
    if (!activeChatSession) return;
    const url = `${window.location.origin}/chat?join=${activeChatSession.config.sessionCode}`;
    QRCode.toDataURL(url, {
      color: { dark: '#f8fafc', light: '#090a10' },
      margin: 2,
      width: 140,
    }).then(setQrUrl).catch(console.error);
  }, [activeChatSession]);

  // Heartbeat loop for participant presence & room synchronization
  useEffect(() => {
    if (!activeChatSession || !participantToken) return;

    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            roomCode: activeChatSession.config.sessionCode,
            participantToken,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.onlineCount) setOnlineCount(data.onlineCount);
        } else if (res.status === 404 || res.status === 410) {
          toast.info('Chat room has been destroyed or expired');
          removeActiveSession(activeChatSession.config.sessionCode);
          window.history.pushState({}, '', '/chat');
        }
      } catch {
        // Heartbeat blip
      }
    };

    const interval = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(interval);
  }, [activeChatSession, participantToken, removeActiveSession]);

  // Auto-scroll when near bottom
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      setShowScrollBottom(false);
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setShowScrollBottom(!isNearBottom);
  };

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom();
    }
  }, [chatHistory, showScrollBottom]);

  // Auto-resize composer textarea like WhatsApp (smooth auto-grow up to max 120px)
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 36), 120);
    el.style.height = `${newHeight}px`;
  }, [inputText]);

  // Create Room Handler
  const handleCreate = async () => {
    if (!participantToken || !myAlias) return;
    setIsProcessing(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const finalMaxUsers = isCustomMaxUsers 
        ? Math.min(Math.max(2, typeof customMaxUsers === 'number' ? customMaxUsers : parseInt(String(customMaxUsers), 10) || 2), 10000)
        : maxUsers;

      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          roomCode: code,
          participantToken,
          maxUsers: finalMaxUsers,
          durationSeconds,
          alias: myAlias.name,
          color: myAlias.color,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to initialize chat room');
      }

      const data = await res.json();
      connectToChat({
        sessionCode: code,
        maxUsers: finalMaxUsers,
        expiresAt: new Date(data.expiresAt),
        isCreator: true,
        alias: myAlias.name,
        color: myAlias.color,
      });

      setIsCreatingNewRoom(false);
      setSelectedRoomCode(code);
      window.history.pushState({}, '', `/chat?join=${code}`);
      toast.success('Chat room created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creating room');
    } finally {
      setIsProcessing(false);
    }
  };

  // Join Room Handler
  const handleJoin = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim().toUpperCase();
    if (!cleanCode || !participantToken || !myAlias) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomCode: cleanCode,
          participantToken,
          alias: myAlias.name,
          color: myAlias.color,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to join chat room');
        return;
      }

      const data = await res.json();
      connectToChat({
        sessionCode: cleanCode,
        maxUsers: data.maxUsers || 2,
        expiresAt: new Date(data.expiresAt),
        isCreator: data.isHost,
        alias: data.alias,
        color: data.color,
      });

      setIsCreatingNewRoom(false);
      setSelectedRoomCode(cleanCode);
      setJoinCode('');
      window.history.pushState({}, '', `/chat?join=${cleanCode}`);
      toast.success(data.isReconnect ? 'Reconnected to chat room' : 'Connected to chat room');
    } catch {
      toast.error('Network error joining room');
    } finally {
      setIsProcessing(false);
    }
  };

  // Send Message
  const handleSend = () => {
    if (!inputText.trim() || !effectiveChatId || !myAlias) return;
    sendChatMessage(effectiveChatId, inputText.trim(), {
      alias: myAlias.name,
      color: myAlias.color,
      senderId: participantToken,
    });
    setInputText('');
    if (composerRef.current) {
      composerRef.current.style.height = '36px';
      // Keep textarea focused so mobile virtual keyboard stays open
      composerRef.current.focus({ preventScroll: true });
    }
  };

  // Leave / Destroy Room
  const handleLeaveOrDestroy = async () => {
    if (!effectiveChatId || !participantToken) return;
    const currentId = effectiveChatId;
    try {
      await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: activeChatSession?.config?.isCreator ? 'destroy' : 'leave',
          roomCode: currentId,
          participantToken,
        }),
      });
    } catch {
      // Continue cleanup
    }
    removeActiveSession(currentId);
    setShowDestroyConfirm(false);
    toast.info(activeChatSession?.config?.isCreator ? 'Chat room destroyed' : 'Left chat room');

    const remaining = activeChatSessions.filter(s => s.id !== currentId);
    if (remaining.length > 0) {
      setSelectedRoomCode(remaining[0].id);
      window.history.pushState({}, '', `/chat?join=${remaining[0].id}`);
    } else {
      setSelectedRoomCode(null);
      setIsCreatingNewRoom(false);
      window.history.pushState({}, '', '/chat');
    }
  };

  const handleCopyCode = () => {
    if (!activeChatSession) return;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(activeChatSession.config.sessionCode).catch(() => {});
      }
    } catch {
      // Safe fallback
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Room code copied');
  };

  const handleCopyLink = () => {
    if (!activeChatSession) return;
    const url = `${window.location.origin}/chat?join=${activeChatSession.config.sessionCode}`;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch {
      // Safe fallback
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Invite link copied');
  };

  // Group consecutive messages by sender for compact aesthetic rendering
  const messageGroups = useMemo(() => {
    const groups: {
      senderKey: string;
      alias: string;
      color: string;
      isMe: boolean;
      messages: ChatMessage[];
    }[] = [];

    chatHistory.forEach((msg) => {
      if (msg.type === 'system') {
        groups.push({
          senderKey: 'system-' + msg.id,
          alias: 'System',
          color: '#94a3b8',
          isMe: false,
          messages: [msg],
        });
        return;
      }

      const isMe = msg.type === 'sent';
      const senderKey = isMe ? 'me' : (msg.senderId || msg.alias || 'other');
      const alias = msg.alias || (isMe ? (myAlias?.name || 'You') : 'Participant');
      const color = msg.color || (isMe ? (myAlias?.color || '#6366f1') : '#10b981');

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.senderKey === senderKey) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({
          senderKey,
          alias,
          color,
          isMe,
          messages: [msg],
        });
      }
    });

    return groups;
  }, [chatHistory, myAlias]);

  return (
    <div className="relative h-full min-h-dvh flex flex-col font-sans text-[var(--wisp-text)] selection:bg-[var(--wisp-glow)]/30">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 min-h-0 flex flex-col justify-center px-3 sm:px-6 pt-2 mobile-bottom-clearance z-10">
        <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col justify-center">

          {/* Multi-Room Switcher Tabs when active chat rooms exist */}
          {activeChatSessions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 scrollbar-none w-full mb-1">
              <div className="flex items-center gap-1.5 p-1 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl backdrop-blur-md">
                {activeChatSessions.map((session) => {
                  const isCurrent = !isCreatingNewRoom && effectiveChatId === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setIsCreatingNewRoom(false);
                        setSelectedRoomCode(session.id);
                        window.history.pushState({}, '', `/chat?join=${session.id}`);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                          : 'text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{session.id}</span>
                      {session.config.isCreator && (
                        <span className="text-[9px] px-1 bg-white/20 text-white rounded font-sans font-normal">
                          Host
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewRoom(true);
                    window.history.pushState({}, '', '/chat?new=1');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isCreatingNewRoom
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/50'
                      : 'text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]'
                  }`}
                  title="Create or join another room"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>New Room</span>
                </button>
              </div>
            </div>
          )}

          {!activeChatSession ? (
            /* ── Screen 1: Create or Join Room (fits in first viewport) ── */
            <div className="flex flex-col w-full max-h-full justify-center my-auto">
              
              {/* Mobile Segmented Switch */}
              <div className="flex sm:hidden p-1 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl mb-3 shrink-0 backdrop-blur-md">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'create' ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm' : 'text-[var(--wisp-muted)]'}`}
                >
                  Create Room
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'join' ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm' : 'text-[var(--wisp-muted)]'}`}
                >
                  Join Room
                </button>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 items-stretch">
                
                {/* Create Card */}
                <SpotlightCard className={`p-4 sm:p-6 shadow-2xl flex flex-col gap-3 sm:gap-4 sm:justify-between ${activeTab === 'join' ? 'hidden sm:flex' : 'flex'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center">
                        <PlusCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[var(--wisp-text)]">Create Room</h2>
                        <p className="text-[11px] text-[var(--wisp-muted)]">Ephemeral, encrypted chat room</p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-3">
                      <ExpiryControl
                        valueSeconds={durationSeconds}
                        onChange={(sel) => setDurationSeconds(sel.totalSeconds)}
                        minSeconds={30}
                        maxSeconds={24 * 3600}
                      />

                      <div>
                        <div className="flex items-center justify-between text-xs text-[var(--wisp-muted)] font-medium mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-500" /> Max Participants
                          </span>
                          <span className="font-mono text-[11px] text-[var(--wisp-text)]">
                            {isCustomMaxUsers ? `${maxUsers} users (custom)` : `${maxUsers} users`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[2, 3, 5, 10].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setIsCustomMaxUsers(false);
                                setMaxUsers(n);
                              }}
                              className={`py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${!isCustomMaxUsers && maxUsers === n ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.02]' : 'bg-[var(--wisp-surface-glass)] border-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]'}`}
                            >
                              {n}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomMaxUsers(true);
                              const parsed = typeof customMaxUsers === 'number' ? customMaxUsers : parseInt(String(customMaxUsers), 10);
                              setMaxUsers(!isNaN(parsed) && parsed >= 2 ? Math.min(parsed, 10000) : 25);
                            }}
                            className={`py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${isCustomMaxUsers ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.02]' : 'bg-[var(--wisp-surface-glass)] border-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]'}`}
                          >
                            Custom
                          </button>
                        </div>

                        {isCustomMaxUsers && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min={2}
                                max={10000}
                                value={customMaxUsers}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCustomMaxUsers(val);
                                  const parsed = parseInt(val, 10);
                                  if (!isNaN(parsed) && parsed >= 2) {
                                    setMaxUsers(Math.min(parsed, 10000));
                                  }
                                }}
                                placeholder="Enter participant limit (e.g. 25, 100, 1000)"
                                className="w-full bg-[var(--wisp-surface-glass)] border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--wisp-text)] focus:outline-none focus:border-indigo-400"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--wisp-muted)] font-mono">
                                max 10,000
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--wisp-border)]">
                    <button
                      onClick={handleCreate}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:via-indigo-500 hover:to-violet-500 text-white py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-[0_0_25px_rgba(99,102,241,0.45)] hover:shadow-[0_0_35px_rgba(99,102,241,0.65)] border border-indigo-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>{isProcessing ? 'Creating...' : 'Create Secure Room'}</span>
                    </button>
                    <p className="text-[10px] text-[var(--wisp-muted)] text-center mt-1.5">
                      Messages live only in client memory. No logs.
                    </p>
                  </div>
                </SpotlightCard>

                {/* Join Card */}
                <SpotlightCard className={`p-4 sm:p-6 shadow-2xl flex flex-col gap-3 sm:gap-4 sm:justify-between ${activeTab === 'create' ? 'hidden sm:flex' : 'flex'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-[var(--wisp-text)] flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[var(--wisp-text)]">Join Room</h2>
                        <p className="text-[11px] text-[var(--wisp-muted)]">Enter room code to connect</p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-[var(--wisp-muted)] font-medium">
                            Room Code
                          </label>
                          <span className="font-mono text-[10px] text-[var(--wisp-muted)]">Case-insensitive</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="ABCDEF"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                            onBlur={() => setJoinCode((prev) => prev.toUpperCase())}
                            maxLength={8}
                            autoCapitalize="characters"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck="false"
                            className="w-full bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl px-4 py-2.5 text-center font-mono font-bold tracking-widest text-base sm:text-lg text-[var(--wisp-text)] uppercase focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              openQRScanner((scanned) => {
                                let code = scanned.trim();
                                if (code.includes('join=')) {
                                  const match = code.match(/join=([a-zA-Z0-9]+)/);
                                  if (match) code = match[1];
                                } else if (code.startsWith('http://') || code.startsWith('https://')) {
                                  try {
                                    const u = new URL(code);
                                    const j = u.searchParams.get('join');
                                    if (j) code = j;
                                  } catch {}
                                }
                                const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                if (cleanCode) {
                                  setJoinCode(cleanCode);
                                  handleJoin(cleanCode);
                                }
                              });
                            }}
                            className="p-2.5 rounded-xl border border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] text-[var(--wisp-muted)] hover:text-indigo-400 hover:border-indigo-400/50 hover:bg-[var(--wisp-elevated)] transition-all cursor-pointer flex items-center justify-center shrink-0"
                            aria-label="Scan Room QR Code"
                            title="Scan Room QR Code"
                          >
                            <QrCodeIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {myAlias && (
                        <div className="p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] flex items-center justify-between text-xs">
                          <span className="text-[var(--wisp-muted)]">Your anonymous alias:</span>
                          <span className="flex items-center gap-1.5 font-semibold text-[var(--wisp-text)]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: myAlias.color }} />
                            {myAlias.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--wisp-border)]">
                    <button
                      onClick={() => handleJoin(joinCode)}
                      disabled={joinCode.length < 5 || isProcessing}
                      className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{isProcessing ? 'Connecting...' : 'Connect to Room'}</span>
                    </button>
                    <p className="text-[10px] text-[var(--wisp-muted)] text-center mt-1.5">
                      Reconnect within 10s grace window preserves your alias.
                    </p>
                  </div>
                </SpotlightCard>

              </div>

            </div>
          ) : (
            /* ── Screen 2: Active Chat Room (No-scroll App Shell) ── */
            <div className="flex flex-col h-full min-h-0 max-h-full glass-panel rounded-2xl shadow-2xl overflow-hidden">
              
              {/* Room Header */}
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[var(--wisp-surface-glass)] border-b border-[var(--wisp-border)] flex items-center justify-between gap-2 shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] px-2.5 py-1 rounded-lg">
                    <span className="font-mono font-bold text-xs text-indigo-500 tracking-wider">
                      {activeChatSession.config.sessionCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-0.5 text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                      title="Copy room code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[var(--wisp-muted)] font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>{onlineCount} / {activeChatSession.config.maxUsers} online</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* New Room Quick Action */}
                  <button
                    onClick={() => {
                      setIsCreatingNewRoom(true);
                      window.history.pushState({}, '', '/chat?new=1');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] border border-[var(--wisp-border)] cursor-pointer"
                    title="Create or join another room"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">New Room</span>
                  </button>

                  {/* Mobile Invite Button */}
                  <button
                    onClick={() => setShowMobileInvite(true)}
                    className="sm:hidden p-1.5 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-lg text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                    title="Invite participants"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Destroy / Leave Button */}
                  <button
                    onClick={() => setShowDestroyConfirm(true)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeChatSession.config.isCreator 
                        ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 hover:text-rose-600 border border-rose-500/30' 
                        : 'bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] border border-[var(--wisp-border)]'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{activeChatSession.config.isCreator ? 'Destroy Room' : 'Leave'}</span>
                  </button>
                </div>
              </div>

              {/* Main Room Body: Left Panel (Desktop) + Messages Pane */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                
                {/* Desktop Left Sidebar: QR & Info (~240px) */}
                <div className="hidden sm:flex flex-col w-56 md:w-60 border-r border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] p-3.5 shrink-0 justify-between backdrop-blur-md">
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-semibold text-[var(--wisp-muted)] uppercase tracking-wider mb-2">
                      Scan to Join
                    </span>
                    {qrUrl ? (
                      <div className="p-2 bg-white rounded-xl shadow-md mb-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="Phantom Room QR" className="w-28 h-28" />
                      </div>
                    ) : (
                      <div className="w-28 h-28 bg-[var(--wisp-elevated)] rounded-xl animate-pulse mb-3" />
                    )}

                    <button
                      onClick={handleCopyLink}
                      className="w-full py-1.5 px-2 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-lg text-xs font-medium text-[var(--wisp-text)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--wisp-muted)]" />}
                      <span>{copiedLink ? 'Link Copied' : 'Copy Invite Link'}</span>
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--wisp-border)]">
                    <div className="text-[11px] text-[var(--wisp-muted)] flex items-center justify-between">
                      <span>Room role:</span>
                      <span className="font-semibold text-[var(--wisp-text)]">
                        {activeChatSession.config.isCreator ? 'Host (Can destroy)' : 'Participant'}
                      </span>
                    </div>

                    {myAlias && (
                      <div className="text-[11px] text-[var(--wisp-muted)] flex items-center justify-between">
                        <span>Your alias:</span>
                        <span className="flex items-center gap-1 font-semibold text-[var(--wisp-text)]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: myAlias.color }} />
                          {myAlias.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Pane: Message List + Composer */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[var(--wisp-surface)]/40 relative">
                  
                  {/* Messages Scroll Region (the ONLY scrolling container) */}
                  <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    onClick={() => {
                      // Tapping on message list blurs the input and dismisses virtual keyboard on mobile
                      composerRef.current?.blur();
                    }}
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 wisp-scrollbar"
                  >
                    {chatHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--wisp-muted)] select-none">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] flex items-center justify-center text-[var(--wisp-glow)] mb-3">
                          <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--wisp-text)] mb-1">
                          Zero-knowledge encrypted room
                        </h3>
                        <p className="text-xs max-w-xs text-[var(--wisp-muted)]">
                          Share the room code or QR to invite participants. Messages are encrypted locally and never saved.
                        </p>
                      </div>
                    ) : (
                      messageGroups.map((group, groupIndex) => {
                        if (group.senderKey.startsWith('system-')) {
                          return (
                            <div key={groupIndex} className="flex justify-center my-1.5">
                              <span className="text-[10px] font-mono text-[var(--wisp-muted)] bg-[var(--wisp-elevated)]/80 px-2.5 py-0.5 rounded-full border border-[var(--wisp-border)]">
                                {group.messages[0].text}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={groupIndex}
                            className={`flex flex-col ${group.isMe ? 'items-end' : 'items-start'}`}
                          >
                            {/* Sender Header (Only shown on first message of group) */}
                            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-[var(--wisp-muted)]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                              <span>{group.isMe ? 'You' : group.alias}</span>
                            </div>

                            {/* Consecutive Messages Stack */}
                            <div className="flex flex-col gap-0.5 max-w-[78%]">
                              {group.messages.map((msg, msgIdx) => {
                                const isFirst = msgIdx === 0;
                                const isLast = msgIdx === group.messages.length - 1;

                                const roundedClasses = group.isMe
                                  ? `rounded-2xl ${!isLast ? 'rounded-br-sm' : ''} ${!isFirst ? 'rounded-tr-sm' : ''}`
                                  : `rounded-2xl ${!isLast ? 'rounded-bl-sm' : ''} ${!isFirst ? 'rounded-tl-sm' : ''}`;

                                return (
                                  <div
                                    key={msg.id}
                                    className={`px-3 py-2 text-[15px] leading-[20px] break-words shadow-md ${roundedClasses} ${
                                      group.isMe
                                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
                                        : 'bg-[var(--wisp-surface)] text-[var(--wisp-text)] border border-[var(--wisp-border)] backdrop-blur-md'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-end justify-between gap-2">
                                      <span className="whitespace-pre-wrap">{msg.text}</span>
                                      <span className={`text-[11px] font-mono shrink-0 select-none ${group.isMe ? 'text-indigo-200' : 'text-[var(--wisp-muted)]'}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Jump to New Messages pill */}
                  {showScrollBottom && (
                    <button
                      onClick={() => scrollToBottom()}
                      className="absolute bottom-16 right-4 z-20 flex items-center gap-1 px-3 py-1 bg-[var(--wisp-surface)] border border-[var(--wisp-border)] shadow-lg rounded-full text-xs font-medium text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)] backdrop-blur-md transition-all cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                      <span>New messages</span>
                    </button>
                  )}

                  {/* Message Composer (WhatsApp-style auto-expanding pill) */}
                  <div className="p-2 sm:p-2.5 bg-[var(--wisp-surface-glass)] border-t border-[var(--wisp-border)] shrink-0 backdrop-blur-md">
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                      className="flex items-end gap-2 max-w-4xl mx-auto"
                    >
                      <div className="flex-1 relative flex items-center bg-[var(--wisp-surface)] border border-[var(--wisp-border)] focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/40 rounded-2xl sm:rounded-3xl transition-colors shadow-inner px-3.5 py-1">
                        <textarea
                          ref={composerRef}
                          value={inputText}
                          enterKeyHint="enter"
                          onChange={(e) => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            const newHeight = Math.min(Math.max(e.target.scrollHeight, 36), 120);
                            e.target.style.height = `${newHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            // On mobile/touch keyboards, Enter always creates a newline (like Shift+Enter on desktop)
                            // Sending on mobile is done exclusively via the on-screen Send button
                            const isTouchDevice = typeof window !== 'undefined' && (
                              'ontouchstart' in window ||
                              navigator.maxTouchPoints > 0 ||
                              window.matchMedia('(pointer: coarse)').matches
                            );

                            if (e.key === 'Enter') {
                              if (isTouchDevice) {
                                // Default newline insertion on mobile keyboard
                                return;
                              }
                              // Desktop behavior: Enter sends, Shift+Enter creates newline
                              if (!e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }
                          }}
                          placeholder="Type an encrypted message..."
                          rows={1}
                          className="w-full bg-transparent py-1.5 px-0.5 text-xs sm:text-sm text-[var(--wisp-text)] focus:outline-none resize-none leading-5 max-h-[120px] min-h-[36px] custom-scrollbar placeholder:text-[var(--wisp-muted)]/60 font-sans"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!inputText.trim()}
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={(e) => e.preventDefault()}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/30 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                        title="Send message"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </button>
                    </form>
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>
      </main>

      {/* Mobile Invite Bottom Sheet */}
      {showMobileInvite && activeChatSession && (
        <div 
          className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm sm:hidden"
          onClick={() => setShowMobileInvite(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full bg-[var(--wisp-surface)] border-t border-[var(--wisp-border)] rounded-t-2xl p-5 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-[var(--wisp-border)] rounded-full mb-1" />
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-[var(--wisp-text)]">Invite to Room</span>
              <button onClick={() => setShowMobileInvite(false)} className="text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrUrl && (
              <div className="p-3 bg-white rounded-xl shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="Phantom QR" className="w-36 h-36" />
              </div>
            )}

            <div className="w-full flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex-1 py-2 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-xl text-xs font-semibold text-[var(--wisp-text)]"
              >
                Copy Code ({activeChatSession.config.sessionCode})
              </button>
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 bg-[var(--wisp-glow)] text-white rounded-xl text-xs font-semibold"
              >
                Copy Invite Link
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Destroy / Leave Confirmation Modal */}
      {showDestroyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--wisp-surface)] border border-[var(--wisp-border)] p-6 rounded-2xl max-w-sm w-full flex flex-col gap-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-[var(--wisp-text)]">
              {activeChatSession?.config?.isCreator ? 'Destroy Chat Room?' : 'Leave Chat Room?'}
            </h3>
            <p className="text-xs text-[var(--wisp-muted)]">
              {activeChatSession?.config?.isCreator
                ? 'This will immediately purge the room and disconnect all participants. Messages cannot be recovered.'
                : 'You will disconnect from this ephemeral session.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--wisp-border)]">
              <button
                onClick={() => setShowDestroyConfirm(false)}
                className="px-3 py-1.5 text-xs text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveOrDestroy}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--wisp-danger)] hover:bg-[var(--wisp-danger)]/80 text-white rounded-xl transition-colors cursor-pointer"
              >
                {activeChatSession?.config?.isCreator ? 'Yes, Destroy Room' : 'Yes, Leave'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
