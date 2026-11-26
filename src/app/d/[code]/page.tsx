"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { decryptData, decryptWithPassword, hashString, importKeyFromBase64 } from '@/lib/crypto';
import { getDropsByLookupCode, getSignedDownloadUrl, recordView } from '@/lib/supabase';
import type { DropRecord } from '@/lib/supabase';
import { getFileCategory, extractKeyFromFragment } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import AccessLimitScreen, { AccessLimitType } from '@/components/ui/AccessLimitScreen';
import VaultErrorScreen from '@/components/ui/VaultErrorScreen';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { useGlobalSession } from '@/context/GlobalSessionContext';
import { stealth } from '@/lib/stealth';
import { sessionCache } from '@/lib/sessionCache';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, KeyRound } from 'lucide-react';

type AccessState =
  | 'loading'
  | 'password-required'
  | 'wrong-password'
  | 'key-required'
  | 'decrypting'
  | 'not-found'
  | 'invalid-code'
  | 'destroyed'
  | 'error'
  | 'expired';

interface DecryptedFile {
  drop: DropRecord;
  blobUrl: string;
  textContent: string;
}

export default function AccessDropPage() {
  const params = useParams();
  const rawParam = params?.code;
  const code = (Array.isArray(rawParam) ? rawParam[0] : rawParam) || '';
  
  const { activeSessions, addActiveSession, setViewingSessionId, setIsDockOpen } = useGlobalSession();
  const activeSessionsRef = useRef(activeSessions);
  useEffect(() => {
    activeSessionsRef.current = activeSessions;
  }, [activeSessions]);
  const router = useRouter();
  
  const [state, setState] = useState<AccessState>('loading');
  const [drops, setDrops] = useState<DropRecord[]>([]);
  const [limitError, setLimitError] = useState<{ type: AccessLimitType; limitNumber?: number } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [manualKey, setManualKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const dbLookupCodeRef = useRef<string>('');
  const hasConsumedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const fetchDrop = async () => {
      try {
        const rawCode = code.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$|^[A-Z0-9]{8}$/.test(rawCode)) {
          setState('invalid-code');
          return;
        }

        const isLegacy = rawCode.length === 6;
        let dbLookupCode = rawCode;

        if (!isLegacy) {
          dbLookupCode = await hashString(rawCode);
        }
        if (!active) return;
        dbLookupCodeRef.current = dbLookupCode;

        const { data: dropList, error: fetchError } = await getDropsByLookupCode(dbLookupCode);
        if (!active) return;

        if (fetchError) {
          setErrorMsg(fetchError.message || 'Could not reach the vault server.');
          setState('error');
          return;
        }
        
        if (dropList && dropList.length > 0) {
          const activeDrops = dropList.filter(d => !d.is_destroyed);
          if (activeDrops.length === 0) {
            const first = dropList[0];
            if (first.destroy_reason === 'panic') {
              setLimitError({ type: 'panic_wiped' });
              return;
            }
            setState('destroyed');
            return;
          }

          const first = activeDrops[0];
          
          // Check if this device is already an admitted receiver viewer
          const isAlreadyAdmitted = activeSessionsRef.current.some(s => s.type === 'drop' && s.id === rawCode);

          // Recipient Limit Enforcement:
          // If max_views is configured and reached, ONLY new incoming scans/codes are blocked.
          // The file is NOT purged for everyone; existing authorized viewers continue unimpeded.
          if (first.max_views !== null && (first.view_count || 0) >= first.max_views && !isAlreadyAdmitted) {
            setLimitError({ type: 'recipient_limit', limitNumber: first.max_views });
            return;
          }

          const now = new Date();
          if (now > new Date(first.expires_at)) {
            setState('expired');
            return;
          }
          
          setDrops(activeDrops);
          if (first.has_password) {
            setState('password-required');
          } else {
            handleDecryption(activeDrops);
          }
          return;
        }

        setState('not-found');
      } catch (err) {
        if (!active) return;
        console.error('Fetch drop error:', err);
        setState('error');
        setErrorMsg('Failed to load file details.');
      }
    };

    if (code) fetchDrop();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Real-time polling to detect remote panic wipe or destroy while viewing
  useEffect(() => {
    const currentCode = dbLookupCodeRef.current;
    if (
      !currentCode ||
      limitError ||
      state === 'destroyed' ||
      state === 'expired' ||
      state === 'not-found' ||
      state === 'invalid-code' ||
      state === 'error' ||
      state === 'loading'
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const { data: dropList } = await getDropsByLookupCode(currentCode);
        if (!dropList || dropList.length === 0 || dropList.every(d => d.is_destroyed)) {
          const first = dropList?.[0];
          if (hasConsumedRef.current && first?.destroy_reason !== 'panic') {
            clearInterval(interval);
            return;
          }
          stealth.wipeMemory();
          if (first?.destroy_reason === 'panic') {
            setLimitError({ type: 'panic_wiped' });
            toast.error('Transmission Terminated: Sender executed remote panic wipe.');
          } else {
            setLimitError({ type: 'burned' });
          }
          clearInterval(interval);
        }
      } catch {
        // Blip
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [limitError, state]);

  const handleDecryption = async (dropList: DropRecord[], providedPassword?: string) => {
    setState('decrypting');
    try {
      const rawCode = code.trim().toUpperCase();
      const isLegacy = rawCode.length === 6;
      
      const results: DecryptedFile[] = [];

      for (const dropData of dropList) {
        const signedUrl = await getSignedDownloadUrl(dropData.storage_path);
        if (!signedUrl) throw new Error('Encrypted file blob could not be located.');
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('Failed to download encrypted payload.');
        const ciphertext = await response.arrayBuffer();

        let plaintext: ArrayBuffer;
        if (isLegacy) {
          if (dropData.has_password && providedPassword) {
            if (!dropData.encryption_salt) continue;
            plaintext = await decryptWithPassword(ciphertext, providedPassword, dropData.encryption_iv, dropData.encryption_salt);
          } else {
            const parsedManualKey = (manualKey.includes('#') ? manualKey.split('#').pop() : manualKey)?.trim();
            const keyBase64 = parsedManualKey || extractKeyFromFragment();
            if (!keyBase64) {
              setState('key-required');
              return;
            }
            const key = await importKeyFromBase64(keyBase64);
            plaintext = await decryptData(ciphertext, key, dropData.encryption_iv);
          }
        } else {
          if (!dropData.encryption_salt) continue;
          if (dropData.has_password) {
            if (!providedPassword) {
              setState('password-required');
              return;
            }
            const combinedPassword = `${rawCode}-${providedPassword}`;
            plaintext = await decryptWithPassword(ciphertext, combinedPassword, dropData.encryption_iv, dropData.encryption_salt);
          } else {
            plaintext = await decryptWithPassword(ciphertext, rawCode, dropData.encryption_iv, dropData.encryption_salt);
          }
        }

        // Track decrypted buffer for stealth auto-wipe
        stealth.trackBuffer(plaintext);

        const fileType = dropData.file_type || 'application/octet-stream';
        const blob = new Blob([plaintext], { type: fileType });
        const objectUrl = URL.createObjectURL(blob);
        stealth.trackBlobUrl(objectUrl);

        let textContent = '';
        const filename = dropData.encrypted_filename || '';
        const category = getFileCategory(filename);
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const isPlainText = category === 'code' || ['txt', 'text', 'md', 'markdown', 'log', 'csv', 'tsv', 'json', 'xml', 'diff', 'patch'].includes(ext);
        if (isPlainText) {
          try {
            textContent = new TextDecoder().decode(plaintext);
          } catch {
            textContent = '';
          }
        }

        results.push({ drop: dropData, blobUrl: objectUrl, textContent });

        // Cache decrypted file locally if burn after reading is not enabled
        if (!dropData.burn_after_reading) {
          sessionCache.saveDropFile(
            rawCode,
            results.length - 1,
            plaintext.slice(0),
            filename,
            fileType,
            textContent,
            dropData.expires_at,
            false
          ).catch(console.error);
        }
      }

      if (results.length === 0) {
        throw new Error('No decrypted files could be loaded.');
      }

      // Mark consumed BEFORE recording view so polling doesn't prematurely kill BAR on slow networks
      hasConsumedRef.current = true;
      await Promise.all(
        results.map((r) => recordView(r.drop.session_code, r.drop.burn_after_reading).catch(console.error))
      );

      let sessionTitle = 'FILE DROP';
      if (results.length > 0) {
        sessionTitle = results[0].drop.encrypted_filename || 'FILE DROP';
        if (results.length > 1) {
          sessionTitle += ` +${results.length - 1}`;
        }
      }

      addActiveSession({
        type: 'drop',
        id: rawCode,
        title: sessionTitle,
        files: results,
        expiresAt: dropList[0]?.expires_at,
        burnAfterReading: dropList.some(d => d.burn_after_reading),
      });

      setIsDockOpen(false);
      setViewingSessionId(rawCode);
      router.replace('/');
    } catch (err: unknown) {
      console.error('Decryption error:', err);
      const isPasswordFailure =
        Boolean(providedPassword) &&
        dropList.some((d) => d.has_password) &&
        err instanceof DOMException &&
        (err.name === 'OperationError' || err.name === 'DataError');

      if (isPasswordFailure) {
        setFailedAttempts((n) => n + 1);
        setPassword('');
        setState('wrong-password');
        toast.error('Incorrect password');
        return;
      }

      setState('error');
      if (err instanceof DOMException && err.name === 'DataError') {
        setErrorMsg('Invalid decryption key. Ensure you copied the full link correctly.');
      } else {
        const message = err instanceof Error && err.message ? err.message : 'Decryption failed. Invalid password or key.';
        setErrorMsg(message);
      }
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drops.length > 0 && password) {
      handleDecryption(drops, password);
    }
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
        
        {/* Recipient Limit / Remote Panic Wipe Screen */}
        {limitError && (
          <AccessLimitScreen
            type={limitError.type}
            code={code}
            limitNumber={limitError.limitNumber}
            onRetry={() => window.location.reload()}
          />
        )}

        {/* Loading / Decrypting */}
        {!limitError && (state === 'loading' || state === 'decrypting') && (
          <SpotlightCard className="w-full max-w-md mx-auto p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
            <div className="w-9 h-9 rounded-full border-2 border-[var(--wisp-border)] border-t-indigo-500 mb-5 animate-spin" />
            <p className="text-sm text-[var(--wisp-muted)] text-center font-medium">
              {state === 'loading' ? 'Locating session...' : 'Decrypting locally...'}
            </p>
          </SpotlightCard>
        )}

        {/* Password Prompt */}
        {!limitError && state === 'password-required' && (
          <div className="w-full max-w-md mx-auto">
            <SpotlightCard className="p-6 sm:p-8 shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(99,102,241,0.18)]">
                  <Lock className="w-7 h-7 text-indigo-500" />
                </div>
                <h2 className="text-xl font-extrabold text-[var(--wisp-text)]">Password Required</h2>
                <p className="text-[var(--wisp-muted)] text-xs sm:text-sm mt-2">
                  This drop is protected with an additional password layer.
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
                  Decrypt File
                </button>
              </form>
            </SpotlightCard>
          </div>
        )}

        {/* Incorrect Password Error Screen */}
        {!limitError && state === 'wrong-password' && (
          <VaultErrorScreen
            variant="wrong_password"
            resourceType="drop"
            code={code}
            attempts={failedAttempts}
            onRetryPassword={() => {
              setPassword('');
              setState('password-required');
            }}
          />
        )}

        {/* Missing Decryption Key (Legacy 6-char) */}
        {!limitError && state === 'key-required' && (
          <div className="w-full max-w-md mx-auto">
            <SpotlightCard className="p-6 sm:p-8 shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(245,158,11,0.18)]">
                  <KeyRound className="w-7 h-7 text-amber-500" />
                </div>
                <h2 className="text-xl font-extrabold text-[var(--wisp-text)]">Decryption Key Missing</h2>
                <p className="text-[var(--wisp-muted)] text-xs sm:text-sm mt-2">
                  Paste the decryption key or full share link manually.
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
                  Decrypt
                </button>
              </form>
            </SpotlightCard>
          </div>
        )}

        {/* Does Not Exist / Invalid Code / Destroyed / Expired / Network Error */}
        {!limitError && (state === 'not-found' || state === 'invalid-code' || state === 'destroyed' || state === 'expired') && (
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
            resourceType="drop"
            code={code}
          />
        )}

        {!limitError && state === 'error' && (
          <VaultErrorScreen
            variant="network_error"
            resourceType="drop"
            code={code}
            errorDetail={errorMsg}
            onRetry={() => window.location.reload()}
          />
        )}

      </main>
    </div>
  );
}
