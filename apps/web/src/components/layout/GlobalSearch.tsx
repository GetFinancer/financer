'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { TransactionWithDetails, AccountWithBalance, RecurringTransactionWithDetails } from '@financer/shared';

type SearchResult =
  | { kind: 'transaction'; item: TransactionWithDetails }
  | { kind: 'account'; item: AccountWithBalance }
  | { kind: 'recurring'; item: RecurringTransactionWithDetails };

const ACCOUNT_ROUTE = '/accounts';
const RECURRING_ROUTE = '/recurring';
const TRANSACTION_ROUTE = '/transactions';

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransactionWithDetails[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload accounts and recurring on mount
  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => {});
    api.getRecurringTransactions().then(setRecurring).catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    const lower = q.toLowerCase();

    // Filter accounts and recurring client-side
    const matchedAccounts: SearchResult[] = accounts
      .filter(a => a.name.toLowerCase().includes(lower))
      .slice(0, 3)
      .map(item => ({ kind: 'account', item }));

    const matchedRecurring: SearchResult[] = recurring
      .filter(r => r.name.toLowerCase().includes(lower))
      .slice(0, 3)
      .map(item => ({ kind: 'recurring', item }));

    // Fetch transactions with limit
    let matchedTransactions: SearchResult[] = [];
    try {
      const txs = await api.getTransactions({ limit: 200 });
      matchedTransactions = txs
        .filter(t =>
          (t.description || '').toLowerCase().includes(lower) ||
          (t.categoryName || '').toLowerCase().includes(lower) ||
          (t.accountName || '').toLowerCase().includes(lower)
        )
        .slice(0, 5)
        .map(item => ({ kind: 'transaction', item }));
    } catch {
      // ignore
    }

    setResults([...matchedAccounts, ...matchedRecurring, ...matchedTransactions]);
    setLoading(false);
  }, [accounts, recurring]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery('');
    if (result.kind === 'account') router.push(ACCOUNT_ROUTE);
    else if (result.kind === 'recurring') router.push(RECURRING_ROUTE);
    else router.push(TRANSACTION_ROUTE);
  }

  function formatAmount(amount: number, type: string) {
    const sign = type === 'income' ? '+' : '−';
    return `${sign}${Math.abs(amount).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €`;
  }

  const accounts_ = results.filter(r => r.kind === 'account');
  const recurring_ = results.filter(r => r.kind === 'recurring');
  const transactions_ = results.filter(r => r.kind === 'transaction');

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          onKeyDown={e => e.key === 'Escape' && (setOpen(false), inputRef.current?.blur())}
          placeholder="Suchen…"
          className="w-full pl-9 pr-4 py-2 text-sm bg-background-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 glass-card-elevated overflow-hidden z-50 max-h-80 overflow-y-auto">
          {accounts_.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Konten</p>
              {accounts_.map((r, i) => {
                const a = (r as { kind: 'account'; item: AccountWithBalance }).item;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-background-surface-hover transition-colors text-left"
                  >
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: a.color ? `${a.color}22` : 'hsl(var(--primary)/0.15)', color: a.color || 'hsl(var(--primary))' }}>
                      {a.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{a.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {a.balance.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {recurring_.length > 0 && (
            <div className={accounts_.length > 0 ? 'border-t border-border/50' : ''}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Daueraufträge</p>
              {recurring_.map((r, i) => {
                const rec = (r as { kind: 'recurring'; item: RecurringTransactionWithDetails }).item;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-background-surface-hover transition-colors text-left"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${rec.type === 'income' ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense'}`}>
                      {rec.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{rec.name}</span>
                    <span className={`text-xs font-mono ${rec.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {formatAmount(rec.amount, rec.type)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {transactions_.length > 0 && (
            <div className={(accounts_.length > 0 || recurring_.length > 0) ? 'border-t border-border/50' : ''}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Transaktionen</p>
              {transactions_.map((r, i) => {
                const tx = (r as { kind: 'transaction'; item: TransactionWithDetails }).item;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-background-surface-hover transition-colors text-left"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${tx.type === 'income' ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense'}`}>
                      {(tx.description || tx.categoryName || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.categoryName || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{tx.accountName} · {new Date(tx.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}</p>
                    </div>
                    <span className={`text-xs font-mono flex-shrink-0 ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {formatAmount(tx.amount, tx.type)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Keine Ergebnisse</p>
          )}
        </div>
      )}
    </div>
  );
}
