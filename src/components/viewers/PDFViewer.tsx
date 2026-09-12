"use client";

import { useState } from 'react';

interface PDFViewerProps {
  src: string;       // blob URL of decrypted PDF
  filename: string;
  viewOnly?: boolean;
}

export default function PDFViewer({ src, filename, viewOnly = false }: PDFViewerProps) {
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--phantom-border)', background: 'var(--phantom-surface)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--phantom-danger)' }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          <span className="text-sm font-medium truncate max-w-[50%]" style={{ color: 'var(--phantom-text)' }}>
            {filename}
          </span>
        </div>
        {!viewOnly && (
          <a
            href={src}
            download={filename}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ background: 'var(--phantom-glow)', color: '#fff' }}
          >
            Download PDF
          </a>
        )}
      </div>

      {/* PDF Render */}
      <div className="flex-1 relative" style={{ background: 'var(--phantom-elevated)' }}>
        {!error ? (
          <iframe
            src={`${src}#toolbar=${viewOnly ? '0' : '1'}&navpanes=0`}
            className="w-full h-full border-none"
            title={`PDF: ${filename}`}
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--phantom-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <p className="text-sm">PDF preview unavailable in this browser</p>
            {!viewOnly && (
              <a
                href={src}
                download={filename}
                className="px-4 py-2 rounded text-sm font-medium transition-colors"
                style={{ background: 'var(--phantom-glow)', color: '#fff' }}
              >
                Download to view
              </a>
            )}
          </div>
        )}
      </div>

      {viewOnly && (
        <div
          className="text-center py-2 text-xs font-medium"
          style={{ background: 'var(--phantom-danger)', color: '#fff' }}
        >
          🔥 View Only — Downloads disabled. This file will be destroyed after this session.
        </div>
      )}
    </div>
  );
}
