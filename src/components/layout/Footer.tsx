export default function Footer() {
  return (
    <footer className="hidden md:flex w-full h-7 items-center justify-between px-6 border-t border-[var(--wisp-border)] bg-[var(--wisp-bg)] text-[11px] text-[var(--wisp-muted)] shrink-0 z-30 select-none">
      <div className="flex items-center gap-2">
        <span>E2E encrypted</span>
        <span>-</span>
        <span>Zero knowledge</span>
        <span>-</span>
        <span>Auto-destruct</span>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-[var(--wisp-text)]">
        <span>PHANTOM</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--wisp-glow)]"></span>
      </div>
    </footer>
  );
}
