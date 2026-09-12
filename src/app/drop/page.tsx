"use client";

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileUpload, UploadPhase } from '@/hooks/useFileUpload';
import { PHANTOM_CONFIG } from '@/lib/config';
import { formatFileSize, getFileCategory, getCategoryLabel } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import QRCode from 'qrcode';
import { Bomb } from 'lucide-react';
import CountdownTimer from '@/components/ui/CountdownTimer';
import SpotlightCard from '@/components/ui/SpotlightCard';
import LiveViewCount from '@/components/ui/LiveViewCount';

export default function DropPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expiry, setExpiry] = useState<{ label: string; value: number }>(PHANTOM_CONFIG.EXPIRY_PRESETS[1]);
  const [isCustomExpiry, setIsCustomExpiry] = useState(false);
  const [customExpiryValue, setCustomExpiryValue] = useState(1);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<'minutes'|'seconds'>('minutes');
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [addPassword, setAddPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [stripMetadata, setStripMetadata] = useState(true);
  
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [fileError, setFileError] = useState('');
  const [isDestroyed, setIsDestroyed] = useState(false);

  const { uploadFile, destructDrop, phase, progress, result, reset, error } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndAddFiles = (selectedFiles: FileList | File[]) => {
    setFileError('');
    const newFiles = Array.from(selectedFiles);
    const totalCurrentSize = files.reduce((acc, f) => acc + f.size, 0);
    const totalNewSize = newFiles.reduce((acc, f) => acc + f.size, 0);
    
    if (totalCurrentSize + totalNewSize > PHANTOM_CONFIG.MAX_FILE_SIZE) {
      setFileError(`Total file size too large. Maximum size is ${formatFileSize(PHANTOM_CONFIG.MAX_FILE_SIZE)}.`);
      return;
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    try {
      let finalExpiry = expiry.value;
      if (isCustomExpiry) {
        finalExpiry = customExpiryUnit === 'minutes' ? customExpiryValue * 60 : customExpiryValue;
      } else {
        finalExpiry = finalExpiry * 60; // preset values are in minutes
      }

      const uploadResult = await uploadFile(files, {
        expirySeconds: finalExpiry,
        burnAfterReading,
        password: addPassword && password ? password : null,
        stripMetadata
      });
      
      if (uploadResult?.shareLink) {
        const qrUrl = await QRCode.toDataURL(uploadResult.shareLink, { 
          width: 200, 
          margin: 2, 
          color: { dark: '#e2e8f0', light: '#0d0d1a' } 
        });
        setQrDataUrl(qrUrl);
      }
    } catch (err: any) {
      setFileError(err.message || 'Upload failed');
    }
  };

  useEffect(() => {
    if (phase !== 'done' || !result?.sessionCode) return;
    
    // Poll for destruction every 5 seconds as fallback
    const pollInterval = setInterval(async () => {
      try {
        const { hashString } = await import('@/lib/crypto');
        const dbLookupCode = await hashString(result.sessionCode);
        const { data } = await supabase
          .rpc('get_drops_by_lookup_code', { p_code: dbLookupCode });
        
        // If no rows exist, or if ALL files in the group are destroyed
        if (!data || data.length === 0 || data.every(d => d.is_destroyed)) {
          setIsDestroyed(true);
        }
      } catch (e) {}
    }, 5000);

    // Real-time listener setup using an async function to get the hash
    let channel: any;
    const setupListener = async () => {
      const { hashString } = await import('@/lib/crypto');
      const dbLookupCode = await hashString(result.sessionCode);
      
      channel = supabase
        .channel(`drop-watch-${dbLookupCode}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'drops', filter: `session_code=eq.${dbLookupCode}` },
          (payload: any) => {
            if (payload.new?.is_destroyed) setIsDestroyed(true);
          }
        )
        .subscribe();
    };
    
    setupListener();

    return () => {
      clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [phase, result]);

  const copyToClipboard = (text: string, type: 'link' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setFileError('');
    reset();
    setQrDataUrl('');
  };

  return (
    <div className="min-h-screen flex flex-col relative text-[var(--phantom-text)]">
      <AnimatedBackground />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <AnimatePresence mode="wait">
            {(phase === 'idle' || phase === 'error') && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="space-y-6"
              >
                {phase === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--phantom-danger)]/10 border border-[var(--phantom-danger)]/50 text-[var(--phantom-danger)] px-4 py-3 rounded-xl flex items-center justify-between"
                  >
                    <span>{error || 'An error occurred during upload.'}</span>
                    <button onClick={reset} className="text-sm underline hover:no-underline ml-4">Dismiss</button>
                  </motion.div>
                )}
                
                <SpotlightCard
                  className={`phantom-card border-2 border-dashed p-1 transition-all duration-500 cursor-pointer ${
                    isDragging 
                      ? 'border-[var(--phantom-glow)] scale-[1.02] shadow-[0_0_30px_rgba(99,102,241,0.3)]' 
                      : 'border-[var(--phantom-border)] hover:border-[var(--phantom-accent)]'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center justify-center min-h-[16rem] p-10 bg-[var(--phantom-surface)]/40 rounded-xl pointer-events-none">
                    <input 
                      type="file" 
                      multiple
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileSelect}
                    />
                    
                    {files.length > 0 ? (
                      <div className="text-center w-full">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--phantom-elevated)] mb-4">
                          <svg className="w-8 h-8 text-[var(--phantom-glow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        
                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto mb-4 px-4 w-full">
                          {files.map((f, i) => (
                            <div key={i} className="flex items-center justify-between bg-[var(--phantom-elevated)] px-3 py-2 rounded border border-[var(--phantom-border)] pointer-events-auto">
                              <span className="truncate max-w-[200px] text-sm font-medium">{f.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--phantom-muted)]">{formatFileSize(f.size)}</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFiles(files.filter((_, idx) => idx !== i));
                                  }}
                                  className="p-1 hover:bg-[var(--phantom-surface)] rounded text-[var(--phantom-danger)] transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-[var(--phantom-muted)] flex items-center justify-center space-x-2">
                          <span>{files.length} file{files.length > 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>Total: {formatFileSize(files.reduce((a,b)=>a+b.size,0))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <motion.div 
                          animate={isDragging ? { y: [0, -10, 0] } : {}}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="inline-block"
                        >
                          <svg className="w-16 h-16 text-[var(--phantom-muted)] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </motion.div>
                        <div>
                          <h3 className="text-xl font-medium mb-1">Drop a file here</h3>
                          <p className="text-[var(--phantom-muted)]">or click to browse</p>
                        </div>
                        <p className="text-sm text-[var(--phantom-muted)]/70 mt-4">Max size: {formatFileSize(PHANTOM_CONFIG.MAX_FILE_SIZE)}</p>
                      </div>
                    )}
                  </div>
                </SpotlightCard>
                
                {fileError && (
                  <div className="text-[var(--phantom-danger)] text-sm text-center">{fileError}</div>
                )}

                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-xl p-6 space-y-6 mt-4">
                        
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-[var(--phantom-muted)] uppercase tracking-wider">Expiry Time</label>
                          <div className="grid grid-cols-4 gap-2">
                            {PHANTOM_CONFIG.EXPIRY_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                onClick={() => {
                                  setExpiry(preset);
                                  setIsCustomExpiry(false);
                                }}
                                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                  expiry.label === preset.label && !isCustomExpiry
                                    ? 'bg-[var(--phantom-glow)] text-white' 
                                    : 'bg-[var(--phantom-elevated)] text-[var(--phantom-text)] hover:bg-[var(--phantom-elevated)]/80'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                            <button
                              onClick={() => setIsCustomExpiry(true)}
                              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                isCustomExpiry
                                  ? 'bg-[var(--phantom-glow)] text-white' 
                                  : 'bg-[var(--phantom-elevated)] text-[var(--phantom-text)] hover:bg-[var(--phantom-elevated)]/80'
                              }`}
                            >
                              Custom
                            </button>
                          </div>
                          {isCustomExpiry && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 flex items-center gap-3 bg-[var(--phantom-elevated)]/50 p-3 rounded-lg border border-[var(--phantom-border)]">
                              <span className="text-sm text-[var(--phantom-text)] font-medium whitespace-nowrap">Keep alive for:</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  min="1"
                                  max="525600"
                                  value={customExpiryValue}
                                  onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-20 bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-md px-3 py-1.5 text-center text-sm text-[var(--phantom-text)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors"
                                />
                                <select
                                  value={customExpiryUnit}
                                  onChange={(e) => setCustomExpiryUnit(e.target.value as 'minutes'|'seconds')}
                                  className="bg-transparent text-sm text-[var(--phantom-muted)] focus:outline-none"
                                >
                                  <option value="minutes">minutes</option>
                                  <option value="seconds">seconds</option>
                                </select>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-[var(--phantom-border)]/50">
                          <div>
                            <div className="font-medium">Burn after reading</div>
                            <div className="text-sm text-[var(--phantom-muted)]">File is permanently deleted after first view (One-time link)</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={burnAfterReading} onChange={() => setBurnAfterReading(!burnAfterReading)} />
                            <div className="w-11 h-6 bg-[var(--phantom-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--phantom-text)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--phantom-glow)]"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-[var(--phantom-border)]/50">
                          <div>
                            <div className="font-medium">Add password layer</div>
                            <div className="text-sm text-[var(--phantom-muted)]">Require a password to decrypt</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={addPassword} onChange={() => setAddPassword(!addPassword)} />
                            <div className="w-11 h-6 bg-[var(--phantom-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--phantom-text)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--phantom-glow)]"></div>
                          </label>
                        </div>
                        
                        {addPassword && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                            <input 
                              type="password" 
                              placeholder="Enter secure password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-lg px-4 py-3 text-[var(--phantom-text)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors"
                            />
                          </motion.div>
                        )}

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <div className="font-medium">Strip metadata</div>
                            <div className="text-sm text-[var(--phantom-muted)]">Remove EXIF, GPS, author info</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={stripMetadata} onChange={() => setStripMetadata(!stripMetadata)} />
                            <div className="w-11 h-6 bg-[var(--phantom-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--phantom-text)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--phantom-glow)]"></div>
                          </label>
                        </div>

                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpload();
                        }}
                        disabled={files.length === 0 || (addPassword && !password)}
                        className="w-full mt-6 bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white font-medium py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        Encrypt & Upload
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {['processing', 'encrypting', 'uploading', 'finalizing'].includes(phase) && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.3 }}
              >
                <SpotlightCard className="p-12 text-center space-y-8">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="relative w-32 h-32 mx-auto"
                  >
                    <svg className="animate-spin w-full h-full text-[var(--phantom-elevated)] drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--phantom-glow)] font-bold">
                      {Math.round(progress)}%
                    </div>
                  </motion.div>
                  
                  <div>
                    <h3 className="text-xl font-medium mb-2 capitalize">
                      {phase === 'stripping' ? 'Stripping metadata...' : 
                      phase === 'encrypting' ? 'Encrypting...' : 
                      phase === 'uploading' ? 'Uploading...' : 'Finalizing...'}
                    </h3>
                    <div className="w-full h-2 bg-[var(--phantom-elevated)] rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[var(--phantom-glow)] relative overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear" }}
                      >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                      </motion.div>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            )}

            {phase === 'done' && result && (
              <AnimatePresence mode="wait">
                {isDestroyed ? (
                  <motion.div
                    key="destroyed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <SpotlightCard className="p-12 flex flex-col items-center gap-6 text-center">
                      <div className="w-20 h-20 bg-[var(--phantom-danger)]/10 rounded-full flex items-center justify-center text-[var(--phantom-danger)]">
                        <Bomb className="w-10 h-10" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-[var(--phantom-text)] mb-2">Drop Destroyed</h2>
                        <p className="text-[var(--phantom-muted)] max-w-sm mx-auto">This secure drop no longer exists. It has been successfully wiped from the server.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setIsDestroyed(false);
                          reset();
                          setFiles([]);
                        }}
                        className="mt-4 px-6 py-2 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] transition-colors"
                      >
                        Drop another file
                      </button>
                    </SpotlightCard>
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                <SpotlightCard className="p-8 space-y-8">
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="text-center"
                  >
                    <div className="w-16 h-16 bg-[var(--phantom-success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-[var(--phantom-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Secure Drop Ready</h2>
                    <p className="text-[var(--phantom-muted)]">Save this code — we cannot recover it</p>
                  </motion.div>

                  <div className="space-y-6">
                    <div className="bg-[var(--phantom-elevated)] rounded-lg p-6 text-center relative group">
                      <div className="text-sm text-[var(--phantom-muted)] mb-2 uppercase tracking-wider font-medium">Session Code</div>
                      <div className="text-4xl md:text-5xl font-mono tracking-[0.2em] font-bold text-[var(--phantom-text)] drop-shadow-md">
                        {result.sessionCode}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(result.sessionCode, 'code')}
                        className="absolute top-4 right-4 p-2 bg-[var(--phantom-surface)] rounded-md hover:bg-[var(--phantom-border)] transition-colors"
                        title="Copy code"
                      >
                        {copiedCode ? (
                          <svg className="w-5 h-5 text-[var(--phantom-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-[var(--phantom-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                      </button>
                      
                      {result.filenames && result.filenames.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                          {result.filenames.map((name, idx) => (
                            <span key={idx} className="bg-[var(--phantom-surface)] text-[var(--phantom-muted)] text-xs px-2 py-1 rounded border border-[var(--phantom-border)] flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      {qrDataUrl && (
                        <div className="bg-[var(--phantom-elevated)] p-4 rounded-lg shrink-0">
                          <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 rounded" />
                        </div>
                      )}
                      
                      <div className="flex-1 w-full space-y-4">
                        <div className="relative">
                          <input 
                            type="text" 
                            readOnly 
                            value={result.shareLink} 
                            className="w-full bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-lg px-4 py-3 pr-12 text-sm font-mono text-[var(--phantom-text)] focus:outline-none"
                          />
                          <button 
                            onClick={() => copyToClipboard(result.shareLink, 'link')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[var(--phantom-surface)] rounded hover:bg-[var(--phantom-border)] transition-colors"
                          >
                            {copiedLink ? (
                              <svg className="w-4 h-4 text-[var(--phantom-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-4 h-4 text-[var(--phantom-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            )}
                          </button>
                        </div>
                        
                        <div className="flex space-x-3 text-xs font-medium">
                          <span className="flex items-center px-3 py-1 bg-[var(--phantom-elevated)] rounded-full text-[var(--phantom-success)]">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            E2E Encrypted
                          </span>
                          <span className="flex items-center px-3 py-1 bg-[var(--phantom-elevated)] rounded-full text-[var(--phantom-accent)]">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            Zero Knowledge
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-12 space-y-8">
                    <div className="bg-[var(--phantom-elevated)]/50 rounded-xl p-6 border border-[var(--phantom-border)] flex flex-col md:flex-row justify-around items-center gap-6">
                      <div className="flex flex-col items-center">
                        <span className="text-[var(--phantom-muted)] text-xs font-semibold uppercase tracking-wider mb-0.5">Time Left</span>
                        <CountdownTimer expiresAt={result.expiresAt} />
                      </div>
                      <div className="w-px h-8 bg-[var(--phantom-border)] hidden md:block"></div>
                      <LiveViewCount sessionCode={result.sessionCode} type="drop" />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
                      <button
                        onClick={async () => {
                          try {
                            await destructDrop(result.sessionCode);
                            setIsDestroyed(true);
                          } catch (err) {
                            console.error('Failed to destroy session.');
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
                        onClick={handleReset}
                        className="flex-1 bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] text-[var(--phantom-text)] font-medium py-3.5 rounded-xl transition-colors shadow-sm"
                      >
                        Drop another file
                      </motion.button>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
                )}
              </AnimatePresence>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
      
      <Footer />
    </div>
  );
}
