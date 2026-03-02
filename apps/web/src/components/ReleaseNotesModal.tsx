'use client';

import { useTranslation } from '@/lib/i18n';
import { getNotesForVersion, type ReleaseChange } from '@/lib/release-notes';

interface ReleaseNotesModalProps {
  version: string;
  onClose: () => void;
}

export function ReleaseNotesModal({ version, onClose }: ReleaseNotesModalProps) {
  const { t, locale } = useTranslation();
  const notes = getNotesForVersion(version);

  function getLabel(item: ReleaseChange): string {
    return locale === 'de' ? item.de : item.en;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-card p-6 shadow-xl animate-page-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
              v{version}
            </span>
            <h3 className="text-lg font-semibold">{t('releaseNotesTitle')}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {notes?.date && (
          <p className="text-xs text-muted-foreground mb-4">{notes.date}</p>
        )}

        {/* Change lists */}
        {notes?.new && notes.new.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t('releaseNotesNew')}
            </h4>
            <ul className="space-y-1">
              {notes.new.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{getLabel(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes?.improved && notes.improved.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t('releaseNotesImproved')}
            </h4>
            <ul className="space-y-1">
              {notes.improved.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{getLabel(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes?.fixed && notes.fixed.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t('releaseNotesFixed')}
            </h4>
            <ul className="space-y-1">
              {notes.fixed.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{getLabel(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t('releaseNotesClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
