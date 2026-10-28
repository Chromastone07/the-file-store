"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://")
    );
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Purge legacy service worker caches that cached old _next chunks
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key !== "phantom-cache-v4") {
            caches.delete(key);
          }
        });
      });
    }

    // 1. Register Service Worker & check for updates immediately
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          registration.update().catch(() => {});

          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("Phantom updated to latest version.");
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn("ServiceWorker registration skipped or failed:", error);
        });
    }

    // 2. Capture beforeinstallprompt for Chrome / Edge / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      toast.success("Phantom installed to your home screen", {
        icon: <Check className="w-4 h-4 text-emerald-400" />,
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      toast.info("To install: use your browser's menu (⋮) -> 'Install Phantom' or 'Add to Home Screen'");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn("PWA install error", err);
    }
  };

  // If already installed or dismissed, don't show the floating banner
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {(isInstallable || (isIOS && !isStandalone)) && !isDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-20 md:bottom-6 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-auto bg-[var(--wisp-bg)]/95 backdrop-blur-xl border border-[var(--wisp-border-strong)] shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/30 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--wisp-text)] flex items-center gap-1.5">
                  <span>Install Phantom</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">PWA</span>
                </div>
                <p className="text-[11px] text-[var(--wisp-muted)] truncate">
                  Fast access with built-in QR scanner & offline shell
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-md border border-indigo-400/30 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)] transition-colors cursor-pointer"
                aria-label="Dismiss install banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Guide Modal */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-[var(--wisp-bg)] border border-[var(--wisp-border-strong)] rounded-2xl max-w-sm w-full p-5 shadow-2xl relative"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-3 right-3 p-1 rounded-lg text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 mx-auto flex items-center justify-center mb-2">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-[var(--wisp-text)]">Install Phantom on iOS</h3>
                <p className="text-xs text-[var(--wisp-muted)] mt-1">
                  Install Phantom as a standalone web app on your iPhone or iPad.
                </p>
              </div>

              <div className="space-y-3 text-xs text-[var(--wisp-text)] mb-5">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--wisp-surface)] border border-[var(--wisp-border)]">
                  <span className="font-mono font-bold text-indigo-400 shrink-0">1.</span>
                  <span>Tap the <strong>Share</strong> button in Safari&apos;s bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--wisp-surface)] border border-[var(--wisp-border)]">
                  <span className="font-mono font-bold text-indigo-400 shrink-0">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--wisp-surface)] border border-[var(--wisp-border)]">
                  <span className="font-mono font-bold text-indigo-400 shrink-0">3.</span>
                  <span>Tap <strong>Add</strong> in the top right to complete.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
