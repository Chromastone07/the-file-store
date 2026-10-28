"use client";

import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface DocumentViewerProps {
  content: string;
  filename: string;
  viewOnly?: boolean;
  src?: string;
}

export default function DocumentViewer({ content: initialContent, filename, viewOnly = false, src }: DocumentViewerProps) {
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);

  useEffect(() => {
    if (!initialContent && src) {
      let active = true;
      fetch(src)
        .then(res => res.text())
        .then(text => {
          if (active) setFetchedContent(text);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [initialContent, src]);

  const content = initialContent || fetchedContent || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const isCSV = ext === 'csv';
  const isMarkdown = ext === 'md';

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      /* silent fail */
    }
  };



  // Parse CSV into rows/columns
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(current.trim());
        if (row.some(cell => cell.length > 0)) rows.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
    if (current || row.length > 0) {
      row.push(current.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
    }
    return rows;
  };

  // Simple markdown to HTML with strict sanitization
  const renderMarkdown = (text: string): string => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const formatted = escaped
      // Headers
      .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.3rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h1>')
      // Bold & Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background:var(--phantom-elevated);padding:0.125rem 0.375rem;border-radius:0.25rem;font-size:0.85em;">$1</code>')
      // Safe Links (http/https only)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--phantom-accent);text-decoration:underline;">$1</a>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--phantom-border);margin:1.5rem 0;" />')
      // Line breaks
      .replace(/\n/g, '<br />');

    // Double-sanitize with DOMPurify if in browser
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(formatted);
    }
    return formatted;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Sub-bar with lines count and copy */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)]/60 text-xs text-[var(--wisp-muted)] shrink-0">
        <span className="font-mono text-[11px]">{content.split('\n').length} lines</span>
        <button
          onClick={copyContent}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] transition-colors"
        >
          Copy text
        </button>
      </div>

      {/* Content area */}
      <div
        className="flex-1 overflow-auto p-6"
        style={{ background: 'var(--phantom-bg)' }}
      >
        {isCSV ? (
          /* CSV Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {(() => {
                const rows = parseCSV(content);
                const header = rows[0];
                const body = rows.slice(1);
                return (
                  <>
                    {header && (
                      <thead>
                        <tr>
                          {header.map((cell, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider border-b"
                              style={{
                                borderColor: 'var(--phantom-border)',
                                color: 'var(--phantom-accent)',
                                background: 'var(--phantom-surface)',
                              }}
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {body.map((row, i) => (
                        <tr
                          key={i}
                          className="transition-colors"
                          style={{ background: i % 2 === 0 ? 'transparent' : 'var(--phantom-surface)' }}
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="px-3 py-2 border-b"
                              style={{ borderColor: 'var(--phantom-border)', color: 'var(--phantom-text)' }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </>
                );
              })()}
            </table>
          </div>
        ) : isMarkdown ? (
          /* Markdown rendered view */
          <div
            className="prose prose-invert max-w-none leading-relaxed"
            style={{ color: 'var(--phantom-text)' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          /* Plain text */
          <pre
            className="whitespace-pre-wrap font-mono text-sm leading-6"
            style={{ color: 'var(--phantom-text)' }}
          >
            {content}
          </pre>
        )}
      </div>

      {viewOnly && (
        <div
          className="text-center py-2 text-xs font-medium"
          style={{ background: 'var(--phantom-danger)', color: '#fff' }}
        >
          🔥 View Only - This file will be destroyed after this session
        </div>
      )}
    </div>
  );
}
