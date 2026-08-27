'use client';

import type { Language } from '@/lib/i18n';
import { useLanguage } from '@/components/language-provider';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const choose = (next: Language) => setLanguage(next);

  return (
    <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/80 p-0.5 text-xs" role="group" aria-label="Language selector">
      <button type="button" onClick={() => choose('en')} aria-pressed={language === 'en'} className={`rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        English
      </button>
      <span className="px-0.5 text-muted-foreground/50" aria-hidden="true">|</span>
      <button type="button" onClick={() => choose('vi')} aria-pressed={language === 'vi'} className={`rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${language === 'vi' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        Tiếng Việt
      </button>
    </div>
  );
}
