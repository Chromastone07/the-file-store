"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { zipSync } from 'fflate';
import { decryptData, decryptWithPassword, hashString } from '@/lib/crypto';
import { getDropsByLookupCode, getSignedDownloadUrl, recordView, destroyExpiredDrop, supabase } from '@/lib/supabase';
import type { DropRecord } from '@/lib/supabase';
import { getFileCategory, formatFileSize, extractKeyFromFragment } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import { useGlobalSession } from '@/context/GlobalSessionContext';
import { useRouter } from 'next/navigation';

type AccessState = 'loading' | 'password-required' | 'key-required' | 'decrypting' | 'destroyed' | 'error' | 'expired';

interface DecryptedFile {
  drop: DropRecord;
  blobUrl: string;
  textContent: string;
}

export default function AccessDropPage() {
  const params = useParams();
  const code = params.code as string;
  
  const { addActiveSession, setViewingSessionId } = useGlobalSession();
  const router = useRouter();
  
  const [state, setState] = useState<AccessState>('loading');
  const [drops, setDrops] = useState<DropRecord[]>([]);
  const [password, setPassword] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const dbLookupCodeRef = useRef<string>('');



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

      let sessionTitle = 'FILE DROP';
      if (results.length > 0) {
        sessionTitle = results[0].drop.encrypted_filename || 'FILE DROP';
        if (results.length > 1) {
          sessionTitle += ` +${results.length - 1}`;
        }
      }

      addActiveSession({
        type: 'drop',
        id: rawCode, // Display the short code, not the hash
        title: sessionTitle,
        files: results
      });

      setViewingSessionId(rawCode);
      router.replace('/');
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
            <button onClick={() => router.push('/')} className="inline-block bg-transparent hover:bg-[var(--phantom-glow)]/10 text-[var(--phantom-text)] border border-[var(--phantom-border)] hover:border-[var(--phantom-glow)]/30 font-medium px-5 py-2.5 rounded-full transition-colors text-[13.5px]">
              Send a new file instead
            </button>
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


    </div>
  );
}
