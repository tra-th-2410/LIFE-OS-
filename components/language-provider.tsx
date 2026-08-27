'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Language } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

const STORAGE_KEY = 'lifeos-language';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateDocument(language: Language): void {
  if (typeof document === 'undefined') return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node): number {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toUpperCase();
        if (['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'MATH', 'ANNOTATION', 'SVG', 'NOSCRIPT'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (
          parent.closest('.chat-markdown') ||
          parent.closest('.katex') ||
          parent.closest('.katex-display') ||
          parent.closest('.katex-html') ||
          parent.closest('[data-no-translate]') ||
          parent.closest('[translate="no"]')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Text);
  }

  nodes.forEach((textNode) => {
    const value = textNode.nodeValue;
    if (!value || typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const translated = translate(trimmed, language);
    if (typeof translated === 'string' && translated && translated !== trimmed) {
      textNode.nodeValue = value.replace(trimmed, translated);
    }
  });

  document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
    if (
      element.closest('.chat-markdown') ||
      element.closest('.katex') ||
      element.closest('.katex-display') ||
      element.closest('[data-no-translate]') ||
      element.closest('[translate="no"]')
    ) {
      return;
    }
    ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value && typeof value === 'string') {
        const translated = translate(value, language);
        if (typeof translated === 'string' && translated && translated !== value) {
          element.setAttribute(attribute, translated);
        }
      }
    });
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') setLanguageState(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language === 'vi' ? 'vi' : 'en';
    window.localStorage.setItem(STORAGE_KEY, language);
    translateDocument(language);
    const observer = new MutationObserver(() => translateDocument(language));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language, ready]);

  const value = useMemo(() => ({ language, setLanguage: (next: Language) => setLanguageState(next), t: (key: string) => translate(key, language) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
