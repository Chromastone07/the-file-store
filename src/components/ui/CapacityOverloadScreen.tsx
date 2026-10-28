"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ServerCrash, RefreshCw, Activity, ArrowLeft, ShieldAlert } from "lucide-react";
import SpotlightCard from "@/components/ui/SpotlightCard";

interface CapacityOverloadScreenProps {
  onRetry?: () => void;
  onReset?: () => void;
  errorMessage?: string | null;
  mode?: "drop" | "text" | "chat";
}

export default function CapacityOverloadScreen({
  onRetry,
  onReset,
  errorMessage,
  mode = "drop",
}: CapacityOverloadScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"checking" | "healthy" | "overloaded" | null>(null);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);

  const handleRetryAction = useCallback(async () => {
    setIsAutoRetrying(true);
    if (onRetry) {
      try {
        await onRetry();
      } finally {
        setIsAutoRetrying(false);
        setSecondsLeft(15);
      }
    }
  }, [onRetry]);

  // Auto-countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      handleRetryAction();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, handleRetryAction]);

  const checkLiveHealth = async () => {
    setHealthStatus("checking");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok && data.healthy) {
        setHealthStatus("healthy");
        setHealthLatency(data.latencyMs);
      } else {
        setHealthStatus("overloaded");
        setHealthLatency(data.latencyMs || null);
      }
    } catch {
      setHealthStatus("overloaded");
    }
  };

  const actionSubject = mode === "drop" ? "file drop" : mode === "text" ? "secure text" : "session";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-xl mx-auto"
    >
      <SpotlightCard className="p-6 sm:p-8 rounded-2xl border border-amber-500/30 bg-[var(--wisp-surface)]/90 backdrop-blur-xl shadow-[0_0_45px_rgba(245,158,11,0.12)] text-center">
        {/* Amber Protocol Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-400 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          <span className="tracking-wider uppercase font-semibold">
            Vault Capacity Limit // Queue Saturated
          </span>
        </div>

        {/* Animated Server Warning Graphic */}
        <div className="relative mb-5 flex justify-center">
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-amber-500/20 via-amber-950/20 to-black/40 border border-amber-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <ServerCrash className="w-10 h-10 text-amber-400 animate-pulse" />
          </div>
        </div>

        {/* Headline in Outfit */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2.5">
          Vaults Temporarily at Peak Capacity
        </h2>

        {/* Clear Explanation */}
        <p className="text-xs sm:text-sm text-[var(--wisp-muted)] leading-relaxed max-w-md mx-auto mb-5">
          Due to an exceptional surge in traffic, our encrypted database connections and storage buffers are currently saturated. 
          To protect your privacy and ensure your {actionSubject} is not corrupted or lost, new uploads are temporarily queued.
        </p>

        {/* Countdown Shimmer Box */}
        <div className="bg-[var(--wisp-surface-glass)] border border-amber-500/20 rounded-xl p-3.5 mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[var(--wisp-muted)] font-mono">
            <span>Auto-probing vault capacity...</span>
            <span className="text-amber-400 font-bold font-mono">
              {secondsLeft > 0 ? `${secondsLeft}s` : "Testing now..."}
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
              initial={{ width: "100%" }}
              animate={{ width: `${(secondsLeft / 15) * 100}%` }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          </div>
        </div>

        {/* Live Diagnostics Pill */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={checkLiveHealth}
            disabled={healthStatus === "checking"}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-[11px] font-mono text-[var(--wisp-muted)] hover:text-amber-300 hover:border-amber-500/40 transition-colors cursor-pointer"
          >
            <Activity className={`w-3.5 h-3.5 ${healthStatus === "checking" ? "animate-spin text-amber-400" : ""}`} />
            <span>
              {healthStatus === "checking"
                ? "Pinging nodes..."
                : healthStatus === "healthy"
                ? `Node online (${healthLatency}ms) - Ready!`
                : healthStatus === "overloaded"
                ? `Node congested (${healthLatency || "timeout"}ms)`
                : "Check Live Vault Status"}
            </span>
          </button>
        </div>

        {/* Error Detail (if provided) */}
        {errorMessage && (
          <div className="mb-5 p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-[var(--wisp-muted)]/70 truncate max-w-sm mx-auto">
            Code: {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex-1 px-4 py-2.5 rounded-xl font-semibold border border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] text-[var(--wisp-text)] text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRetryAction}
            disabled={isAutoRetrying}
            className="flex-1 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.35)] border border-amber-400/30 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRetrying ? "animate-spin" : ""}`} />
            <span>{isAutoRetrying ? "Checking Capacity..." : "Retry Now"}</span>
          </button>
        </div>

        {/* Security Assurance */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[var(--wisp-muted)]/60">
          <ShieldAlert className="w-3 h-3 text-amber-400/80" />
          <span>No unencrypted data left your browser. Your local payload is intact.</span>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
