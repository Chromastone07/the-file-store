"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface StealthState {
  isActive: boolean;
  isPanicking: boolean;
}

export function useStealthMode() {
  const [state, setState] = useState<StealthState>({ isActive: false, isPanicking: false });
  const stealthRef = useRef<{ activate: () => void; deactivate: () => void; panic: () => void } | null>(null);

  useEffect(() => {
    // Lazy-load the stealth engine to avoid SSR issues
    import('@/lib/stealth').then(({ stealth }) => {
      stealthRef.current = stealth;
    });
  }, []);

  const toggle = useCallback(() => {
    if (!stealthRef.current) return;
    if (state.isActive) {
      stealthRef.current.deactivate();
      setState({ isActive: false, isPanicking: false });
    } else {
      stealthRef.current.activate();
      setState({ isActive: true, isPanicking: false });
    }
  }, [state.isActive]);

  const triggerPanic = useCallback(() => {
    if (!stealthRef.current) return;
    setState({ isActive: true, isPanicking: true });
    stealthRef.current.panic();
  }, []);

  return {
    isActive: state.isActive,
    isPanicking: state.isPanicking,
    toggle,
    triggerPanic,
  };
}
