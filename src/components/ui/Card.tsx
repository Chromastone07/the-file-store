"use client";

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', hover = false, onClick }: CardProps) {
  const hoverClasses = hover
    ? 'hover:border-[var(--phantom-glow)] hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] cursor-pointer transition-all duration-300'
    : '';

  return (
    <div
      onClick={onClick}
      className={`bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-[1.25rem] p-6 ${hoverClasses} ${className}`}
    >
      {children}
    </div>
  );
}
