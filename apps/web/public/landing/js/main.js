/* ============================================
   Financer Landing Page — Main JS
   Theme toggle, Language switch, Scroll animations,
   FAQ accordion
   ============================================ */

/* --- i18n Dictionary --- */
const translations = {
  de: {
    // Nav
    'nav.features': 'Features',
    'nav.demo': 'Demo',
    'nav.pricing': 'Preise',
    'nav.selfhost': 'Self-Hosting',
    'nav.impressum': 'Impressum',
    'nav.privacy': 'Datenschutz',

    // Hero
    'hero.badge': 'Personal Finance Planning Tool',
    'hero.title': 'Wisse heute, was am Monatsende \u00fcbrig bleibt',
    'hero.subtitle': 'Plane deine Einnahmen und Ausgaben. Behalte die volle Kontrolle \u00fcber dein Budget \u2014 in Echtzeit, ohne komplexe Software.',
    'hero.cta': '14 Tage kostenlos testen',
    'hero.demo': 'Demo ansehen',

    // Mock Dashboard
    'mock.balance': 'Verf\u00fcgbar',
    'mock.income': 'Einnahmen',
    'mock.expenses': 'Ausgaben',

    // Problem
    'problem.title': 'Kommt dir das bekannt vor?',
    'problem.1.title': 'Kein \u00dcberblick',
    'problem.1.desc': 'Am Monatsende fragst du dich, wo das Geld geblieben ist \u2014 jedes Mal aufs Neue.',
    'problem.2.title': 'Excel-Chaos',
    'problem.2.desc': 'Tabellen, die nach zwei Wochen veraltet sind und niemand mehr pflegt.',
    'problem.3.title': 'B\u00f6se \u00dcberraschungen',
    'problem.3.desc': 'Vergessene Abos, unerwartete Abbuchungen \u2014 und pl\u00f6tzlich ist das Konto im Minus.',
    'problem.4.title': 'Zu komplex',
    'problem.4.desc': 'Buchhaltungssoftware, die f\u00fcr den Alltag viel zu \u00fcberladen und kompliziert ist.',

    // Features
    'features.label': 'Features',
    'features.title': 'Alles, was du f\u00fcr deine Finanzplanung brauchst',
    'features.subtitle': 'Fokussiert auf das Wesentliche. Kein Ballast, kein Schnickschnack.',

    'feature.forecast.title': 'Monatsend-Prognose',
    'feature.forecast.desc': 'Sieh sofort, wie viel am Monatsende \u00fcbrig bleibt. Geplante Einnahmen und Ausgaben werden in Echtzeit berechnet.',
    'feature.dashboard.title': '\u00dcbersichtliches Dashboard',
    'feature.dashboard.desc': 'Gesamtsaldo, monatliche Einnahmen & Ausgaben auf einen Blick. Alle wichtigen Kennzahlen sofort sichtbar.',
    'feature.accounts.title': 'Multi-Konto Verwaltung',
    'feature.accounts.desc': 'Bankkonten, Bargeld, Kreditkarten und Sparkonten \u2014 alles an einem Ort verwaltet.',
    'feature.recurring.title': 'Wiederkehrende Buchungen',
    'feature.recurring.desc': 'Miete, Gehalt, Abos \u2014 einmal einrichten, automatisch ber\u00fccksichtigt. Einzelne Buchungen jederzeit anpassen.',
    'feature.analytics.title': 'Echtzeit-Auswertungen',
    'feature.analytics.desc': 'Interaktive Diagramme zeigen, wohin dein Geld flie\u00dft. Nach Kategorie oder Zeitraum filtern.',
    'feature.security.title': 'Sicher & Privat',
    'feature.security.desc': 'Passwortschutz mit optionaler Zwei-Faktor-Authentifizierung. Deine Daten geh\u00f6ren nur dir.',

    // Demo
    'demo.label': 'Live Demo',
    'demo.title': 'Erlebe Financer in Aktion',
    'demo.subtitle': 'Teste die vollst\u00e4ndige App direkt im Browser \u2014 ohne Registrierung.',
    'demo.button': 'Live Demo testen',
    'demo.credentials': 'Passwort: <strong>demo234</strong> \u2014 Keine Registrierung n\u00f6tig',

    // Demo Mock
    'mock.nav.dashboard': 'Dashboard',
    'mock.nav.accounts': 'Konten',
    'mock.nav.transactions': 'Buchungen',
    'mock.nav.recurring': 'Dauerauftr\u00e4ge',
    'mock.nav.analytics': 'Auswertungen',
    'mock.greeting': 'Hallo, Demo-User',
    'mock.month': 'Februar 2026',
    'mock.totalBalance': 'Gesamtsaldo',
    'mock.monthIncome': 'Einnahmen (Monat)',
    'mock.monthExpense': 'Ausgaben (Monat)',
    'mock.remaining': 'Verf\u00fcgbar',
    'mock.chartTitle': 'Ausgaben nach Kategorie',
    'mock.cat.rent': 'Miete',
    'mock.cat.food': 'Lebensmittel',
    'mock.cat.insurance': 'Versicherung',
    'mock.cat.transport': 'Transport',
    'mock.cat.subs': 'Abos',

    // USPs
    'usps.label': 'Warum Financer',
    'usps.title': 'Dein Vorteil auf einen Blick',
    'usp.forecast.title': 'Forecasting Fokus',
    'usp.forecast.desc': 'Plane voraus statt nur r\u00fcckblickend zu analysieren. Wisse heute, was am Monatsende \u00fcbrig bleibt.',
    'usp.clarity.title': 'Maximale Klarheit',
    'usp.clarity.desc': 'Kein Funktionsballast, keine versteckten Men\u00fcs. Nur das, was du wirklich brauchst \u2014 auf einen Blick.',
    'usp.control.title': 'Volle Datenkontrolle',
    'usp.control.desc': 'Cloud in der EU oder Self-Hosting auf deinem eigenen Server. Du entscheidest, wo deine Daten liegen.',
    'usp.opensource.title': 'Open Source Transparenz',
    'usp.opensource.desc': 'MIT-Lizenz. Jeder kann den Code einsehen, pr\u00fcfen und selbst betreiben. Keine Black Box.',

    // Compare
    'compare.label': 'Deployment',
    'compare.title': 'Cloud oder Self-Hosting?',
    'compare.subtitle': 'Beide Optionen. Deine Wahl. Volle Kontrolle.',
    'compare.recommended': 'Empfohlen',
    'compare.cloud': 'Cloud',
    'compare.selfhosted': 'Self-Hosted',
    'compare.row.setup': 'Setup',
    'compare.row.updates': 'Updates',
    'compare.row.backup': 'Backup',
    'compare.row.support': 'Support',
    'compare.row.data': 'Datenspeicherung',
    'compare.row.price': 'Preis',
    'compare.cloud.setup': 'Sofort startklar',
    'compare.cloud.updates': 'Automatisch',
    'compare.cloud.backup': 'Inklusive',
    'compare.cloud.support': 'Inklusive',
    'compare.cloud.data': 'EU-Server',
    'compare.cloud.price': 'ab 4,99\u20ac/Monat',
    'compare.self.setup': 'Docker erforderlich',
    'compare.self.updates': 'Manuell',
    'compare.self.backup': 'Eigenverantwortung',
    'compare.self.support': 'Community',
    'compare.self.data': 'Dein Server',
    'compare.self.price': 'Kostenlos (MIT)',
    'compare.note': 'Die Self-Hosted Version steht unter der <strong>MIT-Lizenz</strong> \u2014 du kannst den Code frei nutzen, ver\u00e4ndern und verteilen. Kein technisches Wissen? Die Cloud-Version macht es dir einfach.',

    // Pricing
    'pricing.label': 'Preise',
    'pricing.title': 'Einfach. Transparent. Fair.',
    'pricing.self.name': 'Self-Hosted',
    'pricing.self.price': 'Kostenlos',
    'pricing.self.desc': 'MIT-Lizenz. F\u00fcr immer kostenlos.',
    'pricing.self.f1': 'Alle Features inklusive',
    'pricing.self.f2': 'Volle Datenkontrolle',
    'pricing.self.f3': 'Docker Deployment',
    'pricing.self.f4': 'Community Support',
    'pricing.self.f5': 'Unbegrenzte Konten',
    'pricing.self.cta': 'Auf GitHub ansehen',
    'pricing.cloud.popular': 'Beliebt',
    'pricing.cloud.name': 'Cloud',
    'pricing.cloud.period': '/ Monat',
    'pricing.cloud.desc': 'Sofort starten. Wir k\u00fcmmern uns um den Rest.',
    'pricing.cloud.f1': 'Alle Features inklusive',
    'pricing.cloud.f2': 'Automatische Updates',
    'pricing.cloud.f3': 'T\u00e4gliche Backups',
    'pricing.cloud.f4': 'EU-Server (DSGVO)',
    'pricing.cloud.f5': 'Pers\u00f6nlicher Support',
    'pricing.cloud.cta': '14 Tage kostenlos testen',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'H\u00e4ufig gestellte Fragen',
    'faq.q1': 'Sind meine Finanzdaten sicher?',
    'faq.a1': 'Ja. Die Cloud-Version l\u00e4uft auf EU-Servern mit verschl\u00fcsselter Verbindung (HTTPS), Passwort-Hashing (bcrypt) und optionaler Zwei-Faktor-Authentifizierung. Wir verkaufen oder teilen keine Daten. Bei Self-Hosting hast du die volle Kontrolle \u00fcber deine Daten.',
    'faq.q2': 'Kann ich jederzeit k\u00fcndigen?',
    'faq.a2': 'Ja, du kannst die Cloud-Version jederzeit k\u00fcndigen. Es gibt keine Mindestlaufzeit und keine versteckten Kosten. Deine Daten k\u00f6nnen jederzeit exportiert oder gel\u00f6scht werden.',
    'faq.q3': 'Was bedeutet die MIT-Lizenz?',
    'faq.a3': 'Die MIT-Lizenz ist eine der freiz\u00fcgigsten Open-Source-Lizenzen. Du darfst den Code kostenlos nutzen, ver\u00e4ndern, verteilen und sogar kommerziell einsetzen. Der vollst\u00e4ndige Quellcode ist auf GitHub einsehbar.',
    'faq.q4': 'Brauche ich technisches Wissen f\u00fcr Self-Hosting?',
    'faq.a4': 'Grundkenntnisse mit Docker und einem Linux-Server sind empfehlenswert. Die Dokumentation f\u00fchrt dich Schritt f\u00fcr Schritt durch die Installation. Wenn du kein technisches Wissen hast, ist die Cloud-Version die einfachste Option.',

    // CTA
    'cta.title': '\u00dcbernimm die Kontrolle \u00fcber deine Finanzen',
    'cta.subtitle': 'Starte jetzt und wisse immer, was am Monatsende \u00fcbrig bleibt.',
    'cta.button': '14 Tage kostenlos testen',
    'cta.github': 'Auf GitHub ansehen',
    'cta.trust': '14 Tage kostenlos. Keine Kreditkarte n\u00f6tig.',

    // Footer
    'footer.product': 'Produkt',
    'footer.resources': 'Ressourcen',
    'footer.legal': 'Rechtliches',
    'footer.docs': 'Dokumentation',
    'footer.feedback': 'Feedback',
    'footer.github': 'GitHub',
    'footer.impressum': 'Impressum',
    'footer.privacy': 'Datenschutz',
    'footer.made': 'Made in Wien',

    // Impressum
    'imprint.title': 'Impressum',
    'imprint.subtitle': 'Angaben gem\u00e4\u00df \u00a7 5 ECG, \u00a7 14 UGB, \u00a7 25 MedienG',
    'imprint.company.heading': 'Unternehmen',
    'imprint.company.label': 'Unternehmen',
    'imprint.company.owner': 'Inhaber',
    'imprint.company.address': 'Adresse',
    'imprint.company.email': 'E-Mail',
    'imprint.company.phone': 'Telefon',
    'imprint.reg.heading': 'Registrierung',
    'imprint.reg.court': 'Firmenbuchgericht',
    'imprint.activity.heading': 'Unternehmensgegenstand',
    'imprint.activity.desc': 'Dienstleistungen in der automatischen Datenverarbeitung und Informationstechnik',
    'imprint.authority.heading': 'Aufsichtsbeh\u00f6rde',
    'imprint.authority.desc': 'Magistratisches Bezirksamt des XXIII. Bezirkes',
    'imprint.law.heading': 'Anwendbares Recht',
    'imprint.law.desc': 'Gewerbeordnung: <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener">www.ris.bka.gv.at</a>',
    'imprint.dispute.heading': 'Streitschlichtung',
    'imprint.dispute.desc': 'Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Die Europ\u00e4ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr/</a>',
    'imprint.liability.heading': 'Haftung f\u00fcr Inhalte',
    'imprint.liability.desc': 'Die Inhalte unserer Seiten wurden mit gr\u00f6\u00dfter Sorgfalt erstellt. F\u00fcr die Richtigkeit, Vollst\u00e4ndigkeit und Aktualit\u00e4t der Inhalte k\u00f6nnen wir jedoch keine Gew\u00e4hr \u00fcbernehmen. Als Diensteanbieter sind wir gem\u00e4\u00df den allgemeinen Gesetzen f\u00fcr eigene Inhalte auf diesen Seiten verantwortlich. Wir sind jedoch nicht verpflichtet, \u00fcbermittelte oder gespeicherte Informationen Dritter zu \u00fcberwachen oder nach Umst\u00e4nden zu forschen, die auf eine rechtswidrige T\u00e4tigkeit hinweisen.',
    'imprint.copyright.heading': 'Urheberrecht',
    'imprint.copyright.desc': 'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem \u00f6sterreichischen Urheberrecht. Die Vervielf\u00e4ltigung, Bearbeitung, Verbreitung und jede Art der Verwertung au\u00dferhalb der Grenzen des Urheberrechts bed\u00fcrfen der vorherigen schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.',

    // Datenschutz
    'privacy.title': 'Datenschutzerkl\u00e4rung',
    'privacy.updated': 'Letzte Aktualisierung: Februar 2026',
    'privacy.responsible.heading': '1. Verantwortlicher',
    'privacy.responsible.desc': 'Roland R\u00f6tzer e.U.<br>Ing. Roland R\u00f6tzer<br>Breitenfurterstra\u00dfe 376, 1230 Wien, \u00d6sterreich<br>E-Mail: <a href="mailto:roland.roetzer@itwt.at">roland.roetzer@itwt.at</a><br>Telefon: <a href="tel:+436763954894">+43 676 3954894</a>',
    'privacy.overview.heading': '2. \u00dcberblick',
    'privacy.overview.desc': 'Diese Datenschutzerkl\u00e4rung gilt f\u00fcr die Website getfinancer.com und die Financer-Anwendung. Der Schutz Ihrer pers\u00f6nlichen Daten ist uns wichtig. Wir verarbeiten Ihre Daten ausschlie\u00dflich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG 2003).',
    'privacy.cloud.heading': '3. Cloud-gehostete Version',
    'privacy.cloud.desc': 'Bei Nutzung der cloud-gehosteten Version von Financer auf getfinancer.com k\u00f6nnen folgende Daten verarbeitet werden:',
    'privacy.cloud.account': '<strong>Kontodaten:</strong> Ein Passwort (gespeichert als bcrypt-Hash) ist erforderlich, um auf Ihre Instanz zuzugreifen. Bei der Registrierung werden keine E-Mail-Adressen oder pers\u00f6nlichen Identifikationsdaten erhoben.',
    'privacy.cloud.financial': '<strong>Finanzdaten:</strong> Alle Transaktionsdaten, Kontonamen, Kategorien und sonstigen Finanzinformationen, die Sie eingeben, werden auf unseren Servern gespeichert. Diese Daten sind nur f\u00fcr Sie \u00fcber Ihre authentifizierte Sitzung zug\u00e4nglich.',
    'privacy.cloud.logs': '<strong>Server-Logs:</strong> Aus Sicherheits- und Betriebsgr\u00fcnden k\u00f6nnen unsere Server vor\u00fcbergehend IP-Adressen, Zugriffszeiten und User-Agents protokollieren. Diese Logs werden nach 14 Tagen automatisch gel\u00f6scht.',
    'privacy.cloud.session': '<strong>Sitzungsdaten:</strong> Ein Sitzungs-Cookie wird verwendet, um Ihren Anmeldestatus aufrechtzuerhalten. Dies ist ein funktionales Cookie, das f\u00fcr den Betrieb der Anwendung erforderlich ist.',
    'privacy.selfhost.heading': '4. Selbst gehostete Version',
    'privacy.selfhost.desc': 'Wenn Sie Financer auf Ihrer eigenen Infrastruktur selbst hosten, verbleiben alle Daten ausschlie\u00dflich auf Ihrem Server. Wir haben keinen Zugriff auf Daten in selbst gehosteten Instanzen. Sie sind allein f\u00fcr den Datenschutz in Ihrer selbst gehosteten Umgebung verantwortlich.',
    'privacy.website.heading': '5. Diese Website (Landingpage)',
    'privacy.website.desc': 'Diese Landingpage (getfinancer.com Informationsseiten) verwendet keine Cookies, Tracking-Skripte oder Analyse-Tools. Beim blo\u00dfen Besuch dieser Website werden keine personenbezogenen Daten erhoben. Ihre Design- und Spracheinstellungen werden ausschlie\u00dflich im lokalen Speicher Ihres Browsers gespeichert und nie an unsere Server \u00fcbermittelt.',
    'privacy.storage.heading': '6. Datenspeicherung & Sicherheit',
    'privacy.storage.desc': 'Ihre Daten werden auf Servern in der Europ\u00e4ischen Union gespeichert. Wir setzen geeignete technische und organisatorische Ma\u00dfnahmen zum Schutz Ihrer Daten um, darunter:',
    'privacy.storage.https': 'Verschl\u00fcsselte Verbindungen (HTTPS/TLS)',
    'privacy.storage.bcrypt': 'Passwort-Hashing mit bcrypt',
    'privacy.storage.2fa': 'Optionale Zwei-Faktor-Authentifizierung (2FA)',
    'privacy.storage.rate': 'Rate-Limiting zum Schutz vor Brute-Force-Angriffen',
    'privacy.storage.headers': 'Sicherheits-Header (via Helmet.js)',
    'privacy.sharing.heading': '7. Datenweitergabe',
    'privacy.sharing.desc': 'Wir verkaufen, handeln oder teilen Ihre personenbezogenen Daten nicht mit Dritten. Ihre Finanzdaten werden niemals eingesehen, analysiert oder f\u00fcr andere Zwecke als die Bereitstellung des Financer-Dienstes f\u00fcr Sie verwendet.',
    'privacy.rights.heading': '8. Ihre Rechte (DSGVO)',
    'privacy.rights.desc': 'Sie haben folgende Rechte bez\u00fcglich Ihrer personenbezogenen Daten:',
    'privacy.rights.access': '<strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Sie k\u00f6nnen Auskunft dar\u00fcber verlangen, welche Daten wir \u00fcber Sie gespeichert haben.',
    'privacy.rights.rectification': '<strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Sie k\u00f6nnen die Berichtigung unrichtiger Daten verlangen.',
    'privacy.rights.erasure': '<strong>Recht auf L\u00f6schung (Art. 17 DSGVO):</strong> Sie k\u00f6nnen die L\u00f6schung Ihrer Daten verlangen. In der Cloud-Version k\u00f6nnen Ihre gesamte Instanz und alle zugeh\u00f6rigen Daten auf Anfrage gel\u00f6scht werden.',
    'privacy.rights.portability': '<strong>Recht auf Daten\u00fcbertragbarkeit (Art. 20 DSGVO):</strong> Sie k\u00f6nnen Ihre Daten in einem maschinenlesbaren Format anfordern.',
    'privacy.rights.restriction': '<strong>Recht auf Einschr\u00e4nkung (Art. 18 DSGVO):</strong> Sie k\u00f6nnen die Einschr\u00e4nkung der Verarbeitung Ihrer Daten verlangen.',
    'privacy.rights.object': '<strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie k\u00f6nnen der Verarbeitung Ihrer Daten widersprechen.',
    'privacy.rights.contact': 'Um eines dieser Rechte auszu\u00fcben, kontaktieren Sie uns unter <a href="mailto:roland.roetzer@itwt.at">roland.roetzer@itwt.at</a>.',
    'privacy.authority.heading': '9. Aufsichtsbeh\u00f6rde',
    'privacy.authority.desc': 'Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen das Datenschutzrecht verst\u00f6\u00dft oder Ihre datenschutzrechtlichen Anspr\u00fcche in anderer Weise verletzt wurden, k\u00f6nnen Sie sich bei der Aufsichtsbeh\u00f6rde beschweren:',
    'privacy.authority.info': '\u00d6sterreichische Datenschutzbeh\u00f6rde<br>Barichgasse 40-42, 1030 Wien<br><a href="https://www.dsb.gv.at" target="_blank" rel="noopener">www.dsb.gv.at</a>',
    'privacy.changes.heading': '10. \u00c4nderungen dieser Richtlinie',
    'privacy.changes.desc': 'Wir behalten uns das Recht vor, diese Datenschutzerkl\u00e4rung zu aktualisieren, um \u00c4nderungen unserer Praktiken oder aus anderen betrieblichen, rechtlichen oder regulatorischen Gr\u00fcnden widerzuspiegeln. Das Datum oben auf dieser Seite gibt an, wann diese Richtlinie zuletzt \u00fcberarbeitet wurde.',
  },
  en: {
    // Nav
    'nav.features': 'Features',
    'nav.demo': 'Demo',
    'nav.pricing': 'Pricing',
    'nav.selfhost': 'Self-Hosting',
    'nav.impressum': 'Legal Notice',
    'nav.privacy': 'Privacy',

    // Hero
    'hero.badge': 'Personal Finance Planning Tool',
    'hero.title': 'Know today what\'s left at the end of the month',
    'hero.subtitle': 'Plan your income and expenses. Keep full control of your budget \u2014 in real-time, without complex software.',
    'hero.cta': 'Start your free 14-day trial',
    'hero.demo': 'View Demo',

    // Mock Dashboard
    'mock.balance': 'Available',
    'mock.income': 'Income',
    'mock.expenses': 'Expenses',

    // Problem
    'problem.title': 'Does this sound familiar?',
    'problem.1.title': 'No overview',
    'problem.1.desc': 'At the end of the month, you wonder where all the money went \u2014 every single time.',
    'problem.2.title': 'Spreadsheet chaos',
    'problem.2.desc': 'Tables that are outdated after two weeks and nobody maintains anymore.',
    'problem.3.title': 'Nasty surprises',
    'problem.3.desc': 'Forgotten subscriptions, unexpected charges \u2014 and suddenly your account is in the red.',
    'problem.4.title': 'Too complex',
    'problem.4.desc': 'Accounting software that\'s way too bloated and complicated for everyday use.',

    // Features
    'features.label': 'Features',
    'features.title': 'Everything you need for financial planning',
    'features.subtitle': 'Focused on what matters. No bloat, no gimmicks.',

    'feature.forecast.title': 'End-of-Month Forecast',
    'feature.forecast.desc': 'See instantly what\'s left at the end of the month. Planned income and expenses are calculated in real-time.',
    'feature.dashboard.title': 'Clear Dashboard',
    'feature.dashboard.desc': 'Total balance, monthly income & expenses at a glance. All key metrics instantly visible.',
    'feature.accounts.title': 'Multi-Account Management',
    'feature.accounts.desc': 'Bank accounts, cash, credit cards, and savings \u2014 all managed in one place.',
    'feature.recurring.title': 'Recurring Transactions',
    'feature.recurring.desc': 'Rent, salary, subscriptions \u2014 set up once, automatically tracked. Adjust individual entries anytime.',
    'feature.analytics.title': 'Real-Time Analytics',
    'feature.analytics.desc': 'Interactive charts show where your money goes. Filter by category or time range.',
    'feature.security.title': 'Secure & Private',
    'feature.security.desc': 'Password protection with optional two-factor authentication. Your data belongs to you.',

    // Demo
    'demo.label': 'Live Demo',
    'demo.title': 'Experience Financer in action',
    'demo.subtitle': 'Try the full app directly in your browser \u2014 no registration needed.',
    'demo.button': 'Try Live Demo',
    'demo.credentials': 'Password: <strong>demo234</strong> \u2014 No registration needed',

    // Demo Mock
    'mock.nav.dashboard': 'Dashboard',
    'mock.nav.accounts': 'Accounts',
    'mock.nav.transactions': 'Transactions',
    'mock.nav.recurring': 'Recurring',
    'mock.nav.analytics': 'Analytics',
    'mock.greeting': 'Hello, Demo User',
    'mock.month': 'February 2026',
    'mock.totalBalance': 'Total Balance',
    'mock.monthIncome': 'Income (Month)',
    'mock.monthExpense': 'Expenses (Month)',
    'mock.remaining': 'Available',
    'mock.chartTitle': 'Expenses by Category',
    'mock.cat.rent': 'Rent',
    'mock.cat.food': 'Groceries',
    'mock.cat.insurance': 'Insurance',
    'mock.cat.transport': 'Transport',
    'mock.cat.subs': 'Subscriptions',

    // USPs
    'usps.label': 'Why Financer',
    'usps.title': 'Your advantage at a glance',
    'usp.forecast.title': 'Forecasting Focus',
    'usp.forecast.desc': 'Plan ahead instead of just analyzing the past. Know today what\'s left at the end of the month.',
    'usp.clarity.title': 'Maximum Clarity',
    'usp.clarity.desc': 'No feature bloat, no hidden menus. Only what you really need \u2014 at a glance.',
    'usp.control.title': 'Full Data Control',
    'usp.control.desc': 'Cloud in the EU or self-hosting on your own server. You decide where your data lives.',
    'usp.opensource.title': 'Open Source Transparency',
    'usp.opensource.desc': 'MIT License. Anyone can view, audit, and run the code themselves. No black box.',

    // Compare
    'compare.label': 'Deployment',
    'compare.title': 'Cloud or Self-Hosting?',
    'compare.subtitle': 'Both options. Your choice. Full control.',
    'compare.recommended': 'Recommended',
    'compare.cloud': 'Cloud',
    'compare.selfhosted': 'Self-Hosted',
    'compare.row.setup': 'Setup',
    'compare.row.updates': 'Updates',
    'compare.row.backup': 'Backup',
    'compare.row.support': 'Support',
    'compare.row.data': 'Data Storage',
    'compare.row.price': 'Price',
    'compare.cloud.setup': 'Instant setup',
    'compare.cloud.updates': 'Automatic',
    'compare.cloud.backup': 'Included',
    'compare.cloud.support': 'Included',
    'compare.cloud.data': 'EU Servers',
    'compare.cloud.price': 'from \u20ac4.99/month',
    'compare.self.setup': 'Docker required',
    'compare.self.updates': 'Manual',
    'compare.self.backup': 'Self-managed',
    'compare.self.support': 'Community',
    'compare.self.data': 'Your server',
    'compare.self.price': 'Free (MIT)',
    'compare.note': 'The Self-Hosted version is released under the <strong>MIT License</strong> \u2014 you can freely use, modify, and distribute the code. No technical knowledge? The Cloud version makes it easy.',

    // Pricing
    'pricing.label': 'Pricing',
    'pricing.title': 'Simple. Transparent. Fair.',
    'pricing.self.name': 'Self-Hosted',
    'pricing.self.price': 'Free',
    'pricing.self.desc': 'MIT License. Free forever.',
    'pricing.self.f1': 'All features included',
    'pricing.self.f2': 'Full data control',
    'pricing.self.f3': 'Docker deployment',
    'pricing.self.f4': 'Community support',
    'pricing.self.f5': 'Unlimited accounts',
    'pricing.self.cta': 'View on GitHub',
    'pricing.cloud.popular': 'Popular',
    'pricing.cloud.name': 'Cloud',
    'pricing.cloud.period': '/ month',
    'pricing.cloud.desc': 'Start instantly. We take care of the rest.',
    'pricing.cloud.f1': 'All features included',
    'pricing.cloud.f2': 'Automatic updates',
    'pricing.cloud.f3': 'Daily backups',
    'pricing.cloud.f4': 'EU servers (GDPR)',
    'pricing.cloud.f5': 'Personal support',
    'pricing.cloud.cta': 'Start your free 14-day trial',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'Frequently Asked Questions',
    'faq.q1': 'Is my financial data secure?',
    'faq.a1': 'Yes. The cloud version runs on EU servers with encrypted connections (HTTPS), password hashing (bcrypt), and optional two-factor authentication. We never sell or share data. With self-hosting, you have full control over your data.',
    'faq.q2': 'Can I cancel anytime?',
    'faq.a2': 'Yes, you can cancel the cloud version at any time. There\'s no minimum contract and no hidden costs. Your data can be exported or deleted at any time.',
    'faq.q3': 'What does the MIT License mean?',
    'faq.a3': 'The MIT License is one of the most permissive open-source licenses. You can freely use, modify, distribute, and even commercially use the code. The full source code is available on GitHub.',
    'faq.q4': 'Do I need technical knowledge for self-hosting?',
    'faq.a4': 'Basic knowledge of Docker and a Linux server is recommended. The documentation guides you step by step through the installation. If you have no technical knowledge, the cloud version is the easiest option.',

    // CTA
    'cta.title': 'Take control of your finances',
    'cta.subtitle': 'Start now and always know what\'s left at the end of the month.',
    'cta.button': 'Start your free 14-day trial',
    'cta.github': 'View on GitHub',
    'cta.trust': 'No credit card required.',

    // Footer
    'footer.product': 'Product',
    'footer.resources': 'Resources',
    'footer.legal': 'Legal',
    'footer.docs': 'Documentation',
    'footer.feedback': 'Feedback',
    'footer.github': 'GitHub',
    'footer.impressum': 'Legal Notice',
    'footer.privacy': 'Privacy Policy',
    'footer.made': 'Made in Vienna',

    // Impressum
    'imprint.title': 'Legal Notice',
    'imprint.subtitle': 'Information according to \u00a7 5 ECG, \u00a7 14 UGB, \u00a7 25 MedienG',
    'imprint.company.heading': 'Company',
    'imprint.company.label': 'Company',
    'imprint.company.owner': 'Owner',
    'imprint.company.address': 'Address',
    'imprint.company.email': 'Email',
    'imprint.company.phone': 'Phone',
    'imprint.reg.heading': 'Registration',
    'imprint.reg.court': 'Commercial Court',
    'imprint.activity.heading': 'Business Activity',
    'imprint.activity.desc': 'Services in automatic data processing and information technology',
    'imprint.authority.heading': 'Regulatory Authority',
    'imprint.authority.desc': 'Magistratisches Bezirksamt des XXIII. Bezirkes',
    'imprint.law.heading': 'Applicable Law',
    'imprint.law.desc': 'Gewerbeordnung: <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener">www.ris.bka.gv.at</a>',
    'imprint.dispute.heading': 'Dispute Resolution',
    'imprint.dispute.desc': 'We are neither willing nor obligated to participate in dispute resolution proceedings before a consumer arbitration board. The European Commission provides an online dispute resolution platform (OS): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr/</a>',
    'imprint.liability.heading': 'Liability for Content',
    'imprint.liability.desc': 'The contents of our pages were created with the greatest care. However, we cannot guarantee the accuracy, completeness, or timeliness of the content. As a service provider, we are responsible for our own content on these pages in accordance with general laws. However, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.',
    'imprint.copyright.heading': 'Copyright',
    'imprint.copyright.desc': 'The content and works created by the site operators on these pages are subject to Austrian copyright law. Duplication, processing, distribution, and any form of commercialization beyond the scope of copyright law require the prior written consent of the respective author or creator.',

    // Privacy Policy
    'privacy.title': 'Privacy Policy',
    'privacy.updated': 'Last updated: February 2026',
    'privacy.responsible.heading': '1. Responsible Party',
    'privacy.responsible.desc': 'Roland R\u00f6tzer e.U.<br>Ing. Roland R\u00f6tzer<br>Breitenfurterstra\u00dfe 376, 1230 Wien, \u00d6sterreich<br>Email: <a href="mailto:roland.roetzer@itwt.at">roland.roetzer@itwt.at</a><br>Phone: <a href="tel:+436763954894">+43 676 3954894</a>',
    'privacy.overview.heading': '2. Overview',
    'privacy.overview.desc': 'This privacy policy applies to the website getfinancer.com and the Financer application. Protecting your personal data is important to us. We process your data exclusively in accordance with the legal requirements (DSGVO/GDPR, TKG 2003).',
    'privacy.cloud.heading': '3. Cloud-Hosted Version',
    'privacy.cloud.desc': 'When using the cloud-hosted version of Financer at getfinancer.com, the following data may be processed:',
    'privacy.cloud.account': '<strong>Account data:</strong> A password (stored as a bcrypt hash) is required to access your instance. No email address or personal identification is collected during registration.',
    'privacy.cloud.financial': '<strong>Financial data:</strong> All transaction data, account names, categories, and other financial information you enter is stored on our servers. This data is only accessible by you through your authenticated session.',
    'privacy.cloud.logs': '<strong>Server logs:</strong> For security and operational purposes, our servers may temporarily log IP addresses, access times, and user agents. These logs are automatically deleted after 14 days.',
    'privacy.cloud.session': '<strong>Session data:</strong> A session cookie is used to maintain your login state. This is a functional cookie essential for the application to work.',
    'privacy.selfhost.heading': '4. Self-Hosted Version',
    'privacy.selfhost.desc': 'If you self-host Financer on your own infrastructure, all data remains exclusively on your server. We have no access to any data in self-hosted instances. You are solely responsible for data protection in your self-hosted environment.',
    'privacy.website.heading': '5. This Website (Landing Page)',
    'privacy.website.desc': 'This landing page (getfinancer.com informational pages) does not use cookies, tracking scripts, or analytics tools. No personal data is collected when simply visiting this website. Your theme and language preferences are stored only in your browser\'s local storage and are never transmitted to our servers.',
    'privacy.storage.heading': '6. Data Storage & Security',
    'privacy.storage.desc': 'Your data is stored on servers located in the European Union. We implement appropriate technical and organizational measures to protect your data, including:',
    'privacy.storage.https': 'Encrypted connections (HTTPS/TLS)',
    'privacy.storage.bcrypt': 'Password hashing with bcrypt',
    'privacy.storage.2fa': 'Optional two-factor authentication (2FA)',
    'privacy.storage.rate': 'Rate limiting to prevent brute-force attacks',
    'privacy.storage.headers': 'Security headers (via Helmet.js)',
    'privacy.sharing.heading': '7. Data Sharing',
    'privacy.sharing.desc': 'We do not sell, trade, or otherwise share your personal data with third parties. Your financial data is never accessed, analyzed, or used for any purpose other than providing the Financer service to you.',
    'privacy.rights.heading': '8. Your Rights (DSGVO/GDPR)',
    'privacy.rights.desc': 'You have the following rights regarding your personal data:',
    'privacy.rights.access': '<strong>Right of access (Art. 15 DSGVO):</strong> You can request information about what data we store about you.',
    'privacy.rights.rectification': '<strong>Right to rectification (Art. 16 DSGVO):</strong> You can request correction of inaccurate data.',
    'privacy.rights.erasure': '<strong>Right to erasure (Art. 17 DSGVO):</strong> You can request deletion of your data. In the cloud version, your entire instance and all associated data can be deleted upon request.',
    'privacy.rights.portability': '<strong>Right to data portability (Art. 20 DSGVO):</strong> You can request your data in a machine-readable format.',
    'privacy.rights.restriction': '<strong>Right to restriction (Art. 18 DSGVO):</strong> You can request the restriction of processing of your data.',
    'privacy.rights.object': '<strong>Right to object (Art. 21 DSGVO):</strong> You can object to the processing of your data.',
    'privacy.rights.contact': 'To exercise any of these rights, contact us at <a href="mailto:roland.roetzer@itwt.at">roland.roetzer@itwt.at</a>.',
    'privacy.authority.heading': '9. Supervisory Authority',
    'privacy.authority.desc': 'If you believe that the processing of your data violates data protection law or your data protection claims have been violated in any other way, you can file a complaint with the supervisory authority:',
    'privacy.authority.info': '\u00d6sterreichische Datenschutzbeh\u00f6rde<br>Barichgasse 40-42, 1030 Wien<br><a href="https://www.dsb.gv.at" target="_blank" rel="noopener">www.dsb.gv.at</a>',
    'privacy.changes.heading': '10. Changes to This Policy',
    'privacy.changes.desc': 'We reserve the right to update this privacy policy to reflect changes in our practices or for other operational, legal, or regulatory reasons. The date at the top of this page indicates when this policy was last revised.',
  }
};

/* --- State --- */
let currentLang = localStorage.getItem('lang') || 'de';

/* --- Theme --- */
function getTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains('light') ? 'light' : 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function updateThemeIcon(theme) {
  document.querySelectorAll('.theme-icon-sun').forEach(function(el) {
    el.style.display = theme === 'dark' ? 'block' : 'none';
  });
  document.querySelectorAll('.theme-icon-moon').forEach(function(el) {
    el.style.display = theme === 'light' ? 'block' : 'none';
  });
}

/* --- Language --- */
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;

  var dict = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // HTML translations (for elements containing links, <strong>, <br>, etc.)
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-html');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Special: demo credentials contain HTML
  document.querySelectorAll('.demo-credentials').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Special: compare note contains HTML
  document.querySelectorAll('.compare-note p').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Update lang toggle button text
  document.querySelectorAll('.lang-toggle').forEach(function(el) {
    el.textContent = lang === 'de' ? 'EN' : 'DE';
  });
}

function toggleLang() {
  applyLang(currentLang === 'de' ? 'en' : 'de');
}

/* --- Mobile Menu --- */
function toggleMobileMenu() {
  var menu = document.getElementById('mobile-menu');
  var btn = document.getElementById('menu-btn');
  var isOpen = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileMenu() {
  var menu = document.getElementById('mobile-menu');
  var btn = document.getElementById('menu-btn');
  if (menu) {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}

/* --- FAQ Accordion --- */
function toggleFaq(button) {
  var isExpanded = button.getAttribute('aria-expanded') === 'true';
  var answer = button.nextElementSibling;

  // Close all other FAQs
  document.querySelectorAll('.faq-question').forEach(function(q) {
    if (q !== button) {
      q.setAttribute('aria-expanded', 'false');
      q.nextElementSibling.style.maxHeight = null;
    }
  });

  // Toggle current FAQ
  button.setAttribute('aria-expanded', !isExpanded);
  if (!isExpanded) {
    answer.style.maxHeight = answer.scrollHeight + 'px';
  } else {
    answer.style.maxHeight = null;
  }
}

/* --- Scroll Animations --- */
function initScrollAnimations() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(function(el) {
    observer.observe(el);
  });
}

/* --- Init --- */
document.addEventListener('DOMContentLoaded', function() {
  // Theme
  applyTheme(getTheme());

  // Language
  applyLang(currentLang);

  // Scroll animations
  initScrollAnimations();

  // Close mobile menu on link click
  document.querySelectorAll('.mobile-menu a').forEach(function(a) {
    a.addEventListener('click', closeMobileMenu);
  });
});
