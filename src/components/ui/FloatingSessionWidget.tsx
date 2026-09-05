"use client";

import { useGlobalSession } from '@/context/GlobalSessionContext';
import { useSenderHistory } from '@/hooks/useSenderHistory';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Shield, FileText, MessageSquare, ExternalLink } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function FloatingSessionWidget() {
  const { dropPhase, textPhase, clipboardConfig, clipboardConnected } = useGlobalSession();
  const { history } = useSenderHistory();
  const pathname = usePathname();

  // Find latest active sessions from persistent history
  const activeSessions = history
    .filter(h => !h.isDestroyed && new Date(h.expiresAt).getTime() > Date.now())
    .slice(0, 3);
  
  const hasActiveDrop = ['encrypting', 'uploading', 'finalizing'].includes(dropPhase);
  const hasActiveText = ['encrypting', 'uploading', 'finalizing'].includes(textPhase);
  const hasActiveClipboard = !!clipboardConfig;

  // Don't show widget if we are ON the related page
  const showDrop = hasActiveDrop && pathname !== '/drop';
  const showText = hasActiveText && pathname !== '/text';
  const showClipboard = hasActiveClipboard && pathname !== '/clipboard';

  if (!showDrop && !showText && !showClipboard && activeSessions.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      <AnimatePresence>
        {showClipboard && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="group relative cursor-pointer"
          >
            <Link href="/clipboard">
              <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-xl backdrop-blur-md rounded-full px-4 py-3 flex items-center gap-3">
                <div className="relative">
                  <MessageSquare className="w-5 h-5 text-[var(--phantom-text)]" />
                  {clipboardConnected && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--phantom-success)] rounded-full border border-[var(--phantom-surface)]"></span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--phantom-text)]">Active Chat</span>
                  <span className="text-[10px] text-[var(--phantom-muted)]">Code: {clipboardConfig.sessionCode}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--phantom-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>
        )}

        {activeSessions.map((session, index) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="group relative cursor-pointer"
          >
            <Link href={session.type === 'drop' ? `/d/${session.rawCode}` : `/t/${session.rawCode}`}>
              <div className="bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-xl backdrop-blur-md rounded-full px-4 py-3 flex items-center gap-3">
                {session.type === 'drop' ? (
                  <Shield className="w-5 h-5 text-[var(--phantom-glow)]" />
                ) : (
                  <FileText className="w-5 h-5 text-[var(--phantom-accent)]" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--phantom-text)]">
                    {session.type === 'drop' ? 'File Drop' : 'Secure Text'}
                  </span>
                  <span className="text-[10px] text-[var(--phantom-muted)] font-mono">
                    Code: {session.rawCode}
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--phantom-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
