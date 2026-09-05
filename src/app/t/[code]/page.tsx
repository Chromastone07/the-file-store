"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { decryptWithPassword, decryptText, hashString } from '@/lib/crypto';
import { getSecureTextByCode, recordTextView, destroyExpiredText, supabase } from '@/lib/supabase';
import { extractKeyFromFragment } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { Copy, Flame, ShieldCheck, AlertTriangle, Loader2, Key } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type AccessState = 'loading' | 'key-required' | 'password-required' | 'ready' | 'destroyed' | 'error' | 'expired';

export default function TextRetrievalPage() {
  const params = useParams();
  const code = Array.isArray(params?.code) ? params.code[0] : params?.code;
  
  const [state, setState] = useState<AccessState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [manualKey, setManualKey] = useState('');
  const [password, setPassword] = useState('');
  const dbLookupCodeRef = useRef<string>('');
  const expiryFiredRef = useRef(false);

  // ── SECURITY: Handle client-side expiry enforcement ──
  const handleExpired = useCallback(() => {
    if (expiryFiredRef.current) return;
    expiryFiredRef.current = true;
    setDecryptedText(null);
    setMetadata(null);
    setState('expired');
    // Trigger server-side cleanup
    if (dbLookupCodeRef.current) {
      destroyExpiredText(dbLookupCodeRef.current).catch(() => {});
    }
  }, []);

  const performDecryption = async (providedPassword?: string) => {
    try {
      if (!code) throw new Error('Invalid code');
      
      const rawCode = code.toUpperCase();
      let dbLookupCode = rawCode;
      const isLegacy = rawCode.length === 6;

      if (!isLegacy) {
        dbLookupCode = await hashString(rawCode);
      }
      dbLookupCodeRef.current = dbLookupCode;

      const { data: textData, error: fetchError } = await getSecureTextByCode(dbLookupCode);
      
      if (fetchError || !textData || textData.is_destroyed) {
        setState('destroyed');
        return;
      }

      const { base64ToArrayBuffer } = await import('@/lib/crypto');
      const cipherBuffer = base64ToArrayBuffer(textData.encrypted_content);
      let plaintextObj: string;
      
      if (isLegacy) {
        if (textData.has_password && providedPassword) {
          if (!textData.encryption_salt) throw new Error('Missing salt for password decryption');
          const buffer = await decryptWithPassword(cipherBuffer, providedPassword, textData.encryption_iv, textData.encryption_salt);
          plaintextObj = new TextDecoder().decode(buffer);
        } else {
          const parsedManualKey = (manualKey.includes('#') ? manualKey.split('#').pop() : manualKey)?.trim();
          const keyBase64 = parsedManualKey || extractKeyFromFragment();
          if (!keyBase64) {
            setState('key-required');
            return;
          }
          const { importKeyFromBase64, decryptData } = await import('@/lib/crypto');
          const key = await importKeyFromBase64(keyBase64);
          const buffer = await decryptData(cipherBuffer, key, textData.encryption_iv);
          plaintextObj = new TextDecoder().decode(buffer);
        }
      } else {
        if (!textData.encryption_salt) throw new Error('Missing salt for Hashed Routing');
        
        if (textData.has_password) {
          if (!providedPassword) {
            setState('password-required');
            return;
          }
          const combinedPassword = `${rawCode}-${providedPassword}`;
          const buffer = await decryptWithPassword(cipherBuffer, combinedPassword, textData.encryption_iv, textData.encryption_salt);
          plaintextObj = new TextDecoder().decode(buffer);
        } else {
          const buffer = await decryptWithPassword(cipherBuffer, rawCode, textData.encryption_iv, textData.encryption_salt);
          plaintextObj = new TextDecoder().decode(buffer);
        }
      }

      setDecryptedText(plaintextObj);
      setMetadata(textData);
      setState('ready');

      // SECURITY: Scrub the session code from the URL bar
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/t/accessed`);
      }
      
      recordTextView(dbLookupCode, textData.burn_after_reading).catch(console.error);
    } catch (err: any) {
      console.error('Decryption error:', err.message || err);
      setError(err.message || 'Failed to decrypt');
      setState('error');
    }
  };

  useEffect(() => {
    const init = async () => {
      // Hashed routing doesn't need keyBase64 at all.
      await performDecryption();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Real-time subscription + polling fallback for purge detection
  useEffect(() => {
    if (!dbLookupCodeRef.current || state === 'destroyed' || state === 'loading') return;
    
    // Polling fallback: check every 5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await getSecureTextByCode(dbLookupCodeRef.current);
        if (!data || data.is_destroyed) {
          setState('destroyed');
          setDecryptedText(null);
          clearInterval(pollInterval);
        } else if (new Date(data.expires_at) < new Date()) {
          // Server confirms expiry
          handleExpired();
          clearInterval(pollInterval);
        }
      } catch {}
    }, 5000);

    // Also try Supabase Realtime
    const channel = supabase
      .channel(`text-watch-${dbLookupCodeRef.current}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'secure_texts', filter: `session_code=eq.${dbLookupCodeRef.current}` },
        (payload: any) => {
          if (payload.new?.is_destroyed) setState('destroyed');
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLookupCodeRef.current, state]);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey) return;
    setState('loading');
    await performDecryption(manualKey.replace(/^#/, ''));
  };

  const handleCopy = () => {
    if (decryptedText) {
      navigator.clipboard.writeText(decryptedText);
      toast.success('Copied to clipboard');
    }
  };

  const renderContent = () => {
    if (state === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center p-12 gap-4 text-[var(--phantom-muted)]">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--phantom-glow)]" />
          <p className="font-medium animate-pulse">Decrypting locally...</p>
        </div>
      );
    }

    if (state === 'key-required') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[var(--phantom-elevated)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-[var(--phantom-glow)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--phantom-text)]">Decryption Key Missing</h2>
            <p className="text-[var(--phantom-muted)] text-sm mt-2">The URL is missing the key fragment. Please paste it manually.</p>
          </div>
          <form onSubmit={handleKeySubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Paste decryption key or full link..."
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              className="w-full bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--phantom-glow)] font-mono text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualKey}
              className="w-full bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              Decrypt Secure Text
            </button>
          </form>
        </motion.div>
      );
    }

    if (state === 'destroyed') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-12 flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-[var(--phantom-danger)]/10 rounded-full flex items-center justify-center text-[var(--phantom-danger)]">
            <Flame className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--phantom-text)] mb-2">Text Destroyed</h2>
            <p className="text-[var(--phantom-muted)] max-w-sm mx-auto">This secure text no longer exists. It has either expired or was burned after reading.</p>
          </div>
          <Link href="/" className="mt-4 px-6 py-2 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] transition-colors">
            Return to Home
          </Link>
        </motion.div>
      );
    }

    if (state === 'expired') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-12 flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-[var(--phantom-warning)]/10 rounded-full flex items-center justify-center text-[var(--phantom-warning)]">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--phantom-text)] mb-2">Session Expired</h2>
            <p className="text-[var(--phantom-muted)] max-w-sm mx-auto">The sender&apos;s timer ran out. The text has been wiped from memory.</p>
          </div>
          <Link href="/" className="mt-4 px-6 py-2 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] transition-colors">
            Return to Home
          </Link>
        </motion.div>
      );
    }

    if (state === 'error') {
      return (
        <div className="text-center p-8 bg-[var(--phantom-danger)]/10 border border-[var(--phantom-danger)] rounded-xl flex flex-col items-center gap-4">
          <AlertTriangle className="w-10 h-10 text-[var(--phantom-danger)]" />
          <p className="text-[var(--phantom-danger)] font-medium">{error}</p>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--phantom-border)] pb-4">
          <div className="flex items-center gap-3 text-[var(--phantom-success)]">
            <ShieldCheck className="w-6 h-6" />
            <span className="font-medium">Decrypted Successfully</span>
          </div>
          
          {metadata && metadata.expires_at && (
            <div className="bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] px-4 py-2 rounded-full flex items-center gap-2 text-sm text-[var(--phantom-text)]">
              <CountdownTimer expiresAt={metadata.expires_at} onExpired={handleExpired} />
            </div>
          )}
        </div>

        {metadata?.burn_after_reading && (
          <div className="bg-[var(--phantom-danger)]/10 text-[var(--phantom-danger)] border border-[var(--phantom-danger)]/20 px-4 py-3 rounded-lg flex items-center gap-3">
            <Flame className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Burn after reading enabled. This text will be destroyed after you leave this page.</p>
          </div>
        )}

        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleCopy}
              className="bg-[var(--phantom-surface)] hover:bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] text-[var(--phantom-text)] p-2 rounded-lg shadow-sm transition-colors flex items-center gap-2"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
              <span className="text-sm font-medium pr-1">Copy</span>
            </button>
          </div>
          <pre className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-xl p-6 text-[var(--phantom-text)] whitespace-pre-wrap break-words overflow-x-auto text-sm sm:text-base font-mono custom-scrollbar min-h-[12rem]">
            {decryptedText}
          </pre>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-2xl p-6 md:p-10 shadow-2xl backdrop-blur-sm">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
