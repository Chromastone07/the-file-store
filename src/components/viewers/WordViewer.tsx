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
        if (isMounted) setError('Failed to parse Word document.');
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
        <p className="text-sm">Parsing document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--phantom-danger)] bg-[var(--phantom-danger)]/5 p-8 rounded-xl m-8 border border-[var(--phantom-danger)]/20">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="font-medium text-lg">{error}</p>
        <p className="text-sm opacity-80">This file might be corrupted or unsupported.</p>
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
