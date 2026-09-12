"use client";

import DOMPurify from 'dompurify';

interface DocumentViewerProps {
  content: string;
  filename: string;
  viewOnly?: boolean;
}

export default function DocumentViewer({ content, filename, viewOnly = false }: DocumentViewerProps) {
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

  // Simple markdown to HTML (basic support)
  const renderMarkdown = (text: string): string => {
    const rawHtml = text
      // Headers
      .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.3rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h1>')
      // Bold & Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background:var(--phantom-elevated);padding:0.125rem 0.375rem;border-radius:0.25rem;font-size:0.85em;">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--phantom-accent);text-decoration:underline;">$1</a>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--phantom-border);margin:1.5rem 0;" />')
      // Line breaks
      .replace(/\n/g, '<br />');

    // Sanitize the HTML to prevent XSS
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--phantom-border)', background: 'var(--phantom-surface)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--phantom-accent)' }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="text-sm font-medium truncate max-w-[50%]" style={{ color: 'var(--phantom-text)' }}>
            {filename}
          </span>
          <span className="text-xs" style={{ color: 'var(--phantom-muted)' }}>
            {content.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyContent}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-text)' }}
          >
            Copy
          </button>
          {!viewOnly && (
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(content)}`}
              download={filename}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: 'var(--phantom-glow)', color: '#fff' }}
            >
              Download
            </a>
          )}
        </div>
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
          🔥 View Only — This file will be destroyed after this session
        </div>
      )}
    </div>
  );
}
