"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Sun, Moon, AlertOctagon, QrCode } from "lucide-react";
import { WISP_CONFIG } from "@/lib/config";
import { useGlobalSession } from "@/context/GlobalSessionContext";

export default function Navbar() {
  const pathname = usePathname();
  const { activeSessions, isDockOpen, setIsDockOpen, openQRScanner } = useGlobalSession();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [stealthActive, setStealthActive] = useState(false);
  const [shieldMenuOpen, setShieldMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem(WISP_CONFIG.STORAGE_KEYS.THEME) || localStorage.getItem("phantom-theme");
    if (savedTheme === "light") {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (newTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem(WISP_CONFIG.STORAGE_KEYS.THEME, "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(WISP_CONFIG.STORAGE_KEYS.THEME, "dark");
    }
  };

  const triggerPanic = async () => {
    try {
      const { stealth } = await import("@/lib/stealth");
      stealth.panic();
    } catch {
      window.location.replace(WISP_CONFIG.PANIC_REDIRECT_URL);
    }
  };

  const toggleStealth = async () => {
    try {
      const { stealth } = await import("@/lib/stealth");
      if (stealthActive) {
        stealth.deactivate();
      } else {
        stealth.activate();
      }
    } catch (error) {
      console.warn("Stealth module error", error);
    }
    setStealthActive(!stealthActive);
  };

  // Mobile long-press handler on shield for panic wipe
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      triggerPanic();
    }, 800);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const navLinks = [
    { label: "Drop", href: "/drop" },
    { label: "Text", href: "/text" },
    { label: "Chat", href: "/chat" },
    { label: "Manage", href: "/manage" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full h-[var(--header-h)] border-b border-[var(--wisp-border)] bg-[var(--wisp-bg)]/80 backdrop-blur-xl shrink-0">
      <div className="w-full px-4 md:px-8 h-full flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center group hover:opacity-90 transition-opacity">
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-[var(--wisp-text)] flex items-center">
              Phantom<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] ml-1.5 animate-pulse" />
            </span>
          </Link>

          {/* Desktop Nav with Active Indicator */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-medium py-1 transition-colors ${
                    isActive ? "text-[var(--wisp-text)] font-semibold" : "text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="desktop-nav-underline"
                      className="absolute left-0 right-0 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Active Sessions Quick Access Pill */}
          {activeSessions.length > 0 && (
            <button
              onClick={() => setIsDockOpen(!isDockOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--wisp-surface)] border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer shadow-sm group"
              aria-label="Toggle Active Sessions"
              title="Active Sessions"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">{activeSessions.length}</span>
              <span className="hidden sm:inline text-[11px] font-medium text-[var(--wisp-muted)] group-hover:text-[var(--wisp-text)]">
                active
              </span>
            </button>
          )}

          {/* QR Scanner Trigger */}
          <button
            onClick={() => openQRScanner()}
            className="touch-target flex items-center justify-center p-2 rounded-xl bg-[var(--wisp-surface)] border border-[var(--wisp-border)] text-[var(--wisp-text)] hover:border-indigo-400 hover:text-indigo-400 hover:bg-[var(--wisp-elevated)] transition-all cursor-pointer shadow-sm"
            aria-label="Scan QR Code"
            title="Scan QR Code"
          >
            <QrCode className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Shield & Panic Menu */}
          <div className="relative">
            <button
              onClick={() => setShieldMenuOpen(!shieldMenuOpen)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className={`touch-target flex items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                stealthActive
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                  : "bg-[var(--wisp-surface)] border-[var(--wisp-border)] text-[var(--wisp-text)] hover:border-indigo-400 hover:bg-[var(--wisp-elevated)]"
              }`}
              aria-label="Security and Panic Menu (Hold to Panic)"
              title="Click for security menu, hold to panic wipe"
            >
              <Shield className="w-4 h-4 md:w-5 md:h-5" />
              {stealthActive && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {shieldMenuOpen && (
                <>
                  {/* Backdrop dismisser to close when clicking outside */}
                  <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
                    onClick={() => setShieldMenuOpen(false)}
                  />

                  {/* Fully opaque dropdown so text underneath never clashes */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 mt-2 w-64 bg-[var(--wisp-bg)] border border-[var(--wisp-border-strong)] rounded-xl shadow-2xl p-3 z-50 text-xs"
                  >
                    <div className="font-semibold text-sm mb-1 text-[var(--wisp-text)] flex items-center justify-between">
                      <span>Security & Stealth</span>
                      <span className="text-[10px] text-[var(--wisp-muted)] font-mono font-bold">Phantom</span>
                    </div>
                    <p className="text-[var(--wisp-muted)] text-[11px] mb-3 leading-relaxed">
                      Zero knowledge client encryption. Data auto-destructs after receipt.
                    </p>

                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          toggleStealth();
                          setShieldMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>Inactivity Wipe</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${stealthActive ? "bg-[var(--wisp-success)]/20 text-[var(--wisp-success)]" : "text-[var(--wisp-muted)]"}`}>
                          {stealthActive ? "Active" : "Off"}
                        </span>
                      </button>

                      <button
                        onClick={triggerPanic}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[var(--wisp-danger)]/10 hover:bg-[var(--wisp-danger)]/20 text-[var(--wisp-danger)] font-medium flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <AlertOctagon className="w-3.5 h-3.5" /> Panic Wipe
                        </span>
                        <span className="text-[10px] font-mono">Wipe</span>
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] text-center text-[var(--wisp-muted)]">
                      Hold shield button anytime to instant panic wipe.
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="touch-target flex items-center justify-center p-2 rounded-lg bg-[var(--wisp-surface)] border border-[var(--wisp-border)] text-[var(--wisp-text)] hover:border-[var(--wisp-glow)] transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
