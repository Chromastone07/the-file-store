"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [stealthActive, setStealthActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("phantom-theme");
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
      localStorage.setItem("phantom-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("phantom-theme", "dark");
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
      console.warn("Stealth module not found or missing exports", error);
    }
    setStealthActive(!stealthActive);
  };

  const navLinks = [
    { label: "Drop", href: "/drop" },
    { label: "Text", href: "/text" },
    { label: "Chat", href: "/chat" },
    { label: "Manage", href: "/manage" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--phantom-border)] bg-[var(--phantom-bg)]/80 backdrop-blur-md">
      <div className="w-full px-6 md:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-12">
          <Link href="/" className="flex items-baseline text-2xl font-black tracking-widest text-[var(--phantom-text)] hover:opacity-80 transition-opacity">
            PHANTOM<span className="w-2 h-2 rounded-full bg-[var(--phantom-glow)] ml-1"></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-semibold text-[var(--phantom-muted)] hover:text-[var(--phantom-text)] transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleStealth}
            className="flex items-center space-x-2 p-2 rounded-md hover:bg-[var(--phantom-elevated)] transition-colors relative"
            aria-label="Toggle Stealth Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--phantom-text)]">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {stealthActive && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--phantom-success)]"></span>
            )}
          </button>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-[var(--phantom-elevated)] transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--phantom-text)]">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--phantom-text)]">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 rounded-md hover:bg-[var(--phantom-elevated)] transition-colors text-[var(--phantom-text)]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle Mobile Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-[var(--phantom-border)] overflow-hidden"
          >
            <div className="flex flex-col py-4 px-4 space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className="text-sm font-medium text-[var(--phantom-text)] hover:text-[var(--phantom-glow)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
