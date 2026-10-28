"use client";

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  UploadCloud, 
  MessageSquare, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  Download, 
  Clock, 
  RefreshCw, 
  QrCode as QrIcon, 
  X, 
  ShieldCheck, 
  Flame, 
  ShieldAlert
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import CountdownTimer from '@/components/ui/CountdownTimer';
import SpotlightCard from '@/components/ui/SpotlightCard';
import QRCode from 'qrcode';
import { useSenderHistory, SenderHistoryItem, DestroyReason } from '@/hooks/useSenderHistory';
import { supabase, destroyDrop, destroySecureText, getDropsByLookupCode, getSecureTextByCode } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useGlobalSession } from '@/context/GlobalSessionContext';

export default function ManagePage() {
  const router = useRouter();
  const { activeSessions, setViewingSessionId, removeActiveSession } = useGlobalSession();
  const { 
    activeItems, 
    logItems, 
    isLoaded, 
    markAsDestroyed, 
    clearLog, 
    updateItemStats 
  } = useSenderHistory();

  const receivedSessions = activeSessions.filter(s => s.type === 'drop' || s.type === 'text' || s.type === 'chat');
  const [activeSection, setActiveSection] = useState<'active' | 'log'>('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [qrModalItem, setQrModalItem] = useState<{ code: string; url: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [destroyConfirmId, setDestroyConfirmId] = useState<string | null>(null);

  // Poll Supabase for live view & download counts and purge status
  const fetchStatuses = useCallback(async () => {
    if (activeItems.length === 0) return;
    setIsRefreshing(true);

    try {
      await Promise.all(
        activeItems.map(async (item) => {
          if (item.type === 'drop') {
            const { data: drops } = await getDropsByLookupCode(item.dbLookupCode);
            if (drops && drops.length > 0) {
              const viewCount = drops.reduce((sum, d) => sum + (d.view_count || 0), 0);
              const downloadCount = drops.reduce((sum, d) => sum + (d.download_count || 0), 0);
              const isDestroyed = drops.every(d => d.is_destroyed);
              const lastAccessedAt = drops[0].last_accessed_at || undefined;

              updateItemStats(item.id, {
                viewCount,
                downloadCount,
                isDestroyed,
                destroyReason: isDestroyed ? 'burn' : undefined,
                lastAccessedAt,
              });
            } else {
              // Not found in active table = purged
              markAsDestroyed(item.id, 'ttl');
            }
          } else if (item.type === 'text') {
            const { data: text } = await getSecureTextByCode(item.dbLookupCode);
            if (text) {
              updateItemStats(item.id, {
                viewCount: text.view_count || 0,
                downloadCount: 0,
                isDestroyed: text.is_destroyed,
                destroyReason: text.is_destroyed ? 'burn' : undefined,
                lastAccessedAt: text.last_accessed_at || undefined,
              });
            } else {
              markAsDestroyed(item.id, 'ttl');
            }
          }
        })
      );
    } catch (e) {
      console.error('Failed to sync live statuses', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeItems, markAsDestroyed, updateItemStats]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchStatuses();

    const interval = setInterval(fetchStatuses, 8000);
    const channel = supabase.channel('manage-page-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drops' }, () => fetchStatuses())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'secure_texts' }, () => fetchStatuses())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isLoaded, fetchStatuses]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Access code copied');
  };

  const handleCopyLink = (item: SenderHistoryItem) => {
    const route = item.type === 'drop' ? 'd' : item.type === 'text' ? 't' : 'chat';
    const url = item.type === 'clipboard'
      ? `${window.location.origin}/chat?join=${item.rawCode}`
      : `${window.location.origin}/${route}/${item.rawCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(item.id);
    setTimeout(() => setCopiedLink(null), 2000);
    toast.success('Share link copied');
  };

  const handleShowQr = async (item: SenderHistoryItem) => {
    const route = item.type === 'drop' ? 'd' : item.type === 'text' ? 't' : 'chat';
    const url = item.type === 'clipboard'
      ? `${window.location.origin}/chat?join=${item.rawCode}`
      : `${window.location.origin}/${route}/${item.rawCode}`;
    try {
      const data = await QRCode.toDataURL(url, {
        width: 220,
        margin: 2,
        color: { dark: '#f8fafc', light: '#090a10' },
      });
      setQrDataUrl(data);
      setQrModalItem({ code: item.rawCode, url });
    } catch {
      toast.error('Failed to render QR code');
    }
  };

  const handleDestroyItem = async (item: SenderHistoryItem) => {
    try {
      if (item.type === 'drop') {
        await destroyDrop(item.dbLookupCode);
      } else if (item.type === 'text') {
        await destroySecureText(item.dbLookupCode);
      }
      markAsDestroyed(item.id, 'manual');
      setDestroyConfirmId(null);
      toast.success('Item destroyed and purged from server');
    } catch {
      toast.error('Failed to destroy item');
    }
  };

  const getDestroyBadge = (reason?: DestroyReason) => {
    switch (reason) {
      case 'burn':
        return <span className="text-amber-400 font-medium flex items-center gap-1"><Flame className="w-3 h-3" /> Burned</span>;
      case 'ttl':
        return <span className="text-[var(--wisp-muted)] font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Expired</span>;
      case 'panic':
        return <span className="text-red-400 font-medium flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Panic Wipe</span>;
      default:
        return <span className="text-[var(--wisp-danger)] font-medium flex items-center gap-1"><Trash2 className="w-3 h-3" /> Manual Destroy</span>;
    }
  };

  if (!isLoaded) {
    return (
      <div className="h-full min-h-dvh flex flex-col text-[var(--wisp-text)]">
        <AnimatedBackground />
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--wisp-border)] border-t-[var(--wisp-glow)] animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-dvh flex flex-col font-sans text-[var(--wisp-text)] selection:bg-[var(--wisp-glow)]/30">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 min-h-0 flex flex-col justify-center px-3 sm:px-6 pt-2 mobile-bottom-clearance z-10">
        <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col justify-center">
          
          {/* Main Card (sized from height budget, no page scroll) */}
          <SpotlightCard className="flex flex-col h-full min-h-0 max-h-full shadow-2xl p-3 sm:p-5">
            
            {/* Header: Title, Refresh, Active/Log Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--wisp-border)] shrink-0">
              {/* Top Row on mobile / Left side on desktop */}
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--wisp-text)] leading-tight truncate">
                      Session Manager
                    </h1>
                    <p className="text-[11px] text-[var(--wisp-muted)] truncate">
                      Local device tracking and cross-tab sync
                    </p>
                  </div>
                </div>

                {/* Mobile-only Refresh Button */}
                <button
                  onClick={fetchStatuses}
                  className="sm:hidden p-2 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:bg-[var(--wisp-elevated)] rounded-lg text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] transition-colors cursor-pointer shrink-0"
                  title="Refresh live status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                </button>
              </div>

              {/* Controls: Active / Log Tabs + Desktop Refresh */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <div className="grid grid-cols-2 sm:flex p-1 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl text-xs backdrop-blur-md w-full sm:w-auto">
                  <button
                    onClick={() => setActiveSection('active')}
                    className={`px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeSection === 'active'
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                        : 'text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]'
                    }`}
                  >
                    <span>Active</span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeSection === 'active' 
                        ? 'bg-white/25 text-white' 
                        : 'bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)]'
                    }`}>
                      {activeItems.length + receivedSessions.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSection('log')}
                    className={`px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeSection === 'log'
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                        : 'text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]'
                    }`}
                  >
                    <span>Log</span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeSection === 'log' 
                        ? 'bg-white/25 text-white' 
                        : 'bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)]'
                    }`}>
                      {logItems.length}
                    </span>
                  </button>
                </div>

                {/* Desktop Refresh Button */}
                <button
                  onClick={fetchStatuses}
                  className="hidden sm:flex p-2 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:bg-[var(--wisp-elevated)] rounded-lg text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] transition-colors cursor-pointer shrink-0"
                  title="Refresh live status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Content Area: Only scrolling container */}
            <div className="flex-1 min-h-0 overflow-y-auto wisp-scrollbar pt-3 pb-3 pr-0.5">
              
              {activeSection === 'active' ? (
                /* ── ACTIVE SESSIONS LIST ── */
                activeItems.length === 0 && receivedSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--wisp-muted)] select-none">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] flex items-center justify-center text-[var(--wisp-muted)] mb-3">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--wisp-text)] mb-1">
                      No active sessions
                    </h3>
                    <p className="text-xs max-w-xs text-[var(--wisp-muted)] mb-4">
                      Any file or text you share or receive will show here with instant access.
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href="/drop"
                        className="px-3 py-1.5 bg-[var(--wisp-glow)] text-white text-xs font-semibold rounded-xl hover:opacity-95 transition-opacity"
                      >
                        Drop File
                      </Link>
                      <Link
                        href="/text"
                        className="px-3 py-1.5 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl hover:bg-[var(--wisp-border)] transition-colors"
                      >
                        Share Text
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* 1. Received / Decrypted Sessions */}
                    {receivedSessions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2 px-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wisp-text)]">
                              Received in Memory
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                              {receivedSessions.length} active
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--wisp-muted)] hidden sm:inline">
                            Available until expired or closed
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <AnimatePresence>
                            {receivedSessions.map((session) => (
                              <motion.div
                                key={session.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-sm transition-all backdrop-blur-md"
                              >
                                {/* Top: Icon, Title, ID, Status, and Delete */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                                      {session.type === 'drop' && <UploadCloud className="w-4 h-4" />}
                                      {session.type === 'text' && <FileText className="w-4 h-4" />}
                                      {session.type === 'chat' && <MessageSquare className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0 flex flex-col">
                                      <h4 className="text-xs sm:text-sm font-bold text-[var(--wisp-text)] truncate max-w-[170px] sm:max-w-[240px]">
                                        {session.title}
                                      </h4>
                                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--wisp-muted)]">
                                        <span>{session.id}</span>
                                        <span>•</span>
                                        <span className="text-emerald-400 font-medium">Decrypted & Ready</span>
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => removeActiveSession(session.id)}
                                    className="p-1.5 hover:bg-rose-500/20 text-[var(--wisp-muted)] hover:text-rose-400 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Remove from active memory"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Bottom: Action Buttons */}
                                <div className="flex items-center gap-2 pt-1 border-t border-[var(--wisp-border)]/50">
                                  <button
                                    onClick={() => {
                                      if (session.type === 'chat') {
                                        router.push(`/chat?join=${session.id}`);
                                      } else {
                                        setViewingSessionId(session.id);
                                      }
                                    }}
                                    className="flex-1 py-1.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{session.type === 'chat' ? 'Open Chat' : 'Reopen'}</span>
                                  </button>

                                  {session.type === 'drop' && !session.burnAfterReading && session.files[0]?.blobUrl && (
                                    <a
                                      href={session.files[0].blobUrl}
                                      download={session.files[0].drop.encrypted_filename || 'file'}
                                      className="py-1.5 px-3 bg-[var(--wisp-surface)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-lg text-[var(--wisp-text)] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                                      title="Download file"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Save</span>
                                    </a>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {/* 2. Sent Transmissions */}
                    {activeItems.length > 0 && (
                      <div>
                        {receivedSessions.length > 0 && (
                          <div className="flex items-center gap-2 mb-2 px-0.5 pt-2 border-t border-[var(--wisp-border)]">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--wisp-text)]">
                              Sent Transmissions
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-muted)]">
                              {activeItems.length}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <AnimatePresence>
                            {activeItems.map((item) => {
                              const isDrop = item.type === 'drop';
                              const isText = item.type === 'text';
                              const title = item.filenames && item.filenames.length > 0
                                ? (item.filenames.length === 1 ? item.filenames[0] : `${item.filenames[0]} +${item.filenames.length - 1} more`)
                                : (item.nameOrSnippet || (isDrop ? 'Encrypted File' : isText ? 'Secure Text' : 'Chat Room'));

                              return (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm transition-all backdrop-blur-md"
                                >
                            <div>
                              {/* Top Bar: Icon, Title, Actions */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center shrink-0">
                                    {isDrop ? <UploadCloud className="w-4 h-4" /> : isText ? <FileText className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[var(--wisp-text)] truncate max-w-[180px] sm:max-w-[220px]">
                                      {title}
                                    </div>
                                    <div className="text-[10px] text-[var(--wisp-muted)] font-mono">
                                      Created {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleShowQr(item)}
                                    className="p-1.5 hover:bg-[var(--wisp-elevated)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] rounded-lg transition-colors cursor-pointer"
                                    title="Show QR Code"
                                  >
                                    <QrIcon className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleCopyLink(item)}
                                    className="p-1.5 hover:bg-[var(--wisp-elevated)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] rounded-lg transition-colors cursor-pointer"
                                    title="Copy share link"
                                  >
                                    {copiedLink === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>

                                  {destroyConfirmId === item.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleDestroyItem(item)}
                                        className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-md cursor-pointer"
                                      >
                                        Destroy
                                      </button>
                                      <button
                                        onClick={() => setDestroyConfirmId(null)}
                                        className="p-1 text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDestroyConfirmId(item.id)}
                                      className="p-1.5 hover:bg-rose-500/20 text-[var(--wisp-muted)] hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                      title="Destroy item immediately"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Access Code and Counters row */}
                              <div className="grid grid-cols-3 gap-2 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-lg p-2 text-center text-xs backdrop-blur-sm">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-[var(--wisp-muted)] uppercase">Code</span>
                                  <button
                                    onClick={() => handleCopyCode(item.rawCode)}
                                    className="font-mono font-bold text-[11px] text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{item.rawCode}</span>
                                    {copiedCode === item.rawCode && <Check className="w-3 h-3 text-emerald-500" />}
                                  </button>
                                </div>

                                <div className="flex flex-col items-center border-x border-[var(--wisp-border)]">
                                  <span className="text-[10px] text-[var(--wisp-muted)] uppercase flex items-center gap-0.5">
                                    <Eye className="w-2.5 h-2.5" /> Views
                                  </span>
                                  <span className="font-mono font-semibold text-[11px] text-[var(--wisp-text)]">
                                    {item.viewCount || 0}
                                  </span>
                                </div>

                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-[var(--wisp-muted)] uppercase flex items-center gap-0.5">
                                    <Download className="w-2.5 h-2.5" /> Saves
                                  </span>
                                  <span className="font-mono font-semibold text-[11px] text-[var(--wisp-text)]">
                                    {item.downloadCount || 0}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Countdown bar */}
                            <div className="pt-1">
                              <CountdownTimer expiresAt={item.expiresAt} size="sm" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
                /* ── DESTRUCTION LOG (METADATA ONLY) ── */
                logItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--wisp-muted)] select-none">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] flex items-center justify-center text-[var(--wisp-muted)] mb-3">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--wisp-text)] mb-1">
                      Destruction log is clean
                    </h3>
                    <p className="text-xs max-w-xs text-[var(--wisp-muted)]">
                      Destroyed or expired items are recorded here with metadata only. No content is stored.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1.5 px-1 text-xs text-[var(--wisp-muted)]">
                      <span>Metadata history of purged sessions</span>
                      <button
                        onClick={() => { clearLog(); toast.success('Destruction log cleared'); }}
                        className="text-[11px] text-[var(--wisp-danger)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Clear log
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {logItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[var(--wisp-elevated)]/60 border border-[var(--wisp-border)] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-[11px] text-[var(--wisp-muted)]">
                              {item.rawCode}
                            </span>
                            <span className="text-[var(--wisp-text)] font-medium truncate max-w-[160px] sm:max-w-[240px]">
                              {item.filenames?.[0] || item.nameOrSnippet || `${item.type.toUpperCase()} session`}
                            </span>
                            <span className="text-[10px] bg-[var(--wisp-surface)] px-1.5 py-0.5 rounded text-[var(--wisp-muted)] border border-[var(--wisp-border)]">
                              {item.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                            <div className="flex items-center gap-1 text-[var(--wisp-muted)]">
                              <Eye className="w-3 h-3" />
                              <span>{item.viewCount || 0}</span>
                            </div>

                            <div className="flex items-center gap-1 text-[var(--wisp-muted)]">
                              <Download className="w-3 h-3" />
                              <span>{item.downloadCount || 0}</span>
                            </div>

                            <div>
                              {getDestroyBadge(item.destroyReason)}
                            </div>

                            <span className="text-[10px] text-[var(--wisp-muted)]">
                              {item.destroyedAt ? new Date(item.destroyedAt).toLocaleDateString() : 'Purged'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

            </div>

          </SpotlightCard>

        </div>
      </main>

      {/* QR Code Popover Modal */}
      {qrModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setQrModalItem(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel p-6 rounded-2xl max-w-xs w-full flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-[var(--wisp-text)]">Scan to access</span>
              <button onClick={() => setQrModalItem(null)} className="text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {qrDataUrl && (
              <div className="p-3 bg-white rounded-xl shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Phantom QR Code" className="w-44 h-44" />
              </div>
            )}
            <div className="font-mono text-center text-sm font-bold tracking-widest text-[var(--wisp-glow)]">
              {qrModalItem.code}
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
