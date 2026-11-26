import AnimatedBackground from "@/components/layout/AnimatedBackground";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VaultErrorScreen from "@/components/ui/VaultErrorScreen";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col font-sans text-[var(--wisp-text)]">
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 z-10">
        <VaultErrorScreen variant="route_404" resourceType="page" />
      </main>

      <Footer />
    </div>
  );
}
