"use client";

import { getFileCategory } from '@/lib/utils';
import ImageViewer from './ImageViewer';
import VideoPlayer from './VideoPlayer';
import PDFViewer from './PDFViewer';
import CodeViewer from './CodeViewer';
import DocumentViewer from './DocumentViewer';

interface FileViewerModalProps {
  filename: string;
  blobUrl: string;         // blob URL for binary files (image, video, pdf)
  textContent?: string;    // decoded text for code/document files
  viewOnly?: boolean;      // burn-after-reading mode
  onClose: () => void;
  currentIndex?: number;
  totalFiles?: number;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function FileViewerModal({
  filename,
  blobUrl,
  textContent,
  viewOnly = false,
  onClose,
  currentIndex,
  totalFiles,
  onNext,
  onPrev
}: FileViewerModalProps) {
  const category = getFileCategory(filename);

  // Close on Escape key, navigate on arrows
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && onNext) onNext();
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
  };

  const renderViewer = () => {
    switch (category) {
      case 'image':
        return <ImageViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'video':
        return <VideoPlayer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'pdf':
        return <PDFViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'code':
        return <CodeViewer code={textContent || ''} filename={filename} viewOnly={viewOnly} />;
      case 'document':
        return <DocumentViewer content={textContent || ''} filename={filename} viewOnly={viewOnly} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--phantom-muted)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            <p className="text-sm">Preview not available for this file type</p>
            <p className="text-xs">{filename}</p>
            {!viewOnly && (
              <a
                href={blobUrl}
                download={filename}
                className="mt-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--phantom-glow)', color: '#fff' }}
              >
                Download File
              </a>
            )}
            {viewOnly && (
              <p className="text-xs text-[var(--phantom-danger)] mt-2">
                Burn After Reading is enabled. This file type requires downloading to view, but downloads are disabled.
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`File viewer: ${filename}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 phantom-animate-in"
        style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Close button (Floating outside the modal to prevent overlap) */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 md:top-6 md:right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-colors bg-[var(--phantom-surface)] border border-[var(--phantom-border)] text-[var(--phantom-text)] hover:text-[var(--phantom-danger)] hover:border-[var(--phantom-danger)] shadow-2xl"
        aria-label="Close viewer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Modal */}
      <div
        className="relative w-[95vw] h-[90vh] max-w-7xl rounded-2xl overflow-hidden phantom-animate-in flex flex-col"
        style={{
          background: 'var(--phantom-surface)',
          border: '1px solid var(--phantom-border)',
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Viewer content */}
        <div className="flex-1 overflow-auto relative">
          {totalFiles && totalFiles > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--phantom-bg)]/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-[var(--phantom-text)] border border-[var(--phantom-border)] pointer-events-none">
              {(currentIndex ?? 0) + 1} OF {totalFiles}
            </div>
          )}

          {renderViewer()}
          
          {/* Navigation Controls */}
          {totalFiles && totalFiles > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center bg-[var(--phantom-bg)]/80 backdrop-blur-md border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] hover:text-[var(--phantom-glow)] hover:border-[var(--phantom-glow)] transition-all"
                aria-label="Previous file"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center bg-[var(--phantom-bg)]/80 backdrop-blur-md border border-[var(--phantom-border)] rounded-full text-[var(--phantom-text)] hover:text-[var(--phantom-glow)] hover:border-[var(--phantom-glow)] transition-all"
                aria-label="Next file"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
