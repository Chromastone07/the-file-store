export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--phantom-border)] bg-[var(--phantom-bg)] py-6 px-6 md:px-12 mt-auto">
      <div className="w-full flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0 text-sm">
        
        <div className="flex flex-col md:flex-row items-center md:space-x-4 space-y-2 md:space-y-0 text-[var(--phantom-muted)] font-medium text-center md:text-left">
          <div className="flex items-center space-x-2">
            <span>E2E Encrypted</span>
            <span className="hidden md:inline">•</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Zero Knowledge</span>
            <span className="hidden md:inline">•</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Auto-Destruct</span>
          </div>
        </div>
        
        <div className="text-[var(--phantom-muted)] text-center text-xs md:text-sm order-first md:order-none mb-4 md:mb-0">
          Your data never touches our servers unencrypted.
        </div>
        
        <div className="text-[var(--phantom-text)] text-sm tracking-widest uppercase font-black flex items-baseline">
          PHANTOM<span className="w-1.5 h-1.5 rounded-full bg-[var(--phantom-glow)] ml-1"></span>
        </div>
        
      </div>
    </footer>
  );
}
