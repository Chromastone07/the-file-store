"use client";

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  type = 'button',
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[0.75rem] transition-all duration-300 ease-out active:scale-97 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';
  
  const variantClasses = {
    primary: 'bg-[var(--phantom-glow)] text-white hover:shadow-[0_0_15px_var(--phantom-glow)] hover:brightness-110',
    secondary: 'border border-[var(--phantom-border)] bg-transparent text-[var(--phantom-accent)] hover:border-[var(--phantom-accent)] hover:shadow-[0_0_10px_var(--phantom-accent)]',
    danger: 'bg-[var(--phantom-danger)] text-white hover:brightness-110 hover:shadow-[0_0_15px_var(--phantom-danger)]',
    ghost: 'bg-transparent text-[var(--phantom-text)] hover:bg-[var(--phantom-surface)]',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && (
        <span className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {!loading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
