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

  const isUrgent = !timeLeft.expired && timeLeft.totalSeconds <= 30;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-colors w-full max-w-xs mx-auto ${
        timeLeft.expired 
          ? 'bg-[var(--phantom-danger)]/10 border-[var(--phantom-danger)]/50 text-[var(--phantom-danger)]'
          : isUrgent
            ? 'bg-[var(--phantom-warning)]/10 border-[var(--phantom-warning)]/50 text-[var(--phantom-warning)]'
            : 'bg-[var(--phantom-elevated)] border-[var(--phantom-border)] text-[var(--phantom-text)]'
      }`}
    >
      <div className="text-xs uppercase tracking-wider font-semibold opacity-80 mb-1">
        {timeLeft.expired ? 'Expired' : 'Self-Destruct In'}
      </div>
      
      <div className="flex items-center gap-2">
        {isUrgent && (
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
            <AlertCircle className="w-5 h-5" />
          </motion.div>
        )}
        <div className={`text-3xl font-mono font-bold tracking-tight ${isUrgent ? 'animate-pulse' : ''}`}>
          {timeLeft.expired ? '00:00' : timeLeft.label}
        </div>
      </div>
    </motion.div>
  );
}
