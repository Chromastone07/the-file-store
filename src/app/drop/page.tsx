"use client";

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useSenderHistory } from '@/hooks/useSenderHistory';
import { WISP_CONFIG } from '@/lib/config';
import { formatFileSize } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
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
  UploadCloud, 
  File as FileIcon, 
  X, 
  Copy, 
  Check, 
  Trash2, 
  Shield, 
  Flame, 
  Lock, 
  KeyRound,
  AlertCircle,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

export default function DropPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(WISP_CONFIG.DEFAULT_EXPIRY_MINUTES * 60);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [addPassword, setAddPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [stripMetadata, setStripMetadata] = useState(true);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [fileError, setFileError] = useState('');
  const [showConfirmDestruct, setShowConfirmDestruct] = useState(false);

  const { uploadFile, destructDrop, phase, progress, result, reset, error } = useFileUpload('drop');
  const { history, markAsDestroyed: markHistoryDestroyed } = useSenderHistory();
  const historyItem = history.find(h => h.id === result?.sessionCode);

  const [localIsDestroyed, setLocalIsDestroyed] = useState(false);
  const [isSimOverload, setIsSimOverload] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('sim') === 'overload';
    }
    return false;
  });
  const isDestroyed = result?.isDestroyed || historyItem?.isDestroyed || localIsDestroyed;

  const markDestroyed = useCallback(() => {
    setLocalIsDestroyed(true);
    if (result?.sessionCode) {
      markHistoryDestroyed(result.sessionCode, 'manual');
    }
  }, [result, markHistoryDestroyed]);

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
    
    if (totalCurrentSize + totalNewSize > WISP_CONFIG.MAX_FILE_SIZE) {
      setFileError(`Total file size too large. Maximum size is ${WISP_CONFIG.MAX_FILE_SIZE_DISPLAY}.`);
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
      const uploadResult = await uploadFile(files, {
        expirySeconds,
        burnAfterReading,
        password: addPassword && password ? password : null,
        stripMetadata
      });
      
      if (uploadResult?.shareLink) {
        const qrUrl = await QRCode.toDataURL(uploadResult.shareLink, { 
          width: 200, 
          margin: 2, 
          color: { dark: '#f8fafc', light: '#090a10' } 
        });
        setQrDataUrl(qrUrl);
        toast.success('Files encrypted and ready to share');
      }
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  useEffect(() => {
    if (phase !== 'done' || !result?.sessionCode) return;
    
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const pollInterval = setInterval(async () => {
      try {
        const { hashString } = await import('@/lib/crypto');
        const dbLookupCode = await hashString(result.sessionCode);
        const { data } = await supabase
          .rpc('get_drops_by_lookup_code', { p_code: dbLookupCode });
        
        if (isCancelled) return;
        if (!data || data.length === 0 || data.every((d: { is_destroyed?: boolean }) => d.is_destroyed)) {
          markDestroyed();
        }
      } catch {
        // Ignored
      }
    }, 6000);

    const setupListener = async () => {
      const { hashString } = await import('@/lib/crypto');
      const dbLookupCode = await hashString(result.sessionCode);
      if (isCancelled) return;

      channel = supabase
        .channel(`drop-watch-${dbLookupCode}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'drops', filter: `session_code=eq.${dbLookupCode}` },
          (payload: { new?: { is_destroyed?: boolean } }) => {
            if (payload.new?.is_destroyed) markDestroyed();
          }
        )
        .subscribe();
    };
    
    setupListener();

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [phase, result, markDestroyed]);

  const copyToClipboard = (text: string, type: 'link' | 'code') => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch {
      // Safe fallback
    }
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Share link copied');
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success('Session code copied');
    }
  };

  const handleDestructNow = async () => {
    if (!result?.sessionCode) return;
    try {
      await destructDrop(result.sessionCode);
      markDestroyed();
      setShowConfirmDestruct(false);
      toast.success('Files destroyed and wiped from server');
    } catch {
      toast.error('Failed to destroy file session');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setFileError('');
    reset();
    setQrDataUrl('');
    setLocalIsDestroyed(false);
    setShowConfirmDestruct(false);
  };

  return (
    <div className="relative h-full min-h-dvh flex flex-col font-sans text-[var(--wisp-text)] selection:bg-[var(--wisp-glow)]/30">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 min-h-0 flex flex-col justify-center px-4 sm:px-6 pt-2 mobile-bottom-clearance z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl mx-auto flex flex-col justify-center"
        >
          {/* Header Title */}
          <div className="text-center mb-2.5 sm:mb-4">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--wisp-text)]">
              Drop File
            </h1>
            <p className="text-xs sm:text-sm text-[var(--wisp-muted)]">
              Anonymous, encrypted file sharing. Files self-destruct after download or expiry.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {(phase === 'error' || isSimOverload) ? (
              <CapacityOverloadScreen
                key="overload"
                mode="drop"
                errorMessage={error || (isSimOverload ? "SIMULATED_PEAK_CAPACITY" : undefined)}
                onRetry={handleUpload}
                onReset={() => {
                  handleReset();
                  setIsSimOverload(false);
                }}
              />
            ) : (phase === 'idle' || phase === 'stripping' || phase === 'encrypting' || phase === 'uploading') && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Error Banner */}
                {fileError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between backdrop-blur-md"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fileError}
                    </span>
                    <button onClick={() => setFileError('')} className="text-xs font-bold underline ml-3 cursor-pointer">
                      Dismiss
                    </button>
                  </motion.div>
                )}
                
                {/* Unified Frosted Glassmorphism SpotlightCard for Drop + Options */}
                <SpotlightCard className="p-4 sm:p-6 shadow-2xl flex flex-col gap-4">
                  <input 
                    type="file" 
                    multiple
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect}
                  />

                  {/* Dropzone Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-300 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] ${
                      isDragging 
                        ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.3)] scale-[1.01]' 
                        : 'border-[var(--wisp-border)] hover:border-indigo-400/60'
                    }`}
                  >
                    {files.length > 0 ? (
                      <div className="space-y-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-indigo-500 shadow-inner">
                          <FileIcon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto px-1 wisp-scrollbar">
                          {files.map((f, i) => (
                            <div 
                              key={i} 
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-between bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] px-3 py-2 rounded-xl border border-[var(--wisp-border)] text-xs backdrop-blur-sm transition-colors"
                            >
                              <span className="truncate max-w-[220px] sm:max-w-[300px] font-medium text-[var(--wisp-text)]">
                                {f.name}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-[var(--wisp-muted)] font-mono">
                                  {formatFileSize(f.size)}
                                </span>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFiles(files.filter((_, idx) => idx !== i));
                                  }}
                                  className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-500 transition-colors cursor-pointer"
                                  title="Remove file"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-[11px] text-[var(--wisp-muted)] flex items-center justify-center space-x-2 pt-1">
                          <span>{files.length} file{files.length > 1 ? 's' : ''} selected</span>
                          <span>•</span>
                          <span className="font-mono">Total: {formatFileSize(files.reduce((a,b)=>a+b.size,0))}</span>
                          <span>•</span>
                          <span className="text-indigo-500 hover:underline">Click to add more</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5 py-2">
                        <motion.div 
                          animate={isDragging ? { y: [0, -8, 0] } : {}}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="inline-block"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] flex items-center justify-center text-indigo-500 mx-auto shadow-inner">
                            <UploadCloud className="w-7 h-7" />
                          </div>
                        </motion.div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[var(--wisp-text)]">
                            Drop a file here
                          </h3>
                          <p className="text-xs text-[var(--wisp-muted)]">
                            or click to browse your device
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-[10px] text-[var(--wisp-muted)]">
                          <span>Max 50MB</span>
                          <span>•</span>
                          <span>All formats supported</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Options: Smoothly expands when files are present, or available as compact controls */}
                  <AnimatePresence>
                    {files.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-1 border-t border-[var(--wisp-border)] overflow-hidden"
                      >
                        <ExpiryControl 
                          valueSeconds={expirySeconds} 
                          onChange={(sel) => setExpirySeconds(sel.totalSeconds)} 
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* Burn After Reading */}
                          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] transition-colors cursor-pointer select-none">
                            <div className="flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-[11px] text-[var(--wisp-text)] font-medium">Burn on view</span>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={burnAfterReading} 
                              onChange={(e) => setBurnAfterReading(e.target.checked)} 
                              className="accent-indigo-500 w-4 h-4 cursor-pointer" 
                            />
                          </label>

                          {/* Strip EXIF Metadata */}
                          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] transition-colors cursor-pointer select-none">
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[11px] text-[var(--wisp-text)] font-medium">Strip EXIF</span>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={stripMetadata} 
                              onChange={(e) => setStripMetadata(e.target.checked)} 
                              className="accent-indigo-500 w-4 h-4 cursor-pointer" 
                            />
                          </label>

                          {/* Password Protection */}
                          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] hover:border-[var(--wisp-border-strong)] transition-colors cursor-pointer select-none">
                            <div className="flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="text-[11px] text-[var(--wisp-text)] font-medium">Password</span>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={addPassword} 
                              onChange={(e) => setAddPassword(e.target.checked)} 
                              className="accent-indigo-500 w-4 h-4 cursor-pointer" 
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
                              placeholder="Set optional unlock password..."
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="bg-transparent text-xs text-[var(--wisp-text)] focus:outline-none w-full placeholder:text-[var(--wisp-muted)]/60"
                            />
                          </motion.div>
                        )}

                        {/* Upload Progress or Glowing Primary Action Button */}
                        {phase === 'stripping' || phase === 'encrypting' || phase === 'uploading' ? (
                          <div className="p-3 bg-[var(--wisp-surface-glass)] rounded-xl border border-[var(--wisp-border)] flex flex-col gap-2">
                            <div className="flex justify-between text-xs text-[var(--wisp-muted)]">
                              <span>
                                {phase === 'stripping' ? 'Sanitizing EXIF metadata...' : phase === 'encrypting' ? 'Encrypting with AES-256-GCM...' : 'Uploading encrypted payload...'}
                              </span>
                              <span className="font-mono font-bold text-indigo-400">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUpload}
                            disabled={files.length === 0}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:via-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.45)] hover:shadow-[0_0_35px_rgba(99,102,241,0.65)] border border-indigo-400/30 transition-all cursor-pointer text-xs sm:text-sm mt-1"
                          >
                            <Shield className="w-4 h-4" />
                            <span>Encrypt and Drop {files.length} File{files.length > 1 ? 's' : ''}</span>
                          </motion.button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SpotlightCard>
              </motion.div>
            )}

            {/* ── Result State: Signature Big Bold Session Code Result Card ── */}
            {phase === 'done' && result && !isDestroyed && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <SpotlightCard className="p-5 sm:p-7 flex flex-col items-center gap-4 text-center shadow-2xl">
                  {/* Status Indicator */}
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
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
                        onClick={() => copyToClipboard(result.sessionCode, 'code')}
                        className="absolute top-3 right-3 p-2 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-lg transition-colors text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                        title="Copy session code"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      
                      {result.filenames && result.filenames.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 justify-center">
                          {result.filenames.map((name, idx) => (
                            <span key={idx} className="bg-[var(--wisp-surface-glass)] text-[var(--wisp-muted)] text-[10px] px-2 py-0.5 rounded border border-[var(--wisp-border)] flex items-center gap-1 font-mono">
                              <FileIcon className="w-3 h-3 text-indigo-400" />
                              <span className="truncate max-w-[140px]">{name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* QR Code and Share Link Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      {qrDataUrl && (
                        <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] p-2.5 rounded-xl flex items-center justify-center sm:col-span-1">
                          <div className="p-1.5 bg-white rounded-lg shadow-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrDataUrl} alt="QR Code" className="w-20 h-20" />
                          </div>
                        </div>
                      )}
                      
                      <div className={`space-y-2.5 text-left ${qrDataUrl ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                        <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl p-2.5">
                          <div className="text-[10px] text-[var(--wisp-muted)] uppercase tracking-wider mb-1 font-semibold">
                            Share Link
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={result.shareLink} 
                              className="w-full bg-transparent text-xs font-mono text-[var(--wisp-text)] focus:outline-none"
                            />
                            <button 
                              onClick={() => copyToClipboard(result.shareLink, 'link')}
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
                    <span>Do not lose this link. Files cannot be recovered once purged.</span>
                  </div>
                  
                  {/* Stats Row */}
                  <div className="bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl p-3 w-full flex flex-col sm:flex-row justify-around items-center gap-3">
                    <div className="flex flex-col items-center">
                      <CountdownTimer expiresAt={result.expiresAt} size="sm" />
                    </div>
                    <div className="hidden sm:block w-[1px] h-6 bg-[var(--wisp-border)]" />
                    <LiveViewCount sessionCode={result.sessionCode} type="drop" />
                  </div>

                  {/* Action Buttons */}
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
                      onClick={handleReset}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)] font-semibold py-2.5 rounded-xl transition-colors text-xs cursor-pointer shadow-sm"
                    >
                      <span>Drop another file</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </SpotlightCard>
              </motion.div>
            )}

            {/* ── Destroyed State ── */}
            {isDestroyed && (
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
                      File Destroyed
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--wisp-muted)] max-w-sm mx-auto">
                      This secure file session no longer exists. All encrypted blobs were wiped permanently from storage.
                    </p>
                  </div>
                  <button 
                    onClick={handleReset}
                    className="mt-2 px-5 py-2 bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] rounded-full text-xs font-semibold text-[var(--wisp-text)] transition-colors cursor-pointer"
                  >
                    Drop another file
                  </button>
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
