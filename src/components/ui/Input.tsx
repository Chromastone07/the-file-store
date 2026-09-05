"use client";

import React from 'react';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  error?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function Input({
  value,
  onChange,
  placeholder = '',
  type = 'text',
  icon,
  error,
  className = '',
  disabled = false,
  autoFocus = false,
  maxLength,
  onKeyDown,
}: InputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-[var(--phantom-muted)] pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onKeyDown={onKeyDown}
          className={`w-full bg-[var(--phantom-elevated)] text-[var(--phantom-text)] border border-[var(--phantom-border)] rounded-[0.75rem] py-3 pr-4 transition-all duration-200 outline-none focus:ring-2 focus:ring-[var(--phantom-glow)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
            icon ? 'pl-10' : 'pl-4'
          } ${error ? 'border-[var(--phantom-danger)] focus:ring-[var(--phantom-danger)]' : ''}`}
        />
      </div>
      {error && <span className="text-sm text-[var(--phantom-danger)] pl-1">{error}</span>}
    </div>
  );
}
