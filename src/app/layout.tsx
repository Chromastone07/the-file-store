import type { Viewport, Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { GlobalSessionProvider } from '@/context/GlobalSessionContext';
import SessionDock from '@/components/ui/SessionDock';
import MobileTabBar from '@/components/layout/MobileTabBar';
import PWAInstaller from '@/components/pwa/PWAInstaller';
import AppSplashScreen from '@/components/pwa/AppSplashScreen';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#07070f',
};

export const metadata: Metadata = {
  title: 'Phantom - Share. Access. Vanish.',
  description: 'Anonymous, end-to-end encrypted, ephemeral data sharing. No accounts. No traces. No compromises.',
  keywords: ['encrypted file sharing', 'anonymous', 'ephemeral', 'secure transfer', 'burn after reading', 'pwa'],
  robots: 'index, follow',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Phantom',
  },
  openGraph: {
    title: 'Phantom',
    description: 'Anonymous encrypted ephemeral data sharing.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Phantom" />
      </head>
      <body className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[var(--wisp-bg)] text-[var(--wisp-text)] min-h-screen flex flex-col`}>
        <AppSplashScreen />
        <GlobalSessionProvider>
          {children}
          <SessionDock />
          <MobileTabBar />
          <PWAInstaller />
          <Toaster 
            position="bottom-center"
            offset="76px"
            visibleToasts={1}
            duration={2200}
            closeButton={false}
            theme="dark"
          />
        </GlobalSessionProvider>
      </body>
    </html>
  );
}