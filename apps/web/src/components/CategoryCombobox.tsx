'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Category } from '@financer/shared';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Semantic keyword → common category name fragments (for uncertain suggestions)
export const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  miete: ['wohnen', 'wohn', 'unterkunft', 'housing', 'rent'],
  kaltmiete: ['wohnen', 'wohn', 'unterkunft', 'rent'],
  warmmiete: ['wohnen', 'wohn', 'unterkunft', 'rent'],
  nebenkosten: ['wohnen', 'nebenkosten', 'utilities'],
  strom: ['wohnen', 'energie', 'strom', 'utilities'],
  gas: ['wohnen', 'energie', 'utilities'],
  wasser: ['wohnen', 'nebenkosten', 'utilities'],
  internet: ['internet', 'kommunikation', 'communication'],
  telefon: ['telefon', 'kommunikation', 'communication'],
  handy: ['handy', 'mobile', 'kommunikation'],
  mobilfunk: ['handy', 'mobile', 'kommunikation'],
  versicherung: ['versicherung', 'insurance'],
  krankenkasse: ['gesundheit', 'health', 'versicherung'],
  haftpflicht: ['versicherung', 'insurance'],
  hausrat: ['versicherung', 'insurance'],
  gehalt: ['einkommen', 'einnahmen', 'income', 'salary'],
  lohn: ['einkommen', 'einnahmen', 'income', 'salary'],
  rente: ['einkommen', 'rente', 'income'],
  netflix: ['unterhaltung', 'streaming', 'entertainment', 'abo'],
  spotify: ['musik', 'unterhaltung', 'entertainment', 'abo'],
  disney: ['unterhaltung', 'streaming', 'entertainment'],
  youtube: ['unterhaltung', 'streaming', 'entertainment'],
  adobe: ['software', 'abo', 'abonnement'],
  gym: ['sport', 'fitness', 'gesundheit'],
  fitnessstudio: ['sport', 'fitness', 'gesundheit'],
  rate: ['kredit', 'darlehen', 'loan'],
  kredit: ['kredit', 'darlehen', 'loan'],
};

/** Returns a category whose name semantically matches the description keyword. */
export function findSemanticCategory(desc: string, categories: Category[]): Category | null {
  const keywords = CATEGORY_KEYWORD_MAP[desc.toLowerCase()];
  if (!keywords) return null;
  return categories.find(c =>
    keywords.some(k => c.name.toLowerCase().includes(k) || k.includes(c.name.toLowerCase()))
  ) ?? null;
}

// Bilingual keyword hints — triggers "Create as Recurring" as first suggestion
export const RECURRING_HINTS = new Set([
  // DE
  'miete', 'kaltmiete', 'warmmiete', 'strom', 'gas', 'wasser', 'internet',
  'telefon', 'handy', 'mobilfunk', 'gehalt', 'lohn', 'rente', 'pension',
  'kindergeld', 'versicherung', 'krankenkasse', 'krankenversicherung',
  'haftpflicht', 'hausrat', 'kfz', 'rate', 'kredit', 'darlehen',
  'abo', 'abonnement', 'mitgliedschaft', 'fitnessstudio', 'steuer',
  'rundfunkbeitrag', 'gez',
  // EN
  'rent', 'electricity', 'water', 'phone', 'mobile', 'salary', 'wage',
  'pension', 'insurance', 'loan', 'installment', 'subscription',
  'membership', 'gym', 'tax',
  // Brands (language-neutral)
  'netflix', 'spotify', 'disney', 'amazon', 'prime', 'apple', 'icloud',
  'youtube', 'adobe', 'github', 'dropbox', 'notion', 'slack', 'openai',
  'microsoft', 'google', 'linkedin', 'chatgpt',
]);

interface CategoryComboboxProps {
  value: string; // selected category ID as string, '' for none
  onChange: (value: string) => void;
  categories: Category[]; // already filtered by transaction type
  transactionType: 'income' | 'expense' | 'transfer';
  onCategoryCreated: (category: Category) => void;
}

export function CategoryCombobox({
  value,
  onChange,
  categories,
  transactionType,
  onCategoryCreated,
}: CategoryComboboxProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find((c) => String(c.id) === value);
  const [inputText, setInputText] = useState(selectedCategory?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmRecurring, setConfirmRecurring] = useState(false);

  // Sync display text when value or categories change (e.g. form reset)
  useEffect(() => {
    const cat = categories.find((c) => String(c.id) === value);
    setInputText(cat?.name ?? '');
  }, [value, categories]);

  // Close + restore on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setConfirmRecurring(false);
        const cat = categories.find((c) => String(c.id) === value);
        setInputText(cat?.name ?? '');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [value, categories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(inputText.toLowerCase())
  );

  const trimmed = inputText.trim();
  const hasExactMatch = categories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = trimmed.length > 0 && !hasExactMatch;
  const isRecurringHint = RECURRING_HINTS.has(trimmed.toLowerCase());

  function selectCategory(cat: Category) {
    onChange(String(cat.id));
    setInputText(cat.name);
    setIsOpen(false);
    setConfirmRecurring(false);
  }

  function clearSelection() {
    onChange('');
    setInputText('');
  }

  async function handleCreateCategory() {
    if (!trimmed || transactionType === 'transfer') return;
    setCreating(true);
    try {
      const newCat = await api.createCategory({
        name: trimmed,
        type: transactionType,
      });
      onCategoryCreated(newCat);
      selectCategory(newCat);
    } catch {
      // keep dropdown open so user can retry
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Text input */}
      <div className="relative">
        <input
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            onChange('');
            setIsOpen(true);
            setConfirmRecurring(false);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-8"
          placeholder={t('txNoCategory')}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (filtered.length > 0 || showCreate) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 glass-card rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">

          {/* Existing matches */}
          {filtered.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={() => selectCategory(cat)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5',
                String(cat.id) === value
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-white/5'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              {cat.name}
            </button>
          ))}

          {/* Create options — only when typed text has no exact match */}
          {showCreate && !confirmRecurring && (
            <>
              {filtered.length > 0 && <div className="border-t border-border my-1" />}

              {/* Recurring hint → show first */}
              {isRecurringHint && (
                <button
                  type="button"
                  onMouseDown={() => setConfirmRecurring(true)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2.5 text-secondary"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('createAsRecurring')} „{trimmed}"
                </button>
              )}

              {/* Create category (skip for transfer type) */}
              {transactionType !== 'transfer' && (
                <button
                  type="button"
                  onMouseDown={handleCreateCategory}
                  disabled={creating}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2.5 text-primary disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  {creating ? '…' : `${t('createAsCategory')} „${trimmed}"`}
                </button>
              )}

              {/* Recurring hint — show last if NOT a hint */}
              {!isRecurringHint && (
                <button
                  type="button"
                  onMouseDown={() => setConfirmRecurring(true)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2.5 text-muted-foreground"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('createAsRecurring')} „{trimmed}"
                </button>
              )}
            </>
          )}

          {/* Recurring redirect confirmation */}
          {showCreate && confirmRecurring && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium">{t('confirmRecurringRedirect')}</p>
              <p className="text-xs text-muted-foreground">{t('confirmRecurringNote')}</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onMouseDown={() => setConfirmRecurring(false)}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:bg-white/5 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onMouseDown={() => router.push(`/recurring?name=${encodeURIComponent(trimmed)}&new=1`)}
                  className="flex-1 py-1.5 text-xs rounded-lg nav-item-active hover:opacity-90 transition-all"
                >
                  {t('yes')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
