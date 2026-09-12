"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { supabase } from "@/lib/supabase";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [heroCode, setHeroCode] = useState("");
  const [bottomCode, setBottomCode] = useState("");
  const [isRouting, setIsRouting] = useState(false);

  const handleRouting = async (code: string) => {
    const trimmed = code.trim();
    if (trimmed.length !== 6 && trimmed.length !== 8) return;
    
    setIsRouting(true);
    const upperCode = trimmed.toUpperCase();
    
    try {
      // 1. Check Chat Sessions
      const { data: chatData } = await supabase
        .from('clipboard_sessions')
        .select('session_code')
        .eq('session_code', upperCode)
        .limit(1);
        
      if (chatData && chatData.length > 0) {
        router.push(`/chat?join=${upperCode}`);
        return;
      }

      let dbLookupCode = upperCode;
      if (upperCode.length !== 6) { // non-legacy codes are hashed
        const { hashString } = await import('@/lib/crypto');
        dbLookupCode = await hashString(upperCode);
      }

      // 2. Check Text Sessions
      const { data } = await supabase
        .from('secure_texts')
        .select('id')
        .eq('session_code', dbLookupCode)
        .limit(1);
        
      if (data && data.length > 0) {
        router.push(`/t/${upperCode}`);
        return;
      }
    } catch (e) {
      console.error("Routing check failed", e);
    }
    
    // Default to file drop if not found in texts
    router.push(`/d/${upperCode}`);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRouting) return;
    handleRouting(heroCode);
  };

  const handleBottomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRouting) return;
    handleRouting(bottomCode);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  return (
    <div className="relative min-h-screen flex flex-col font-sans text-[var(--phantom-text)]">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-grow z-10">
        {/* 1. Hero Section */}
        <section className="relative pt-32 pb-20 px-6 lg:pt-48 lg:pb-32 overflow-hidden">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
            >
              <span className="block">Share anything.</span>
              <motion.span
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 5, ease: "linear", repeat: Infinity }}
                className="block text-transparent bg-clip-text bg-[length:200%_auto]"
                style={{
                  backgroundImage: "linear-gradient(to right, var(--phantom-glow), var(--phantom-accent), var(--phantom-glow))",
                }}
              >
                Trust no one.
              </motion.span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-lg md:text-xl max-w-2xl mx-auto mb-10"
              style={{ color: "var(--phantom-muted)" }}
            >
              Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts. No traces. No compromises.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/drop"
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-white flex items-center justify-center"
                style={{ backgroundColor: "var(--phantom-glow)" }}
              >
                Drop a File
              </Link>
              <Link
                href="/text"
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-medium transition-all duration-200 border bg-transparent hover:bg-white/5 flex items-center justify-center"
                style={{ borderColor: "var(--phantom-border)", color: "var(--phantom-accent)" }}
              >
                Share Text
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SpotlightCard className="max-w-md mx-auto p-8 rounded-xl border border-[var(--phantom-border)]">
                <label htmlFor="heroCode" className="block text-sm font-medium mb-4 text-left text-[var(--phantom-muted)]">
                  Have a code?
                </label>
              <form onSubmit={handleHeroSubmit} className="flex gap-2">
                <input
                  id="heroCode"
                  type="text"
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  value={heroCode}
                  onChange={(e) => setHeroCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 rounded-lg font-mono text-center tracking-widest text-lg uppercase outline-none transition-colors border focus:border-indigo-500 bg-transparent"
                  style={{
                    borderColor: "var(--phantom-border)",
                    color: "var(--phantom-text)",
                  }}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="submit"
                  disabled={heroCode.length !== 6 && heroCode.length !== 8 || isRouting}
                  className="px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 text-white flex items-center justify-center min-w-[64px]"
                  style={{ backgroundColor: "var(--phantom-glow)" }}
                >
                  {isRouting ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Go"}
                </button>
              </form>
              </SpotlightCard>
            </motion.div>
          </motion.div>
        </section>

        {/* 2. How It Works Section */}
        <section className="py-24 px-6 border-t" style={{ borderColor: "var(--phantom-border)" }}>
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold">How it works</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <SpotlightCard className="h-full p-8 rounded-xl border border-[var(--phantom-border)] transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-6 bg-[var(--phantom-elevated)]">
                    <svg className="w-6 h-6 text-[var(--phantom-glow)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Encrypt</h3>
                  <p className="text-[var(--phantom-muted)]">
                    Your file is encrypted in your browser with AES-256 before anything touches the network.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <SpotlightCard className="h-full p-8 rounded-xl border border-[var(--phantom-border)] transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-6 bg-[var(--phantom-elevated)]">
                    <svg className="w-6 h-6 text-[var(--phantom-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Share</h3>
                  <p className="text-[var(--phantom-muted)]">
                    Get an 8-digit code or link. Share it however you want — text, voice, carrier pigeon.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <SpotlightCard className="h-full p-8 rounded-xl border border-[var(--phantom-border)] transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-6 bg-[var(--phantom-elevated)]">
                    <svg className="w-6 h-6 text-[var(--phantom-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Vanish</h3>
                  <p className="text-[var(--phantom-muted)]">
                    Your file auto-destructs after access or when the timer runs out. No traces left behind.
                  </p>
                </SpotlightCard>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 3. Features Grid */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold">Built for paranoia</h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "E2E Encrypted",
                  desc: "AES-GCM-256. Keys never leave your device. The server only stores encrypted noise.",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                },
                {
                  title: "Zero Knowledge",
                  desc: "We can't read your files even if we wanted to. The decryption key is in the URL fragment — never sent to our servers.",
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                },
                {
                  title: "Burn After Reading",
                  desc: "One view, then it's gone forever. Perfect for sensitive documents you only need to share once.",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                },
                {
                  title: "Stealth Mode",
                  desc: "Click the shield icon in the nav bar to activate. Panic button (Ctrl+Shift+X), inactivity wipe, anti-caching — leave nothing behind.",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                },
                {
                  title: "Smart Viewers",
                  desc: "PDFs, code, images, videos — each file type gets its own specialized viewer. No downloads required.",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                },
                {
                  title: "Metadata Stripped",
                  desc: "EXIF data, GPS coordinates, author info — automatically scrubbed before encryption.",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <SpotlightCard className="h-full p-6 rounded-xl border border-[var(--phantom-border)] transition-colors duration-300 hover:border-[var(--phantom-glow)] group">
                    <svg className="w-8 h-8 mb-4 transition-colors duration-300 text-[var(--phantom-muted)] group-hover:text-[var(--phantom-glow)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      {feature.icon}
                    </svg>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-sm text-[var(--phantom-muted)]">
                      {feature.desc}
                    </p>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Access Code Section (bottom CTA) */}
        <section className="py-32 px-6 border-t" style={{ borderColor: "var(--phantom-border)" }}>
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl font-bold mb-4">Ready to receive?</h2>
              <p className="text-lg mb-10" style={{ color: "var(--phantom-muted)" }}>
                Enter an 8-digit access code to retrieve your file
              </p>
              
              <form onSubmit={handleBottomSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  value={bottomCode}
                  onChange={(e) => setBottomCode(e.target.value.toUpperCase())}
                  className="w-full sm:w-64 px-6 py-4 rounded-xl font-mono text-center tracking-[0.3em] text-2xl uppercase outline-none transition-colors border focus:border-[var(--phantom-glow)]"
                  style={{
                    backgroundColor: "var(--phantom-surface)",
                    borderColor: "var(--phantom-border)",
                    color: "var(--phantom-text)",
                  }}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="submit"
                  disabled={bottomCode.length !== 6 && bottomCode.length !== 8 || isRouting}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center min-w-[120px]"
                  style={{ backgroundColor: "var(--phantom-glow)" }}
                >
                  {isRouting ? <RefreshCw className="w-6 h-6 animate-spin" /> : "Retrieve"}
                </button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}