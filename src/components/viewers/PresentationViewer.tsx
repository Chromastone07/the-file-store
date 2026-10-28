"use client";

import { Presentation, Download } from 'lucide-react';

interface PresentationViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
}

export default function PresentationViewer({ src, filename, viewOnly = false }: PresentationViewerProps) {

  return (
    <div className="flex flex-col h-full w-full bg-[var(--wisp-surface)] text-[var(--wisp-text)]">

      {/* Internal Content Area (Carousel Card) */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-2xl bg-[var(--wisp-elevated)]/60 border border-[var(--wisp-border)] rounded-2xl p-8 sm:p-12 shadow-xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--wisp-glow)]/10 text-[var(--wisp-glow)] flex items-center justify-center mb-2">
            <Presentation className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-[var(--wisp-text)]">
            {filename}
          </h3>

          <p className="text-xs text-[var(--wisp-muted)] max-w-md">
            PowerPoint presentation decrypted in memory. To review animations, formatting, and notes, download the original decrypted file below.
          </p>

          {!viewOnly ? (
            <a
              href={src}
              download={filename}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--wisp-glow)] hover:bg-[var(--wisp-accent)] text-white text-xs font-semibold shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Decrypted Presentation</span>
            </a>
          ) : (
            <div className="text-xs text-amber-400 font-medium">
              Burn after reading is active. File is held in memory for this session only.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
