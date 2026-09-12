"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFileUpload } from '@/hooks/useFileUpload';
import { PHANTOM_CONFIG } from '@/lib/config';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import QRCode from 'qrcode';
import { Copy, Shield, Lock, AlertTriangle, RefreshCw, Bomb } from 'lucide-react';
import { toast } from 'sonner';
import CountdownTimer from '@/components/ui/CountdownTimer';
import LiveViewCount from '@/components/ui/LiveViewCount';
import SpotlightCard from '@/components/ui/SpotlightCard';
import CustomSelect from '@/components/ui/CustomSelect';

export default function TextPage() {
  const [text, setText] = useState('');
  const [expiry, setExpiry] = useState<number>(PHANTOM_CONFIG?.EXPIRY_PRESETS?.[0]?.value || 3600);
  const [customExpiryValue, setCustomExpiryValue] = useState<number>(1);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<'minutes'|'seconds'>('minutes');
  const [contentType, setContentType] = useState('Text');
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);
  const { uploadText, destructText, isProcessing: isUploading, result } = useFileUpload();
  
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const shareUrl = result ? `${window.location.origin}/t/${result.sessionCode}#${result.keyBase64}` : '';

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        color: {
          dark: '#e2e8f0', // Light text
          light: '#0d0d1a', // Dark bg
        },
        margin: 2,
        width: 200,
      }).then(setQrCodeUrl).catch(console.error);
    }
  }, [shareUrl]);

  const handleShare = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text to share');
      return;
    }
    try {
      let finalExpiry = expiry;
      if (expiry === -1) {
        finalExpiry = customExpiryUnit === 'minutes' ? customExpiryValue * 60 : customExpiryValue;
      } else {
        finalExpiry = finalExpiry * 60; // Preset values are in minutes
      }
      await uploadText(text, contentType, { expirySeconds: finalExpiry, burnAfterReading });
      toast.success('Text encrypted and shared securely!');
    } catch (err) {
      toast.error('Failed to encrypt and share text.');
    }
  };

  const handleCopy = (str: string, msg: string) => {
    navigator.clipboard.writeText(str);
    toast.success(msg);
  };

  return (
    <div className="relative min-h-screen flex flex-col z-10">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl flex flex-col gap-6"
        >
          <div className="text-center mb-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--phantom-text)] mb-3">
              Secure Text
            </h1>
            <p className="text-[var(--phantom-muted)] text-lg">
              Share passwords, API keys, notes, or code snippets. Encrypted and ephemeral.
            </p>
          </div>

          {!result ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <SpotlightCard className="p-8 flex flex-col gap-6">
                <div className="relative">
                <textarea
                  className="w-full min-h-[12rem] bg-[var(--phantom-elevated)] text-[var(--phantom-text)] font-mono p-4 rounded-xl border border-[var(--phantom-border)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors resize-y"
                  placeholder="Paste your sensitive text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="absolute bottom-3 right-3 text-xs text-[var(--phantom-muted)] bg-[var(--phantom-surface)] px-2 py-1 rounded">
                  {text.length} chars
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 border-t border-[var(--phantom-border)] pt-6">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-sm font-medium text-[var(--phantom-muted)]">Content Type</label>
                  <CustomSelect 
                    value={contentType}
                    onChange={(val) => setContentType(val)}
                    options={[
                      { label: "Plain Text", value: "Text" },
                      { label: "Code Snippet", value: "Code" },
                      { label: "Secure Note", value: "Note" }
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between bg-[var(--phantom-elevated)] p-4 rounded-xl border border-[var(--phantom-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--phantom-danger)]/10 text-[var(--phantom-danger)] flex items-center justify-center">
                      <Bomb className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--phantom-text)]">Burn after reading</div>
                      <div className="text-sm text-[var(--phantom-muted)]">Text is permanently deleted after first view (One-time link)</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={burnAfterReading} 
                      onChange={(e) => setBurnAfterReading(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-[var(--phantom-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--phantom-border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--phantom-danger)]"></div>
                  </label>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-sm font-medium text-[var(--phantom-muted)]">Expiry Time</label>
                  <CustomSelect 
                    value={expiry}
                    onChange={(val) => setExpiry(Number(val))}
                    options={[
                      ...(PHANTOM_CONFIG?.EXPIRY_PRESETS?.map((preset: any) => ({
                        label: preset.label,
                        value: preset.value
                      })) || []),
                      { label: "Custom", value: -1 }
                    ]}
                  />
                  
                  {expiry === -1 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-1 flex items-center gap-2 bg-[var(--phantom-elevated)]/50 p-2 rounded-lg border border-[var(--phantom-border)]">
                      <input 
                        type="number" 
                        min="1"
                        max="525600"
                        value={customExpiryValue}
                        onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-md px-2 py-1 text-center text-sm text-[var(--phantom-text)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors"
                      />
                      <CustomSelect
                        value={customExpiryUnit}
                        onChange={(val) => setCustomExpiryUnit(val as 'minutes'|'seconds')}
                        options={[
                          { label: "minutes", value: "minutes" },
                          { label: "seconds", value: "seconds" }
                        ]}
                        className="w-32 ml-auto"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  disabled={isUploading || !text.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white py-4 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-2"
                >
                  {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {isUploading ? 'Encrypting & Uploading...' : 'Encrypt & Share'}
                </motion.button>
              </SpotlightCard>
            </motion.div>
          ) : isDestroyed ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <SpotlightCard className="p-12 flex flex-col items-center gap-6 text-center">
                <div className="w-20 h-20 bg-[var(--phantom-danger)]/10 rounded-full flex items-center justify-center text-[var(--phantom-danger)]">
                  <Bomb className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--phantom-text)] mb-2">Text Destroyed</h2>
                  <p className="text-[var(--phantom-muted)] max-w-sm mx-auto">This secure text no longer exists. It has been successfully wiped from the server.</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-6 py-2 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] transition-colors"
                >
                  Share another snippet
                </button>
              </SpotlightCard>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <SpotlightCard className="p-8 flex flex-col items-center gap-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--phantom-success)]/10 text-[var(--phantom-success)] flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                <Lock className="w-8 h-8" />
              </div>
              
              <div className="w-full space-y-4">
                <div className="bg-[var(--phantom-elevated)] p-4 rounded-xl border border-[var(--phantom-border)]">
                  <p className="text-[var(--phantom-muted)] text-sm mb-2">Share Link</p>
                  <div className="flex items-center gap-3">
                    <input 
                      readOnly 
                      value={shareUrl}
                      className="flex-1 bg-transparent text-[var(--phantom-text)] font-mono text-sm focus:outline-none"
                    />
                    <button 
                      onClick={() => handleCopy(shareUrl, 'Link copied!')}
                      className="p-2 hover:bg-[var(--phantom-border)] rounded-lg transition-colors text-[var(--phantom-accent)]"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--phantom-elevated)] p-4 rounded-xl border border-[var(--phantom-border)] flex flex-col items-center justify-center gap-2">
                    <p className="text-[var(--phantom-muted)] text-sm">Session Code</p>
                    <p className="text-2xl font-mono font-bold text-[var(--phantom-text)]">{result.sessionCode}</p>
                  </div>
                  {qrCodeUrl && (
                    <div className="bg-[var(--phantom-elevated)] p-4 rounded-xl border border-[var(--phantom-border)] flex items-center justify-center">
                      <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 rounded" />
                    </div>
                  )}
                </div>
              </div>

                <div className="flex items-center gap-2 text-[var(--phantom-warning)] text-sm bg-[var(--phantom-warning)]/10 px-4 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  <p>Do not lose this link. We cannot recover the text without it.</p>
                </div>
                <div className="mt-12 space-y-8 w-full">
                  <div className="bg-[var(--phantom-elevated)]/50 rounded-xl p-6 border border-[var(--phantom-border)] w-full flex flex-col md:flex-row justify-around items-center gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-[var(--phantom-muted)] text-xs font-semibold uppercase tracking-wider mb-0.5">Time Left</span>
                      <CountdownTimer expiresAt={result.expiresAt} />
                    </div>
                    <div className="w-px h-8 bg-[var(--phantom-border)] hidden md:block"></div>
                    <LiveViewCount sessionCode={result.sessionCode} type="text" />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto w-full">
                    <button
                      onClick={async () => {
                        try {
                          await destructText(result.sessionCode);
                          toast.success('Session manually destroyed.');
                          setIsDestroyed(true);
                        } catch (err) {
                          toast.error('Failed to destroy session.');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-[var(--phantom-danger)] hover:bg-[var(--phantom-danger)]/90 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                      <Bomb className="w-5 h-5" />
                      Destruct Now
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.location.reload()}
                      className="flex-1 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] text-[var(--phantom-text)] font-medium py-3.5 rounded-xl transition-colors shadow-sm"
                    >
                      Share another snippet
                    </motion.button>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          )}
        </motion.div>
      </main>
      
      <Footer />
    </div>
  );
}
