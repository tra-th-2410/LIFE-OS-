'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function preprocessMarkdown(raw: string | undefined | null): string {
  if (!raw) return '';
  let text = String(raw).trim();
  if (text === 'undefined' || text === 'null') return '';

  // 1. Remove markdown images or links with undefined targets or descriptions
  text = text.replace(/!?\[([^\]]*)\]\(undefined\)/gi, '');
  text = text.replace(/!?\[undefined\]\([^)]*\)/gi, '');
  text = text.replace(/\[undefined\]/gi, '');

  // 2. Remove isolated or standalone literal "undefined" / "null" lines and tokens
  text = text.replace(/(^|\n)\s*(?:undefined|null)\s*(?=\n|$)/gi, '');
  text = text.replace(/(\s+)undefined(?=\s+|$)/gi, '$1');

  // 3. Normalize LaTeX display math: \[ ... \] -> $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`);

  // 4. Normalize LaTeX inline math: \( ... \) -> $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  return text.trim();
}

export function ChatMessageRenderer({ content }: { content?: string | null }) {
  console.log('[ChatMessageRenderer] raw content received:', content);
  const processedContent = preprocessMarkdown(content);
  console.log('[ChatMessageRenderer] processed content to render:', processedContent);

  if (!processedContent) {
    return null;
  }

  return (
    <div className="chat-markdown text-sm leading-relaxed" data-no-translate="true" translate="no">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => {
            if (!href || href === 'undefined' || href === 'null') {
              return <span>{children}</span>;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            if (!src || src === 'undefined' || src === 'null') {
              return null;
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || 'Image'}
                className="max-w-full rounded-lg my-2 border border-border"
                loading="lazy"
              />
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-3 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-3" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse border border-border text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-1.5 bg-muted font-semibold text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1.5">{children}</td>
          ),
          pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
          code: ({ className, children }) => {
            if (className) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match ? match[1].toLowerCase() : '';
              // Safely handle unsupported visualization/diagram blocks
              if (lang === 'visualization' || lang === 'diagram' || lang === 'tikz') {
                return null;
              }
              return (
                <code className={`block rounded bg-muted p-3 text-xs font-mono overflow-x-auto ${className}`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
