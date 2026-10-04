# 0815 – Alltagshelfer

v0.6.1 enthält **Schmerz v0.1**, **Rabatt** und **Trinken**, vollständige lokale
**Notizen** und **Personen-Notizen**. Die gehärtete technische
Baseline ist als `baseline-v0.4.1` erhalten; die bestehende Gestaltung und Shell bilden
den Rahmen für einzeln entwickelte Helper.
Die visuelle Richtung und der aktuelle Editorial-Design-Pass stehen in [`DESIGN.md`](DESIGN.md).
Der Language- und UI-Pass ab v0.5.3 ist in [`LANGUAGE_REVIEW.md`](LANGUAGE_REVIEW.md) dokumentiert.
Neue Helper: [`docs/HELPER_AUTHORING.md`](docs/HELPER_AUTHORING.md).

## Prinzip

> App-Shell stabil halten. Helfer einzeln entwickeln, testen, einbauen oder wieder ausblenden.

Die Shell bietet nur:

- **Jetzt** – kontextuelle Helfer und bewusst verknüpfte Notizen
- **Favoriten**
- **Alle Helfer** – Suche + Kategorie
- festen Footer: **Ort · Notiz · Person**
- Fokusansicht: Helfer ersetzt den gesamten Contentbereich; Dashboard und Menü sind dann unsichtbar
- Zurück führt eine Ebene zurück: Einstellungen → Helper, Unteransicht → Parent, Helper → Dashboard
- lokale Daten in IndexedDB
- Ort / Tageszeit / Intervall / Favorit / zuletzt verwendet als gemeinsame Kontextbasis
- Import / Export / Daten löschen
- Datenschutz / Impressum / App-Info
- PWA / Offline-Shell mit versioniertem Cache

## Schmerz v0.1

Ein persönliches Schmerztagebuch: Körperbereich und Intensität 1–10 genügen. Zeitpunkt
wird automatisch dokumentiert; ein Schmerzbeginn wird nicht daraus abgeleitet.
„Schmerz weg“ erstellt ein separates Ereignis mit Intensität 0. Zusatzangaben bleiben
freiwillig und erscheinen erst nach dem Speichern. Verlauf ist immer ortsbezogen.
Keine Diagnose, Therapieempfehlung oder medizinische Auswertung.

Details und tatsächliches Schema: [`src/helpers/pain/README.md`](src/helpers/pain/README.md).

`src/helpers/registry.js` registriert `pain`, `discount` und `drink`.

Ein Helfer lebt vollständig unter:

```text
src/helpers/<id>/index.js
```

Die genaue Mini-Schnittstelle steht in [`src/helpers/README.md`](src/helpers/README.md).

## „Installierbar“ bedeutet hier nur sichtbar / unsichtbar

Es gibt keine Plugin-Installation und keinen Paketmanager.

Sobald ein Helfer im Repository registriert ist, besitzt er in den Einstellungen einen Schalter **Sichtbar**. Ausgeschaltet bedeutet:

- nicht unter „Alle Helfer“
- nicht unter Favoriten
- nicht unter „Jetzt“
- Daten werden nicht gelöscht

Damit kann ein Fork mit einem einfachen Cleanup beginnen: Helfer ausblenden oder das Modul ganz entfernen.

## Fokusregel

Wenn ein Helfer geöffnet ist, sieht der Nutzer nur:

1. Header mit Zurück + Helfername
2. die Funktion selbst
3. den festen Footer

Kein Dashboard, keine Favoriten, keine Liste aller Helfer, kein globales Menü.

Für Helfer-Einstellungen gilt derselbe Fokusmodus.

## Kontext-Engine

Die gemeinsame Shell ist bereits vorbereitet für:

- Favorit
- gespeicherte Orte
- Tageszeit
- Intervall + Toleranz
- zuletzt verwendet

Standort wird erst abgefragt, wenn ein sichtbarer Helfer eine Ortsverknüpfung besitzt,
eine Notiz mit einem vorhandenen Ort verknüpft ist oder der Nutzer aktiv „Ort“ wählt.
Notizen verwenden dasselbe Ortsmatching und dieselben Tageszeiten. Kein Hintergrund-Geofencing.

## Core-Footer

Die drei Grundaktionen sind keine Helfer:

- **Ort** – aktuellen Ort lokal merken
- **Notiz** – schnelle lokale Notiz
- **Person** – Person anlegen/auswählen und Referenz oder Geschenkidee **hinzufügen**; bestehende Einträge werden nicht überschrieben

Im `…`-Menü öffnen **Notizen** und **Personen** die vorhandenen lokalen Inhalte.
Notizen erscheinen nach Tagen gruppiert, neueste zuerst. Nach dem schnellen Speichern
können Ort und Tageszeit freiwillig verknüpft werden. Die Detailansicht bietet Textbearbeitung,
Kontextverwaltung und bestätigtes Löschen. Ort **ODER** Tageszeit lassen eine Notiz unter
„Jetzt“ wieder auftauchen; Öffnen verändert sie nicht. Modell und Tests: [`docs/NOTES.md`](docs/NOTES.md).
Personen sind alphabetisch
sortiert; ihre Detailansicht trennt **Notizen** und **Geschenkideen**, jeweils
neueste zuerst. Zurück führt Person → Personen → Startseite und stellt in der Liste
den Fokus wieder her. Beide Arten von Personen-Einträgen lassen sich öffnen, bearbeiten,
verknüpfen und nach Bestätigung löschen. „Jetzt“ zeigt den Namen bei der Notiz, etwa
Mamas Frage am verknüpften Ort oder zur gewählten Tageszeit. Erfassung auf einer
Personenseite wählt diese Person bereits aus. Details: [`docs/PERSON_NOTES.md`](docs/PERSON_NOTES.md).
Notizen verwenden den bestehenden Store ohne Migration oder neues Importformat.

## Entwicklung

Kein Build nötig:

```bash
python3 -m http.server 8080
```

Test:

```bash
npm test
```

Browserprüfungen und Grenzen: [`tests/README.md`](tests/README.md).

## GitHub Pages

`main` ist die einzige Entwicklungsquelle. Neue Arbeit beginnt auf einem
Feature-Branch von `main` und wird über einen Pull Request zusammengeführt.

Ein Push/Merge nach `main` führt über [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
nach erfolgreichen Tests zu **Build → `pages`-Snapshot → GitHub Pages**.
Der Workflow kann auch manuell auf `main` gestartet werden. In den Repository-Einstellungen
muss **Pages → Build and deployment → Source: GitHub Actions** gewählt sein.

`bin/build-pages` erzeugt `dist/` sauber neu: HTML, Manifest, Worker, die expliziten
Shell-Assets und -Module sowie registrierte Helper-Module mit ihren `offlineAssets`,
ergänzt um `.nojekyll`. Keine Dokumentation, Tests oder lokalen Daten werden kopiert.
Neue Shell-Dateien müssen in der Whitelist des Scripts ergänzt werden; weitere
Helper-Assets werden über den bestehenden Helper-Vertrag deklariert.
Es gibt keine Transformation oder zusätzlichen Dependencies.

`pages` ist ein generierter Deployment-Branch. Nicht manuell bearbeiten und nie
nach `main` zurückmergen. Snapshot und offizielles Pages-Artifact stammen aus
demselben `dist/`; bei unverändertem Inhalt entsteht kein neuer Snapshot-Commit.

## Struktur

```text
.
├── assets/
│   ├── icons/
│   └── styles.css
├── src/
│   ├── app.js
│   ├── context.js
│   ├── db.js
│   ├── schema.js
│   ├── retention.js
│   └── helpers/
│       ├── contract.js
│       ├── registry.js   # pain, discount, drink
│       ├── README.md
│       └── pain/
├── tests/
│   └── smoke.mjs
├── index.html
├── manifest.webmanifest
└── sw.js
```

## Non-Goals

- kein Framework
- kein Bundler
- kein Account
- keine Cloud-Synchronisation
- keine Analytics
- keine Werbung
- kein Hintergrund-Geofencing
- keine Runtime-KI
- kein Plugin-System um des Plugin-Systems willen

## Speicher und Import

Import ersetzt den gesamten Bestand nach Bestätigung. Version 2 benötigt alle fünf
Stores als Arrays; Version 1 darf `helperRules` auslassen. IDs, Zeitstempel,
Koordinaten, Kontextwerte und Intervalle werden vor jedem Datenbankzugriff geprüft.
Unbekannte Stores, doppelte IDs und ungültige Datensätze werden abgelehnt.
Fachliche JSON-Felder innerhalb eines gültigen Helper-Eintrags bleiben erhalten.

Ersetzen, Gesamtlöschung und Export verwenden jeweils eine gemeinsame
IndexedDB-Transaktion über alle Stores. Ein fehlgeschlagener Import wird vollständig
zurückgerollt. Ein erfolgreich gespeicherter Eintrag zählt erst nach Commit als gespeichert.
Browser-Persistenz bleibt eine Anfrage, keine garantierte Datensicherung.

Helper mit deklarierter Aufbewahrung (aktuell Schmerz) bieten 7, 30, 365 Tage oder
unbegrenzt an. Default für Schmerz ist unbegrenzt. Die Dauer gilt für fachliche Einträge,
nicht für Konfiguration. Bereinigung erfolgt bei App-Start, Eintragslesen, Export,
Import und Regeländerung. Details stehen im Helper-Vertrag. Verkürzen kann Daten
unwiderruflich löschen; Exportdateien außerhalb der App werden davon nicht verändert.

## Releases und Offline

Bei jeder Änderung an Shell, Registry, Helpern oder Assets:

1. Version in `package.json` und Cache-Namen in `sw.js` gemeinsam erhöhen.
2. Die Shell-Liste in `sw.js` bei neuen Shell-Dateien ergänzen.
3. Neue Helper folgen `src/helpers/<id>/index.js`; diese Module werden aus der Registry
   automatisch precached. Weitere Dateien deklariert der Helper über `offlineAssets`.
4. `npm test`, Browserstart und Offline-Neuladen prüfen.

Der Worker ist ein ES-Modul. Deshalb müssen Helper-Module ohne DOM-Zugriffe auf
Modulebene importierbar sein; DOM-Arbeit beginnt erst in `mount()`. Das ist auch
Voraussetzung für die Registry-Tests in Node.

Der Worker lädt Release-Assets mit `cache: 'reload'`, verwaltet nur `0815-`-Caches,
speichert nur erfolgreiche nicht umgeleitete GET-Antworten ohne Query-Parameter
und verwendet den HTML-Fallback ausschließlich für Navigationen. Ein neuer Worker
wird direkt aktiviert; bereits offene Seiten übernehmen die neue Oberfläche beim
nächsten Neuladen. Bei lokalem Entwickeln ohne Versionswechsel gegebenenfalls
Worker/Cache in den Browser-Devtools löschen. Der Pages-Workflow erhöht keine Versionen.

## Rechtliches

Impressum und Datenschutzhinweise sind strukturell vorhanden, enthalten aber bewusst Platzhalter für Betreiber- und hosterspezifische Angaben. Vor öffentlichem Deployment ergänzen.
