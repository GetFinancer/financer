'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import de, { TranslationKey } from './de';
import en from './en';

export type Locale = 'de' | 'en';

const translations: Record<Locale, Record<TranslationKey, string>> = { de, en };

const localeConfig: Record<Locale, { numberLocale: string; flag: string; label: string }> = {
  de: { numberLocale: 'de-DE', flag: '🇩🇪', label: 'Deutsch' },
  en: { numberLocale: 'en-GB', flag: '🇬🇧', label: 'English' },
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  numberLocale: string;
  locales: typeof localeConfig;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('de');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[locale][key] || translations.de[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  const value: LanguageContextType = {
    locale,
    setLocale,
    t,
    numberLocale: localeConfig[locale].numberLocale,
    locales: localeConfig,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
