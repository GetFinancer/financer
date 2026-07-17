'use client';

import { useState } from 'react';
import { isNative } from '@/lib/native';
import { scanReceipt } from '@/lib/native/scanner';
import { parseReceiptText, type ParsedReceipt } from '@/lib/receipt-parser';
import { useTranslation } from '@/lib/i18n';

interface ScanReceiptButtonProps {
  onResult: (parsed: ParsedReceipt) => void;
}

export function ScanReceiptButton({ onResult }: ScanReceiptButtonProps) {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  if (!isNative()) return null;

  async function handleScan() {
    setError('');
    setScanning(true);
    try {
      const text = await scanReceipt();
      if (!text) {
        setError(t('scanReceiptNoText'));
        return;
      }
      onResult(parseReceiptText(text));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleScan}
        disabled={scanning}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] border border-dashed border-white/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-white/35 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {scanning ? t('scanReceiptScanning') : t('scanReceiptButton')}
      </button>

      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
    </div>
  );
}
