"use client";

import { useEffect, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { getPrismLanguage } from '@/lib/utils';

interface CodeViewerProps {
  code: string;
  filename: string;
  viewOnly?: boolean;
  src?: string;
}

const MAX_HIGHLIGHT_CHARS = 250_000;
let prismLoadPromise: Promise<void> | null = null;

function ensurePrismGrammars(): Promise<void> {
  if (!prismLoadPromise) {
    prismLoadPromise = (async () => {
      if (typeof globalThis !== 'undefined') {
        (globalThis as unknown as { Prism?: typeof Prism }).Prism = Prism;
      }

      // Base grammars must load in strict order before dependents (php -> markup-templating, cpp -> c, jsx -> markup+javascript, etc.)
      await import('prismjs/components/prism-markup');
      await import('prismjs/components/prism-css');
      await import('prismjs/components/prism-clike');
      await import('prismjs/components/prism-markup-templating');
      await import('prismjs/components/prism-javascript');
      await import('prismjs/components/prism-c');
      await import('prismjs/components/prism-java');
      await import('prismjs/components/prism-typescript');
      await import('prismjs/components/prism-jsx');

      await Promise.all([
        import('prismjs/components/prism-tsx'),
        import('prismjs/components/prism-cpp'),
        import('prismjs/components/prism-csharp'),
        import('prismjs/components/prism-go'),
        import('prismjs/components/prism-rust'),
        import('prismjs/components/prism-ruby'),
        import('prismjs/components/prism-php'),
        import('prismjs/components/prism-swift'),
        import('prismjs/components/prism-kotlin'),
        import('prismjs/components/prism-scala'),
        import('prismjs/components/prism-dart'),
        import('prismjs/components/prism-python'),
        import('prismjs/components/prism-sql'),
        import('prismjs/components/prism-bash'),
        import('prismjs/components/prism-json'),
        import('prismjs/components/prism-yaml'),
        import('prismjs/components/prism-scss'),
        import('prismjs/components/prism-less'),
        import('prismjs/components/prism-markdown'),
        import('prismjs/components/prism-docker'),
        import('prismjs/components/prism-toml'),
        import('prismjs/components/prism-ini'),
        import('prismjs/components/prism-diff'),
        import('prismjs/components/prism-makefile'),
        import('prismjs/components/prism-r'),
        import('prismjs/components/prism-lua'),
        import('prismjs/components/prism-perl'),
        import('prismjs/components/prism-graphql'),
      ]);
    })();
  }
  return prismLoadPromise;
}

export default function CodeViewer({ code, filename, viewOnly = false, src }: CodeViewerProps) {
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<{ key: string; html: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
  const contentKey = `${language}:${content.length}:${content.slice(0, 64)}`;

  useEffect(() => {
    if (!content || language === 'text' || content.length > MAX_HIGHLIGHT_CHARS) {
      return;
    }

    let active = true;
    ensurePrismGrammars()
      .then(() => {
        if (!active) return;
        try {
          const fallbackLang = language === 'html' || language === 'xml' ? 'markup' : language;
          const grammar = Prism.languages[language] || Prism.languages[fallbackLang];
          if (!grammar) return;
          const langId = Prism.languages[language] ? language : fallbackLang;
          const html = Prism.highlight(content, grammar, langId);
          setHighlighted({ key: contentKey, html });
        } catch (err) {
          console.warn('Prism highlight fallback:', err);
        }
      })
      .catch((err) => {
        console.warn('Prism grammar load fallback:', err);
      });

    return () => {
      active = false;
    };
  }, [content, language, contentKey]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const activeHtml = highlighted?.key === contentKey ? highlighted.html : null;

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
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] text-[var(--wisp-text)] transition-colors cursor-pointer"
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      {/* Code area */}
      <div
        className="flex-1 overflow-auto font-mono text-sm leading-6"
        style={{ background: '#0d1117', color: '#e6edf3' }}
      >
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div
            className="select-none text-right px-3 sm:px-4 py-4 sticky left-0 shrink-0"
            style={{ color: '#6e7681', background: '#0d1117', minWidth: '3.25rem' }}
            aria-hidden="true"
          >
            {lines.map((_: string, i: number) => (
              <div key={i} className="leading-6 text-xs">{i + 1}</div>
            ))}
          </div>

          {/* Code */}
          <pre
            className="flex-1 py-4 pr-4 overflow-x-auto m-0 leading-6 text-xs sm:text-sm"
            style={{ background: 'transparent', margin: 0, padding: '1rem 1rem 1rem 0' }}
          >
            {activeHtml ? (
              <code
                key="highlighted"
                className={`language-${language} leading-6`}
                style={{ background: 'transparent', color: '#e6edf3', textShadow: 'none', fontSize: 'inherit', lineHeight: 'inherit' }}
                dangerouslySetInnerHTML={{ __html: activeHtml }}
              />
            ) : (
              <code
                key="plain"
                className={`language-${language} leading-6`}
                style={{ background: 'transparent', color: '#e6edf3', textShadow: 'none', fontSize: 'inherit', lineHeight: 'inherit' }}
              >
                {content}
              </code>
            )}
          </pre>
        </div>
      </div>

      {viewOnly && (
        <div
          className="text-center py-2 text-xs font-medium shrink-0"
          style={{ background: 'var(--phantom-danger)', color: '#fff' }}
        >
          Burn After Reading mode is active.
        </div>
      )}
    </div>
  );
}
