"use client";

import { useState, useEffect } from 'react';
import { unzip } from 'fflate';
import { File, Folder, Download, AlertCircle } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface ArchiveViewerProps {
  src: string; // Blob URL
  filename: string;
  viewOnly?: boolean;
}

interface ZipEntry {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
}

export default function ArchiveViewer({ src, filename, viewOnly = false }: ArchiveViewerProps) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadZip() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Failed to load archive');
        const buffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        unzip(uint8, (err, unzipped) => {
          if (!active) return;
          if (err) {
            const ext = filename.split('.').pop()?.toUpperCase() || 'ARCHIVE';
            setError(`In-memory directory listing is supported for .zip archives. For ${ext} archives, please download the decrypted file below.`);
            setLoading(false);
            return;
          }

          const parsedEntries: ZipEntry[] = Object.keys(unzipped).map((path) => {
            const isDir = path.endsWith('/');
            const parts = path.replace(/\/$/, '').split('/');
            const name = parts[parts.length - 1] || path;
            const data = unzipped[path];
            return {
              path,
              name,
              size: data ? data.length : 0,
              isDir,
            };
          });

          // Sort directories first, then alphabetical
          parsedEntries.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.path.localeCompare(b.path);
          });

          setEntries(parsedEntries);
          setLoading(false);
        });
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Error reading zip archive');
        setLoading(false);
      }
    }

    loadZip();

    return () => {
      active = false;
    };
  }, [src, filename]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--wisp-surface)] text-[var(--wisp-text)]">
      {/* Items count subbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)]/60 text-xs text-[var(--wisp-muted)] shrink-0">
        <span className="font-mono text-[11px]">{entries.length} items in archive</span>
      </div>

      {/* Internal Scroll Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto wisp-scrollbar p-4 overscroll-contain">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--wisp-muted)]">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--wisp-border)] border-t-[var(--wisp-glow)] animate-spin" />
            <span className="text-xs">Reading archive table of contents...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center max-w-md mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-400 opacity-90" />
            <p className="text-xs text-[var(--wisp-muted)] font-medium leading-relaxed">{error}</p>
            {!viewOnly && (
              <a
                href={src}
                download={filename}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--wisp-glow)] hover:bg-[var(--wisp-accent)] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {filename}</span>
              </a>
            )}
          </div>
        ) : entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--wisp-muted)] text-xs">
            Archive is empty.
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--wisp-elevated)]/40 hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {entry.isDir ? (
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-[var(--wisp-muted)] shrink-0" />
                  )}
                  <span className="truncate font-mono text-[11px] sm:text-xs text-[var(--wisp-text)]">
                    {entry.path}
                  </span>
                </div>
                {!entry.isDir && (
                  <span className="text-[10px] text-[var(--wisp-muted)] font-mono shrink-0 ml-2">
                    {formatFileSize(entry.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
