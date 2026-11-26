"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalSession, ActiveSession, DecryptedFile } from '@/context/GlobalSessionContext';
import { Shield, X, MessageSquare, FileText, Activity, AlertTriangle } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const FileViewerModal = dynamic(() => import('../viewers/FileViewerModal'), { ssr: false });
const QRScannerModal = dynamic(() => import('./QRScannerModal'), { ssr: false });
import { recordView, destroyDrop, destroySecureText, getDropByCode, getDropsByLookupCode, getSecureTextByCode } from '@/lib/supabase';
import { hashString } from '@/lib/crypto';
import { stealth } from '@/lib/stealth';
import { toast } from 'sonner';

interface ViewerErrorBoundaryProps {
  onClose: () => void;
  children: React.ReactNode;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
}

class ViewerErrorBoundary extends React.Component<ViewerErrorBoundaryProps, ViewerErrorBoundaryState> {
  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('FileViewerModal render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="max-w-sm w-full bg-[var(--wisp-surface)] border border-[var(--wisp-border)] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[var(--wisp-text)]">Preview Unavailable</h3>
            <p className="text-xs text-[var(--wisp-muted)]">
              This file could not be rendered cleanly in the browser preview.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Close Viewer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SessionDock() {
  const { 
    activeSessions, 
    removeActiveSession, 
    viewingSessionId, 
    setViewingSessionId,
    isDockOpen,
    setIsDockOpen,
    isQRScannerOpen,
    closeQRScanner,
    qrScannerCallback
  } = useGlobalSession();
  const router = useRouter();
  const pathname = usePathname();
  const isChat = pathname === '/chat' || pathname?.startsWith('/chat');
  
  const [fileIndexState, setFileIndexState] = useState<{ sessionId: string | null; index: number }>({
    sessionId: null,
    index: 0,
  });

  // BAR Tracking
  const viewRecordedRef = useRef<Set<string>>(new Set());
  const pendingDestroyedRef = useRef<Set<string>>(new Set());
  const burnedSessionIdsRef = useRef<Set<string>>(new Set());

  const viewingSession = activeSessions.find(s => s.id === viewingSessionId);
  const viewingDropSession = viewingSession && viewingSession.type === 'drop' ? viewingSession : null;
  const viewingTextSession = viewingSession && viewingSession.type === 'text' ? viewingSession : null;
  const rawIndex = fileIndexState.sessionId === viewingSessionId ? fileIndexState.index : 0;
  const activeFileIndex = viewingDropSession && rawIndex >= 0 && rawIndex < viewingDropSession.files.length ? rawIndex : 0;
  const currentDropFile: DecryptedFile | undefined = viewingDropSession?.files[activeFileIndex];

  // Immediately burn & purge an active session (on Close, Tab Switch, or Expiry)
  const burnViewingSession = useCallback(
    (session: ActiveSession, reason: 'close' | 'tab-switch' | 'expired') => {
      if (burnedSessionIdsRef.current.has(session.id)) return;
      burnedSessionIdsRef.current.add(session.id);
      setTimeout(() => burnedSessionIdsRef.current.delete(session.id), 2000);

      setViewingSessionId(null);
      setFileIndexState({ sessionId: null, index: 0 });

      if (session.type === 'drop' && session.files) {
        session.files.forEach((f) => {
          pendingDestroyedRef.current.delete(f.drop.session_code);
          viewRecordedRef.current.delete(f.drop.session_code);
          if (f.blobUrl) {
            URL.revokeObjectURL(f.blobUrl);
            f.blobUrl = '';
          }
          destroyDrop(f.drop.session_code).catch(() => {});
        });
      } else if (session.type === 'text') {
        hashString(session.id)
          .then((lookup) => destroySecureText(lookup).catch(() => {}))
          .catch(() => {});
      }

      stealth.wipeMemory();
      removeActiveSession(session.id);

      if (reason === 'expired') {
        toast.info('Session expired and was burned from memory.');
      } else if (reason === 'tab-switch') {
        toast.info('Burn-after-reading session burned after switching tabs.');
      } else {
        toast.info('Burn-after-reading session destroyed.');
      }
    },
    [removeActiveSession, setViewingSessionId]
  );

  // Poll for expiry and remote wipe of active drops
  useEffect(() => {
    const dropSessions = activeSessions.filter((s): s is Extract<ActiveSession, { type: 'drop' }> => s.type === 'drop');
    if (dropSessions.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const now = Date.now();
        for (const session of dropSessions) {
          const expiresAt = session.expiresAt || session.files?.[0]?.drop.expires_at;
          if (expiresAt && new Date(expiresAt).getTime() <= now) {
            if (viewingSessionId === session.id) {
              burnViewingSession(session, 'expired');
            } else {
              session.files?.forEach(f => {
                if (f.blobUrl) {
                  URL.revokeObjectURL(f.blobUrl);
                  f.blobUrl = '';
                }
              });
              removeActiveSession(session.id);
              toast.info(`Drop session ${session.id} expired.`);
            }
            continue;
          }

          // Active BAR drops stay open in viewer until user closes, switches tabs, or timer expires
          const isSessionBar = !!session.burnAfterReading || session.files?.some(f => f.drop.burn_after_reading);
          if (isSessionBar) {
            continue;
          }

          const files = session.files;
          if (!files || files.length === 0) continue;

          for (const file of files) {
            if (pendingDestroyedRef.current.has(file.drop.session_code)) {
              continue;
            }

            let isPurged = false;
            if (!file.drop.storage_path && file.drop.session_code === session.id) {
              // Restored from IndexedDB: session_code holds rawCode -> check via lookup hash
              const lookupCode = session.id.length === 6 ? session.id : await hashString(session.id);
              const { data: list } = await getDropsByLookupCode(lookupCode);
              const activeDrops = list?.filter(d => !d.is_destroyed && new Date(d.expires_at) >= new Date()) || [];
              if (activeDrops.length === 0) {
                isPurged = true;
              }
            } else {
              const { data } = await getDropByCode(file.drop.session_code);
              if (!data || data.is_destroyed || new Date(data.expires_at) < new Date()) {
                isPurged = true;
              }
            }

            if (isPurged) {
              // Remote panic wipe or destroy triggered!
              if (viewingSessionId === session.id) {
                setViewingSessionId(null);
              }
              files.forEach(f => {
                if (f.blobUrl) {
                  URL.revokeObjectURL(f.blobUrl);
                  f.blobUrl = '';
                }
              });
              removeActiveSession(session.id);
              toast.error(`Transmission Purged: Session ${session.id} was securely destroyed or panic-wiped.`);
              break;
            }
          }
        }
      } catch {
        // Silent polling failure
      }
    }, 7000);

    return () => clearInterval(pollInterval);
  }, [activeSessions, viewingSessionId, removeActiveSession, setViewingSessionId, burnViewingSession]);

  // Poll for expiry & remote panic destruction of active text sessions
  useEffect(() => {
    const textSessions = activeSessions.filter((s): s is Extract<ActiveSession, { type: 'text' }> => s.type === 'text');
    if (textSessions.length === 0) return;

    const textInterval = setInterval(async () => {
      const now = Date.now();
      for (const session of textSessions) {
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) {
          if (viewingSessionId === session.id) setViewingSessionId(null);
          removeActiveSession(session.id);
          toast.info(`Text session ${session.id} expired.`);
          continue;
        }

        if (session.burnAfterReading) {
          continue;
        }

        try {
          const lookupCode = session.id.length === 6 ? session.id : await hashString(session.id);
          const { data } = await getSecureTextByCode(lookupCode);
          if (!data || data.is_destroyed) {
            if (viewingSessionId === session.id) setViewingSessionId(null);
            removeActiveSession(session.id);
            toast.error(`Transmission Purged: Text session ${session.id} was wiped remotely.`);
          }
        } catch {
          // Blip
        }
      }
    }, 7000);

    return () => clearInterval(textInterval);
  }, [activeSessions, viewingSessionId, removeActiveSession, setViewingSessionId]);

  // Automatically record view / lock server blobs for files when actively viewed
  useEffect(() => {
    if (!viewingSessionId || !viewingDropSession) return;

    const isBar = !!viewingDropSession.burnAfterReading || viewingDropSession.files.some(f => f.drop.burn_after_reading);
    if (isBar) {
      viewingDropSession.files.forEach((f) => {
        if (!pendingDestroyedRef.current.has(f.drop.session_code)) {
          pendingDestroyedRef.current.add(f.drop.session_code);
          viewRecordedRef.current.add(f.drop.session_code);
          destroyDrop(f.drop.session_code).catch(console.error);
        }
      });
      return;
    }

    if (currentDropFile && !viewRecordedRef.current.has(currentDropFile.drop.session_code)) {
      recordView(currentDropFile.drop.session_code, false).catch(console.error);
      viewRecordedRef.current.add(currentDropFile.drop.session_code);
    }
  }, [viewingSessionId, viewingDropSession, currentDropFile]);

  // Exact expiry timer while a session is open in the viewer
  useEffect(() => {
    if (!viewingSession) return;
    const expiresAt =
      viewingSession.expiresAt ||
      (viewingSession.type === 'drop' ? viewingSession.files?.[0]?.drop.expires_at : undefined);
    if (!expiresAt) return;

    const msRemaining = new Date(expiresAt).getTime() - Date.now();
    if (msRemaining <= 0) {
      const immediate = setTimeout(() => burnViewingSession(viewingSession, 'expired'), 0);
      return () => clearTimeout(immediate);
    }

    const timer = setTimeout(() => burnViewingSession(viewingSession, 'expired'), msRemaining);
    return () => clearTimeout(timer);
  }, [viewingSession, burnViewingSession]);

  // Burn-after-reading: stay open while viewer is active, auto-burn on tab switch or tab close
  useEffect(() => {
    if (!viewingSession) return;
    const isBar =
      viewingSession.burnAfterReading ||
      (viewingSession.type === 'drop' && viewingSession.files?.some(f => f.drop.burn_after_reading));
    if (!isBar) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        burnViewingSession(viewingSession, 'tab-switch');
      }
    };

    const handlePageHide = () => {
      if (viewingSession.type === 'drop' && viewingSession.files) {
        viewingSession.files.forEach((f) => {
          if (f.blobUrl) URL.revokeObjectURL(f.blobUrl);
          destroyDrop(f.drop.session_code).catch(() => {});
        });
      }
      stealth.wipeMemory();
      removeActiveSession(viewingSession.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [viewingSession, burnViewingSession, removeActiveSession]);

  const handleCloseDropViewer = useCallback(() => {
    if (
      viewingDropSession &&
      (viewingDropSession.burnAfterReading || viewingDropSession.files?.some(f => f.drop.burn_after_reading))
    ) {
      burnViewingSession(viewingDropSession, 'close');
    } else {
      setViewingSessionId(null);
      setFileIndexState({ sessionId: null, index: 0 });
    }
  }, [viewingDropSession, burnViewingSession, setViewingSessionId]);

  const handleCloseTextViewer = useCallback(() => {
    if (viewingTextSession?.burnAfterReading) {
      burnViewingSession(viewingTextSession, 'close');
    } else {
      setViewingSessionId(null);
    }
  }, [viewingTextSession, burnViewingSession, setViewingSessionId]);

  const handlePillClick = (session: ActiveSession) => {
    if (session.type === 'chat') {
      router.push(`/chat?join=${session.id}`);
      setIsDockOpen(false);
    } else if (session.type === 'sent_drop') {
      router.push('/manage');
      setIsDockOpen(false);
    } else if (session.type === 'sent_text') {
      router.push('/manage');
      setIsDockOpen(false);
    } else {
      setFileIndexState({ sessionId: session.id, index: 0 });
      setViewingSessionId(session.id);
      setIsDockOpen(false);
    }
  };

  return (
    <>
      {/* Universal Active Sessions Drawer & Controls (only when active sessions exist) */}
      {activeSessions.length > 0 && (
        <>
          {/* Click-outside backdrop to dismiss opened panel */}
          <AnimatePresence>
        {isDockOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDockOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Floating Trigger Button (mobile & desktop) - Hidden on chat to prevent overlapping Send button */}
      {!isChat && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
          {!isDockOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => setIsDockOpen(true)}
              className="pointer-events-auto relative w-12 h-12 bg-[var(--phantom-surface)] border border-emerald-500/30 shadow-2xl rounded-full flex items-center justify-center hover:border-emerald-500 transition-colors cursor-pointer"
              title="View active sessions"
            >
              <Activity className="w-5 h-5 text-emerald-400" />
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                {activeSessions.length}
              </div>
            </motion.button>
          )}
        </div>
      )}

      {/* Universal Active Sessions Drawer / Modal */}
      <AnimatePresence>
        {isDockOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bottom-16 sm:bottom-6 inset-x-3 sm:inset-x-auto sm:right-6 w-auto sm:w-96 max-h-[75vh] bg-[var(--wisp-bg)] border border-[var(--wisp-border-strong)] shadow-2xl rounded-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-sm tracking-wide text-[var(--wisp-text)]">Active Sessions</span>
                <span className="text-xs font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {activeSessions.length}
                </span>
              </div>
              <button
                onClick={() => setIsDockOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--wisp-elevated)] transition-colors text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] cursor-pointer"
                title="Close active sessions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-3 flex flex-col gap-2 wisp-scrollbar">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-xl p-2.5 gap-3 hover:border-indigo-400/50 hover:bg-[var(--wisp-elevated)] transition-all cursor-pointer group"
                  onClick={() => handlePillClick(session)}
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--wisp-surface)] flex shrink-0 items-center justify-center border border-[var(--wisp-border)]">
                    {session.type === 'drop' && <Shield className="w-5 h-5 text-indigo-400" />}
                    {session.type === 'sent_drop' && <Shield className="w-5 h-5 text-indigo-400" />}
                    {session.type === 'chat' && <MessageSquare className="w-5 h-5 text-violet-400" />}
                    {session.type === 'text' && <FileText className="w-5 h-5 text-emerald-400" />}
                    {session.type === 'sent_text' && <FileText className="w-5 h-5 text-emerald-400" />}
                  </div>
                  
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--wisp-muted)] truncate">
                        {session.title}
                      </span>
                      {session.type === 'chat' && session.config?.isCreator && (
                        <span className="text-[9px] px-1 bg-indigo-500/20 text-indigo-300 rounded font-mono">Host</span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--wisp-text)] truncate">
                      {session.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePillClick(session);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      {session.type === 'chat' ? 'Open' : 'View'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (session.id === viewingSessionId) setViewingSessionId(null);
                        removeActiveSession(session.id);
                      }}
                      className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-[var(--wisp-muted)] hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Remove session"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 border-t border-[var(--wisp-border)] bg-[var(--wisp-surface)] flex items-center justify-between text-xs">
              <span className="text-[var(--wisp-muted)] text-[11px]">Auto-encrypted in memory</span>
              <button
                onClick={() => {
                  router.push('/manage');
                  setIsDockOpen(false);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer text-xs"
              >
                Go to Session Manager →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}

      {/* Global Viewer Modal */}
      {viewingSessionId && viewingDropSession && currentDropFile && (
        <ViewerErrorBoundary
          key={viewingSessionId}
          onClose={handleCloseDropViewer}
        >
          <FileViewerModal
            onClose={handleCloseDropViewer}
            blobUrl={currentDropFile.blobUrl}
            textContent={currentDropFile.textContent}
            filename={currentDropFile.drop.encrypted_filename || 'Unknown File'}
            dropCode={currentDropFile.drop.session_code}
            viewOnly={!!(viewingDropSession.burnAfterReading || currentDropFile.drop.burn_after_reading)}
            expiresAt={viewingDropSession.expiresAt || currentDropFile.drop.expires_at}
            onExpired={() => burnViewingSession(viewingDropSession, 'expired')}
            currentIndex={activeFileIndex}
            totalFiles={viewingDropSession.files.length}
            onNext={() => {
              const files = viewingDropSession.files;
              const nextIdx = (activeFileIndex + 1) % files.length;
              setFileIndexState({ sessionId: viewingSessionId, index: nextIdx });
              const nextFile = files[nextIdx];
              if (!nextFile.drop.burn_after_reading && !viewRecordedRef.current.has(nextFile.drop.session_code)) {
                recordView(nextFile.drop.session_code, false);
                viewRecordedRef.current.add(nextFile.drop.session_code);
              }
            }}
            onPrev={() => {
              const files = viewingDropSession.files;
              const prevIdx = (activeFileIndex - 1 + files.length) % files.length;
              setFileIndexState({ sessionId: viewingSessionId, index: prevIdx });
              const prevFile = files[prevIdx];
              if (!prevFile.drop.burn_after_reading && !viewRecordedRef.current.has(prevFile.drop.session_code)) {
                recordView(prevFile.drop.session_code, false);
                viewRecordedRef.current.add(prevFile.drop.session_code);
              }
            }}
          />
        </ViewerErrorBoundary>
      )}

      {/* Global Text Session Viewer Modal */}
      {viewingSessionId && viewingTextSession && (
        <ViewerErrorBoundary
          key={`text-${viewingSessionId}`}
          onClose={handleCloseTextViewer}
        >
          <FileViewerModal
            onClose={handleCloseTextViewer}
            blobUrl=""
            textContent={viewingTextSession.text}
            filename={viewingTextSession.title.endsWith('.txt') ? viewingTextSession.title : `${viewingTextSession.title}.txt`}
            dropCode={viewingTextSession.id}
            viewOnly={viewingTextSession.burnAfterReading}
            expiresAt={viewingTextSession.expiresAt}
            onExpired={() => burnViewingSession(viewingTextSession, 'expired')}
            currentIndex={0}
            totalFiles={1}
          />
        </ViewerErrorBoundary>
      )}

      {/* Global In-App QR Code Scanner */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={closeQRScanner}
        onScan={qrScannerCallback || undefined}
      />
    </>
  );
}
