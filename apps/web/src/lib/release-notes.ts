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
