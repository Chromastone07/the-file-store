"use client";

import { useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerProps {
  src: string;       // blob URL of decrypted image
  filename: string;
  viewOnly?: boolean; // burn-after-reading: no download
}

export default function ImageViewer({ src, filename, viewOnly = false }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(0.25, z + delta), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-[#121316] select-none">
      {/* Image viewport */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center relative"
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={filename}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-150 p-2 sm:p-4"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            ...(viewOnly ? { pointerEvents: 'none' as const } : {}),
          }}
          onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
        />
      </div>

      {/* Floating Bottom Zoom Pill */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--wisp-surface)]/90 backdrop-blur-md border border-[var(--wisp-border)] shadow-xl text-xs text-[var(--wisp-text)]">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] font-mono min-w-[3rem] text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom(z => Math.min(5, z + 0.25))}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-3 bg-[var(--wisp-border)] mx-0.5" />

        <button
          onClick={resetView}
          className="px-2 py-0.5 rounded text-[11px] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)] transition-colors"
          title="Reset zoom"
        >
          Reset
        </button>
      </div>

      {viewOnly && (
        <div className="bg-rose-950/80 border-t border-rose-500/20 text-rose-300 text-center py-1.5 px-3 text-[11px] font-medium shrink-0">
          Burn on view active. File is held in memory for this session only.
        </div>
      )}
    </div>
  );
}
