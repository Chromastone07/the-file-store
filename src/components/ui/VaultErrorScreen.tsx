"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import SpotlightCard from "@/components/ui/SpotlightCard";
import {
  KeyRound,
  SearchX,
  Flame,
  Clock,
  WifiOff,
  Ghost,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  UploadCloud,
  FileText,
  MessageSquare,
} from "lucide-react";

export type VaultErrorVariant =
  | "wrong_password"
  | "not_found"
  | "invalid_code"
  | "destroyed"
  | "expired"
  | "network_error"
  | "route_404"
  | "unexpected_error";

export type VaultResourceType = "drop" | "text" | "session" | "page";

interface VaultErrorScreenProps {
  variant: VaultErrorVariant;
  resourceType?: VaultResourceType;
  code?: string;
  attempts?: number;
  errorDetail?: string;
  onRetryPassword?: () => void;
  onRetry?: () => void;
}

export default function VaultErrorScreen({
  variant,
  resourceType = "session",
  code,
  attempts = 1,
  errorDetail,
  onRetryPassword,
  onRetry,
}: VaultErrorScreenProps) {
  const resourceLabel =
    resourceType === "drop"
      ? "file drop"
      : resourceType === "text"
        ? "secure text"
        : "transmission";

  const secondaryCreateHref = resourceType === "text" ? "/text" : "/drop";
  const secondaryCreateLabel =
    resourceType === "text" ? "Share New Text" : "Drop New File";

  const config = (() => {
    switch (variant) {
      case "wrong_password":
        return {
          badge: "AUTHENTICATION FAILED // INCORRECT PASSWORD",
          badgeStyle: "text-rose-500 bg-rose-500/10 border-rose-500/25",
          iconWellStyle:
            "border-rose-500/30 shadow-[0_0_32px_rgba(244,63,94,0.2)]",
          icon: <KeyRound className="w-8 h-8 text-rose-500" />,
          title: "Incorrect Password",
          description: `The passphrase you entered could not decrypt this ${resourceLabel}. Check Caps Lock or spelling and try again.`,
          notice:
            "Zero-knowledge check: Phantom derives keys locally using PBKDF2-SHA256. Passwords are never transmitted to or stored on the server.",
        };

      case "not_found":
        return {
          badge: "LOOKUP FAILED // DOES NOT EXIST",
          badgeStyle: "text-indigo-500 bg-indigo-500/10 border-indigo-500/25",
          iconWellStyle:
            "border-indigo-500/30 shadow-[0_0_32px_rgba(99,102,241,0.2)]",
          icon: <SearchX className="w-8 h-8 text-indigo-500" />,
          title:
            resourceType === "drop"
              ? "File Drop Not Found"
              : resourceType === "text"
                ? "Secure Text Not Found"
                : "Session Does Not Exist",
          description:
            code && code.toUpperCase() !== "ACCESSED"
              ? `No active ${resourceLabel} exists for code "${code.toUpperCase()}". It may be mistyped, never created, or already purged after expiry.`
              : `No active ${resourceLabel} exists at this link. It may have been mistyped, scrubbed from the URL bar after viewing, or permanently purged.`,
          notice:
            "Phantom keeps zero directory listings and zero backups. Once a session is purged or if a code never existed, nothing can be queried or restored.",
        };

      case "invalid_code":
        return {
          badge: "INVALID ACCESS CODE // FORMAT ERROR",
          badgeStyle: "text-amber-500 bg-amber-500/10 border-amber-500/25",
          iconWellStyle:
            "border-amber-500/30 shadow-[0_0_32px_rgba(245,158,11,0.2)]",
          icon: <ShieldAlert className="w-8 h-8 text-amber-500" />,
          title: "Invalid Session Code",
          description:
            "This link does not contain a valid Phantom access code. Session codes must be 8 alphanumeric characters (or 6 characters for legacy links).",
          notice:
            "Double-check the full share link or enter the 8-character access code manually on the home page.",
        };

      case "destroyed":
        return {
          badge: "EPHEMERAL PURGE // DESTROYED",
          badgeStyle: "text-rose-500 bg-rose-500/10 border-rose-500/25",
          iconWellStyle:
            "border-rose-500/30 shadow-[0_0_32px_rgba(244,63,94,0.2)]",
          icon: <Flame className="w-8 h-8 text-rose-500" />,
          title: "Already Burned or Destroyed",
          description: `This ${resourceLabel} is no longer available. It was either set to Burn After Reading or manually destroyed by the sender.`,
          notice:
            "Encrypted payloads and database access keys are permanently wiped once burned.",
        };

      case "expired":
        return {
          badge: "TTL EXPIRED // WINDOW CLOSED",
          badgeStyle: "text-amber-500 bg-amber-500/10 border-amber-500/25",
          iconWellStyle:
            "border-amber-500/30 shadow-[0_0_32px_rgba(245,158,11,0.2)]",
          icon: <Clock className="w-8 h-8 text-amber-500" />,
          title: "This Session Has Expired",
          description: `The sender's self-destruct timer ran out before or during access. Nothing for this ${resourceLabel} remains stored.`,
          notice:
            "Ask the sender to upload a new session if you still need access.",
        };

      case "network_error":
        return {
          badge: "CONNECTION INTERRUPTED // NETWORK ERROR",
          badgeStyle: "text-amber-500 bg-amber-500/10 border-amber-500/25",
          iconWellStyle:
            "border-amber-500/30 shadow-[0_0_32px_rgba(245,158,11,0.2)]",
          icon: <WifiOff className="w-8 h-8 text-amber-500" />,
          title: "Couldn't Reach the Vault",
          description:
            errorDetail ||
            "A network or decryption transfer error interrupted this request. No partial plaintext was exposed.",
          notice:
            "Check your internet connection and retry, or confirm you copied the complete share link.",
        };

      case "unexpected_error":
        return {
          badge: "SAFE RECOVERY // UNEXPECTED EXCEPTION",
          badgeStyle: "text-rose-500 bg-rose-500/10 border-rose-500/25",
          iconWellStyle:
            "border-rose-500/30 shadow-[0_0_32px_rgba(244,63,94,0.2)]",
          icon: <AlertTriangle className="w-8 h-8 text-rose-500" />,
          title: "Something Went Wrong",
          description:
            errorDetail ||
            "An unexpected client error occurred while rendering this view. All local keys and buffers remain isolated.",
          notice:
            "You can safely retry loading this page or return to the home screen.",
        };

      case "route_404":
      default:
        return {
          badge: "HTTP 404 // PAGE DOES NOT EXIST",
          badgeStyle: "text-indigo-500 bg-indigo-500/10 border-indigo-500/25",
          iconWellStyle:
            "border-indigo-500/30 shadow-[0_0_32px_rgba(99,102,241,0.22)]",
          icon: <Ghost className="w-8 h-8 text-indigo-500" />,
          title: "This Page Does Not Exist",
          description:
            "The route you requested could not be found. Phantom keeps zero public profiles, accounts, or browsable file directories.",
          notice:
            "If you have a session code, enter it on the home page or start a new encrypted drop, note, or chat room below.",
        };
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-lg mx-auto"
    >
      <SpotlightCard className="p-6 sm:p-8 rounded-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)] backdrop-blur-xl shadow-2xl text-center">
        {/* Status Pill */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono mb-5 ${config.badgeStyle}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
          <span className="tracking-wider uppercase font-semibold">
            {config.badge}
          </span>
        </div>

        {/* Icon / 404 Graphic */}
        <div className="flex flex-col items-center justify-center mb-4 gap-3">
          {variant === "route_404" && (
            <div className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-[var(--wisp-text)]/90 select-none">
              404
            </div>
          )}
          <div
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-[var(--wisp-elevated)] border flex items-center justify-center ${config.iconWellStyle}`}
          >
            {config.icon}
          </div>
        </div>

        {/* Attempt Counter / Searched Code Chip */}
        {variant === "wrong_password" && attempts > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono font-semibold text-rose-500 mb-3">
            <span>Failed Attempt #{attempts}</span>
            <span className="opacity-50">•</span>
            <span>0 bytes decrypted</span>
          </div>
        )}

        {(variant === "not_found" || variant === "invalid_code") &&
          code &&
          code.toUpperCase() !== "ACCESSED" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-xs font-mono text-[var(--wisp-text)] mb-3">
              <span className="text-[var(--wisp-muted)] uppercase text-[10px]">
                Code:
              </span>
              <span className="font-bold tracking-wider truncate max-w-[180px]">
                {code.toUpperCase()}
              </span>
            </div>
          )}

        {/* Headline */}
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--wisp-text)] mb-2.5 leading-snug">
          {config.title}
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[var(--wisp-muted)] leading-relaxed mb-5 max-w-md mx-auto">
          {config.description}
        </p>

        {/* Zero-Knowledge Notice */}
        <div className="p-3 rounded-xl bg-[var(--wisp-elevated)]/70 border border-[var(--wisp-border)] text-[11px] sm:text-xs text-[var(--wisp-muted)] leading-relaxed mb-6 text-left flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>{config.notice}</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 w-full">
          {variant === "wrong_password" && onRetryPassword && (
            <button
              type="button"
              onClick={onRetryPassword}
              autoFocus
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Try Password Again</span>
            </button>
          )}

          {(variant === "network_error" || variant === "unexpected_error") &&
            onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            )}

          {variant === "route_404" ? (
            <>
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return Home</span>
              </Link>
              <Link
                href="/drop"
                className="w-full sm:w-auto px-4 py-2.5 bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl border border-[var(--wisp-border)] transition-colors flex items-center justify-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                <span>Drop File</span>
              </Link>
              <Link
                href="/text"
                className="w-full sm:w-auto px-4 py-2.5 bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl border border-[var(--wisp-border)] transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Share Text</span>
              </Link>
              <Link
                href="/chat"
                className="w-full sm:w-auto px-4 py-2.5 bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl border border-[var(--wisp-border)] transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
                <span>Live Chat</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/"
                className={`w-full sm:w-auto px-5 py-2.5 text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  variant === "wrong_password" ||
                  ((variant === "network_error" ||
                    variant === "unexpected_error") &&
                    onRetry)
                    ? "bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] font-semibold border border-[var(--wisp-border)]"
                    : "bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold shadow-lg shadow-indigo-500/20"
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>
                  {variant === "not_found" || variant === "invalid_code"
                    ? "Try Another Code"
                    : "Return to Home"}
                </span>
              </Link>

              {(variant === "not_found" ||
                variant === "destroyed" ||
                variant === "expired") && (
                <Link
                  href={secondaryCreateHref}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] text-xs font-semibold rounded-xl border border-[var(--wisp-border)] transition-colors flex items-center justify-center gap-1.5"
                >
                  {resourceType === "text" ? (
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                  <span>{secondaryCreateLabel}</span>
                </Link>
              )}
            </>
          )}
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
