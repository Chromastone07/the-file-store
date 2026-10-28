"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ExternalLink,
  Download,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface PDFViewerProps {
  src: string;       // blob URL of decrypted PDF
  filename: string;
  viewOnly?: boolean;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getViewport: (params: { scale: number; rotation?: number }) => PDFPageViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }) => PDFRenderTask;
}

interface PDFPageViewport {
  width: number;
  height: number;
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PDFJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { url: string; cMapUrl?: string; cMapPacked?: boolean }) => {
    promise: Promise<PDFDocumentProxy>;
  };
}

// Dynamically load browser-native PDF.js build from public/ to avoid bundler canvas errors
function getPdfjsLib(): Promise<PDFJsLib> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  const win = window as unknown as { pdfjsLib?: PDFJsLib };
  if (win.pdfjsLib) {
    win.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    return Promise.resolve(win.pdfjsLib);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="/pdf.min.js"]');
    if (existing) {
      const onExistingLoad = () => {
        const lib = (window as unknown as { pdfjsLib?: PDFJsLib }).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('pdfjsLib failed to initialize'));
        }
      };
      existing.addEventListener('load', onExistingLoad);
      if ((window as unknown as { pdfjsLib?: PDFJsLib }).pdfjsLib) onExistingLoad();
      return;
    }

    const script = document.createElement('script');
    script.src = '/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PDFJsLib }).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        resolve(lib);
      } else {
        reject(new Error('pdfjsLib failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF engine script'));
    document.head.appendChild(script);
  });
}

export default function PDFViewer({ src, filename, viewOnly = false }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<PDFRenderTask | null>(null);

  // Load PDF Document via standalone browser PDF.js engine
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const pdfjsLib = await getPdfjsLib();

        const loadingTask = pdfjsLib.getDocument({
          url: src,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setIsLoading(false);
      } catch (err: unknown) {
        console.error('Failed to load PDF via PDF.js:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Could not parse PDF in-memory';
          setError(message);
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [src]);

  // Render current page onto canvas
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      setIsRendering(true);
      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Calculate responsive fit width
      const container = containerRef.current;
      const containerWidth = container ? container.clientWidth - (window.innerWidth < 640 ? 16 : 48) : 800;
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      
      const fitScale = Math.min(Math.max(containerWidth / unscaledViewport.width, 0.4), 2.5);
      const finalScale = fitScale * zoom;

      const viewport = page.getViewport({ scale: finalScale, rotation });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: unknown) {
      const isCancelled = typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException';
      if (!isCancelled) {
        console.error('Error rendering page:', err);
      }
    } finally {
      setIsRendering(false);
    }
  }, [zoom, rotation]);

  // Trigger render when page, zoom, rotation, or document changes
  useEffect(() => {
    if (!isLoading && pdfDocRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, zoom, rotation, isLoading, renderPage]);

  // Handle window resize to re-render fit width
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isLoading && pdfDocRef.current) {
          renderPage(currentPage);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [currentPage, isLoading, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage(p => p + 1);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--wisp-muted)] p-6">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--wisp-glow)]" />
        <p className="text-xs sm:text-sm font-medium">Decrypting and rendering PDF pages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-sm sm:text-base font-bold text-[var(--wisp-text)]">Native PDF rendering unavailable</h4>
          <p className="text-xs text-[var(--wisp-muted)] mt-1">{error}</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] hover:bg-[var(--wisp-surface)] text-[var(--wisp-text)] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Tab</span>
          </a>
          {!viewOnly && (
            <a
              href={src}
              download={filename}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--wisp-glow)] hover:bg-[var(--wisp-accent)] text-white shadow-md transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-[#1e2024] select-none">
      {/* Scrollable Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-2 sm:p-6 custom-scrollbar"
        onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
      >
        <div className="relative shadow-2xl rounded-sm overflow-hidden bg-white my-auto">
          <canvas ref={canvasRef} className="block" />
          {isRendering && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom PDF Control Pill */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[var(--wisp-surface)]/95 backdrop-blur-md border border-[var(--wisp-border)] shadow-2xl text-[var(--wisp-text)] max-w-[95vw]">
        {/* Page Navigation */}
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="font-mono text-[11px] sm:text-xs font-semibold px-1 whitespace-nowrap">
          {currentPage} / {numPages}
        </span>

        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--wisp-border)] mx-0.5" />

        {/* Zoom Controls */}
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono hover:bg-[var(--wisp-elevated)] transition-colors whitespace-nowrap"
          title="Fit Width"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleRotate}
          className="p-1 rounded-lg hover:bg-[var(--wisp-elevated)] transition-colors hidden sm:flex"
          title="Rotate Page"
          aria-label="Rotate Page"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* View Only Warning Banner */}
      {viewOnly && (
        <div className="bg-rose-950/80 border-t border-rose-500/20 text-rose-300 text-center py-1.5 px-3 text-[11px] font-medium shrink-0">
          Burn on view active. File is held in memory for this session only.
        </div>
      )}
    </div>
  );
}
