"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useSenderHistory } from '@/hooks/useSenderHistory';
import { WISP_CONFIG } from '@/lib/config';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import ExpiryControl from '@/components/ui/ExpiryControl';
import CountdownTimer from '@/components/ui/CountdownTimer';
import SpotlightCard from '@/components/ui/SpotlightCard';
import LiveViewCount from '@/components/ui/LiveViewCount';
import CapacityOverloadScreen from '@/components/ui/CapacityOverloadScreen';
import QRCode from 'qrcode';
import { 
  FileText, 
  Copy, 
  Check, 
  Trash2, 
  Shield, 
  Flame, 
  Lock, 
  KeyRound, 
  RefreshCw,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function TextPage() {
  const [text, setText] = useState('');
  const [expirySeconds, setExpirySeconds] = useState(WISP_CONFIG.DEFAULT_EXPIRY_MINUTES * 60);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [addPassword, setAddPassword] = useState(false);
  const [password, setPassword] = useState('');

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showConfirmDestruct, setShowConfirmDestruct] = useState(false);
  const [isSimOverload, setIsSimOverload] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('sim') === 'overload';
    }
    return false;
  });

  const { uploadText, destructText, isProcessing, result, reset, phase, error } = useFileUpload('text');
  const { history, markAsDestroyed: markHistoryDestroyed } = useSenderHistory();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const historyItem = history.find(h => h.id === result?.sessionCode);
  const [localIsDestroyed, setLocalIsDestroyed] = useState(false);
  const isDestroyed = result?.isDestroyed || historyItem?.isDestroyed || localIsDestroyed;

  const markDestroyed = useCallback(() => {
    setLocalIsDestroyed(true);
    if (result?.sessionCode) {
      markHistoryDestroyed(result.sessionCode, 'manual');
    }
  }, [result, markHistoryDestroyed]);

  const shareUrl = result
    ? (typeof window !== 'undefined'
        ? (result.keyBase64
            ? `${window.location.origin}/t/${result.sessionCode}#${result.keyBase64}`
            : `${window.location.origin}/t/${result.sessionCode}`)
        : '')
    : '';

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        color: { dark: '#f8fafc', light: '#090a10' },
        margin: 2,
        width: 180,
      }).then(setQrCodeUrl).catch(console.error);
    }
  }, [shareUrl]);

  const handleShare = async () => {
    if (!text.trim() || isProcessing) {
      toast.error('Please enter some text to share');
      return;
    }

    try {
      const res = await uploadText(text, 'Text', {
        expirySeconds,
        burnAfterReading,
        password: addPassword && password ? password : null,
      });

      if (res) {
        toast.success('Text encrypted and shared securely');
      }
    } catch {
      toast.error('Failed to encrypt and share text');
    }
  };

  const handleCopy = (str: string, type: 'code' | 'link') => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(str).catch(() => {});
      }
    } catch {
      // Safe fallback
    }
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success('Session code copied');
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Share link copied');
    }
  };

  const handleDestructNow = async () => {
    if (!result?.sessionCode) return;
    try {
      await destructText(result.sessionCode);
      markDestroyed();
      setShowConfirmDestruct(false);
      toast.success('Text destroyed and wiped from server');
    } catch {
      toast.error('Failed to destroy text');
    }
  };

  const handleNewSnippet = () => {
    reset();
    setText('');
    setPassword('');
    setLocalIsDestroyed(false);
    setQrCodeUrl('');
    setCopiedLink(false);
    setCopiedCode(false);
  };

  return (
    <div className="relative h-full min-h-dvh flex flex-col text-[var(--wisp-text)] selection:bg-[var(--wisp-glow)]/30">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 min-h-0 flex flex-col justify-center px-4 sm:px-6 pt-2 mobile-bottom-clearance z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl mx-auto flex flex-col justify-center"
        >
          {/* Header Title (compact) */}
          <div className="text-center mb-2 sm:mb-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--wisp-text)]">
              Secure Text
            </h1>
            <p className="text-xs sm:text-sm text-[var(--wisp-muted)]">
              Passwords, API keys, code snippets, or confidential notes. Client-side encrypted.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {(phase === 'error' || isSimOverload) ? (
              <CapacityOverloadScreen
                key="overload"
                mode="text"
                errorMessage={error || (isSimOverload ? "SIMULATED_PEAK_CAPACITY" : undefined)}
                onRetry={handleShare}
                onReset={() => {
                  handleNewSnippet();
                  setIsSimOverload(false);
                }}
              />
            ) : !result ? (
              /* ── Form View: Frosted Glass SpotlightCard ── */
              <motion.div
                key="compose"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <SpotlightCard className="p-4 sm:p-6 flex flex-col gap-3 shadow-2xl">
                  {/* Security & Encryption Header Row */}
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--wisp-border)]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wisp-text)]">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Encrypted Text Payload</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                      <span>AES-256-GCM</span>
                    </div>
                  </div>

                  {/* Textarea with transparent frosted styling */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your sensitive text here..."
                      className="w-full min-h-[120px] sm:min-h-[180px] max-h-[220px] bg-[var(--wisp-surface-glass)] backdrop-blur-md text-[var(--wisp-text)] font-mono text-xs sm:text-sm p-3.5 rounded-xl border border-[var(--wisp-border)] focus:outline-none focus:border-[var(--wisp-glow)] focus:ring-1 focus:ring-[var(--wisp-glow)]/40 transition-all resize-y wisp-scrollbar placeholder:text-[var(--wisp-muted)]/60"
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-[var(--wisp-muted)] bg-[var(--wisp-surface)] backdrop-blur-md px-2 py-0.5 rounded border border-[var(--wisp-border)] select-none">
                      {text.length} chars
                    </div>
                  </div>

                  {/* Options Grid */}
                  <div className="space-y-2.5 pt-1 border-t border-[var(--wisp-border)]">
                    <ExpiryControl 
                      valueSeconds={expirySeconds} 
                      onChange={(sel) => setExpirySeconds(sel.totalSeconds)} 
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Burn After Reading Toggle */}
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] transition-colors cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <Flame className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-[11px] sm:text-xs text-[var(--wisp-text)]">Burn after reading</div>
                            <div className="text-[10px] text-[var(--wisp-muted)]">Purge permanently after first access</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={burnAfterReading}
                          onChange={(e) => setBurnAfterReading(e.target.checked)}
                          className="accent-[var(--wisp-glow)] w-4 h-4 cursor-pointer"
                        />
                      </label>

                      {/* Password Protection Toggle */}
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] transition-colors cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-[11px] sm:text-xs text-[var(--wisp-text)]">Password protect</div>
                            <div className="text-[10px] text-[var(--wisp-muted)]">Require a secret unlock password</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={addPassword}
                          onChange={(e) => setAddPassword(e.target.checked)}
                          className="accent-[var(--wisp-glow)] w-4 h-4 cursor-pointer"
                        />
                      </label>
                    </div>

                    {addPassword && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-2 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl px-3 py-2"
                      >
                        <Lock className="w-4 h-4 text-[var(--wisp-muted)] shrink-0" />
                        <input
                          type="password"
                          placeholder="Enter password to unlock this snippet..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-transparent text-xs text-[var(--wisp-text)] focus:outline-none w-full placeholder:text-[var(--wisp-muted)]/60"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Primary Encrypt & Share Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShare}
                    disabled={isProcessing || !text.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:via-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.45)] hover:shadow-[0_0_35px_rgba(99,102,241,0.65)] border border-indigo-400/30 transition-all cursor-pointer text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    <span>{isProcessing ? 'Encrypting with AES-256...' : 'Encrypt and Share'}</span>
                  </motion.button>
                </SpotlightCard>
              </motion.div>
            ) : isDestroyed ? (
              /* ── Destroyed State: Frosted SpotlightCard ── */
              <motion.div
                key="destroyed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <SpotlightCard className="p-8 sm:p-10 flex flex-col items-center gap-4 text-center shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[var(--wisp-text)] mb-1">
                      Text Destroyed
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--wisp-muted)] max-w-sm mx-auto">
                      This secure text snippet has been wiped permanently from the server.
                    </p>
                  </div>
                  <button
                    onClick={handleNewSnippet}
                    className="mt-2 px-5 py-2 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-full text-xs font-semibold text-[var(--wisp-text)] transition-colors cursor-pointer"
                  >
                    Share another snippet
                  </button>
                </SpotlightCard>
              </motion.div>
            ) : (
              /* ── Result State: Signature Big Bold Session Code Result Card ── */
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <SpotlightCard className="p-5 sm:p-7 flex flex-col items-center gap-4 text-center shadow-2xl">
                  {/* Status Indicator */}
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                    <Check className="w-6 h-6" />
                  </div>

                  <div className="w-full space-y-3">
                    {/* Big Session Code Display */}
                    <div className="relative bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-2xl p-4 sm:p-5 text-center">
                      <div className="text-[10px] text-[var(--wisp-muted)] uppercase tracking-wider font-semibold mb-1">
                        Session Code
                      </div>
                      <div className="text-3xl sm:text-5xl font-mono tracking-[0.2em] font-bold text-[var(--wisp-text)] drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                        {result.sessionCode}
                      </div>
                      <button
                        onClick={() => handleCopy(result.sessionCode, 'code')}
                        className="absolute top-3 right-3 p-2 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-lg transition-colors text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                        title="Copy session code"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* QR Code and Share Link Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      {qrCodeUrl && (
                        <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] p-2.5 rounded-xl flex items-center justify-center sm:col-span-1">
                          <div className="p-1.5 bg-white rounded-lg shadow-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrCodeUrl} alt="Phantom QR Code" className="w-20 h-20" />
                          </div>
                        </div>
                      )}

                      <div className={`space-y-2.5 text-left ${qrCodeUrl ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                        <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl p-2.5">
                          <div className="text-[10px] text-[var(--wisp-muted)] uppercase tracking-wider mb-1 font-semibold">
                            Share Link
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={shareUrl}
                              className="w-full bg-transparent text-xs font-mono text-[var(--wisp-text)] focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopy(shareUrl, 'link')}
                              className="p-1.5 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-lg transition-colors text-[var(--wisp-text)] cursor-pointer shrink-0"
                              title="Copy link"
                            >
                              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex space-x-2 text-[10px] font-medium">
                          <span className="flex items-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500">
                            <Shield className="w-3 h-3 mr-1" />
                            E2E Encrypted
                          </span>
                          <span className="flex items-center px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-500">
                            <Lock className="w-3 h-3 mr-1" />
                            Zero Knowledge
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning banner */}
                  <div className="flex items-center gap-2 text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg w-full justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Do not lose this link. It cannot be recovered once purged.</span>
                  </div>

                  {/* Live Stats Row: Countdown + Views */}
                  <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl p-3 w-full flex flex-col sm:flex-row justify-around items-center gap-3">
                    <div className="flex flex-col items-center">
                      <CountdownTimer expiresAt={result.expiresAt} size="sm" />
                    </div>
                    <div className="hidden sm:block w-[1px] h-6 bg-[var(--wisp-border)]" />
                    <LiveViewCount sessionCode={result.sessionCode} type="text" />
                  </div>

                  {/* Action Buttons: Destruct Now + Share Another */}
                  <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                    {showConfirmDestruct ? (
                      <div className="flex-1 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2 justify-center">
                        <span className="text-xs text-rose-500 font-medium">Permanently destroy now?</span>
                        <button
                          onClick={handleDestructNow}
                          className="px-3 py-1 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowConfirmDestruct(false)}
                          className="px-2 py-1 text-xs text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirmDestruct(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-semibold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Destruct Now</span>
                      </button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleNewSnippet}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)] font-semibold py-2.5 rounded-xl transition-colors text-xs cursor-pointer shadow-sm"
                    >
                      <span>Share another snippet</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </SpotlightCard>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
