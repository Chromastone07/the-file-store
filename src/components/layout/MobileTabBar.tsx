"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, FileText, MessageSquare, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGlobalSession } from '@/context/GlobalSessionContext';

const NAV_ITEMS = [
  { href: '/drop', label: 'Drop', icon: Upload },
  { href: '/text', label: 'Text', icon: FileText },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/manage', label: 'Manage', icon: Shield },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { activeSessions } = useGlobalSession();

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--wisp-surface)]/95 backdrop-blur-lg border-t border-[var(--wisp-border)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full touch-target transition-colors ${
                isActive ? 'text-[var(--wisp-glow)] font-semibold' : 'text-[var(--wisp-muted)] hover:text-[var(--wisp-text)]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {label === 'Manage' && activeSessions.length > 0 && (
                  <span className="absolute -top-1 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-sm animate-pulse">
                    {activeSessions.length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--wisp-glow)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[11px] leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
