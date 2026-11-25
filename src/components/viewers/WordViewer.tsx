import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';

interface WordViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
}

export default function WordViewer({ src, filename, viewOnly }: WordViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(15);

  useEffect(() => {
    let isMounted = true;
    
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert docx to html using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        if (!isMounted) return;
        
        if (result.messages && result.messages.length > 0) {
          console.warn('Mammoth warnings:', result.messages);
        }
        
        // Sanitize html output
        const cleanHtml = DOMPurify.sanitize(result.value);
        setHtml(cleanHtml || '<p><em>Document is empty</em></p>');
        
      } catch (err) {
        console.error('Word parse error:', err);
        try {
          const textRes = await fetch(src);
          const rawText = await textRes.text();
          if (rawText && rawText.length > 10 && !rawText.includes('\0\0\0\0')) {
            const cleanText = DOMPurify.sanitize(rawText);
            setHtml(`<pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px;">${cleanText}</pre>`);
            return;
          }
        } catch {
          // Continue to error
        }
        if (isMounted) setError('Preview is optimized for .docx documents. For legacy .doc or protected files, download to view.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadDocument();
    
    return () => { isMounted = false; };
  }, [src]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--phantom-muted)]">
        <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--phantom-border)] border-t-[var(--phantom-glow)] animate-spin"></div>
        <p className="text-sm">Rendering document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--phantom-text)] p-6 sm:p-8 rounded-xl m-4 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <p className="font-semibold text-sm text-[var(--phantom-text)]">{error}</p>
        <p className="text-xs text-[var(--phantom-muted)]">This document format is decrypted in memory and ready to open locally.</p>
        {!viewOnly && (
          <a
            href={src}
            download={filename}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--phantom-glow)] hover:bg-[var(--phantom-accent)] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            Download {filename}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--phantom-bg)] text-[var(--phantom-text)]">
      {/* Sub-bar with document reading controls */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-b border-[var(--phantom-border)] bg-[var(--phantom-surface)]/80 backdrop-blur-sm text-xs text-[var(--phantom-muted)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[var(--phantom-text)] truncate max-w-[160px] sm:max-w-xs">{filename}</span>
          <span className="hidden sm:inline-block opacity-40">•</span>
          <span className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--phantom-elevated)] border border-[var(--phantom-border)] uppercase">Docx</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          <span>{fontSize}px</span>
          <button
            onClick={() => setFontSize(prev => Math.max(13, prev - 1))}
            className="w-6 h-6 rounded flex items-center justify-center bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] text-[var(--phantom-text)] transition-colors cursor-pointer font-bold"
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize(prev => Math.min(22, prev + 1))}
            className="w-6 h-6 rounded flex items-center justify-center bg-[var(--phantom-elevated)] hover:bg-[var(--phantom-border)] text-[var(--phantom-text)] transition-colors cursor-pointer font-bold"
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Main Document Scroll Area */}
      <div className="flex-1 overflow-auto p-2 sm:p-6 md:p-8 custom-scrollbar">
        <div 
          className="w-full max-w-3xl mx-auto bg-[var(--phantom-surface)] border border-[var(--phantom-border)] shadow-xl rounded-xl sm:rounded-2xl p-4 sm:p-10 md:p-14 mb-8 phantom-word-wrapper"
          style={{ fontSize: `${fontSize}px` }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            .phantom-word-wrapper {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Charter", "Georgia", serif;
              line-height: 1.75;
              color: var(--phantom-text);
              word-break: break-word;
              overflow-wrap: anywhere;
            }
            .phantom-word-wrapper p { 
              margin-bottom: 1.2em; 
            }
            .phantom-word-wrapper h1 { 
              font-size: 1.6em; 
              margin-top: 1.4em; 
              margin-bottom: 0.6em; 
              font-weight: 700; 
              color: var(--phantom-text);
              line-height: 1.3;
            }
            .phantom-word-wrapper h2 { 
              font-size: 1.3em; 
              margin-top: 1.2em; 
              margin-bottom: 0.5em; 
              font-weight: 700; 
              color: var(--phantom-text);
              line-height: 1.35;
            }
            .phantom-word-wrapper h3 { 
              font-size: 1.15em; 
              margin-top: 1em; 
              margin-bottom: 0.4em; 
              font-weight: 600; 
              color: var(--phantom-text);
            }
            .phantom-word-wrapper table { 
              display: block; 
              width: 100%; 
              max-width: 100%;
              overflow-x: auto; 
              -webkit-overflow-scrolling: touch;
              border-collapse: collapse; 
              margin: 1.25em 0; 
              font-size: 0.9em;
            }
            .phantom-word-wrapper th, .phantom-word-wrapper td { 
              border: 1px solid var(--phantom-border); 
              padding: 8px 12px; 
              min-width: 90px;
              text-align: left;
            }
            .phantom-word-wrapper th {
              background: var(--phantom-elevated);
              font-weight: 600;
            }
            .phantom-word-wrapper tr:nth-child(even) td {
              background: var(--phantom-elevated);
            }
            .phantom-word-wrapper ul { 
              list-style-type: disc; 
              padding-left: 1.5em; 
              margin-bottom: 1.2em; 
            }
            .phantom-word-wrapper ol { 
              list-style-type: decimal; 
              padding-left: 1.5em; 
              margin-bottom: 1.2em; 
            }
            .phantom-word-wrapper li {
              margin-bottom: 0.4em;
            }
            .phantom-word-wrapper img { 
              max-width: 100%; 
              height: auto; 
              border-radius: 8px;
              margin: 1em auto;
              display: block;
            }
            .phantom-word-wrapper blockquote {
              border-left: 3px solid var(--phantom-glow, #6366f1);
              padding-left: 1rem;
              margin: 1.2em 0;
              font-style: italic;
              color: var(--phantom-muted);
            }
          `}} />
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      
      {viewOnly && (
        <div className="bg-[var(--phantom-danger)]/10 border-t border-[var(--phantom-danger)]/20 p-2 text-center text-[var(--phantom-danger)] text-xs font-medium shrink-0">
          Burn After Reading mode is active.
        </div>
      )}
    </div>
  );
}
