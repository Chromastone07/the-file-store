"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: { label: string; value: string | number }[];
  className?: string;
}

export default function CustomSelect({ value, onChange, options, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] rounded-lg px-4 py-2.5 text-[var(--phantom-text)] focus:outline-none focus:border-[var(--phantom-glow)] transition-colors hover:bg-[var(--phantom-border)]/50"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`w-4 h-4 text-[var(--phantom-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-lg shadow-2xl overflow-hidden backdrop-blur-md"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    option.value === value 
                      ? "bg-[var(--phantom-glow)]/10 text-[var(--phantom-glow)] font-medium" 
                      : "text-[var(--phantom-text)] hover:bg-[var(--phantom-elevated)] hover:text-[var(--phantom-glow)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
