"use client";

import { useEffect, useRef } from 'react';
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
}

export default function CodeViewer({ code, filename, viewOnly = false }: CodeViewerProps) {
  const codeRef = useRef<HTMLElement>(null);
  const language = getPrismLanguage(filename);
  const lines = code.split('\n');

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--phantom-border)', background: 'var(--phantom-surface)' }}
      >
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--phantom-accent)' }}>
            <polyline points="16,18 22,12 16,6" />
            <polyline points="8,6 2,12 8,18" />
          </svg>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--phantom-text)' }}>
            {filename}
          </span>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-muted)' }}
          >
            {language}
          </span>
          <span className="text-xs" style={{ color: 'var(--phantom-muted)' }}>
            {lines.length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--phantom-elevated)', color: 'var(--phantom-text)' }}
          >
            Copy
          </button>
          {!viewOnly && (
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(code)}`}
              download={filename}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: 'var(--phantom-glow)', color: '#fff' }}
            >
              Download
            </a>
          )}
        </div>
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
            {lines.map((_, i) => (
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
              {code}
            </code>
          </pre>
        </div>
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
