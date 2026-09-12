"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalSession } from '@/context/GlobalSessionContext';
import { Shield, X, MessageSquare, FileText, Maximize2, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import FileViewerModal from '../viewers/FileViewerModal';
import { supabase, recordView, destroyDrop } from '@/lib/supabase';
import { toast } from 'sonner';

export default function SessionDock() {
  const { activeSessions, removeActiveSession, viewingSessionId, setViewingSessionId } = useGlobalSession();
  const router = useRouter();
  
  // Multi-file state for the active drop
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  
  // Collapse state for multiple sessions
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse when multiple sessions are detected
  useEffect(() => {
    if (activeSessions.length <= 1) setIsExpanded(true);
  }, [activeSessions.length]);

  // BAR Tracking
  const viewRecordedRef = useRef<Set<string>>(new Set());
  const pendingDestroyedRef = useRef<Set<string>>(new Set());
  const [triggerCleanup, setTriggerCleanup] = useState(0);

  // Poll for destruction of active drops
  useEffect(() => {
    const dropSessions = activeSessions.filter(s => s.type === 'drop');
    if (dropSessions.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        for (const session of dropSessions) {
          if (session.type !== 'drop') continue;
          if (!('files' in session)) continue;
          const files = (session as any).files;
          if (!files) continue;

          let changed = false;
          for (const file of files) {
            const { data } = await supabase
              .from('drops')
              .select('is_destroyed, expires_at')
              .eq('session_code', file.drop.session_code)
              .single();
              
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
      } catch (e) {}
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeSessions]);

  const viewingSession = activeSessions.find(s => s.id === viewingSessionId);

  // Automatically record view for files when they are actively viewed
  useEffect(() => {
    if (viewingSessionId && viewingSession && viewingSession.type === 'drop') {
      const files = (viewingSession as any).files;
      const currentFile = files[activeFileIndex];
      if (currentFile) {
        if (!viewRecordedRef.current.has(currentFile.drop.session_code)) {
          if (currentFile.drop.burn_after_reading) {
            destroyDrop(currentFile.drop.session_code).catch(console.error);
            pendingDestroyedRef.current.add(currentFile.drop.session_code);
          } else {
            recordView(currentFile.drop.session_code, false).catch(console.error);
          }
          viewRecordedRef.current.add(currentFile.drop.session_code);
        }
      }
    }
  }, [viewingSessionId, viewingSession, activeFileIndex]);

  // Handle BAR Cleanup ONLY when viewer is closed
  useEffect(() => {
    if (pendingDestroyedRef.current.size === 0) return;
    
    if (!viewingSessionId) {
      activeSessions.forEach(session => {
        if (session.type === 'drop' && (session as any).files) {
          const files = (session as any).files;
          let allDestroyed = true;
          files.forEach((f: any) => {
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

  if (activeSessions.length === 0) return null;

  const handlePillClick = (session: any) => {
    if (session.type === 'chat') {
      router.push(`/chat?join=${session.id}`);
    } else {
      setViewingSessionId(session.id);
      setActiveFileIndex(0);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {(isExpanded || activeSessions.length === 1) && activeSessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="pointer-events-auto flex items-center bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-2xl rounded-full pl-2 pr-1 py-1 gap-3 backdrop-blur-md hover:border-[var(--phantom-glow)]/50 transition-colors cursor-pointer group"
              onClick={() => handlePillClick(session)}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--phantom-elevated)] flex items-center justify-center">
                {session.type === 'drop' && <Shield className="w-4 h-4 text-[var(--phantom-glow)]" />}
                {session.type === 'chat' && <MessageSquare className="w-4 h-4 text-[var(--phantom-accent)]" />}
                {session.type === 'text' && <FileText className="w-4 h-4 text-[var(--phantom-success)]" />}
              </div>
              
              <div className="flex flex-col pr-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--phantom-muted)]">
                  {session.title}
                </span>
                <span className="text-sm font-mono text-[var(--phantom-text)]">
                  {session.id}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePillClick(session);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-[var(--phantom-elevated)] flex items-center justify-center text-[var(--phantom-text)]"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (session.id === viewingSessionId) setViewingSessionId(null);
                    removeActiveSession(session.id);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-[var(--phantom-danger)] hover:text-white flex items-center justify-center text-[var(--phantom-muted)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {activeSessions.length > 1 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="pointer-events-auto flex items-center bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-2xl rounded-full px-4 py-2 gap-3 backdrop-blur-md hover:border-[var(--phantom-glow)] transition-colors"
          >
            <span className="font-bold text-sm text-[var(--phantom-text)]">
              {isExpanded ? "Collapse" : `${activeSessions.length} Active Sessions`}
            </span>
            <div className={`w-6 h-6 rounded-full bg-[var(--phantom-elevated)] flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronUp className="w-4 h-4 text-[var(--phantom-text)]" />
            </div>
          </motion.button>
        )}
      </div>

      {/* Global Viewer Modal */}
      {viewingSessionId && viewingSession && viewingSession.type === 'drop' && (
        <FileViewerModal
          onClose={() => setViewingSessionId(null)}
          blobUrl={(viewingSession as any).files[activeFileIndex]?.blobUrl}
          textContent={(viewingSession as any).files[activeFileIndex]?.textContent}
          filename={(viewingSession as any).files[activeFileIndex]?.drop.encrypted_filename || 'Unknown File'}
          viewOnly={(viewingSession as any).files[activeFileIndex]?.drop.burn_after_reading}
          currentIndex={activeFileIndex}
          totalFiles={(viewingSession as any).files.length}
          onNext={() => {
            const files = (viewingSession as any).files;
            const nextIdx = (activeFileIndex + 1) % files.length;
            setActiveFileIndex(nextIdx);
            const nextFile = files[nextIdx];
            if (!viewRecordedRef.current.has(nextFile.drop.session_code)) {
              recordView(nextFile.drop.session_code, nextFile.drop.burn_after_reading);
              viewRecordedRef.current.add(nextFile.drop.session_code);
            }
          }}
          onPrev={() => {
            const files = (viewingSession as any).files;
            const prevIdx = (activeFileIndex - 1 + files.length) % files.length;
            setActiveFileIndex(prevIdx);
            const prevFile = files[prevIdx];
            if (!viewRecordedRef.current.has(prevFile.drop.session_code)) {
              recordView(prevFile.drop.session_code, prevFile.drop.burn_after_reading);
              viewRecordedRef.current.add(prevFile.drop.session_code);
            }
          }}
          onMediaEnded={() => {
            if ((viewingSession as any).files[activeFileIndex]?.drop.burn_after_reading) {
              setViewingSessionId(null);
            }
          }}
        />
      )}
    </>
  );
}
