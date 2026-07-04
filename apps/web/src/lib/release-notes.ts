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
    version: '2.0.0',
    date: '2026-07',
    new: [
      {
        de: 'Komplett überarbeitetes Design — Premium Dark-Fintech-Look mit Glassmorphism, Neon-Akzenten und tiefen Schwarz-Navy-Tönen',
        en: 'Fully redesigned UI — premium dark fintech look with glassmorphism, neon accents, and deep black-navy tones',
      },
      {
        de: 'Dashboard-Layout neu: Zwei-Spalten-Grid mit Geplante Buchungen und Letzte Transaktionen nebeneinander',
        en: 'New dashboard layout: two-column grid with Planned Transactions and Recent Transactions side by side',
      },
      {
        de: 'Farbige Glas-Container je Sektion — Amber für Finanzübersicht, Blau für Geplante Buchungen, Lila für Letzte Transaktionen',
        en: 'Colored glass containers per section — amber for Financial Overview, blue for Planned Transactions, purple for Recent Transactions',
      },
      {
        de: 'Avatar-Kreis als Checkbox — Buchstabe des Namens als visuelles Toggle, Klick markiert die Buchung als erledigt',
        en: 'Avatar circle as checkbox — first letter of name as visual toggle, tap marks the booking as done',
      },
      {
        de: 'Globale Suche in der Topbar — durchsucht Transaktionen, Konten und Daueraufträge gleichzeitig',
        en: 'Global search in topbar — searches transactions, accounts, and recurring entries simultaneously',
      },
      {
        de: 'Dark/Light-Umschalter direkt in der Topbar (Desktop) und im Header (Mobil) — kein Umweg mehr über Einstellungen',
        en: 'Dark/Light toggle directly in the topbar (desktop) and header (mobile) — no more detour via settings',
      },
    ],
    improved: [
      {
        de: 'Alle Modals und Dialoge im neuen Premium-Glass-Design mit Gradient-Hintergrund und Shimmer-Effekt',
        en: 'All modals and dialogs in the new premium glass design with gradient background and shimmer effect',
      },
      {
        de: 'Light Mode überarbeitet — blaustichiger Off-White-Hintergrund, weiße Cards mit Elevation-Schatten und subtilen Farbakzenten',
        en: 'Improved light mode — blue-tinted off-white background, white cards with elevation shadows and subtle color accents',
      },
      {
        de: 'Geplante Buchungen: Einzelne Zeilen statt separater Karten — kompaktere Liste mit Dividers',
        en: 'Planned Transactions: individual rows instead of separate cards — more compact list with dividers',
      },
      {
        de: 'KPI-Karten mit Gradient-Hintergrund, Shimmer-Inset und Neon-Hover-Effekt',
        en: 'KPI cards with gradient background, shimmer inset, and neon hover effect',
      },
      {
        de: 'Sidebar mit tiefem Dunkelblau-Gradient und stärkerer visueller Trennung vom Hauptbereich',
        en: 'Sidebar with deep dark-blue gradient and stronger visual separation from the main area',
      },
      {
        de: 'Kategorie-Badge bei Transaktionen auf dem Dashboard sichtbar',
        en: 'Category badge visible on transactions in the dashboard',
      },
      {
        de: 'Eingabefelder in Modals haben eigene Hintergrundfarbe — besser lesbar auf dunklem Untergrund',
        en: 'Input fields in modals have their own background color — easier to read on dark backgrounds',
      },
    ],
  },
  {
    version: '1.6.5',
    date: '2026-03',
    new: [
      {
        de: 'Umbuchungen als Dauerauftrag — wiederkehrende Transfers zwischen Konten anlegen',
        en: 'Transfers as recurring transactions — create recurring transfers between accounts',
      },
      {
        de: 'Mehrfachauswahl in Transaktionen — mehrere Einträge auf einmal markieren und löschen',
        en: 'Multi-select in transactions — select and delete multiple entries at once',
      },
      {
        de: 'Konto selbst löschen — Nutzer können ihr Konto inkl. aller Daten in den Einstellungen löschen (nur Cloud)',
        en: 'Self-service account deletion — users can delete their account and all data in settings (Cloud only)',
      },
    ],
    improved: [
      {
        de: 'Umbuchungen werden überall korrekt blau dargestellt (Dashboard, Transaktionen, Daueraufträge)',
        en: 'Transfers are now consistently shown in blue across Dashboard, Transactions, and Recurring',
      },
      {
        de: 'Betrag eines Dauerauftrags kann für einen einzelnen Monat jetzt auch auf 0 gesetzt werden',
        en: 'Recurring transaction amount for a single month can now be set to 0',
      },
      {
        de: 'Mobile: Seitenüberschriften und Buttons umbrechen korrekt auf kleinen Geräten (iPhone SE)',
        en: 'Mobile: page headers and buttons now wrap correctly on small screens (iPhone SE)',
      },
      {
        de: 'Mobile: Modals scrollen korrekt und der Speichern-Button ist immer sichtbar',
        en: 'Mobile: modals scroll correctly and the save button is always visible',
      },
      {
        de: 'Transaktionsseite lädt zuverlässig auch ohne Cloud-Features (Selfhosted)',
        en: 'Transactions page loads reliably even without Cloud features (self-hosted)',
      },
      {
        de: '/admin ist bei Tenant-Subdomains nicht erreichbar und leitet zur Startseite weiter',
        en: '/admin is no longer accessible on tenant subdomains and redirects to the home page',
      },
    ],
    fixed: [
      {
        de: 'Umbuchungs-Zielkonto fehlte im Transaktions-Modal auf der Transaktionsseite',
        en: 'Transfer target account was missing in the transaction modal on the Transactions page',
      },
      {
        de: 'Release-Notes-Modal war auf Mobilgeräten nicht scrollbar und nicht schließbar',
        en: 'Release notes modal was not scrollable or closable on mobile devices',
      },
    ],
  },
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
