# Now Surface – Implementierung und Prüfung

Stand: 6. Oktober 2026. Branch: `feature/now-surface`.

## Ausgangspunkt und Umfang

Ausgangscommit: `deab4937bd85c37b200fabc41432614d841e23b4`, nach `git fetch origin`
der aktuelle `origin/main`. Der Working Tree war vor dem Branchwechsel sauber.
Der neue Branch wurde direkt davon angelegt; keine Änderungen anderer Arbeitsbranches
wurden übernommen. Runtime-/Cacheversion: `0.8.0`.

Geänderte Dateien:

- Shell und Darstellung: `src/app.js`, `src/db.js`, `src/context.js`, `src/notes.js`, `assets/styles.css`.
- Contract: `src/helpers/contract.js`.
- Helper: `src/helpers/parking/index.js`, `src/helpers/pain/index.js`,
  `src/helpers/training/index.js`, `src/helpers/drink/index.js`, `src/helpers/drink/model.js`.
- Release: `package.json`, `sw.js`.
- Dokumentation: `docs/HELPER_AUTHORING.md`, `docs/NOW_SURFACE.md`, `tests/README.md`.
- Neue Tests: `tests/now-surface.mjs`, `tests/now-surface-browser-check.js`,
  `tests/now-api-browser-check.js`.
- Angepasste Browser-Gates: `tests/context-core-browser-check.js`,
  `tests/discount-browser-check.js`, `tests/drink-browser-check.js`,
  `tests/helpers-offline-check.js`, `tests/language-browser-check.js`,
  `tests/notes-browser-check.js`, `tests/person-notes-browser-check.js`,
  `tests/signature-browser-check.js`.

Generierte Builddateien und durch Tests neu aufgenommene historische Signature-Bilder
sind nicht Bestandteil der Änderungen. Neue Sichtungsbilder liegen unter
`/tmp/0815-now-{light,dark,signature}-{320,1280}.png`.

## Contract und Verantwortung

Optional: `nowCard({ entries, now, lastUsedAt, interval, context })`.
Der Aufruf ist synchron, ohne DOM, DB-API oder Seiteneffekte; die Shell übergibt
nur eigene bereits geladene Entries in einem tief eingefrorenen Snapshot.
Rückgabe: erforderliches `active: boolean`; optional `primary`, `secondary`,
`badge: { value, label }`, `tone: 'normal' | 'attention'`,
`density: 'compact' | 'standard'`, `nextChangeAt`.
Strings, erlaubte Felder, Badge, Ton, Dichte und Zeitstempel werden geprüft.

`nextChangeAt` beschreibt ausschließlich die nächste Änderung des Karteninhalts.
Die Shell berücksichtigt zukünftige Grenzen eingeblendeter Helper in ihrem bereits
vorhandenen Vordergrund-Timeout, auch wenn deren Karte noch nicht aktiv ist. Dadurch aktualisieren sich Trinkzähler und Zeittexte
auch bei geöffneter Startseite. Hintergrund, Navigation und Rückkehr behalten den
bestehenden Context-Lebenszyklus; kein zusätzlicher Polling-Timer.

Die Shell berechnet Contexts unverändert und nimmt einen sichtbaren Helper auf,
wenn `context.match || nowCard.active` gilt. Fachlogik bleibt in den Helpern.
Aktive Zustände stehen zuerst; danach gilt die bestehende stabile Context-Sortierung
für Helper und Notizen. Keine Obergrenze, Nutzungsvermutung oder Recommendation Scores.
Ausblenden bleibt wirksam und löscht keine Daten.

## Fachliche Karten

- **Parken:** Der vorhandene Entry `parking-position` bedeutet aktiv. Die Karte zeigt
  seine wirkliche Notiz und Speicherzeit oder „Auto geparkt“. Löschen beendet die
  Zustandsrelevanz; Ersetzen aktualisiert die Karte. Keine erfundenen Ortsnamen.
- **Schmerz:** Pro normalisiertem Körperbereich gilt das jüngste Ereignis nach der
  vorhandenen Verlaufssortierung (Zeit, dann ID). `observation` hält den Bereich offen,
  `resolved` beendet ihn. Ein Bereich zeigt Name und Intensität, mehrere ihre Anzahl.
  Nach dem letzten Abschluss darf ein explizit passender Context die Karte weiter zeigen.
- **Training:** Jede vorhandene aktive Session hält Training unter Jetzt. Ohne aktive
  Session zeigt eine kontextuell sichtbare Karte den Abstand zum letzten abgeschlossenen
  Training, andernfalls „Noch kein Training dokumentiert“. Es wird die bestehende globale
  Referenz verwendet; keine neue ortsbezogene Historienlogik.
- **Trinken:** Kein aktiver Dauerzustand. Für Minuten-/Stundenintervalle gilt
  `floor(max(0, now - latest.recordedAt) / intervalDuration)`.
  59/60/119/120/179/180 Minuten ergeben 0/1/1/2/2/3. `earlyBy` betrifft allein
  die Sichtbarkeit: mit 15 Minuten Vorlauf heißt es ab Minute 45 „Bald wieder dran“.
  Kalenderintervalle zeigen den Dokumentationsabstand und einen sachlichen Anstoß,
  ohne Gelegenheitenzähler. Ab zwei Intervallen gibt es zusätzlich Akzent und Textbadge.
  Die Erklärung im Helper trennt dokumentierte Ereignisse vom tatsächlichen Konsum.
- **Trinkintervall abschalten:** Der ausdrückliche Button ruft
  `await api.disableContext('interval')` auf und navigiert nach Commit nach Hause.
  Die API akzeptiert nur das deklarierte eigene Intervall, setzt `interval` und
  `earlyBy` auf null, normalisiert alte Minutenregeln und erhält sonstige Regeln,
  Favorit, Sichtbarkeit, Entries und Nutzung. Fehler erhalten den bisherigen Zustand.
  Der gezielte atomare Regelschreibvorgang in `db.js` öffnet ausschließlich `helperRules`;
  auch bereits abgelaufene Entries bleiben dabei erhalten. Dies zählt nicht als
  Fachnutzung; kein direkter DB-Zugriff im Helper.
- **Notizen:** Bleiben direkt öffnende Eintragskarten. Vollständiger sicher gerenderter
  Text ist die Hauptinformation, einschließlich langer und mehrzeiliger Notizen.

Helper ohne Projektion funktionieren bei deklarierten, passenden Contexts weiter
als Context-Karten: aktuell Rabatt, zusätzlich getestet mit isolierten Minimal-Helpern.
Warte auf besitzt seit dem Nachtrag vom 7. Oktober ebenfalls eine Now-Projektion.

## Darstellung und Accessibility

Eine Shell-Komponente besitzt Außenrahmen, Inhaltsreihenfolge, Fokus, Badge und
Indikatoren für beide Kartenarten. Ort, Intervall, Zeitfenster und aktiver Zustand
haben lokale dekorative SVGs mit zugänglicher Textbeschreibung am Indikator.
Der konkrete Ortsname bzw. das Zeitfenster bleibt sichtbar; vollständige Context-Gründe
stehen in der zugänglichen Beschreibung und im Titel.

Mobile: eine Spalte, natürliche Inhaltshöhe, echte Buttons mit mindestens 48 px Höhe.
Ab 700 px: drei Grid-Spalten, `compact` belegt eine, `standard` zwei. Kein Dense-Grid,
keine visuelle Umordnung. Lange Notizen und inhaltreiche Helper können mehr Raum erhalten.
Die DOM-Reihenfolge bleibt Tastatur-/Lesereihenfolge. Keine gekappten Inhaltszeilen.
Farbe ist nur zusätzliche Markierung neben Text und Badge. Keine Animationen.

## Tatsächlich ausgeführte Prüfungen

Node.js `v22.23.2`, keine Dependency-Installation:

- `npm test`: 18 Testdateien bestanden.
- `TZ=Europe/Berlin node --test tests/now-surface.mjs tests/drink.mjs tests/context.mjs tests/intervals.mjs`: bestanden.
- Syntax für alle JS/MJS-Dateien in `src` und `tests`, außerdem `sw.js` und `bin/build-pages`: bestanden.
- `bin/build-pages`: erfolgreich, 48 Runtime-Dateien in `dist/`.
- `git diff --check`: bestanden.

Im bereitgestellten echten Chromium-/Playwright-Browser, mit isolierten Kontexten:

| Gate | Ergebnis |
| --- | --- |
| `now-surface-browser-check.js` | bestanden; fünf Karten gemeinsam, Fachaktionen, Zählgrenzen, Opt-out/Retry, Reflow, Fokus, Kontraste |
| `now-api-browser-check.js` | bestanden; Deklaration, erlaubter Typ, keine freie Mutation, stale Mount, kein Retention-Pruning beim Opt-out |
| `context-core-browser-check.js` | bestanden; ODER, Vordergrund, automatische Grenzen, kein Recent-Fallback, mehr als neun Treffer |
| `drink-browser-check.js` | bestanden; Commit, Fehler, Nutzungsmetadaten, Intervall und Retention |
| `parking-places-browser-check.js` | bestanden in drei Themes |
| `pain-browser-check.js` | bestanden |
| `training-browser-check.js` | bestanden |
| `browser-check.js` | bestanden; allgemeiner Shell-/Storage-Contract |
| `navigation-browser-check.js` | bestanden |
| `design-check.js` | bestanden |
| `notes-browser-check.js` | bestanden |
| `person-notes-browser-check.js` | bestanden |
| `signature-browser-check.js` | bestanden |
| `language-browser-check.js` | bestanden |
| `discount-browser-check.js` | bestanden; Helper ohne Projektion |
| `helpers-offline-check.js` | bestanden mit echtem Service Worker, Offline-Speichern und Reload; aktive Karten und Intervallabschaltung eingeschlossen |

Die früheren Tests für schmale mobile Launcher bzw. getrennte Notizkacheln wurden
an die neue Produktanforderung angepasst. Speicher-, Context- und Navigationsprüfungen
wurden erhalten. Die Sichtprüfung der erzeugten Aufnahmen fand einen geerbten
Signature-Hintergrundunterschied; dieser ist korrigiert und die einheitliche
Kartenfläche wird nun in allen Themes geprüft.

320/1280 px und 100/200 % Text bestanden in Light, Dark, Signature. Gemessene minimale
Text-/Randkontraste der tatsächlichen Karten: Light 5,87/3,33; Dark 6,61/3,97;
Signature 7,60/4,90. Tastaturreihenfolge, sichtbarer Fokus, Badge-Beschreibung,
dekorative SVGs, lange Inhalte und sichere HTML-Textausgabe bestanden.

Offene manuelle Abnahme: reale Screenreader, Gerätezoom, weitere Browser/Zielgeräte,
Betriebssysteminstallation und echte Geräteortung. CSS-Textvergrößerung und Accessibility
Tree ersetzen diese Prüfungen nicht. Kein Deployment-/Hosting-Test in diesem Auftrag.

Neue Context-Arten eingeführt? **Nein.** `CONTEXT_TYPES` bleibt place/time/interval.
Neue externe Requests eingeführt? **Nein.** Alle neuen Daten und Darstellung bleiben lokal.
Kein neuer Store, keine Runtime-Dependency und keine generische State-/Plugin-Engine.

## Produktprüfung

1. Sehe ich meinen Parkplatz bis zum Löschen? **Ja.** Mit gespeicherter Notiz zeigt
   die Karte auch diese Ortsinformation; ohne Notiz erfindet sie keinen Ort.
2. Bleibt offen dokumentierter Schmerz bis „Schmerz weg“ griffbereit? **Ja.**
   Jeder Bereich wird unabhängig betrachtet.
3. Sehe ich, wie viele eingestellte Trinkabstände vergangen sind? **Ja**, für die
   linearen Minuten-/Stundenintervalle; Kalenderintervalle sind bewusst ohne Zählung.
4. Sehe ich bei relevantem Training meinen letzten Trainingsabstand? **Ja**;
   eine aktive Session zeigt stattdessen „Training läuft“ mit Beginn.
5. Kann ich eine relevante Notiz bereits auf dem Homescreen lesen? **Ja**,
   mit vollständigem Text in derselben Kartenfamilie.

## Nachtrag: Warte auf, 7. Oktober 2026

Mit Runtime-/Cacheversion `0.8.1` besitzt auch Warte auf eine reine `nowCard()`-Projektion
im bestehenden Fachmodell. Aktiv bedeutet: mindestens ein Entry mit `status: 'waiting'`
und `expectedDate <= lokales Heute`. Undatierte, zukünftige und erledigte Entries
aktivieren keine Karte. Ein einzelner fälliger Entry zeigt seinen Text und seine
Wiedervorlage, mehrere zeigen Anzahl und den ältesten fälligen Text nach bestehender
Sortierung. Die Karte öffnet die vorhandene Helper-Liste.

`nextChangeAt` liefert den nächsten lokalen Fälligkeitstermin bzw. den Tageswechsel
für die Angabe „heute“. Die Shell plant diese Grenze nun auch bei noch inaktiver Karte,
solange der Helper eingeblendet ist. Dafür wurde die bestehende Timer-Planung minimal
erweitert; keine neue Kontextart, kein Hintergrundtimer und keine neue API.
Trinken und Training liefern reine Textgrenzen nur für bereits passende Contexts,
damit unsichtbare Karten keine unnötigen Aktualisierungen auslösen.

Erneut ausgeführt: `npm test` (18 Testdateien), Berliner Zeitzonentests für
`warte-auf.mjs` und `now-surface.mjs`, Syntaxprüfung, Pages-Build und `git diff --check`.
Im Chromium-Browser bestanden `warte-auf-now-browser-check.js`,
`warte-auf-browser-check.js`, `context-core-browser-check.js`,
`now-surface-browser-check.js` und `helpers-offline-check.js` mit echtem Worker.
Die neue Prüfung deckt erstmalige Fälligkeit bei geöffneter Startseite, mehrere
Entries, Abschluss/Verschieben, Öffnen ohne Bestätigung, Hintergrund/Rückkehr,
Ausblenden, Reload und sicheren langen Text bei 320 px/200 % in drei Themes ab.
Die Node-Prüfung schließt die 23- und 25-Stunden-Tagesgrenzen in Europe/Berlin ein.
Reale Screenreader und weitere Zielgeräte bleiben wie oben manuell zu prüfen.
