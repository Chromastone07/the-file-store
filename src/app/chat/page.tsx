"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalSession } from '@/context/GlobalSessionContext';
import { createClipboardSession, getClipboardSession, deleteClipboardSession } from '@/lib/supabase';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import QRCode from 'qrcode';
import { Copy, Link as LinkIcon, Send, Shield, Activity, Users, PlusCircle, LogOut, Clock, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export default function ClipboardPage() {
  const { 
    activeSessions,
    chatHistories, 
    connectToChat, 
    sendChatMessage,
    removeActiveSession
  } = useGlobalSession();

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const activeChatId = searchParams?.get('join');
  
  const activeChatSession = activeSessions.find(s => s.id === activeChatId && s.type === 'chat') as any;
  const chatHistory = activeChatId ? (chatHistories[activeChatId] || []) : [];

  const [joinCode, setJoinCode] = useState('');
  const [inputText, setInputText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings for creator
  const [durationMins, setDurationMins] = useState(15);
  const [maxUsers, setMaxUsers] = useState(2);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChatSession?.config?.isCreator) {
      const url = `${window.location.origin}/chat?join=${activeChatSession.config.sessionCode}`;
      QRCode.toDataURL(url, {
        color: { dark: '#e2e8f0', light: '#0d0d1a' }, margin: 2
      }).then(setQrUrl).catch(console.error);
    }
  }, [activeChatSession]);

  useEffect(() => {
    // Auto scroll to bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCodeParam = urlParams.get('join');
    if (joinCodeParam && !activeSessions.some(s => s.id === joinCodeParam)) {
      setJoinCode(joinCodeParam);
      handleJoin(joinCodeParam);
    }
  }, []);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreate = async () => {
    setIsProcessing(true);
    try {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + durationMins * 60000);

      // Create DB Record
      const { error } = await createClipboardSession({
        session_code: code,
        max_users: maxUsers,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      connectToChat({
        sessionCode: code,
        maxUsers,
        expiresAt,
        isCreator: true
      });
      
      // Auto-navigate to the new session
      window.history.pushState({}, '', `/chat?join=${code}`);
      
    } catch (err) {
      toast.error('Failed to create session');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoin = async (codeToJoin: string) => {
    if (!codeToJoin) return;
    setIsProcessing(true);
    try {
      const code = codeToJoin.toUpperCase();
      const { data, error } = await getClipboardSession(code);
      
      if (error || !data) {
        toast.error('Session not found or expired.');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast.error('Session has expired.');
        return;
      }

      connectToChat({
        sessionCode: code,
        maxUsers: data.max_users,
        expiresAt: new Date(data.expires_at),
        isCreator: false
      });
      
      window.history.pushState({}, '', `/chat?join=${code}`);

    } catch (err) {
      toast.error('Error joining session');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeChatId) return;
    sendChatMessage(activeChatId, inputText);
    setInputText('');
  };

  const handleLeave = async () => {
    if (!activeChatId) return;
    if (activeChatSession?.config?.isCreator) {
      try {
        await deleteClipboardSession(activeChatId);
      } catch (e) {}
    }
    removeActiveSession(activeChatId);
    window.history.pushState({}, '', '/chat');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl flex flex-col h-full"
        >
          {!activeChatSession ? (
            <div className="w-full flex flex-col gap-8 max-w-4xl mx-auto py-12">
              <div className="text-center">
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--phantom-text)] mb-3">
                  Secure Chat Room
                </h1>
                <p className="text-[var(--phantom-muted)] text-lg">
                  Ephemeral, zero-knowledge chat. Navigate away and the session stays alive.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Create Session Card */}
                <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] p-8 rounded-2xl shadow-xl flex flex-col justify-between gap-6 backdrop-blur-sm">
                  <div className="text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-[var(--phantom-glow)]/10 rounded-full flex items-center justify-center text-[var(--phantom-glow)] mb-4">
                      <PlusCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--phantom-text)] mb-2">Create Room</h3>
                    <p className="text-[var(--phantom-muted)] text-sm mb-6">Start a new ephemeral chat room and share the code.</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-[var(--phantom-muted)] mb-2">
                        <Clock className="w-4 h-4" /> Room Lifespan
                      </label>
                      <select 
                        value={durationMins} 
                        onChange={e => setDurationMins(Number(e.target.value))}
                        className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] text-[var(--phantom-text)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--phantom-glow)]"
                      >
                        <option value={5}>5 Minutes</option>
                        <option value={15}>15 Minutes</option>
                        <option value={60}>1 Hour</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-[var(--phantom-muted)] mb-2">
                        <Users className="w-4 h-4" /> Max Participants
                      </label>
                      <select 
                        value={maxUsers} 
                        onChange={e => setMaxUsers(Number(e.target.value))}
                        className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] text-[var(--phantom-text)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--phantom-glow)]"
                      >
                        <option value={2}>2 Users</option>
                        <option value={3}>3 Users</option>
                        <option value={5}>5 Users</option>
                        <option value={10}>10 Users</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={isProcessing}
                    className="w-full bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white py-3.5 rounded-xl font-semibold transition-colors shadow-lg disabled:opacity-50"
                  >
                    {isProcessing ? 'Creating...' : 'Generate Secure Code'}
                  </button>
                </div>

                {/* Join Session Card */}
                <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] p-8 rounded-2xl shadow-xl flex flex-col justify-between gap-6 backdrop-blur-sm">
                  <div className="text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-full flex items-center justify-center text-[var(--phantom-text)] mb-4">
                      <LinkIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--phantom-text)] mb-2">Join Room</h3>
                    <p className="text-[var(--phantom-muted)] text-sm mb-6">Enter a session code to securely connect.</p>
                  </div>

                  <div className="flex-grow flex items-center justify-center">
                    <div className="w-full flex gap-2">
                      <input
                        type="text"
                        placeholder="CODE..."
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        className="flex-1 bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-xl px-4 py-3.5 text-[var(--phantom-text)] uppercase font-mono tracking-widest text-center text-lg focus:outline-none focus:border-[var(--phantom-glow)]"
                        maxLength={6}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleJoin(joinCode)}
                    disabled={joinCode.length < 5 || isProcessing}
                    className="w-full bg-[var(--phantom-surface)] border border-[var(--phantom-border)] hover:bg-[var(--phantom-elevated)] text-[var(--phantom-text)] py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? 'Connecting...' : 'Connect to Session'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden flex flex-col flex-grow md:h-[80vh] w-full">
              {/* Chat Header */}
              <div className="bg-[var(--phantom-elevated)] border-b border-[var(--phantom-border)] p-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${activeChatSession.connected ? 'bg-[var(--phantom-success)] shadow-[0_0_8px_var(--phantom-success)]' : 'bg-[var(--phantom-warning)] animate-pulse'}`}></div>
                      <span className="font-bold text-[var(--phantom-text)] flex items-center gap-2">
                        Session: <span className="font-mono tracking-widest text-[var(--phantom-glow)]">{activeChatSession.config.sessionCode}</span>
                      </span>
                    </div>
                    <span className="text-xs text-[var(--phantom-muted)] flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" /> Max {activeChatSession.config.maxUsers}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={handleLeave}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--phantom-danger)] hover:bg-[var(--phantom-danger)]/80 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{activeChatSession.config.isCreator ? 'Destroy Room' : 'Leave'}</span>
                </button>
              </div>

              {/* Main Chat Layout */}
              <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                
                {/* Optional Sidebar for QR / Metadata if Creator */}
                {activeChatSession.config.isCreator && (
                  <div className="hidden md:flex flex-col w-64 border-r border-[var(--phantom-border)] bg-[var(--phantom-elevated)]/30 p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--phantom-muted)] mb-4 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" /> Invite
                    </h3>
                    {qrUrl ? (
                      <div className="bg-white p-2 rounded-xl mb-4 self-center shadow-md">
                        <img src={qrUrl} alt="QR Code" className="w-32 h-32" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-[var(--phantom-border)] animate-pulse rounded-xl self-center mb-4"></div>
                    )}
                    <button 
                      onClick={() => copyToClipboard(`${window.location.origin}/chat?join=${activeChatSession.config.sessionCode}`)}
                      className="text-xs bg-[var(--phantom-surface)] border border-[var(--phantom-border)] hover:bg-[var(--phantom-elevated)] transition-colors py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Copy className="w-3 h-3" /> Copy Link
                    </button>
                  </div>
                )}

                {/* Chat Area */}
                <div className="flex flex-col flex-grow relative bg-[var(--phantom-surface)]/50">
                  {/* Messages */}
                  <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                    {chatHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--phantom-muted)] opacity-70">
                        <Shield className="w-12 h-12 mb-4 text-[var(--phantom-border)]" />
                        <p className="text-sm text-center max-w-xs">End-to-end encrypted chat. Messages are never stored on the server. Navigating away keeps the session active.</p>
                      </div>
                    ) : (
                      chatHistory.map((msg: any) => (
                        <div 
                          key={msg.id} 
                          className={`flex ${msg.type === 'system' ? 'justify-center' : msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.type === 'system' ? (
                            <div className="bg-[var(--phantom-elevated)]/50 text-[var(--phantom-muted)] text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border border-[var(--phantom-border)]">
                              {msg.text}
                            </div>
                          ) : (
                            <div className={`group relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${msg.type === 'sent' ? 'bg-[var(--phantom-glow)] text-white rounded-tr-sm' : 'bg-[var(--phantom-elevated)] text-[var(--phantom-text)] border border-[var(--phantom-border)] rounded-tl-sm'}`}>
                              <p className="text-sm sm:text-base whitespace-pre-wrap break-words">{msg.text}</p>
                              <div className={`text-[10px] mt-1 opacity-60 ${msg.type === 'sent' ? 'text-right text-blue-100' : 'text-left text-[var(--phantom-muted)]'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              
                              {/* Copy button appears on hover */}
                              <button
                                onClick={() => copyToClipboard(msg.text)}
                                className={`absolute top-2 ${msg.type === 'sent' ? '-left-10 text-[var(--phantom-muted)] hover:text-[var(--phantom-text)]' : '-right-10 text-[var(--phantom-muted)] hover:text-[var(--phantom-text)]'} opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-[var(--phantom-surface)] rounded-md border border-[var(--phantom-border)] shadow-sm`}
                                title="Copy message"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Bar */}
                  <div className="p-4 border-t border-[var(--phantom-border)] bg-[var(--phantom-surface)]">
                    <form onSubmit={handleSend} className="flex items-end gap-2 max-w-4xl mx-auto">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        disabled={!activeChatSession.connected}
                        placeholder={activeChatSession.connected ? "Type a secure message..." : "Waiting for connection..."}
                        className="flex-grow bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-2xl px-4 py-3 text-sm sm:text-base text-[var(--phantom-text)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors resize-none max-h-32 min-h-[44px]"
                        rows={1}
                        style={{ height: 'auto' }}
                      />
                      <button
                        type="submit"
                        disabled={!activeChatSession.connected || !inputText.trim()}
                        className="bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white p-3.5 rounded-2xl transition-all disabled:opacity-50 disabled:scale-100 hover:scale-105 active:scale-95 flex-shrink-0 shadow-md"
                      >
                        <Send className="w-5 h-5 ml-1" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
