import { Toaster } from 'sonner';
import { GlobalSessionProvider } from '@/context/GlobalSessionContext';
import SessionDock from '@/components/ui/SessionDock';
import './globals.css';

export const metadata = {
  title: 'PHANTOM — Share. Access. Vanish.',
  description: 'Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts. No traces. No compromises.',
  keywords: ['encrypted file sharing', 'anonymous', 'ephemeral', 'secure transfer', 'burn after reading'],
  robots: 'index, follow',
  openGraph: {
    title: 'PHANTOM',
    description: 'Anonymous encrypted ephemeral data sharing.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <meta name="referrer" content="no-referrer" />
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
      </head>
      <body className="antialiased bg-[var(--phantom-bg)] text-[var(--phantom-text)] min-h-screen flex flex-col">
        <GlobalSessionProvider>
          {children}
          <SessionDock />
          <Toaster 
            position="top-center"
            toastOptions={{
              className: 'bg-[var(--phantom-elevated)] border-[var(--phantom-border)] text-[var(--phantom-text)]',
              style: {
                backdropFilter: 'blur(10px)',
              }
            }}
          />
        </GlobalSessionProvider>
      </body>
    </html>
  );
}