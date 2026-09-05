"use client";

import React, { useState, useRef, useEffect } from 'react';

interface AccessCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
}

export default function AccessCodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
}: AccessCodeInputProps) {
  const [activeBox, setActiveBox] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newValue = value.slice(0, index) + value.slice(index + 1);
      onChange(newValue);
      
      if (index > 0) {
        setActiveBox(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveBox(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      setActiveBox(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const char = e.target.value.toUpperCase().slice(-1);
    if (!char) return;

    const newValue = value.split('');
    newValue[index] = char;
    const finalValue = newValue.join('').slice(0, length);
    onChange(finalValue);

    if (index < length - 1) {
      setActiveBox(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    if (!pastedData) return;
    
    onChange(pastedData);
    const nextIndex = Math.min(pastedData.length, length - 1);
    setActiveBox(nextIndex);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          value={value[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          onFocus={() => setActiveBox(index)}
          disabled={disabled}
          className={`w-12 h-14 bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-[0.75rem] flex items-center justify-center text-center text-xl font-bold font-mono text-[var(--phantom-text)] transition-all outline-none disabled:opacity-50
          ${activeBox === index ? 'ring-2 ring-[var(--phantom-glow)] border-transparent' : 'focus:ring-2 focus:ring-[var(--phantom-glow)]'}`}
        />
      ))}
    </div>
  );
}
