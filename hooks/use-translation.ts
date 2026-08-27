'use client';

import { useLanguage } from '@/components/language-provider';

export function useTranslation() {
  return useLanguage();
}
