"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { getFileCategory } from '@/lib/utils';
import { recordDownload } from '@/lib/supabase';
import ImageViewer from './ImageViewer';
import VideoPlayer from './VideoPlayer';
import DocumentViewer from './DocumentViewer';
import AudioViewer from './AudioViewer';
import FallbackViewer from './FallbackViewer';

// Heavy specialized viewers dynamically loaded on-demand
const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false });
const WordViewer = dynamic(() => import('./WordViewer'), { ssr: false });
const SpreadsheetViewer = dynamic(() => import('./SpreadsheetViewer'), { ssr: false });
const ArchiveViewer = dynamic(() => import('./ArchiveViewer'), { ssr: false });
const PresentationViewer = dynamic(() => import('./PresentationViewer'), { ssr: false });
const CodeViewer = dynamic(() => import('./CodeViewer'), { ssr: false });
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Code as CodeIcon,
  Table,
  Archive,
  Presentation,
  FileQuestion
} from 'lucide-react';

interface FileViewerModalProps {
  filename: string;
  blobUrl: string;         // blob URL for binary files (image, video, pdf, etc.)
  dropCode?: string;       // session code for tracking downloads
  textContent?: string;    // decoded text for code/document files
  viewOnly?: boolean;      // burn-after-reading mode
  onClose: () => void;
  currentIndex?: number;
  totalFiles?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onMediaEnded?: () => void;
}

export default function FileViewerModal({
  filename,
  blobUrl,
  dropCode,
  textContent,
  viewOnly = false,
  onClose,
  currentIndex,
  totalFiles,
  onNext,
  onPrev,
  onMediaEnded,
}: FileViewerModalProps) {
  const category = getFileCategory(filename);

  // Close on Escape key, navigate on arrows
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && onNext) onNext();
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
  };

  const handleDownload = () => {
    if (dropCode) {
      recordDownload(dropCode).catch(() => {});
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'image': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'video': return <Video className="w-4 h-4 text-purple-400" />;
      case 'pdf': return <FileText className="w-4 h-4 text-rose-400" />;
      case 'audio': return <Music className="w-4 h-4 text-amber-400" />;
      case 'code': return <CodeIcon className="w-4 h-4 text-cyan-400" />;
      case 'spreadsheet': return <Table className="w-4 h-4 text-emerald-500" />;
      case 'archive': return <Archive className="w-4 h-4 text-amber-500" />;
      case 'presentation': return <Presentation className="w-4 h-4 text-orange-400" />;
      case 'document': return <FileText className="w-4 h-4 text-blue-400" />;
      default: return <FileQuestion className="w-4 h-4 text-indigo-400" />;
    }
  };

  const renderViewer = () => {
    switch (category) {
      case 'image':
        return <ImageViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'video':
        return <VideoPlayer src={blobUrl} filename={filename} viewOnly={viewOnly} onEnded={onMediaEnded} />;
      case 'pdf':
        return <PDFViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'audio':
        return <AudioViewer src={blobUrl} filename={filename} viewOnly={viewOnly} onEnded={onMediaEnded} />;
      case 'code':
        return <CodeViewer code={textContent || ''} src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'spreadsheet':
        return <SpreadsheetViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'archive':
        return <ArchiveViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'presentation':
        return <PresentationViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      case 'document': {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext === 'doc' || ext === 'docx') {
          return <WordViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
        }
        return <DocumentViewer content={textContent || ''} src={blobUrl} filename={filename} viewOnly={viewOnly} />;
      }
      default:
        return <FallbackViewer src={blobUrl} filename={filename} viewOnly={viewOnly} />;
    }
  };

  const fileExt = filename.split('.').pop()?.toUpperCase() || category.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`File viewer: ${filename}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Unified Modal Container */}
      <div className="relative w-full max-w-6xl h-[92dvh] sm:h-[88dvh] rounded-2xl overflow-hidden bg-[var(--wisp-surface)] border border-[var(--wisp-border)] shadow-2xl flex flex-col z-10">
        
        {/* Unified Responsive Header */}
        <div className="h-13 sm:h-14 px-3 sm:px-4 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)] flex items-center justify-between shrink-0 gap-2">
          {/* Left: Icon + Filename + Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] flex items-center justify-center shrink-0">
              {getCategoryIcon(category)}
            </div>
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-[var(--wisp-text)] truncate max-w-[110px] xs:max-w-[150px] sm:max-w-xs md:max-w-md" title={filename}>
                {filename}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-[var(--wisp-elevated)] text-[var(--wisp-muted)] border border-[var(--wisp-border)] shrink-0 hidden sm:inline-block">
                {fileExt}
              </span>
            </div>
          </div>

          {/* Center: File Counter (1 of 2) */}
          {totalFiles && totalFiles > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[10px] sm:text-xs font-mono font-semibold text-[var(--wisp-muted)] shrink-0">
              <span className="text-[var(--wisp-text)]">{(currentIndex ?? 0) + 1}</span>
              <span className="opacity-40">/</span>
              <span>{totalFiles}</span>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Open in Tab for binary files */}
            {blobUrl && (category === 'pdf' || category === 'image' || category === 'video') && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] border border-[var(--wisp-border)] transition-all cursor-pointer"
                title="Open raw file in browser tab"
                aria-label="Open raw file in browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            )}

            {/* Download Button */}
            {!viewOnly && blobUrl && (
              <a
                href={blobUrl}
                download={filename}
                onClick={handleDownload}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-glow)] border border-[var(--wisp-border)] transition-all cursor-pointer"
                title="Download file"
                aria-label="Download file"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-[var(--wisp-elevated)] hover:bg-rose-500/20 text-[var(--wisp-muted)] hover:text-rose-400 border border-[var(--wisp-border)] hover:border-rose-500/30 transition-all cursor-pointer"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content Body */}
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          {renderViewer()}

          {/* Navigation Controls between multiple files */}
          {totalFiles && totalFiles > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[var(--wisp-bg)]/80 hover:bg-[var(--wisp-surface)] backdrop-blur-md border border-[var(--wisp-border)] hover:border-[var(--wisp-glow)] rounded-full text-[var(--wisp-text)] shadow-xl transition-all cursor-pointer"
                aria-label="Previous file"
                title="Previous file"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-[var(--wisp-bg)]/80 hover:bg-[var(--wisp-surface)] backdrop-blur-md border border-[var(--wisp-border)] hover:border-[var(--wisp-glow)] rounded-full text-[var(--wisp-text)] shadow-xl transition-all cursor-pointer"
                aria-label="Next file"
                title="Next file"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
