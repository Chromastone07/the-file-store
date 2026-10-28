"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalSession, ActiveSession, DecryptedFile } from '@/context/GlobalSessionContext';
import { Shield, X, MessageSquare, FileText, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import FileViewerModal from '../viewers/FileViewerModal';
import QRScannerModal from './QRScannerModal';
import { recordView, destroyDrop, getDropByCode } from '@/lib/supabase';
import { toast } from 'sonner';

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
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // BAR Tracking
  const viewRecordedRef = useRef<Set<string>>(new Set());
  const pendingDestroyedRef = useRef<Set<string>>(new Set());
  const [triggerCleanup, setTriggerCleanup] = useState(0);

  // Poll for destruction of active drops using RPC (bypasses RLS)
  useEffect(() => {
    const dropSessions = activeSessions.filter((s): s is Extract<ActiveSession, { type: 'drop' }> => s.type === 'drop');
    if (dropSessions.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        for (const session of dropSessions) {
          const files = session.files;
          if (!files) continue;

          let changed = false;
          for (const file of files) {
            const { data } = await getDropByCode(file.drop.session_code);
              
            if (data) {
              if (data.is_destroyed || new Date(data.expires_at) < new Date()) {
                if (!pendingDestroyedRef.current.has(file.drop.session_code)) {
                  pendingDestroyedRef.current.add(file.drop.session_code);
                  changed = true;
                }
              }
            }
          }
          if (changed) setTriggerCleanup(t => t + 1);
        }
      } catch {
        // Silent polling failure
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeSessions]);

  // Poll for expiry of active text sessions
  useEffect(() => {
    const textSessions = activeSessions.filter((s): s is Extract<ActiveSession, { type: 'text' }> => s.type === 'text');
    if (textSessions.length === 0) return;

    const textInterval = setInterval(() => {
      const now = Date.now();
      for (const session of textSessions) {
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) {
          removeActiveSession(session.id);
        }
      }
    }, 5000);

    return () => clearInterval(textInterval);
  }, [activeSessions, removeActiveSession]);

  const viewingSession = activeSessions.find(s => s.id === viewingSessionId);
  const viewingDropSession = viewingSession && viewingSession.type === 'drop' ? viewingSession : null;
  const viewingTextSession = viewingSession && viewingSession.type === 'text' ? viewingSession : null;
  const currentDropFile: DecryptedFile | undefined = viewingDropSession?.files[activeFileIndex];

  // Automatically record view for files when they are actively viewed
  useEffect(() => {
    if (viewingSessionId && viewingDropSession && currentDropFile) {
      if (!viewRecordedRef.current.has(currentDropFile.drop.session_code)) {
        if (currentDropFile.drop.burn_after_reading) {
          destroyDrop(currentDropFile.drop.session_code).catch(console.error);
          pendingDestroyedRef.current.add(currentDropFile.drop.session_code);
        } else {
          recordView(currentDropFile.drop.session_code, false).catch(console.error);
        }
        viewRecordedRef.current.add(currentDropFile.drop.session_code);
      }
    }
  }, [viewingSessionId, viewingDropSession, currentDropFile]);

  // Handle BAR Cleanup ONLY when viewer is closed
  useEffect(() => {
    if (pendingDestroyedRef.current.size === 0) return;
    
    if (!viewingSessionId) {
      activeSessions.forEach(session => {
        if (session.type === 'drop' && session.files) {
          const files = session.files;
          let allDestroyed = true;
          files.forEach(f => {
            if (pendingDestroyedRef.current.has(f.drop.session_code)) {
              if (f.blobUrl) {
                URL.revokeObjectURL(f.blobUrl);
                f.blobUrl = ''; // Mark as revoked
              }
            } else {
              allDestroyed = false;
            }
          });
          
          if (allDestroyed) {
            toast.info(`Drop session ${session.id} destroyed.`);
            removeActiveSession(session.id);
          }
        }
      });
    }
  }, [triggerCleanup, viewingSessionId, activeSessions, removeActiveSession]);

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
      setViewingSessionId(session.id);
      setActiveFileIndex(0);
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

      {/* Floating Trigger Button (desktop corner) */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end gap-3 pointer-events-none">
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
        <FileViewerModal
          onClose={() => setViewingSessionId(null)}
          blobUrl={currentDropFile.blobUrl}
          textContent={currentDropFile.textContent}
          filename={currentDropFile.drop.encrypted_filename || 'Unknown File'}
          dropCode={currentDropFile.drop.session_code}
          viewOnly={currentDropFile.drop.burn_after_reading}
          currentIndex={activeFileIndex}
          totalFiles={viewingDropSession.files.length}
          onNext={() => {
            const files = viewingDropSession.files;
            const nextIdx = (activeFileIndex + 1) % files.length;
            setActiveFileIndex(nextIdx);
            const nextFile = files[nextIdx];
            if (!viewRecordedRef.current.has(nextFile.drop.session_code)) {
              recordView(nextFile.drop.session_code, nextFile.drop.burn_after_reading);
              viewRecordedRef.current.add(nextFile.drop.session_code);
            }
          }}
          onPrev={() => {
            const files = viewingDropSession.files;
            const prevIdx = (activeFileIndex - 1 + files.length) % files.length;
            setActiveFileIndex(prevIdx);
            const prevFile = files[prevIdx];
            if (!viewRecordedRef.current.has(prevFile.drop.session_code)) {
              recordView(prevFile.drop.session_code, prevFile.drop.burn_after_reading);
              viewRecordedRef.current.add(prevFile.drop.session_code);
            }
          }}
          onMediaEnded={() => {
            if (currentDropFile.drop.burn_after_reading) {
              setViewingSessionId(null);
            }
          }}
        />
      )}

      {/* Global Text Session Viewer Modal */}
      {viewingSessionId && viewingTextSession && (
        <FileViewerModal
          onClose={() => {
            if (viewingTextSession.burnAfterReading) {
              removeActiveSession(viewingTextSession.id);
            }
            setViewingSessionId(null);
          }}
          blobUrl=""
          textContent={viewingTextSession.text}
          filename={viewingTextSession.title.endsWith('.txt') ? viewingTextSession.title : `${viewingTextSession.title}.txt`}
          dropCode={viewingTextSession.id}
          viewOnly={viewingTextSession.burnAfterReading}
          currentIndex={0}
          totalFiles={1}
        />
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
