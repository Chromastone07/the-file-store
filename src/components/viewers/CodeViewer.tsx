"use client";

import { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-docker';
import { getPrismLanguage } from '@/lib/utils';

interface CodeViewerProps {
  code: string;
  filename: string;
  viewOnly?: boolean;
  src?: string;
}

export default function CodeViewer({ code, filename, viewOnly = false, src }: CodeViewerProps) {
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);
  const language = getPrismLanguage(filename);

  useEffect(() => {
    if (!code && src) {
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
  }, [code, src]);

  const content = code || fetchedContent || '';
  const lines = content.split('\n');

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [content, language]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };


  return (
    <div className="flex flex-col h-full w-full">
      {/* Sub-bar with language badge, lines count, and copy */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)]/60 text-xs text-[var(--wisp-muted)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] text-[var(--wisp-text)]">
            {language}
          </span>
          <span className="font-mono text-[11px]">{lines.length} lines</span>
        </div>
        <button
          onClick={copyCode}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] transition-colors"
        >
          Copy code
        </button>
      </div>

      {/* Code area */}
      <div
        className="flex-1 overflow-auto font-mono text-sm leading-6"
        style={{ background: '#0d1117' }}
      >
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div
            className="select-none text-right px-4 py-4 sticky left-0"
            style={{ color: 'var(--phantom-muted)', background: '#0d1117', minWidth: '3.5rem' }}
            aria-hidden="true"
          >
            {lines.map((_: string, i: number) => (
              <div key={i} className="leading-6 text-xs">{i + 1}</div>
            ))}
          </div>

          {/* Code */}
          <pre className="flex-1 py-4 pr-4 overflow-x-auto m-0" style={{ background: 'transparent' }}>
            <code
              ref={codeRef}
              className={`language-${language}`}
              style={{ background: 'transparent', textShadow: 'none' }}
            >
              {content}
            </code>
          </pre>
        </div>
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
