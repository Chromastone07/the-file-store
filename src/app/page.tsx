"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { getClipboardSession, getSecureTextByCode } from "@/lib/supabase";
import { useGlobalSession } from "@/context/GlobalSessionContext";
import { RefreshCw, ShieldCheck, EyeOff, Flame, Ghost, Layers, FileCheck, QrCode } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { openQRScanner } = useGlobalSession();
  const [accessCode, setAccessCode] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRouting = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6 && trimmed.length !== 8) {
      setErrorMessage("Enter an 8-character access code (or 6-character legacy code)");
      return;
    }
    
    setErrorMessage("");
    setIsRouting(true);
    
    try {
      // 1. Check Chat / Clipboard Sessions via RPC
      const { data: chatData } = await getClipboardSession(trimmed);
      if (chatData && chatData.session_code) {
        router.push(`/chat?join=${trimmed}`);
        return;
      }

      let dbLookupCode = trimmed;
      if (trimmed.length !== 6) {
        const { hashString } = await import("@/lib/crypto");
        dbLookupCode = await hashString(trimmed);
      }

      // 2. Check Text Sessions via RPC
      const { data: textData } = await getSecureTextByCode(dbLookupCode);
      if (textData && !textData.is_destroyed) {
        router.push(`/t/${trimmed}`);
        return;
      }
    } catch (e) {
      console.error("Routing check failed", e);
    }
    
    // Default to file drop route
    router.push(`/d/${trimmed}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRouting) return;
    handleRouting(accessCode);
  };

  return (
    <div className="relative min-h-screen flex flex-col font-sans text-[var(--wisp-text)]">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow z-10 flex flex-col">
        {/* 1. Hero Section - Clean, minimal hero as requested */}
        <section className="min-h-[calc(100dvh-var(--header-h)-var(--footer-h)-var(--tabbar-h))] flex flex-col justify-center items-center px-4 py-8 md:py-12 max-w-4xl mx-auto w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col items-center"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4 leading-[1.08]">
              <span className="text-[var(--wisp-text)]">Share anything.</span>
              <br />
              <span className="text-indigo-600 dark:text-indigo-400">Trust no one.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl max-w-xl mx-auto mb-8 text-[var(--wisp-muted)] leading-relaxed font-normal">
              Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts.
              <br className="hidden sm:inline" /> No traces. No compromises.
            </p>

            {/* Clean Minimal CTAs: Drop a File, Share Text, Live Chat */}
            <div className="flex flex-row flex-wrap items-center justify-center gap-3 w-full max-w-md sm:max-w-lg mb-8">
              <Link
                href="/drop"
                className="flex-1 min-w-[110px] px-5 py-3 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-sm flex items-center justify-center cursor-pointer text-center"
              >
                Drop a File
              </Link>
              <Link
                href="/text"
                className="flex-1 min-w-[110px] px-5 py-3 rounded-xl font-semibold transition-all border border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] hover:-translate-y-0.5 text-[var(--wisp-text)] text-sm flex items-center justify-center backdrop-blur-md cursor-pointer text-center"
              >
                Share Text
              </Link>
              <Link
                href="/chat"
                className="flex-1 min-w-[110px] px-5 py-3 rounded-xl font-semibold transition-all border border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] hover:bg-[var(--wisp-elevated)] hover:-translate-y-0.5 text-[var(--wisp-text)] text-sm flex items-center justify-center backdrop-blur-md cursor-pointer text-center"
              >
                Live Chat
              </Link>
            </div>

            {/* Minimal Access Code Card */}
            <SpotlightCard className="w-full max-w-md p-4 sm:p-5 rounded-2xl shadow-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)]/70 backdrop-blur-md">
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs text-[var(--wisp-muted)] px-1">
                  <span>Have a code?</span>
                  <span className="font-mono text-[10px]">Case-insensitive</span>
                </div>
                <div className="flex gap-2">
                  <input
                    id="heroCode"
                    type="text"
                    maxLength={8}
                    placeholder="XXXXXXXX"
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''));
                      if (errorMessage) setErrorMessage("");
                    }}
                    onBlur={() => {
                      setAccessCode((prev) => prev.toUpperCase());
                    }}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck="false"
                    className="w-full px-4 py-2.5 rounded-xl font-mono text-center tracking-[0.25em] text-lg uppercase outline-none transition-colors border border-[var(--wisp-border)] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 bg-[var(--wisp-surface-glass)] text-[var(--wisp-text)] placeholder:text-[var(--wisp-muted)]/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      openQRScanner((scanned) => {
                        const clean = scanned.trim();
                        if (clean.startsWith("http://") || clean.startsWith("https://")) {
                          try {
                            const u = new URL(clean);
                            if (u.pathname.startsWith('/d/') || u.pathname.startsWith('/t/') || u.pathname.startsWith('/chat')) {
                              window.location.href = `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
                              return;
                            }
                          } catch {}
                        }
                        const codeOnly = clean.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                        if (codeOnly) {
                          setAccessCode(codeOnly);
                          handleRouting(codeOnly);
                        }
                      });
                    }}
                    className="p-2.5 rounded-xl border border-[var(--wisp-border)] bg-[var(--wisp-surface-glass)] text-[var(--wisp-muted)] hover:text-indigo-400 hover:border-indigo-400/50 hover:bg-[var(--wisp-elevated)] transition-all cursor-pointer flex items-center justify-center shrink-0"
                    aria-label="Scan QR Code"
                    title="Scan QR Code"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={(accessCode.length !== 6 && accessCode.length !== 8) || isRouting}
                    className="px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-40 text-white bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/30 flex items-center justify-center shrink-0 min-w-[70px] cursor-pointer"
                  >
                    {isRouting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Go"}
                  </button>
                </div>
                {errorMessage && (
                  <p className="text-xs text-rose-400 text-left px-1">{errorMessage}</p>
                )}
              </form>
            </SpotlightCard>
          </motion.div>
        </section>

        {/* 2. How It Works Section (Below the fold) */}
        <section className="py-16 md:py-20 px-4 md:px-8 border-t border-[var(--wisp-border)] bg-[var(--wisp-surface)]/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--wisp-text)] mb-2">How it works</h2>
              <p className="text-sm sm:text-base text-[var(--wisp-muted)]">Ephemeral privacy in three frictionless steps</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {[
                {
                  step: "01",
                  title: "Encrypt",
                  desc: "Your payload is encrypted in memory using AES-256-GCM before any bytes leave your browser.",
                  icon: ShieldCheck,
                },
                {
                  step: "02",
                  title: "Share",
                  desc: "Receive an 8-character access code or secure link. Keys are contained only in the client URL fragment.",
                  icon: Ghost,
                },
                {
                  step: "03",
                  title: "Vanish",
                  desc: "The file is purged permanently from memory and storage upon first access or when the timer expires.",
                  icon: Flame,
                },
              ].map((item, i) => (
                <SpotlightCard key={i} className="p-6 rounded-2xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--wisp-elevated)] flex items-center justify-center text-[var(--wisp-glow)]">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs text-[var(--wisp-muted)] font-semibold">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-1.5">{item.title}</h3>
                  <p className="text-xs md:text-sm text-[var(--wisp-muted)] leading-relaxed">{item.desc}</p>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Features Grid (Below the fold) */}
        <section className="py-16 md:py-20 px-4 md:px-8 border-t border-[var(--wisp-border)]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--wisp-text)] mb-2">Built for paranoia</h2>
              <p className="text-sm sm:text-base text-[var(--wisp-muted)]">Engineered with uncompromising zero-knowledge architecture</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "E2E Encrypted",
                  desc: "AES-GCM-256 with PBKDF2 key derivation. The server only ever holds opaque encrypted blobs.",
                  icon: ShieldCheck,
                },
                {
                  title: "Zero Knowledge",
                  desc: "Decryption keys remain solely in the URL fragment (#) and are never transmitted over HTTP.",
                  icon: EyeOff,
                },
                {
                  title: "Burn After Reading",
                  desc: "One verified view and the server immediately purges ciphertext and storage pointers.",
                  icon: Flame,
                },
                {
                  title: "Stealth Mode",
                  desc: "Panic wipe redirects immediately. Automatic inactivity wipe clears in-memory buffers.",
                  icon: Ghost,
                },
                {
                  title: "Smart Viewers",
                  desc: "In-memory decoders for images, video, audio, PDF, Word, Excel, CSV, and code. No disk caching.",
                  icon: Layers,
                },
                {
                  title: "Metadata Stripped",
                  desc: "EXIF data, GPS coordinates, camera models, and author timestamps scrubbed prior to encryption.",
                  icon: FileCheck,
                },
              ].map((f, i) => (
                <SpotlightCard key={i} className="p-5 rounded-xl border border-[var(--wisp-border)] bg-[var(--wisp-surface)]">
                  <f.icon className="w-5 h-5 text-[var(--wisp-glow)] mb-3" />
                  <h3 className="text-base font-semibold mb-1">{f.title}</h3>
                  <p className="text-xs text-[var(--wisp-muted)] leading-relaxed">{f.desc}</p>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}