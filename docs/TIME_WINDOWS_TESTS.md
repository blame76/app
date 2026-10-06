# Zeitfenster: unabhängige Prüfung

Stand: 6. Oktober 2026, Branch `feature/custom-time-windows`, Ausgangscommit
`6f857cf`. Node.js 22.23.2, echter Chromium-Browser über das bereitgestellte
Playwright-Tool. Alle Browserdaten stammen aus isolierten Testprofilen.

## Architekturprüfung

Die Erweiterung bleibt innerhalb der bestehenden Architektur: ES-Module ohne
Runtime-Abhängigkeiten, Definitionen im vorhandenen `settings`-Store, unveränderte
`timeBuckets`-Referenzen, keine DB-Migration. Defaults bleiben Code-Konstanten.
Helper und beide Notizarten verwenden dieselben aktiven Fenster; das bestehende
Dashboard-Timeout berücksichtigt Start und Ende. Ort/Intervall/Zeit behalten die
Ränge 400/300/200. Löschung schreibt keine referenzierenden Fachdaten um.

## Neue Tests

- `tests/time-windows.mjs`: 11 Unit-Tests. Alle 1.440 lokalen Tagesminuten der
  bisherigen Defaults, Labels und Legacy-API; Überschneidungen, Mitternacht,
  inklusive/exklusive Grenzen samt Sekunden; nächste Start-/Endgrenze und Folgetag;
  mehrere Helper-Gründe und Priorität; beide Notizarten bei Umbenennung,
  Verschiebung und Löschung; fehlende IDs; Uhrzeit-Roundtrip und ungültige Daten;
  Importvalidierung einschließlich alter Exportformate 1 und 2.
- `tests/time-windows-browser-check.js`: vollständiger Ablauf mit echten Helpern,
  IndexedDB und Service Worker in Light, Dark und Signature. Anlegen,
  Validierungsfehler, Helper-Auswahl, Notiz und Personen-Notiz, Reload, Umbenennen,
  Verschieben, automatischer Start/Ende auf offenem Dashboard, Löschen ohne Kaskade,
  fehlende Referenzen in Details und Auswahl, Import/Export und abgewiesene Imports
  ohne Datenverlust. Zusätzlich Tastatur, lange unvertrauenswürdige Labels,
  320 CSS px/200 % Text, keine Nutzungsregistrierung durch Konfiguration,
  keine externen Requests, Worker-Cache, Offline-Änderung und Offline-Reload.

Die Browserfunktion wird wie die vorhandenen Gates über `browser_run_code_unsafe`
mit ihrem absoluten Dateipfad ausgeführt. `node tests/…-browser-check.js` führt
keinen Browserablauf aus. Voraussetzung ist der lokale Python-Server auf Port 8080.

## Anpassungen bestehender Tests

- `pages-build.mjs`: ausgelieferte Zeitfensterdatei entspricht dem Quellmodul;
  Änderung des Moduls verändert den Release-Hash.
- `service-worker.mjs`: Installation precacht das Zeitfenstermodul ausdrücklich.
- `context-core-browser-check.js`: nach dem bereits abgewarteten 15-Uhr-Wechsel
  darf „mittags“ beim späteren Ortsmatch nicht mehr als aktiver Grund erscheinen.
- `browser-check.js`: vor der ausstehenden Geolocation bewusst die bestehende
  Positionsquelle „Hier“ wählen. Sonst existiert der simulierte Callback nicht.

Keine reine Ersetzung von „Tageszeit“ war erforderlich; verbliebene Vorkommen
sind unter anderem Fixture-Namen, keine Erwartungen an die geänderte UI-Bezeichnung.

## Gefundener Produktfehler und Korrektur

Ein zulässiger langer eigener Name führte in der Helper-Auswahl bei 320 CSS px
und 200 % Text zu einer Dokumentbreite von 814 px. Der Text war ein anonymes
Flex-Item und konnte nicht ausreichend umbrechen.

Die Zeitfensterbeschriftung erhält in `src/app.js` ein `span`; eine gezielte Regel
in `assets/styles.css` erlaubt diesem Element Schrumpfen und Wortumbruch.
Der neue Browsertest reproduzierte den Fehler vor der Korrektur und besteht danach
in allen drei Modi. Fachlogik und Speicherung wurden nicht geändert.
Paket- und Worker-Version wurden für die Runtime-Korrektur gemeinsam auf 0.7.6 erhöht.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 17/17 Testdateien bestanden, kein Fehler/Skip |
| `node tests/time-windows.mjs` | 11/11 Unit-Tests bestanden |
| `TZ=Europe/Berlin node --test tests/time-windows.mjs` | bestanden |
| Syntax aller `.js`/`.mjs` in `src` und `tests`, `sw.js`, `bin/build-pages` | bestanden |
| `node bin/build-pages` | 48 Runtime-Dateien, Zeitfenstermodul enthalten |
| `git diff --check` | bestanden |
| `time-windows-browser-check.js` | 123 Checks bestanden, drei Modi einschließlich offline |
| `context-core-browser-check.js` | 17 Checks bestanden |
| `browser-check.js` | 28 Checks bestanden |
| `navigation-browser-check.js` | 26 Checks bestanden |
| `design-check.js` | 22 Checks bestanden |
| `notes-browser-check.js` | 120 Checks bestanden |
| `person-notes-browser-check.js` | 90 Checks bestanden |
| `helpers-offline-check.js` | 29 Checks bestanden, echter Worker |
| `signature-browser-check.js` | 107 Checks bestanden, 14 Screenshots |
| `pain-browser-check.js` | 88 Checks bestanden |
| `language-browser-check.js` | fehlgeschlagen an bestehender Proportionsannahme, siehe unten |

Der direkte Aufruf `bin/build-pages` scheiterte am fehlenden Ausführungsrecht im
Checkout. Derselbe Packager wurde erfolgreich mit `node bin/build-pages` ausgeführt.
Es wurde keine Dependency installiert und nichts gemergt oder veröffentlicht.

## Verbleibender Fehler und Prüflücken

`language-browser-check.js` verlangt für eine Kachel bei 320 px ein Verhältnis
Höhe/Breite kleiner als 1,6. Gemessen wurden 132 × 229,15625 px, also rund 1,736.
Die Grid-Zeilenhöhe wird auch durch den langen benachbarten Helpernamen und die
vorhandene „Warum jetzt?“-Beschriftung bestimmt. Die Erwartung scheitert auch mit
unverändertem CSS aus `origin/feature/custom-time-windows`; die einzige neue
CSS-Regel betrifft ausschließlich Helper-Einstellungen.

Ein separater Diagnoselauf mit ersetzter Proportionsprüfung (Breite innerhalb des
Containers, Mindesthöhe 48 px) bestand alle 38 Checks, einschließlich Textcontainment,
Reflow und der weiteren Speicher-/Importabläufe. Das ist **kein bestandener Lauf des
unveränderten Language-Gates**. Test und allgemeine Kachelgestaltung wurden für diesen
Auftrag nicht verändert. Offen bleibt die Abstimmung dieser älteren visuellen Erwartung.

Die neue Prüfung verwendet eine kontrollierte lokale Uhr in Europe/Berlin; Sprünge
bei Sommer-/Winterzeitwechseln sind nicht abgedeckt. Reale Screenreader, Gerätezoom,
Betriebssysteminstallation, Firefox und WebKit wurden nicht geprüft. 200 % Text wird
über die Root-Schriftgröße simuliert. Die Zeitfenster-Screenshots wurden als ergänzende
Sichtprüfung verwendet; der feste Footer kann in Full-Page-Aufnahmen mitten im Bild
erscheinen. Weitere, fachlich unbetroffene Browser-Gates wurden nicht ausgeführt.
