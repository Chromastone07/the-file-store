"use client";

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, ShieldAlert, ArrowRight, FileText, Key, Trash2, RefreshCw } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { useSenderHistory, SenderHistoryItem } from '@/hooks/useSenderHistory';
import { supabase } from '@/lib/supabase';
import { destroyDrop, destroySecureText } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';

interface LiveStatus {
  view_count: number;
  is_destroyed: boolean;
}

export default function ManagePage() {
  const { history, isLoaded, removeHistoryItem, markAsDestroyed, clearHistory } = useSenderHistory();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'drop' | 'text' | 'clipboard'>('drop');

  // Poll Supabase for live statuses
  const fetchStatuses = useCallback(async () => {
    if (history.length === 0) return;
    setIsRefreshing(true);

    try {
      const dropCodes = history.filter(h => h.type === 'drop').map(h => h.dbLookupCode);
      const textCodes = history.filter(h => h.type === 'text').map(h => h.dbLookupCode);

      const statuses: Record<string, LiveStatus> = {};

      if (dropCodes.length > 0) {
        const { data: drops } = await supabase
          .from('drops')
          .select('session_code, group_code, view_count, is_destroyed')
          .or(`session_code.in.(${dropCodes.join(',')}),group_code.in.(${dropCodes.join(',')})`);
        
        drops?.forEach(d => {
          const key = d.group_code || d.session_code;
          if (!statuses[key]) {
            statuses[key] = { view_count: 0, is_destroyed: true };
          }
          statuses[key].view_count += (d.view_count || 0);
          if (!d.is_destroyed) {
            statuses[key].is_destroyed = false;
          }
        });
      }

      if (textCodes.length > 0) {
        const { data: texts } = await supabase
          .from('secure_texts')
          .select('session_code, view_count, is_destroyed')
          .in('session_code', textCodes);
        
        texts?.forEach(d => {
          statuses[d.session_code] = { view_count: d.view_count || 0, is_destroyed: d.is_destroyed };
        });
      }

      setLiveStatuses(statuses);
    } catch (e) {
      console.error('Failed to fetch live statuses', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [history]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchStatuses();
    
    const interval = setInterval(fetchStatuses, 10000);
    const channel = supabase.channel('manage-page-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drops' }, () => fetchStatuses())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'secure_texts' }, () => fetchStatuses())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isLoaded, fetchStatuses]);

  const handleDestroy = async (item: SenderHistoryItem) => {
    try {
      toast.info('Destroying...', { id: `destroy-${item.dbLookupCode}` });
      if (item.type === 'drop') {
        await destroyDrop(item.dbLookupCode);
      } else {
        await destroySecureText(item.dbLookupCode);
      }
      markAsDestroyed(item.id);
      setLiveStatuses(prev => ({
        ...prev,
        [item.dbLookupCode]: { ...prev[item.dbLookupCode], is_destroyed: true }
      }));
      toast.success('File destroyed successfully', { id: `destroy-${item.dbLookupCode}` });
    } catch (e) {
      toast.error('Failed to destroy file', { id: `destroy-${item.dbLookupCode}` });
    }
  };

  const handleRemoveLocal = (id: string) => {
    removeHistoryItem(id);
    toast.success('Removed from local history');
  };

  if (!isLoaded) return null;

  return (
    <div className="relative min-h-screen flex flex-col font-sans bg-[var(--phantom-bg)] text-[var(--phantom-text)]">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow z-10 pt-[120px] pb-20 px-4 md:px-8 max-w-5xl mx-auto w-full flex items-start">
        <div className="w-full">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.01em] mb-1.5 text-[var(--phantom-text)]">Your sessions</h1>
              <p className="text-sm text-[var(--phantom-muted)]">Tracked locally on this device only. Nothing here is tied to an account.</p>
            </div>
            <button 
              onClick={fetchStatuses}
              className="p-3 bg-[var(--phantom-surface)] hover:bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-full transition-colors group"
            >
              <RefreshCw className={`w-5 h-5 text-[var(--phantom-text)] ${isRefreshing ? 'animate-spin' : 'group-hover:text-[var(--phantom-glow)]'}`} />
            </button>
          </div>

          <div className="flex gap-1.5 mb-6 border-b border-[var(--phantom-border)] pb-0">
            {(['drop', 'text', 'clipboard'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[13.5px] font-medium px-2 py-2.5 relative transition-colors ${activeTab === tab ? 'text-[var(--phantom-text)]' : 'text-[var(--phantom-muted)] hover:text-[var(--phantom-text)]'}`}
              >
                {tab === 'drop' ? 'Files' : tab === 'text' ? 'Text' : 'Clipboard'}
                <span className="font-mono text-[10.5px] text-[var(--phantom-muted)] ml-1.5 bg-[var(--phantom-elevated)] px-1.5 py-[2px] rounded-full">
                  {history.filter(h => h.type === tab).length}
                </span>
                {activeTab === tab && (
                  <div className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-sm bg-gradient-to-r from-[var(--phantom-glow)] to-[var(--phantom-accent)]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col">
            {history.filter(h => h.type === activeTab).length === 0 ? (
              <div className="text-center py-16 px-5 text-[var(--phantom-muted)] border border-dashed border-[var(--phantom-border)] rounded-2xl bg-[var(--phantom-surface)]/50">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-[var(--phantom-muted)]" />
                <p className="text-[13.5px] mb-5">No sessions found in this category.</p>
                <Link href={activeTab === 'text' ? '/text' : activeTab === 'drop' ? '/drop' : '/clipboard'} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--phantom-text)] text-[var(--phantom-bg)] rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5">
                  Start a session <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <AnimatePresence>
                {history.filter(h => h.type === activeTab).map((item) => {
                  const status = liveStatuses[item.dbLookupCode];
                  const isDestroyed = status?.is_destroyed ?? item.isDestroyed;
                  const isExpired = new Date(item.expiresAt).getTime() < Date.now();
                  const isDead = isDestroyed || isExpired;
                  
                  const now = Date.now();
                  const expiresAtTime = new Date(item.expiresAt).getTime();
                  const diffSeconds = Math.max(0, Math.floor((expiresAtTime - now) / 1000));
                  const m = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                  const s = (diffSeconds % 60).toString().padStart(2, '0');

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, x: 12 }}
                      className={`flex flex-wrap sm:flex-nowrap items-center gap-4 border rounded-2xl p-4 md:p-[18px_20px] mb-3 transition-all ${
                        isDead ? 'bg-[var(--phantom-surface)]/30 border-[var(--phantom-border)] opacity-60' : 'bg-[var(--phantom-surface)] border-[var(--phantom-border)] hover:-translate-y-0.5 hover:border-[var(--phantom-glow)]/50 hover:shadow-[0_16px_32px_-20px_rgba(124,158,255,0.25)]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] flex items-center justify-center shrink-0">
                        {item.type === 'drop' ? (
                          <svg className="w-[17px] h-[17px] text-[var(--phantom-glow)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        ) : item.type === 'text' ? (
                          <svg className="w-[17px] h-[17px] text-[var(--phantom-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                        ) : (
                          <svg className="w-[17px] h-[17px] text-[var(--phantom-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="6" y="4" width="12" height="18" rx="2"/><path d="M9 2h6v3H9z"/></svg>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate text-[var(--phantom-text)]">
                          {item.type === 'drop' && item.filenames?.length ? item.filenames.join(', ') : item.type === 'text' ? 'Secure Text Note' : 'Clipboard Session'}
                        </div>
                        <div className="flex flex-wrap gap-3.5 font-mono text-[11px] text-[var(--phantom-muted)] mt-1">
                          <span>Code {item.rawCode}</span>
                          {!isDead ? (
                            <span className={diffSeconds < 60 ? 'text-[var(--phantom-danger)]' : ''}>
                              {m}:{s} left
                            </span>
                          ) : (
                            <span className="text-[var(--phantom-muted)]">
                              {isDestroyed 
                                ? `Destroyed${item.destroyedAt ? ` ${new Date(item.destroyedAt).toLocaleString()}` : ''}` 
                                : `Expired ${new Date(item.expiresAt).toLocaleString()}`}
                            </span>
                          )}
                          {item.type !== 'clipboard' && (
                            <span>{status?.view_count ?? 0} views</span>
                          )}
                        </div>
                      </div>

                      {isDead ? (
                        <span className="font-mono text-[10.5px] px-2.5 py-1 rounded-full bg-[var(--phantom-danger)]/10 text-[var(--phantom-danger)] shrink-0">
                          {isDestroyed ? 'Destroyed' : 'Expired'}
                        </span>
                      ) : (
                        <span className="font-mono text-[10.5px] px-2.5 py-1 rounded-full bg-[var(--phantom-success)]/10 text-[var(--phantom-success)] shrink-0">
                          Ready
                        </span>
                      )}

                      <div className="flex gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}/${item.type === 'drop' ? 'd' : 't'}/${item.rawCode}`;
                            navigator.clipboard.writeText(url);
                            toast.success('Link copied');
                          }}
                          className="p-2 rounded-lg border border-[var(--phantom-border)] hover:border-[var(--phantom-text)] hover:text-[var(--phantom-text)] transition-colors text-[var(--phantom-muted)] bg-transparent flex items-center justify-center h-[38px] w-[38px]"
                          aria-label="Copy link"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                        </button>
                        
                        {isDead ? (
                          <button 
                            onClick={() => handleRemoveLocal(item.id)}
                            className="px-4 py-2 text-[13px] font-medium rounded-lg border border-[var(--phantom-border)] text-[var(--phantom-muted)] hover:border-[var(--phantom-text)] hover:text-[var(--phantom-text)] transition-all bg-transparent h-[38px]"
                          >
                            Remove
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleDestroy(item)}
                            className="px-4 py-2 text-[13px] font-medium rounded-lg border border-[var(--phantom-danger)]/30 text-[var(--phantom-danger)] hover:border-[var(--phantom-danger)] hover:-translate-y-[2px] hover:shadow-[0_12px_24px_-10px_rgba(255,107,107,0.25)] transition-all bg-transparent h-[38px]"
                          >
                            Purge
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
              })}
            </AnimatePresence>
            )}

            {history.length > 0 && (
              <div className="mt-8 text-center">
                <button
                  onClick={clearHistory}
                  className="text-sm text-[var(--phantom-muted)] hover:text-[var(--phantom-danger)] transition-colors"
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
