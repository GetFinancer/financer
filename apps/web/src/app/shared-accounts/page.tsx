'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import type { SharedAccountInfo } from '@financer/shared';
import SharedAccountModal from '@/components/SharedAccountModal';

export default function SharedAccountsPage() {
  const { t, numberLocale } = useTranslation();
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SharedAccountInfo | null>(null);

  async function loadSharedAccounts() {
    try {
      const data = await api.getSharedAccounts();
      setSharedAccounts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSharedAccounts();
  }, []);

  return (
    <>
      {selected && (
        <SharedAccountModal
          account={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { loadSharedAccounts(); setSelected(null); }}
        />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('sharedAccountsTitle')}</h1>
          <p className="text-muted-foreground">{t('sharedAccountsSubtitle')}</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : sharedAccounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
            <p>{t('sharedAccountsEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedAccounts.map(sa => (
              <div key={sa.uuid} className="glass-card p-6 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {sa.accountName}
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-normal">
                        {t('sharedAccountsShared')}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t('sharedAccountsOwner')}: {sa.isOwner ? t('sharedAccountsYou') : sa.ownerTenant}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('sharedAccountsMembers').replace('{count}', String(sa.members.length))}
                    </p>
                  </div>
                  <span className={`text-xl font-bold ${sa.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCurrency(sa.balance, undefined, numberLocale)}
                  </span>
                </div>

                <button
                  onClick={() => setSelected(sa)}
                  className="w-full py-2 text-sm nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all"
                >
                  {t('sharedAccountsViewDetails')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
