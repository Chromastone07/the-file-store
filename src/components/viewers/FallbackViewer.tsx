"use client";

import { Download, AlertTriangle } from 'lucide-react';
import { getFileExtension, getCategoryLabel, getFileCategory } from '@/lib/utils';

interface FallbackViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
}

export default function FallbackViewer({ src, filename, viewOnly = false }: FallbackViewerProps) {
  const ext = getFileExtension(filename).toUpperCase() || 'FILE';
  const category = getFileCategory(filename);
  const categoryLabel = getCategoryLabel(category);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--wisp-surface)] text-[var(--wisp-text)]">

      {/* Card Content Area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-[var(--wisp-elevated)]/60 border border-[var(--wisp-border)] rounded-2xl p-8 shadow-xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--wisp-glow)]/10 text-[var(--wisp-glow)] flex items-center justify-center font-mono font-bold text-lg">
            {ext}
          </div>

          <div>
            <h3 className="text-base font-bold text-[var(--wisp-text)] break-words">
              {filename}
            </h3>
            <p className="text-xs text-[var(--wisp-muted)] mt-1">
              {categoryLabel} format
            </p>
          </div>

          <p className="text-xs text-[var(--wisp-muted)] max-w-xs">
            This file type is decrypted and ready to save. Open it with an application on your device.
          </p>

          {!viewOnly ? (
            <a
              href={src}
              download={filename}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--wisp-glow)] hover:bg-[var(--wisp-accent)] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </a>
          ) : (
            <div className="text-xs text-amber-400 font-medium flex items-center gap-1.5 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Burn after reading is active. File is held in memory for this session only.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
