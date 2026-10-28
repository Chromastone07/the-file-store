"use client";

import React, { useEffect, useState } from 'react';
import { getTimeRemaining } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: string;
  size?: 'sm' | 'md' | 'lg';
  onExpired?: () => void;
}

export default function CountdownTimer({ expiresAt, size = 'md', onExpired }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getTimeRemaining(expiresAt);
      setTimeLeft(remaining);
      if (remaining.expired) {
        clearInterval(timer);
        if (onExpired) onExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const isUrgent = !timeLeft.expired && timeLeft.totalSeconds <= 60;

  const sizeStyles = {
    sm: { container: 'p-2 max-w-[200px]', label: 'text-[10px]', timer: 'text-xl', icon: 'w-4 h-4' },
    md: { container: 'p-4 max-w-xs', label: 'text-xs', timer: 'text-3xl', icon: 'w-5 h-5' },
    lg: { container: 'p-6 max-w-sm', label: 'text-sm', timer: 'text-4xl', icon: 'w-6 h-6' },
  }[size];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center rounded-xl border transition-colors w-full mx-auto ${sizeStyles.container} ${
        timeLeft.expired 
          ? 'bg-[var(--wisp-danger)]/10 border-[var(--wisp-danger)]/50 text-[var(--wisp-danger)]'
          : isUrgent
            ? 'bg-[var(--wisp-danger)]/10 border-[var(--wisp-danger)]/50 text-[var(--wisp-danger)]'
            : 'bg-[var(--wisp-surface-glass)] border-[var(--wisp-border)] text-[var(--wisp-text)]'
      }`}
    >
      <div className={`${sizeStyles.label} uppercase tracking-wider font-semibold mb-1 text-[var(--wisp-muted)]`}>
        {timeLeft.expired ? 'Expired' : 'Self-Destruct In'}
      </div>
      
      <div className="flex items-center gap-2">
        {isUrgent && (
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
            <AlertCircle className={sizeStyles.icon} />
          </motion.div>
        )}
        <div className={`${sizeStyles.timer} font-mono font-bold tracking-tight text-[var(--wisp-text)] ${isUrgent ? 'animate-pulse' : ''}`}>
          {timeLeft.expired ? '00:00' : timeLeft.label}
        </div>
      </div>
    </motion.div>
  );
}
