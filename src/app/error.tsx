"use client";

import { useEffect } from "react";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VaultErrorScreen from "@/components/ui/VaultErrorScreen";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  const safeDetail =
    process.env.NODE_ENV !== "production" && error?.message
      ? error.message
      : undefined;

  return (
    <div className="relative min-h-screen flex flex-col font-sans text-[var(--wisp-text)]">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 z-10">
        <VaultErrorScreen
          variant="unexpected_error"
          resourceType="page"
          errorDetail={safeDetail}
          onRetry={reset}
        />
      </main>

      <Footer />
    </div>
  );
}
