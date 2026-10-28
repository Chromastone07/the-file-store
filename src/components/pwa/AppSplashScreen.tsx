"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function AppSplashScreen() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Fast-path bypass for automated audits & search engine bots
    if (/lighthouse|headlesschrome|bot|crawl|spider/i.test(navigator.userAgent)) {
      return;
    }

    const isPreview = window.location.search.includes("splash");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // Show splash screen for installed PWA launches or explicit preview
    if (isPreview || isStandalone) {
      const shown = sessionStorage.getItem("phantom_splash_shown");
      if (!shown || isPreview) {
        setIsVisible(true);
        if (!isPreview) {
          sessionStorage.setItem("phantom_splash_shown", "true");
          const timer = setTimeout(() => setIsVisible(false), 900);
          return () => clearTimeout(timer);
        }
      }
    }
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="phantom-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-[#07080f] flex flex-col items-center justify-center p-6 select-none pointer-events-auto"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute w-80 h-80 rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />

          <div className="relative flex flex-col items-center max-w-xs text-center z-10">
            {/* Pulsing Ghost Emblem */}
            <div className="relative mb-6">
              {/* Orbital pulse rings */}
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-4 rounded-full border border-cyan-400/30 blur-xs"
              />
              <motion.div
                animate={{ scale: [1.1, 1.25, 1.1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-8 rounded-full border border-indigo-500/20"
              />

              {/* Ghost Emblem Container */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="w-24 h-24 rounded-3xl border border-cyan-400/40 shadow-[0_0_40px_rgba(34,211,238,0.3)] relative overflow-hidden flex items-center justify-center"
              >
                <Image
                  src="/icons/icon-192.png"
                  alt="Phantom"
                  width={96}
                  height={96}
                  priority
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </div>

            {/* Brand Title in Stylish Space Grotesk */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="flex items-center gap-1.5 mb-2.5"
            >
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-violet-300 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                Phantom
              </h1>
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-pulse" />
            </motion.div>

            {/* Stylish Micro Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] text-cyan-400/80 uppercase font-semibold mb-6"
            >
              Share • Access • Vanish
            </motion.p>

            {/* Cyber Shimmer Progress Bar */}
            <div className="w-40 h-1 bg-white/5 rounded-full overflow-hidden relative">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#22d3ee]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
