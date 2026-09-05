"use client";

import React from 'react';

interface SecurityBadgeProps {
  type: 'encrypted' | 'zero-knowledge' | 'burn' | 'stealth' | 'password';
  size?: 'sm' | 'md';
}

export default function SecurityBadge({ type, size = 'sm' }: SecurityBadgeProps) {
  const configs = {
    encrypted: {
      icon: '🔒',
      label: 'E2E Encrypted',
      classes: 'bg-[rgba(52,211,153,0.15)] text-[var(--phantom-success)] border border-[rgba(52,211,153,0.3)]',
    },
    'zero-knowledge': {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline-block">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
          <line x1="2" y1="2" x2="22" y2="22"></line>
        </svg>
      ),
      label: 'Zero Knowledge',
      classes: 'bg-[rgba(99,102,241,0.15)] text-[var(--phantom-accent)] border border-[rgba(99,102,241,0.3)]',
    },
    burn: {
      icon: '🔥',
      label: 'Burn After Reading',
      classes: 'bg-[rgba(248,113,113,0.15)] text-[var(--phantom-danger)] border border-[rgba(248,113,113,0.3)]',
    },
    stealth: {
      icon: '🛡️',
      label: 'Lab Safe',
      classes: 'bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)]',
    },
    password: {
      icon: '🔑',
      label: 'Password Protected',
      classes: 'bg-[rgba(251,191,36,0.15)] text-[var(--phantom-warning)] border border-[rgba(251,191,36,0.3)]',
    },
  };

  const config = configs[type];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <div className={`inline-flex items-center rounded-full font-bold transition-all duration-300 ${sizeClasses[size]} ${config.classes}`}>
      {typeof config.icon === 'string' ? (
        <span className="mr-1.5 leading-none">{config.icon}</span>
      ) : (
        config.icon
      )}
      <span>{config.label}</span>
    </div>
  );
}
