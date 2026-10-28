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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--wisp-muted)]">
        <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--wisp-border)] border-t-[var(--wisp-glow)] animate-spin"></div>
        <p className="text-sm">Parsing document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--wisp-text)] p-8 rounded-xl m-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <p className="font-semibold text-sm text-[var(--wisp-text)]">{error}</p>
        <p className="text-xs text-[var(--wisp-muted)]">This document format is decrypted in memory and ready to open locally.</p>
        {!viewOnly && (
          <a
            href={src}
            download={filename}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--wisp-glow)] hover:bg-[var(--wisp-accent)] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            Download {filename}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6]">
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-[816px] min-h-[1056px] mx-auto bg-white shadow-md border border-gray-200 p-8 md:p-16 mb-8 phantom-word-wrapper">
          <style dangerouslySetInnerHTML={{__html: `
            .phantom-word-wrapper {
              font-family: "Times New Roman", Times, serif;
              font-size: 16px;
              line-height: 1.6;
              color: #000;
            }
            .phantom-word-wrapper p { margin-bottom: 1em; }
            .phantom-word-wrapper h1 { font-size: 2em; margin-bottom: 0.5em; font-weight: bold; }
            .phantom-word-wrapper h2 { font-size: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
            .phantom-word-wrapper h3 { font-size: 1.17em; margin-bottom: 0.5em; font-weight: bold; }
            .phantom-word-wrapper table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
            .phantom-word-wrapper th, .phantom-word-wrapper td { border: 1px solid #000; padding: 4px; }
            .phantom-word-wrapper ul { list-style-type: disc; margin-left: 2em; margin-bottom: 1em; }
            .phantom-word-wrapper ol { list-style-type: decimal; margin-left: 2em; margin-bottom: 1em; }
            .phantom-word-wrapper img { max-width: 100%; height: auto; }
          `}} />
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      
      {viewOnly && (
        <div className="bg-[var(--phantom-danger)]/10 border-t border-[var(--phantom-danger)]/20 p-2 text-center text-[var(--phantom-danger)] text-xs font-medium">
          Burn After Reading mode is active.
        </div>
      )}
    </div>
  );
}
