import { useEffect, useRef, useState } from 'react';

interface AudioViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
  onEnded?: () => void;
}

export default function AudioViewer({ src, filename, viewOnly, onEnded }: AudioViewerProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--phantom-surface)] p-8">
      <div className="w-32 h-32 rounded-full bg-[var(--phantom-elevated)] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
        <svg className="w-16 h-16 text-[var(--phantom-glow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      
      <h3 className="text-xl font-medium text-[var(--phantom-text)] mb-8 break-all text-center max-w-xl">
        {filename}
      </h3>
      
      <div className="w-full max-w-md bg-[var(--phantom-elevated)] p-6 rounded-2xl border border-[var(--phantom-border)] shadow-xl">
        {src ? (
          <audio 
            controls 
            controlsList={viewOnly ? "nodownload" : ""}
            className="w-full focus:outline-none" 
            autoPlay 
            src={src} 
            onEnded={onEnded}
          />
        ) : (
          <div className="w-full h-14 bg-[var(--phantom-surface)] border border-[var(--phantom-border)] rounded-lg flex items-center justify-center text-sm text-[var(--phantom-muted)]">
            Audio revoked
          </div>
        )}
        
        {viewOnly && (
          <p className="text-xs text-[var(--phantom-warning)] text-center mt-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Burn After Reading is active. Downloads are disabled.
          </p>
        )}
      </div>
    </div>
  );
}
