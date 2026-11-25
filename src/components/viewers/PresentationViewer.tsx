"use client";

import { useEffect, useState } from 'react';
import { unzip } from 'fflate';
import {
  Presentation,
  Download,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PresentationViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
}

interface SlideParagraph {
  text: string;
  isBullet: boolean;
  level: number;
  isBold: boolean;
}

interface SlideBlock {
  kind: 'title' | 'subtitle' | 'body';
  paragraphs: SlideParagraph[];
}

interface ParsedSlide {
  number: number;
  title: string;
  subtitle: string;
  blocks: SlideBlock[];
  tables: string[][][];
  images: { src: string; name: string }[];
  notes: string[];
}

const IMAGE_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

function unzipPromise(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}

function getByLocalName(root: Element | Document, name: string): Element[] {
  const all = root.getElementsByTagName('*');
  const matches: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === name) {
      matches.push(all[i]);
    }
  }
  return matches;
}

function getFirstDirectChild(el: Element, localName: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].localName === localName) {
      return el.children[i];
    }
  }
  return null;
}

function extractParagraphs(txBody: Element): SlideParagraph[] {
  const paragraphs: SlideParagraph[] = [];
  const pNodes = getByLocalName(txBody, 'p');

  for (const p of pNodes) {
    const pPr = getFirstDirectChild(p, 'pPr');
    const buNone = pPr ? getFirstDirectChild(pPr, 'buNone') : null;
    const buChar = pPr ? getFirstDirectChild(pPr, 'buChar') : null;
    const buAuto = pPr ? getFirstDirectChild(pPr, 'buAutoNum') : null;
    const lvlAttr = pPr?.getAttribute('lvl');
    const level = lvlAttr ? Math.min(4, Math.max(0, parseInt(lvlAttr, 10) || 0)) : 0;

    let text = '';
    let hasBold = false;
    for (let i = 0; i < p.children.length; i++) {
      const child = p.children[i];
      if (child.localName === 'r' || child.localName === 'fld') {
        const rPr = getFirstDirectChild(child, 'rPr');
        if (rPr?.getAttribute('b') === '1') hasBold = true;
        const tNode = getFirstDirectChild(child, 't');
        if (tNode?.textContent) text += tNode.textContent;
      } else if (child.localName === 'br') {
        text += '\n';
      }
    }

    const cleaned = text.trim();
    if (!cleaned) continue;

    paragraphs.push({
      text: cleaned,
      isBullet: !buNone && (!!buChar || !!buAuto || level > 0),
      level,
      isBold: hasBold,
    });
  }

  return paragraphs;
}

function extractTables(doc: Document): string[][][] {
  const tables: string[][][] = [];
  const tblNodes = getByLocalName(doc, 'tbl');

  for (const tbl of tblNodes) {
    const rows: string[][] = [];
    for (let r = 0; r < tbl.children.length; r++) {
      const tr = tbl.children[r];
      if (tr.localName !== 'tr') continue;
      const cells: string[] = [];
      for (let c = 0; c < tr.children.length; c++) {
        const tc = tr.children[c];
        if (tc.localName !== 'tc') continue;
        const cellText = getByLocalName(tc, 't')
          .map(t => t.textContent || '')
          .join(' ')
          .trim();
        cells.push(cellText);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }

  return tables;
}

function resolveSlideRelPath(target: string): string {
  const clean = target.replace(/^\/+/, '');
  if (clean.startsWith('ppt/')) return clean;
  const parts = ['ppt', 'slides', ...clean.split('/')];
  const resolved: string[] = [];
  for (const seg of parts) {
    if (!seg || seg === '.') continue;
    if (seg === '..') resolved.pop();
    else resolved.push(seg);
  }
  return resolved.join('/');
}

function parseRelationships(xmlBytes: Uint8Array | undefined, decoder: TextDecoder, parser: DOMParser): Map<string, string> {
  const rels = new Map<string, string>();
  if (!xmlBytes) return rels;
  const doc = parser.parseFromString(decoder.decode(xmlBytes), 'application/xml');
  const nodes = getByLocalName(doc, 'Relationship');
  for (const node of nodes) {
    const id = node.getAttribute('Id');
    const target = node.getAttribute('Target');
    if (id && target) rels.set(id, target);
  }
  return rels;
}

export default function PresentationViewer({ src, filename, viewOnly = false }: PresentationViewerProps) {
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    async function loadPptx() {
      setLoading(true);
      setFallbackReason(null);
      setSlides([]);
      setCurrentIndex(0);

      try {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (ext !== 'pptx') {
          throw new Error(
            `In-browser slide preview is supported for .pptx decks. To inspect animations or formatting in .${ext || 'ppt'} files, download the decrypted presentation below.`
          );
        }

        const res = await fetch(src);
        if (!res.ok) throw new Error('Failed to load presentation');
        const buffer = await res.arrayBuffer();
        const unzipped = await unzipPromise(new Uint8Array(buffer));

        const slidePaths = Object.keys(unzipped)
          .filter(p => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            return numA - numB;
          });

        if (slidePaths.length === 0) {
          throw new Error('No slides could be parsed in this presentation archive. Download below to open locally.');
        }

        const decoder = new TextDecoder();
        const parser = new DOMParser();

        const parsedSlides: ParsedSlide[] = slidePaths.map((path, idx) => {
          const slideNumMatch = path.match(/slide(\d+)\.xml$/i);
          const slideFile = slideNumMatch ? `slide${slideNumMatch[1]}.xml` : `slide${idx + 1}.xml`;
          const relsPath = `ppt/slides/_rels/${slideFile}.rels`;
          const rels = parseRelationships(unzipped[relsPath], decoder, parser);

          const slideDoc = parser.parseFromString(decoder.decode(unzipped[path]), 'application/xml');
          const shapes = getByLocalName(slideDoc, 'sp');

          let title = '';
          let subtitle = '';
          const blocks: SlideBlock[] = [];

          for (const sp of shapes) {
            const nvSpPr = getFirstDirectChild(sp, 'nvSpPr');
            const nvPr = nvSpPr ? getFirstDirectChild(nvSpPr, 'nvPr') : null;
            const ph = nvPr ? getFirstDirectChild(nvPr, 'ph') : null;
            const phType = ph?.getAttribute('type') || '';

            // Skip slide numbers / footers / headers clutter
            if (phType === 'sldNum' || phType === 'ftr' || phType === 'dt') continue;

            const txBody = getFirstDirectChild(sp, 'txBody');
            if (!txBody) continue;
            const paragraphs = extractParagraphs(txBody);
            if (paragraphs.length === 0) continue;

            if (phType === 'title' || phType === 'ctrTitle') {
              title = title || paragraphs.map(p => p.text).join(' ');
            } else if (phType === 'subTitle') {
              subtitle = subtitle || paragraphs.map(p => p.text).join('\n');
            } else {
              blocks.push({ kind: 'body', paragraphs });
            }
          }

          // Tables
          const tables = extractTables(slideDoc);

          // Embedded Images
          const images: { src: string; name: string }[] = [];
          const seenMedia = new Set<string>();
          const blipNodes = getByLocalName(slideDoc, 'blip');
          for (const blip of blipNodes) {
            const embedId =
              blip.getAttribute('r:embed') ||
              blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
            if (!embedId) continue;
            const target = rels.get(embedId);
            if (!target) continue;

            const mediaPath = resolveSlideRelPath(target);
            if (seenMedia.has(mediaPath) || !unzipped[mediaPath]) continue;
            const mediaExt = mediaPath.split('.').pop()?.toLowerCase() || '';
            const mime = IMAGE_MIME_MAP[mediaExt];
            if (!mime) continue;

            seenMedia.add(mediaPath);
            const rawBytes = unzipped[mediaPath];
            const copyBytes = new Uint8Array(rawBytes.byteLength);
            copyBytes.set(rawBytes);
            const url = URL.createObjectURL(new Blob([copyBytes], { type: mime }));
            createdUrls.push(url);
            images.push({ src: url, name: mediaPath.split('/').pop() || 'slide-image' });
          }

          // Speaker Notes
          const notes: string[] = [];
          for (const target of rels.values()) {
            if (target.includes('notesSlide')) {
              const notesPath = resolveSlideRelPath(target);
              const notesBytes = unzipped[notesPath];
              if (!notesBytes) continue;
              const notesDoc = parser.parseFromString(decoder.decode(notesBytes), 'application/xml');
              const noteShapes = getByLocalName(notesDoc, 'sp');
              for (const nSp of noteShapes) {
                const nNvPr = getFirstDirectChild(nSp, 'nvSpPr');
                const nMeta = nNvPr ? getFirstDirectChild(nNvPr, 'nvPr') : null;
                const nPh = nMeta ? getFirstDirectChild(nMeta, 'ph') : null;
                if (nPh?.getAttribute('type') === 'sldNum') continue;
                const nTx = getFirstDirectChild(nSp, 'txBody');
                if (!nTx) continue;
                extractParagraphs(nTx).forEach(p => notes.push(p.text));
              }
            }
          }

          return {
            number: idx + 1,
            title,
            subtitle,
            blocks,
            tables,
            images,
            notes,
          };
        });

        if (!active) return;
        setSlides(parsedSlides);
      } catch (err) {
        if (!active) return;
        setFallbackReason(
          err instanceof Error
            ? err.message
            : 'PowerPoint presentation decrypted in memory. Download the decrypted file below to view.'
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPptx();

    return () => {
      active = false;
      createdUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [src, filename]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--phantom-muted)]">
        <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--phantom-border)] border-t-[var(--phantom-glow)] animate-spin" />
        <p className="text-sm">Rendering presentation slides...</p>
      </div>
    );
  }

  if (fallbackReason || slides.length === 0) {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--wisp-surface)] text-[var(--wisp-text)]">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-2xl bg-[var(--wisp-elevated)]/60 border border-[var(--wisp-border)] rounded-2xl p-8 sm:p-12 shadow-xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--wisp-glow)]/10 text-[var(--wisp-glow)] flex items-center justify-center mb-2">
              <Presentation className="w-8 h-8" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[var(--wisp-text)] break-all">
              {filename}
            </h3>

            <p className="text-xs text-[var(--wisp-muted)] max-w-md leading-relaxed">
              {fallbackReason || 'PowerPoint presentation decrypted in memory. Download the original decrypted file below.'}
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

  const currentSlide = slides[currentIndex] || slides[0];
  const hasNotes = currentSlide.notes.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-[var(--phantom-bg)] text-[var(--phantom-text)]">
      {/* Slide Controls Bar */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-[var(--phantom-border)] bg-[var(--phantom-surface)]/80 backdrop-blur-sm text-xs shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0">
            Slide {currentSlide.number} / {slides.length}
          </span>
          <span className="hidden sm:inline truncate text-[var(--phantom-muted)] text-[11px]">
            {currentSlide.title || filename}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasNotes && (
            <button
              type="button"
              onClick={() => setShowNotes(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                showNotes
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-[var(--phantom-elevated)] border-[var(--phantom-border)] text-[var(--phantom-muted)] hover:text-[var(--phantom-text)]'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Notes</span>
              {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="w-7 h-7 rounded-lg bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] flex items-center justify-center disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            title="Previous slide"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(i => Math.min(slides.length - 1, i + 1))}
            disabled={currentIndex >= slides.length - 1}
            className="w-7 h-7 rounded-lg bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] border border-[var(--phantom-border)] flex items-center justify-center disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            title="Next slide"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Stage */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 custom-scrollbar flex flex-col items-center">
        <div className="w-full max-w-4xl bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-xl rounded-2xl p-5 sm:p-10 md:p-12 flex flex-col gap-5 min-h-[280px] sm:min-h-[380px] justify-between relative">
          <div className="space-y-4">
            {/* Title & Subtitle */}
            {(currentSlide.title || currentSlide.subtitle) && (
              <div className="border-b border-[var(--phantom-border)] pb-3.5 space-y-1.5">
                {currentSlide.title && (
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--phantom-text)] leading-snug break-words">
                    {currentSlide.title}
                  </h2>
                )}
                {currentSlide.subtitle && (
                  <p className="text-xs sm:text-sm text-[var(--phantom-muted)] whitespace-pre-line leading-relaxed">
                    {currentSlide.subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Text Blocks */}
            {currentSlide.blocks.length > 0 && (
              <div className="space-y-3">
                {currentSlide.blocks.map((block, bIdx) => (
                  <div key={bIdx} className="space-y-1.5">
                    {block.paragraphs.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        style={{ paddingLeft: `${p.level * 16}px` }}
                        className={`text-xs sm:text-sm md:text-[15px] leading-relaxed text-[var(--phantom-text)] break-words flex items-start gap-2 ${
                          p.isBold ? 'font-semibold' : ''
                        }`}
                      >
                        {p.isBullet && (
                          <span className="text-[var(--phantom-glow)] font-bold shrink-0 mt-0.5">•</span>
                        )}
                        <span className="whitespace-pre-line">{p.text}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Tables */}
            {currentSlide.tables.map((table, tIdx) => (
              <div key={tIdx} className="overflow-x-auto rounded-xl border border-[var(--phantom-border)]">
                <table className="w-full border-collapse text-xs sm:text-sm text-left">
                  <tbody>
                    {table.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={rIdx === 0 ? 'bg-[var(--phantom-elevated)] font-semibold' : 'border-t border-[var(--phantom-border)]'}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 border-r last:border-r-0 border-[var(--phantom-border)] min-w-[80px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Embedded Slide Images */}
            {currentSlide.images.length > 0 && (
              <div className={`grid gap-3 pt-1 ${currentSlide.images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {currentSlide.images.map((img, iIdx) => (
                  <div
                    key={iIdx}
                    className="rounded-xl overflow-hidden border border-[var(--phantom-border)] bg-[var(--phantom-elevated)]/40 flex items-center justify-center p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.name}
                      className="max-h-72 w-auto max-w-full object-contain rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Empty slide placeholder */}
            {!currentSlide.title &&
              !currentSlide.subtitle &&
              currentSlide.blocks.length === 0 &&
              currentSlide.tables.length === 0 &&
              currentSlide.images.length === 0 && (
                <div className="py-12 text-center text-xs text-[var(--phantom-muted)] italic">
                  This slide contains visual/vector layout elements with no extractable text or raster images.
                </div>
              )}
          </div>

          <div className="pt-3 border-t border-[var(--phantom-border)]/50 flex items-center justify-between text-[10px] font-mono text-[var(--phantom-muted)]">
            <span className="truncate max-w-[200px] sm:max-w-sm">{filename}</span>
            <span>{currentSlide.number} of {slides.length}</span>
          </div>
        </div>

        {/* Speaker Notes Drawer */}
        {hasNotes && showNotes && (
          <div className="w-full max-w-4xl mt-3 bg-amber-500/5 border border-amber-500/25 rounded-xl p-4 text-xs text-[var(--phantom-text)] space-y-1.5">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              <span>Speaker Notes (Slide {currentSlide.number})</span>
            </div>
            {currentSlide.notes.map((line, idx) => (
              <p key={idx} className="leading-relaxed text-[var(--phantom-muted)] whitespace-pre-line">
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Quick Slide Stepper Dots / Strip */}
        {slides.length > 1 && (
          <div className="w-full max-w-4xl mt-4 flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
            {slides.map((s, idx) => (
              <button
                key={s.number}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border shrink-0 transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'bg-[var(--phantom-glow)] text-white border-[var(--phantom-glow)] shadow-sm'
                    : 'bg-[var(--phantom-surface)] text-[var(--phantom-muted)] border-[var(--phantom-border)] hover:text-[var(--phantom-text)]'
                }`}
              >
                {s.number}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewOnly && (
        <div className="bg-[var(--phantom-danger)]/10 border-t border-[var(--phantom-danger)]/20 p-2 text-center text-[var(--phantom-danger)] text-xs font-medium shrink-0">
          Burn After Reading mode is active.
        </div>
      )}
    </div>
  );
}
