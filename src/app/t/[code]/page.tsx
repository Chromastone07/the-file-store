"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { decryptWithPassword, hashString } from '@/lib/crypto';
import { getSecureTextByCode, recordTextView, destroyExpiredText, supabase } from '@/lib/supabase';
import { extractKeyFromFragment } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AccessLimitScreen, { AccessLimitType } from '@/components/ui/AccessLimitScreen';
import VaultErrorScreen from '@/components/ui/VaultErrorScreen';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { Copy, Flame, ShieldCheck, Loader2, Key, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useGlobalSession } from '@/context/GlobalSessionContext';
import { sessionCache } from '@/lib/sessionCache';
import { stealth } from '@/lib/stealth';

type AccessState =
  | 'loading'
  | 'key-required'
  | 'password-required'
  | 'wrong-password'
  | 'ready'
  | 'not-found'
  | 'invalid-code'
  | 'destroyed'
  | 'error'
  | 'expired';

interface SecureTextMetadata {
  session_code: string;
  has_password?: boolean;
  burn_after_reading?: boolean;
  expires_at: string;
  is_destroyed?: boolean;
}

export default function TextRetrievalPage() {
  const params = useParams();
  const code = Array.isArray(params?.code) ? params.code[0] : params?.code;
  const { activeSessions, addActiveSession, removeActiveSession } = useGlobalSession();
  const activeSessionsRef = useRef(activeSessions);
  useEffect(() => {
    activeSessionsRef.current = activeSessions;
  }, [activeSessions]);
  
  const [state, setState] = useState<AccessState>('loading');
  const [limitError, setLimitError] = useState<{ type: AccessLimitType; limitNumber?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SecureTextMetadata | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const dbLookupCodeRef = useRef<string>('');
  const expiryFiredRef = useRef(false);
  const burnAfterReadingRef = useRef(false);
  const hasConsumedRef = useRef(false);
  const barBurnedRef = useRef(false);
  const fetchedCodeRef = useRef<string | null>(null);

  // ── SECURITY: Handle client-side expiry enforcement ──
  const handleExpired = useCallback(() => {
    if (expiryFiredRef.current) return;
    expiryFiredRef.current = true;
    setDecryptedText(null);
    setMetadata(null);
    stealth.wipeMemory();
    setState('expired');
    if (code) {
      const upper = code.toUpperCase();
      removeActiveSession(upper);
      sessionCache.removeSession(upper);
    }
    // Trigger server-side cleanup
    if (dbLookupCodeRef.current) {
      destroyExpiredText(dbLookupCodeRef.current).catch(() => {});
    }
  }, [code, removeActiveSession]);

  // ── SECURITY: Burn-after-reading immediate client wipe (close / tab switch / unmount) ──
  const burnBarSession = useCallback((reason?: 'tab-switch' | 'close') => {
    if (barBurnedRef.current) return;
    barBurnedRef.current = true;
    setDecryptedText(null);
    setMetadata(null);
    stealth.wipeMemory();
    setState('destroyed');
    if (code) {
      const upper = code.toUpperCase();
      removeActiveSession(upper);
      sessionCache.removeSession(upper);
    }
    if (dbLookupCodeRef.current) {
      destroyExpiredText(dbLookupCodeRef.current).catch(() => {});
    }
    if (reason === 'tab-switch') {
      toast.info('Burn-after-reading note burned after switching tabs.');
    }
  }, [code, removeActiveSession]);

  const performDecryption = useCallback(async (providedPassword?: string, providedManualKey?: string) => {
    let usedPasswordLayer = false;
    try {
      if (!code) {
        setState('invalid-code');
        return;
      }
      
      const rawCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$|^[A-Z0-9]{8}$/.test(rawCode)) {
        setState('invalid-code');
        return;
      }

      let dbLookupCode = rawCode;
      const isLegacy = rawCode.length === 6;

      if (!isLegacy) {
        dbLookupCode = await hashString(rawCode);
      }
      dbLookupCodeRef.current = dbLookupCode;

      const { data: textData, error: fetchError } = await getSecureTextByCode(dbLookupCode);

      if (fetchError) {
        setError(fetchError.message || 'Could not reach the vault server.');
        setState('error');
        return;
      }

      if (!textData) {
        setState('not-found');
        return;
      }

      if (textData.is_destroyed) {
        if (textData.destroy_reason === 'panic') {
          setLimitError({ type: 'panic_wiped' });
          return;
        }
        setState('destroyed');
        return;
      }

      if (new Date(textData.expires_at) < new Date()) {
        handleExpired();
        return;
      }

      // Check if this device is already an admitted receiver viewer
      const isAlreadyAdmitted = activeSessionsRef.current.some(s => s.type === 'text' && s.id === rawCode);

      // Recipient Limit Enforcement:
      // If max_views is configured and reached, ONLY new incoming scans/codes are blocked.
      // The text is NOT purged for everyone; existing authorized viewers continue unimpeded.
      if (textData.max_views !== null && (textData.view_count || 0) >= textData.max_views && !isAlreadyAdmitted) {
        setLimitError({ type: 'recipient_limit', limitNumber: textData.max_views });
        return;
      }

      burnAfterReadingRef.current = !!textData.burn_after_reading;

      const { base64ToArrayBuffer } = await import('@/lib/crypto');
      const cipherBuffer = base64ToArrayBuffer(textData.encrypted_content);
      let plaintextObj: string;
      
      if (isLegacy) {
        if (textData.has_password) {
          if (!providedPassword) {
            setState('password-required');
            return;
          }
          if (!textData.encryption_salt) throw new Error('Missing salt for password decryption');
          usedPasswordLayer = true;
          const buffer = await decryptWithPassword(cipherBuffer, providedPassword, textData.encryption_iv, textData.encryption_salt);
          plaintextObj = new TextDecoder().decode(buffer);
        } else {
          const parsedManualKey = (providedManualKey?.includes('#') ? providedManualKey.split('#').pop() : providedManualKey)?.trim();
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
          usedPasswordLayer = true;
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

      // Keep non-BAR notes in Active Sessions so receiver can reaccess them; BAR stays single-view in active tab only
      if (!textData.burn_after_reading) {
        addActiveSession({
          type: 'text',
          id: rawCode,
          title: `SECURE NOTE (${rawCode})`,
          text: plaintextObj,
          expiresAt: textData.expires_at,
          burnAfterReading: false,
          drop: textData,
        });

        sessionCache.saveText(
          rawCode,
          `SECURE NOTE (${rawCode})`,
          plaintextObj,
          textData.expires_at,
          false
        ).catch(console.error);
      }

      // SECURITY: Scrub the session code from the URL bar
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/t/accessed`);
      }
      
      hasConsumedRef.current = true;
      recordTextView(dbLookupCode, !!textData.burn_after_reading).catch(console.error);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to decrypt';
      console.error('Decryption error:', message);
      if (
        usedPasswordLayer &&
        err instanceof DOMException &&
        (err.name === 'OperationError' || err.name === 'DataError')
      ) {
        setFailedAttempts((n) => n + 1);
        setPassword('');
        setState('wrong-password');
        toast.error('Incorrect password');
        return;
      }
      setError(message);
      setState('error');
    }
  }, [code, addActiveSession, handleExpired]);

  useEffect(() => {
    if (!code || fetchedCodeRef.current === code) return;
    fetchedCodeRef.current = code;
    performDecryption();
  }, [code, performDecryption]);

  // Real-time subscription + polling fallback for remote panic wipe & expiry (never self-burn active BAR note)
  useEffect(() => {
    const currentCode = dbLookupCodeRef.current;
    if (
      !currentCode ||
      state === 'destroyed' ||
      state === 'expired' ||
      state === 'not-found' ||
      state === 'invalid-code' ||
      state === 'error' ||
      state === 'loading'
    ) {
      return;
    }
    
    // Polling fallback: check every 3 seconds for remote wipe or expiry
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await getSecureTextByCode(currentCode);
        if (data?.destroy_reason === 'panic') {
          setLimitError({ type: 'panic_wiped' });
          toast.error('Transmission Terminated: Sender executed remote panic wipe.');
          setDecryptedText(null);
          stealth.wipeMemory();
          clearInterval(pollInterval);
        } else if (data && new Date(data.expires_at) < new Date()) {
          handleExpired();
          clearInterval(pollInterval);
        } else if ((!data || data.is_destroyed) && !burnAfterReadingRef.current && !hasConsumedRef.current) {
          setState('destroyed');
          setDecryptedText(null);
          stealth.wipeMemory();
          clearInterval(pollInterval);
        }
      } catch {
        // Ignored in background polling
      }
    }, 3000);

    // Also try Supabase Realtime
    const channel = supabase
      .channel(`text-watch-${currentCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'secure_texts', filter: `session_code=eq.${currentCode}` },
        (payload: { new?: { is_destroyed?: boolean; destroy_reason?: string } }) => {
          if (payload.new?.destroy_reason === 'panic') {
            setLimitError({ type: 'panic_wiped' });
            setDecryptedText(null);
            stealth.wipeMemory();
          } else if (payload.new?.is_destroyed && !burnAfterReadingRef.current && !hasConsumedRef.current) {
            setState('destroyed');
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [state, handleExpired]);

  // Exact expiry timer while decrypted text is open in viewer
  useEffect(() => {
    if (state !== 'ready' || !metadata?.expires_at) return;
    const msRemaining = new Date(metadata.expires_at).getTime() - Date.now();
    if (msRemaining <= 0) {
      const immediateTimer = setTimeout(handleExpired, 0);
      return () => clearTimeout(immediateTimer);
    }
    const timer = setTimeout(handleExpired, msRemaining);
    return () => clearTimeout(timer);
  }, [state, metadata?.expires_at, handleExpired]);

  // Burn-after-reading: stay open while actively viewed, burn on tab switch / page close / route change
  useEffect(() => {
    if (state !== 'ready' || !metadata?.burn_after_reading) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        burnBarSession('tab-switch');
      }
    };

    const handlePageHide = () => {
      stealth.wipeMemory();
      if (dbLookupCodeRef.current) {
        destroyExpiredText(dbLookupCodeRef.current).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      stealth.wipeMemory();
    };
  }, [state, metadata?.burn_after_reading, burnBarSession]);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualKey.replace(/^#/, '').trim();
    if (!cleaned) return;
    setState('loading');
    await performDecryption(undefined, cleaned);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setState('loading');
    await performDecryption(password);
  };

  const handleCopy = () => {
    if (decryptedText) {
      navigator.clipboard.writeText(decryptedText);
      toast.success('Copied to clipboard');
    }
  };

  const renderContent = () => {
    if (limitError) {
      return (
        <AccessLimitScreen
          type={limitError.type}
          code={code}
          limitNumber={limitError.limitNumber}
          onRetry={() => window.location.reload()}
        />
      );
    }

    if (state === 'loading') {
      return (
        <SpotlightCard className="w-full max-w-md mx-auto p-8 sm:p-12 flex flex-col items-center justify-center gap-4 text-[var(--wisp-muted)] shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
          <Loader2 className="w-9 h-9 animate-spin text-indigo-500" />
          <p className="text-sm font-medium animate-pulse">Decrypting locally...</p>
        </SpotlightCard>
      );
    }

    if (state === 'password-required') {
      return (
        <div className="w-full max-w-md mx-auto">
          <SpotlightCard className="p-6 sm:p-8 shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(99,102,241,0.18)]">
                <Lock className="w-7 h-7 text-indigo-500" />
              </div>
              <h2 className="text-xl font-extrabold text-[var(--wisp-text)]">Password Required</h2>
              <p className="text-[var(--wisp-muted)] text-xs sm:text-sm mt-2">
                This secure text is protected with an extra password layer.
              </p>
              {failedAttempts > 0 && (
                <p className="text-[11px] font-mono text-amber-500 mt-2">
                  Previous attempt failed ({failedAttempts}) — check Caps Lock
                </p>
              )}
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter unlock password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] focus:border-indigo-500 rounded-xl px-4 py-3 pr-11 focus:outline-none text-sm text-[var(--wisp-text)] placeholder:text-[var(--wisp-muted)]/60"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!password}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-indigo-500/20 text-sm"
              >
                Unlock Text
              </button>
            </form>
          </SpotlightCard>
        </div>
      );
    }

    if (state === 'wrong-password') {
      return (
        <VaultErrorScreen
          variant="wrong_password"
          resourceType="text"
          code={code}
          attempts={failedAttempts}
          onRetryPassword={() => {
            setPassword('');
            setState('password-required');
          }}
        />
      );
    }

    if (state === 'key-required') {
      return (
        <div className="w-full max-w-md mx-auto">
          <SpotlightCard className="p-6 sm:p-8 shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(245,158,11,0.18)]">
                <Key className="w-7 h-7 text-amber-500" />
              </div>
              <h2 className="text-xl font-extrabold text-[var(--wisp-text)]">Decryption Key Missing</h2>
              <p className="text-[var(--wisp-muted)] text-xs sm:text-sm mt-2">
                The URL is missing the key fragment. Paste it manually below.
              </p>
            </div>
            <form onSubmit={handleKeySubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Paste decryption key or full link..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                className="w-full bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] focus:border-indigo-500 rounded-xl px-4 py-3 focus:outline-none font-mono text-sm text-[var(--wisp-text)]"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualKey}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer text-sm"
              >
                Decrypt Secure Text
              </button>
            </form>
          </SpotlightCard>
        </div>
      );
    }

    if (state === 'not-found' || state === 'invalid-code' || state === 'destroyed' || state === 'expired') {
      return (
        <VaultErrorScreen
          variant={
            state === 'not-found'
              ? 'not_found'
              : state === 'invalid-code'
                ? 'invalid_code'
                : state === 'destroyed'
                  ? 'destroyed'
                  : 'expired'
          }
          resourceType="text"
          code={code}
        />
      );
    }

    if (state === 'error') {
      return (
        <VaultErrorScreen
          variant="network_error"
          resourceType="text"
          code={code}
          errorDetail={error || undefined}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return (
      <div className="w-full max-w-4xl bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-2xl p-6 md:p-10 shadow-2xl backdrop-blur-sm">
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
              <p className="text-sm font-medium">Burn after reading enabled. Keep this tab open to read — it auto-burns if you switch tabs, close, or when the timer expires.</p>
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

          {/* Receiver actions & status */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[var(--phantom-border)] text-xs text-[var(--phantom-muted)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {metadata?.burn_after_reading ? (
                <span className="text-rose-400 font-medium">Single-view session: Auto-wipes when closed</span>
              ) : (
                <span className="text-emerald-400 font-medium">Saved in Active Sessions: Reopenable anytime</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {metadata?.burn_after_reading ? (
                <button
                  onClick={() => burnBarSession('close')}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Destroy Note Now
                </button>
              ) : (
                <Link
                  href="/"
                  className="px-4 py-2 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-surface)] border border-[var(--phantom-border)] text-[var(--phantom-text)] rounded-xl font-medium transition-colors"
                >
                  Return to Home
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        {renderContent()}
      </main>
    </div>
  );
}
