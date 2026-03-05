export interface ReleaseChange {
  de: string;
  en: string;
}

export interface VersionNotes {
  version: string;
  date: string;
  new?: ReleaseChange[];
  improved?: ReleaseChange[];
  fixed?: ReleaseChange[];
}

export const releaseNotes: VersionNotes[] = [
  {
    version: '1.6.0',
    date: '2026-03',
    new: [
      {
        de: 'Geteilte Konten — Konten mit anderen Financer-Nutzern teilen und gemeinsam verwalten (nur Cloud)',
        en: 'Shared Accounts — share and manage accounts together with other Financer users (Cloud only)',
      },
      {
        de: 'Zwei Kontoarten: Gemeinsames Konto (Joint Account) und Ausgaben-Pool (Expense Pool)',
        en: 'Two account types: Joint Account and Expense Pool',
      },
      {
        de: 'Einladungssystem per Link (48 h gültig, einmalig verwendbar)',
        en: 'Invite system via link (valid 48 h, single-use)',
      },
      {
        de: 'Ausgaben aufteilen: Jede Ausgabe wird automatisch anteilig aufgeteilt und als Eigenanteil verbucht',
        en: 'Expense splitting: each expense is automatically split and booked as an own share',
      },
      {
        de: 'Übersicht "Schulde ich" / "Schuldet mir" direkt auf der Geteilte-Konten-Seite',
        en: '"I owe" / "They owe me" overview directly on the Shared Accounts page',
      },
      {
        de: 'Aufschlüsselung: Aufklappbare Quellliste zeigt wie sich jede Schuld zusammensetzt',
        en: 'Breakdown: expandable source list shows how each debt is composed',
      },
      {
        de: 'Schulden begleichen mit automatischer gegenseitiger Verrechnung (Cross-Pool-Netting)',
        en: 'Settle up with automatic mutual netting across all shared accounts',
      },
      {
        de: 'Konto-Details mit Tabs: Alle / Von mir / Von [Name]',
        en: 'Account details with tabs: All / By me / By [Name]',
      },
    ],
    improved: [
      {
        de: 'Kontolöschung: Umbuchungen bleiben auf dem verbleibenden Konto erhalten und werden als Einnahme oder Ausgabe umgewandelt',
        en: 'Account deletion: transfers are preserved on the remaining account and converted to income or expense',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03',
    new: [
      {
        de: 'Zwei-Faktor-Authentifizierung (TOTP) mit Backup-Codes',
        en: 'Two-factor authentication (TOTP) with backup codes',
      },
      {
        de: 'Release Notes Popup bei neuen Versionen',
        en: 'Release notes popup for new versions',
      },
    ],
    improved: [
      {
        de: 'Sicherheit: Passwort-Validierung und Rate-Limiting verbessert',
        en: 'Security: improved password validation and rate limiting',
      },
      {
        de: 'Backup-Codes werden jetzt sicher gehasht gespeichert',
        en: 'Backup codes are now stored securely hashed',
      },
      {
        de: 'Hinweis bei Passwörtern, die die neuen Mindestanforderungen nicht erfüllen',
        en: 'Warning for passwords that do not meet the new minimum requirements',
      },
      {
        de: 'Admin-Panel zeigt E-Mail- und 2FA-Status direkt in der Tenant-Übersicht',
        en: 'Admin panel now shows email and 2FA status directly in the tenant list',
      },
      {
        de: 'Fehlermeldung beim Upgrade-Button wenn die Zahlungsseite nicht geöffnet werden kann',
        en: 'Error message on the upgrade button if the payment page cannot be opened',
      },
    ],
  },
];

export function getNotesForVersion(version: string): VersionNotes | undefined {
  return releaseNotes.find((n) => n.version === version) ?? releaseNotes[0];
}
