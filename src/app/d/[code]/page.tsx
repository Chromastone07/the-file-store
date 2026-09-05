"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { decryptData, decryptWithPassword, hashString } from '@/lib/crypto';
import { getDropsByLookupCode, getSignedDownloadUrl, recordView, destroyExpiredDrop, supabase } from '@/lib/supabase';
import type { DropRecord } from '@/lib/supabase';
import { getFileCategory, formatFileSize, extractKeyFromFragment } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import FileViewerModal from '@/components/viewers/FileViewerModal';
import CountdownTimer from '@/components/ui/CountdownTimer';
import Link from 'next/link';

type AccessState = 'loading' | 'password-required' | 'key-required' | 'decrypting' | 'ready' | 'destroyed' | 'error' | 'expired';

interface DecryptedFile {
  drop: DropRecord;
  blobUrl: string;
  textContent: string;
}

export default function AccessDropPage() {
  const params = useParams();
  const code = params.code as string;
  
  const [state, setState] = useState<AccessState>('loading');
  const [drops, setDrops] = useState<DropRecord[]>([]);
  const [password, setPassword] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [decryptedFiles, setDecryptedFiles] = useState<DecryptedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const dbLookupCodeRef = useRef<string>('');
  
  // Track if a view has been recorded for the currently active file during this modal session
  const viewRecordedRef = useRef<Set<string>>(new Set());
  const pendingDestroyedRef = useRef<Set<string>>(new Set());
  const [triggerCleanup, setTriggerCleanup] = useState(0);
  const expiryFiredRef = useRef(false);

  // ── SECURITY: Revoke all blob URLs and wipe decrypted state ──
  const nukeDecryptedState = useCallback(() => {
    setDecryptedFiles(prev => {
      prev.forEach(f => URL.revokeObjectURL(f.blobUrl));
      return [];
    });
    setIsViewerOpen(false);
    setActiveFileIndex(0);
  }, []);

  // ── SECURITY: Handle client-side expiry enforcement ──
  const handleExpired = useCallback(() => {
    if (expiryFiredRef.current) return;
    expiryFiredRef.current = true;
    nukeDecryptedState();
    setState('expired');
    // Also trigger server-side cleanup for all drops in this session
    drops.forEach(d => {
      destroyExpiredDrop(d.session_code).catch(() => {});
    });
  }, [nukeDecryptedState, drops]);

  useEffect(() => {
    const fetchDrop = async () => {
      try {
        const rawCode = code.toUpperCase();
        const isLegacy = rawCode.length === 6;
        let dbLookupCode = rawCode;

        if (!isLegacy) {
          dbLookupCode = await hashString(rawCode);
        }
        dbLookupCodeRef.current = dbLookupCode;

        const { data: dropList } = await getDropsByLookupCode(dbLookupCode);
        
        if (dropList && dropList.length > 0) {
          const activeDrops = dropList.filter(d => !d.is_destroyed);
          if (activeDrops.length === 0) {
            setState('destroyed');
            return;
          }

          const now = new Date();
          if (now > new Date(activeDrops[0].expires_at)) { setState('expired'); return; }
          
          setDrops(activeDrops);
          if (activeDrops[0].has_password) { setState('password-required'); } 
          else { handleDecryption(activeDrops); }
          return;
        }

        setState('destroyed');
      } catch (err) {
        console.error(err);
        setState('error');
        setErrorMsg('Failed to load file details.');
      }
    };

    if (code) fetchDrop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Real-time subscription + polling fallback for purge detection
  useEffect(() => {
    if (drops.length === 0 || state === 'destroyed' || state === 'expired' || state === 'loading') return;
    
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await getDropsByLookupCode(dbLookupCodeRef.current);
        if (data) {
          const now = new Date();
          let allExpiredOrDestroyed = true;
          data.forEach(d => {
            if (d.is_destroyed) {
              pendingDestroyedRef.current.add(d.session_code);
            } else if (new Date(d.expires_at) < now) {
              // Server confirms expiry — enforce client-side
              pendingDestroyedRef.current.add(d.session_code);
            } else {
              allExpiredOrDestroyed = false;
            }
          });
          if (allExpiredOrDestroyed && data.length > 0) {
            handleExpired();
          }
          setTriggerCleanup(t => t + 1);
        }
      } catch {}
    }, 5000);

    const channels = drops.map(drop => {
      return supabase
        .channel(`drop-watch-${drop.session_code}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'drops', filter: `session_code=eq.${drop.session_code}` },
          (payload: any) => {
            if (payload.new?.is_destroyed) {
              pendingDestroyedRef.current.add(drop.session_code);
              setTriggerCleanup(t => t + 1);
            }
          }
        )
        .subscribe();
    });

    return () => {
      clearInterval(pollInterval);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, state]);

  // Dedicated cleanup effect for BAR files
  useEffect(() => {
    if (pendingDestroyedRef.current.size === 0) return;
    
    const activeSessionCode = (isViewerOpen && decryptedFiles[activeFileIndex]) 
      ? decryptedFiles[activeFileIndex].drop.session_code 
      : null;

    let removedAny = false;

    setDecryptedFiles(prev => {
      const updated = prev.filter(f => {
        const isPending = pendingDestroyedRef.current.has(f.drop.session_code);
        const isCurrentlyViewing = activeSessionCode === f.drop.session_code;
        if (isPending && !isCurrentlyViewing) {
          URL.revokeObjectURL(f.blobUrl);
          removedAny = true;
          return false;
        }
        return true;
      });

      if (removedAny && updated.length === 0) {
        setState('destroyed');
      }
      return updated;
    });

    if (removedAny) {
      setDrops(prev => prev.filter(d => {
        const isPending = pendingDestroyedRef.current.has(d.session_code);
        const isCurrentlyViewing = activeSessionCode === d.session_code;
        return !(isPending && !isCurrentlyViewing);
      }));
    }

  }, [activeFileIndex, isViewerOpen, triggerCleanup]);

  const handleDecryption = async (dropList: DropRecord[], providedPassword?: string) => {
    setState('decrypting');
    try {
      const rawCode = code.toUpperCase();
      const isLegacy = rawCode.length === 6;
      
      const results: DecryptedFile[] = [];

      for (const dropData of dropList) {
        const signedUrl = await getSignedDownloadUrl(dropData.storage_path);
        if (!signedUrl) continue;
        const response = await fetch(signedUrl);
        if (!response.ok) continue;
        const ciphertext = await response.arrayBuffer();

        let plaintext: ArrayBuffer;
        if (isLegacy) {
          if (dropData.has_password && providedPassword) {
            if (!dropData.encryption_salt) continue;
            plaintext = await decryptWithPassword(ciphertext, providedPassword, dropData.encryption_iv, dropData.encryption_salt);
          } else {
            const parsedManualKey = (manualKey.includes('#') ? manualKey.split('#').pop() : manualKey)?.trim();
            const keyBase64 = parsedManualKey || extractKeyFromFragment();
            if (!keyBase64) { setState('key-required'); return; }
            const { importKeyFromBase64 } = await import('@/lib/crypto');
            const key = await importKeyFromBase64(keyBase64);
            plaintext = await decryptData(ciphertext, key, dropData.encryption_iv);
          }
        } else {
          if (!dropData.encryption_salt) continue;
          if (dropData.has_password) {
            if (!providedPassword) { setState('password-required'); return; }
            const combinedPassword = `${rawCode}-${providedPassword}`;
            plaintext = await decryptWithPassword(ciphertext, combinedPassword, dropData.encryption_iv, dropData.encryption_salt);
          } else {
            plaintext = await decryptWithPassword(ciphertext, rawCode, dropData.encryption_iv, dropData.encryption_salt);
          }
        }

        const fileType = dropData.file_type || 'application/octet-stream';
        const blob = new Blob([plaintext], { type: fileType });
        const objectUrl = URL.createObjectURL(blob);

        let textContent = '';
        const category = getFileCategory(fileType);
        if (category === 'code' || category === 'document') {
          try { textContent = new TextDecoder().decode(plaintext); } catch (e) {}
        }

        results.push({ drop: dropData, blobUrl: objectUrl, textContent });
      }

      // Note: we don't record view on load anymore. We record view only when the file is opened in the viewer modal.

      setDecryptedFiles(results);
      setState('ready');

      // SECURITY: Scrub the session code from the URL bar so it can't be shoulder-surfed or saved in browser history
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/d/accessed`);
      }
    } catch (err: any) {
      console.error('Decryption error:', err.message || err);
      setState('error');
      if (err instanceof DOMException && err.name === 'DataError') {
        setErrorMsg('Invalid decryption key. Ensure you copied the full link correctly.');
      } else {
        setErrorMsg('Decryption failed. Invalid password or key.');
      }
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drops.length > 0 && password) handleDecryption(drops, password);
  };

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drops.length > 0 && manualKey) handleDecryption(drops);
  };

  const activeFile = decryptedFiles[activeFileIndex];
  const isMulti = decryptedFiles.length > 1;

  return (
    <div className="min-h-screen flex flex-col relative text-[var(--phantom-text)]">
      <AnimatedBackground />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center z-10">
        
        {state === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <svg className="animate-spin w-12 h-12 text-[var(--phantom-glow)] mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-lg font-medium text-[var(--phantom-muted)]">Retrieving...</div>
          </motion.div>
        )}

        {state === 'password-required' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--phantom-elevated)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--phantom-glow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h2 className="text-xl font-bold">Password Required</h2>
              <p className="text-[var(--phantom-muted)] text-sm mt-2">This drop is protected with an additional password layer.</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--phantom-glow)]" autoFocus />
              <button type="submit" disabled={!password} className="w-full bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50">Decrypt</button>
            </form>
          </motion.div>
        )}

        {state === 'key-required' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--phantom-elevated)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--phantom-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.286l5.964-5.964A6 6 0 1121 9z" /></svg>
              </div>
              <h2 className="text-xl font-bold">Decryption Key Missing</h2>
              <p className="text-[var(--phantom-muted)] text-sm mt-2">Paste the decryption key or full link manually.</p>
            </div>
            <form onSubmit={handleKeySubmit} className="space-y-4">
              <input type="text" placeholder="Paste decryption key or full link..." value={manualKey} onChange={(e) => setManualKey(e.target.value)} className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--phantom-glow)] font-mono text-sm" autoFocus />
              <button type="submit" disabled={!manualKey} className="w-full bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50">Decrypt</button>
            </form>
          </motion.div>
        )}

        {/* Loading */}
        {(state === 'loading' || state === 'decrypting') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel w-full max-w-md mx-auto py-12 flex flex-col items-center justify-center">
            <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--phantom-border)] border-t-[var(--phantom-glow)] mb-5 animate-spin"></div>
            <p className="text-[13.5px] text-[var(--phantom-muted)] text-center">
              {state === 'loading' ? 'Locating session...' : 'Decrypting locally...'}
            </p>
          </motion.div>
        )}

        {/* Ready */}
        {state === 'ready' && activeFile && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-xl overflow-hidden">
            
            {/* Multi-file Switcher */}
            {isMulti && (
              <div className="bg-[var(--phantom-elevated)] border-b border-[var(--phantom-border)] p-3 flex gap-2 overflow-x-auto custom-scrollbar">
                {decryptedFiles.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      idx === activeFileIndex
                        ? 'bg-[var(--phantom-glow)] text-white shadow-md'
                        : 'bg-[var(--phantom-surface)] text-[var(--phantom-muted)] hover:text-[var(--phantom-text)] hover:bg-[var(--phantom-border)]'
                    }`}
                  >
                    {file.drop.encrypted_filename || `File ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            <div className="p-8 border-b border-[var(--phantom-border)]">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold break-all">{activeFile.drop.encrypted_filename || 'Unknown File'}</h2>
                  <div className="flex items-center space-x-3 mt-2 text-[var(--phantom-muted)]">
                    <span>{formatFileSize(activeFile.drop.file_size)}</span>
                    <span>•</span>
                    <span className="uppercase text-xs font-semibold tracking-wider bg-[var(--phantom-elevated)] px-2 py-1 rounded">
                      {getFileCategory(activeFile.drop.file_type || '')}
                    </span>
                    {isMulti && (
                      <>
                        <span>•</span>
                        <span className="text-xs font-medium text-[var(--phantom-glow)]">
                          {activeFileIndex + 1} of {decryptedFiles.length} files
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm text-[var(--phantom-muted)] mb-1">Expires in</div>
                  <div className="text-xl font-mono text-[var(--phantom-danger)]">
                    <CountdownTimer expiresAt={activeFile.drop.expires_at} size="lg" onExpired={handleExpired} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                <span className="flex items-center px-3 py-1 bg-[var(--phantom-success)]/10 text-[var(--phantom-success)] rounded-full text-xs font-medium">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  E2E Encrypted
                </span>
                {activeFile.drop.burn_after_reading && (
                  <span className="flex items-center px-3 py-1 bg-[var(--phantom-danger)]/10 text-[var(--phantom-danger)] rounded-full text-xs font-medium">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    Burn After Reading
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setIsViewerOpen(true);
                    if (!viewRecordedRef.current.has(activeFile.drop.session_code)) {
                      recordView(activeFile.drop.session_code, activeFile.drop.burn_after_reading);
                      viewRecordedRef.current.add(activeFile.drop.session_code);
                    }
                  }}
                  className="w-full bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] text-[var(--phantom-text)] font-medium py-3 rounded-lg transition-colors flex justify-center items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Open Viewer
                </button>
                
                {!activeFile.drop.burn_after_reading && (
                  <a
                    href={activeFile.blobUrl}
                    download={activeFile.drop.encrypted_filename || 'download'}
                    className="w-full bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download
                  </a>
                )}
              </div>
            </div>
            
            <div className="bg-[var(--phantom-elevated)] px-8 py-4 text-center text-sm text-[var(--phantom-muted)]">
              Viewed successfully
            </div>
          </motion.div>
        )}

        {/* Expired / Destroyed */}
        {(state === 'destroyed' || state === 'expired') && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="panel w-full max-w-md mx-auto text-center py-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-[var(--phantom-elevated)] border ${state === 'destroyed' ? 'border-[var(--phantom-muted)]/30' : 'border-[var(--phantom-danger)]/30'}`}>
              {state === 'destroyed' ? (
                <svg className="w-[26px] h-[26px] text-[var(--phantom-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>
              ) : (
                <svg className="w-[26px] h-[26px] text-[var(--phantom-danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              )}
            </div>
            <h3 className="font-display text-[20px] font-semibold mb-2 text-[var(--phantom-text)]">
              {state === 'destroyed' ? 'Already opened and destroyed' : 'This session has expired'}
            </h3>
            <p className="text-[13.5px] text-[var(--phantom-muted)] max-w-[340px] mx-auto mb-6">
              {state === 'destroyed' 
                ? "This was a one-time link and it's already been used. If you were expecting this file, ask the sender for a new session." 
                : "The sender's timer ran out before this link was opened. Nothing was ever stored longer than that window."}
            </p>
            <Link href="/" className="inline-block bg-transparent hover:bg-[var(--phantom-glow)]/10 text-[var(--phantom-text)] border border-[var(--phantom-border)] hover:border-[var(--phantom-glow)]/30 font-medium px-5 py-2.5 rounded-full transition-colors text-[13.5px]">
              Send a new file instead
            </Link>
          </motion.div>
        )}

        {/* Error */}
        {state === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel w-full max-w-md mx-auto text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-[var(--phantom-elevated)] border border-[var(--phantom-danger)]/30">
              <svg className="w-[26px] h-[26px] text-[var(--phantom-danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 9v4M12 17h.01M10.3 3.9L2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
            </div>
            <h3 className="font-display text-[20px] font-semibold mb-2 text-[var(--phantom-text)]">Couldn't reach the session</h3>
            <p className="text-[13.5px] text-[var(--phantom-muted)] max-w-[340px] mx-auto mb-6">{errorMsg || 'The network dropped mid-request.'}</p>
            <button onClick={() => window.location.reload()} className="inline-block bg-transparent hover:bg-[var(--phantom-glow)]/10 text-[var(--phantom-text)] border border-[var(--phantom-border)] hover:border-[var(--phantom-glow)]/30 font-medium px-5 py-2.5 rounded-full transition-colors text-[13.5px]">
              Retry now
            </button>
          </motion.div>
        )}

      </main>

      {isViewerOpen && activeFile && (
        <FileViewerModal 
          onClose={() => setIsViewerOpen(false)} 
          blobUrl={activeFile.blobUrl} 
          textContent={activeFile.textContent}
          filename={activeFile.drop.encrypted_filename || 'Unknown File'}
          viewOnly={activeFile.drop.burn_after_reading}
          currentIndex={activeFileIndex}
          totalFiles={decryptedFiles.length}
          onNext={() => {
            const nextIdx = (activeFileIndex + 1) % decryptedFiles.length;
            setActiveFileIndex(nextIdx);
            const nextFile = decryptedFiles[nextIdx];
            if (!viewRecordedRef.current.has(nextFile.drop.session_code)) {
              recordView(nextFile.drop.session_code, nextFile.drop.burn_after_reading);
              viewRecordedRef.current.add(nextFile.drop.session_code);
            }
          }}
          onPrev={() => {
            const prevIdx = (activeFileIndex - 1 + decryptedFiles.length) % decryptedFiles.length;
            setActiveFileIndex(prevIdx);
            const prevFile = decryptedFiles[prevIdx];
            if (!viewRecordedRef.current.has(prevFile.drop.session_code)) {
              recordView(prevFile.drop.session_code, prevFile.drop.burn_after_reading);
              viewRecordedRef.current.add(prevFile.drop.session_code);
            }
          }}
        />
      )}
    </div>
  );
}
