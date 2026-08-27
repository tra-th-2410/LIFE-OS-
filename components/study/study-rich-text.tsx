'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function preprocessContent(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw).trim();
  if (text === 'undefined' || text === 'null') return '';

  // Normalize display math: \[ ... \] -> $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`);

  // Normalize inline math: \( ... \) -> $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  return text;
}

interface StudyRichTextProps {
  content?: string | null;
  className?: string;
  inline?: boolean;
}

export function StudyRichText({ content, className = '', inline = false }: StudyRichTextProps) {
  const processed = preprocessContent(content);

  if (!processed) {
    return null;
  }

  return (
    <div
      className={`study-rich-text ${inline ? 'inline-block' : 'block'} text-foreground leading-relaxed ${className}`}
      data-no-translate="true"
      translate="no"
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
        components={{
          p: ({ children }) => (inline ? <span>{children}</span> : <p className="my-1.5 leading-relaxed">{children}</p>),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ className, children }) => (
            <code className={`rounded bg-muted px-1.5 py-0.5 text-xs font-mono ${className || ''}`}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono">
              {children}
            </pre>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
