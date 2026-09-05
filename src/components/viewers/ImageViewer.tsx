"use client";

import { useState } from 'react';

interface ImageViewerProps {
  src: string;       // blob URL of decrypted image
  filename: string;
  onClose?: () => void;
  viewOnly?: boolean; // burn-after-reading: no download
}

export default function ImageViewer({ src, filename, onClose, viewOnly = false }: ImageViewerProps) {
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
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--phantom-border)', background: 'var(--phantom-surface)' }}
      >
        <span className="text-sm font-medium truncate max-w-[50%]" style={{ color: 'var(--phantom-text)' }}>
          {filename}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
            className="px-2 py-1 rounded text-sm transition-colors hover:opacity-80"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-text)' }}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-mono min-w-[3rem] text-center" style={{ color: 'var(--phantom-muted)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(5, z + 0.25))}
            className="px-2 py-1 rounded text-sm transition-colors hover:opacity-80"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-text)' }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 rounded text-xs transition-colors hover:opacity-80"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-muted)' }}
          >
            Reset
          </button>
          {!viewOnly && (
            <a
              href={src}
              download={filename}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{ background: 'var(--phantom-glow)', color: '#fff' }}
            >
              Download
            </a>
          )}
        </div>
      </div>

      {/* Image viewport */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{
          background: 'var(--phantom-bg)',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={filename}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-150"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            ...(viewOnly ? { pointerEvents: 'none' as const } : {}),
          }}
          onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
        />
      </div>

      {viewOnly && (
        <div
          className="text-center py-2 text-xs font-medium"
          style={{ background: 'var(--phantom-danger)', color: '#fff' }}
        >
          🔥 View Only — This file will be destroyed after this session
        </div>
      )}
    </div>
  );
}
