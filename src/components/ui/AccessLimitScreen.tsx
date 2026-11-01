"use client";

import { motion } from "framer-motion";
import { Users, ShieldAlert, ArrowLeft, RefreshCw, PlusCircle, Home, Flame } from "lucide-react";
import SpotlightCard from "@/components/ui/SpotlightCard";
import Link from "next/link";

export type AccessLimitType = 
  | 'room_full' 
  | 'room_not_found' 
  | 'recipient_limit' 
  | 'panic_wiped'
  | 'burned';

interface AccessLimitScreenProps {
  type: AccessLimitType;
  code?: string;
  limitNumber?: number;
  onRetry?: () => void;
  onReset?: () => void;
}

export default function AccessLimitScreen({
  type,
  code,
  limitNumber,
  onRetry,
  onReset
}: AccessLimitScreenProps) {
  
  const getContent = () => {
    switch (type) {
      case 'room_full':
        return {
          badge: 'ACCESS DENIED // ROOM FULL',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <Users className="w-9 h-9 text-amber-400" />,
          glowColor: 'shadow-[0_0_35px_rgba(245,158,11,0.2)]',
          title: 'Chat Session at Maximum Capacity',
          description: `The host restricted this chat room to a strict limit of ${limitNumber || 2} participant${(limitNumber || 2) > 1 ? 's' : ''}. All participant slots are currently filled.`,
          subNotice: 'Phantom strictly enforces cryptographic member caps. Existing participants cannot be evicted or replaced by incoming connections.',
          primaryActionText: 'Try Another Code',
          showCreateRoom: true,
        };
      case 'room_not_found':
        return {
          badge: 'INVALID SESSION // NOT FOUND',
          badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          icon: <ShieldAlert className="w-9 h-9 text-rose-400" />,
          glowColor: 'shadow-[0_0_35px_rgba(244,63,94,0.2)]',
          title: 'Chat Room Does Not Exist',
          description: code 
            ? `No active chat session was found with code "${code}". This code may belong to a file drop, a text drop, or may have already expired.`
            : 'No active chat session was found with the provided code. Ghost rooms are disabled.',
          subNotice: 'Chat rooms must be explicitly initiated by a creator before participants can connect.',
          primaryActionText: 'Enter Different Code',
          showCreateRoom: true,
        };
      case 'recipient_limit':
        return {
          badge: 'ACCESS CONTROL // USER LIMIT REACHED',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <Users className="w-9 h-9 text-amber-400" />,
          glowColor: 'shadow-[0_0_35px_rgba(245,158,11,0.2)]',
          title: 'User Access Limit Reached',
          description: `The sender restricted this transmission to a maximum of ${limitNumber || 2} recipient${(limitNumber || 2) > 1 ? 's' : ''}. All access slots have already been claimed. You cannot access this file.`,
          subNotice: 'Existing authorized recipients retain uninterrupted access. The file remains active for admitted users until their countdown timer expires or remote panic wipe is triggered.',
          primaryActionText: 'Return to Home',
          showCreateRoom: false,
        };
      case 'panic_wiped':
        return {
          badge: 'EMERGENCY PROTOCOL // REMOTE PANIC WIPE',
          badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          icon: <ShieldAlert className="w-9 h-9 text-rose-400" />,
          glowColor: 'shadow-[0_0_35px_rgba(244,63,94,0.3)]',
          title: 'Transmission Terminated Remotely',
          description: 'The sender executed a Remote Panic Wipe. All encrypted blobs, decryption keys, and active memory references have been permanently eradicated across all devices.',
          subNotice: 'Zero traces remain on the server, local storage, or connected client memories.',
          primaryActionText: 'Return to Home',
          showCreateRoom: false,
        };
      case 'burned':
      default:
        return {
          badge: 'EPHEMERAL PURGE // BURNED ON VIEW',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <Flame className="w-9 h-9 text-amber-400" />,
          glowColor: 'shadow-[0_0_35px_rgba(245,158,11,0.2)]',
          title: 'Transmission Self-Destructed',
          description: 'This transmission was configured for Burn-After-Reading. As soon as the recipient accessed it, the server and storage blobs were wiped.',
          subNotice: 'No persistent copies or access history are stored on the server.',
          primaryActionText: 'Return to Home',
          showCreateRoom: false,
        };
    }
  };

  const content = getContent();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      <SpotlightCard className="p-6 sm:p-8 rounded-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)]/95 backdrop-blur-xl shadow-2xl text-center">
        
        {/* Security protocol pill */}
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono mb-5 ${content.badgeColor}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
          <span className="tracking-wider uppercase font-semibold">
            {content.badge}
          </span>
        </div>

        {/* Warning Icon Graphic */}
        <div className="relative mb-5 flex justify-center">
          <div className={`w-20 h-20 rounded-2xl bg-[var(--wisp-elevated)] border border-[var(--wisp-border-strong)] flex items-center justify-center ${content.glowColor}`}>
            {content.icon}
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--wisp-text)] mb-3 leading-snug">
          {content.title}
        </h2>

        {/* Description */}
        <p className="text-sm text-[var(--wisp-muted)] leading-relaxed mb-4 max-w-md mx-auto">
          {content.description}
        </p>

        {/* Security Sub-Notice Banner */}
        <div className="p-3 rounded-xl bg-[var(--wisp-elevated)]/60 border border-[var(--wisp-border)] text-xs text-[var(--wisp-muted)] leading-relaxed mb-6 text-left flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>{content.subNotice}</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
          {onRetry ? (
            <button
              onClick={onRetry}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{content.primaryActionText}</span>
            </button>
          ) : (
            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{content.primaryActionText}</span>
            </Link>
          )}

          {content.showCreateRoom && (
            <button
              onClick={onReset || (() => window.location.href = '/chat?new=1')}
              className="w-full sm:w-auto px-4 py-2.5 bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl border border-[var(--wisp-border)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create New Room</span>
            </button>
          )}
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

