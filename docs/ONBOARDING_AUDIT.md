# Contributor- und Coding-Agent-Onboarding-Audit

Stand: 2026-10-05, Ausgangsversion 0.6.6. Zu Beginn war der Git-Arbeitsbaum sauber.
Untersucht: Root/README/DESIGN/CONTRIBUTING, `docs/`, Helper-Vertrag und Registry,
alle drei Helper, Shell-API, Context, Navigation, DB/Schema/Retention, Import/Export,
PWA/Worker sowie Node-/Browserprüfungen und Pages-Build/Workflow.

## Phase 1: vorher

Gedankenauftrag: „Baue einen neuen Helper für Parken passend zur bestehenden Anwendung.“
Die Bewertungen beziehen sich auf die vorhandenen Informationen **vor** diesem Audit.
„Klar auffindbar“ heißt über README → bestehenden Helper-Guide erreichbar; ein eigener
Agenten-Einstieg fehlte. Der Guide war bereits substanziell und bleibt kanonisch.

| # | Frage | Bewertung | Befund / bisherige Quelle |
| --- | --- | --- | --- |
| 1 | Was ist 0815? | klar auffindbar | README: lokale Alltagshelfer mit gemeinsamer Shell. |
| 2 | Unverhandelbare Produktprinzipien? | klar auffindbar | README Non-Goals, CONTRIBUTING und Guide; noch kein kurzer gemeinsamer Einstieg. |
| 3 | Wo lebt ein Helper? | klar auffindbar | Guide: `src/helpers/<id>/index.js`. |
| 4 | Wie registrieren? | klar auffindbar | Guide und `registry.js`: einmal in `HELPERS`. |
| 5 | Welcher Contract? | widersprüchlich | Guide/`contract.js` erlauben fehlende `offlineAssets`; `pages-build.mjs` spreadet das Feld zwingend. |
| 6 | Welche APIs? | klar auffindbar | Guide enthält alle zehn Methoden aus `openHelper()` und das Signal. Die API ist keine Sicherheits-Sandbox. |
| 7 | Wie Daten speichern? | klar auffindbar | Guide: eigene Entries, Commit, Validator, Retention. Store-Übersicht und Kompatibilitätsregel fehlen dort. |
| 8 | Wann `recordUse()`? | klar auffindbar | Guide beschreibt Erfolg und separaten Metadatenfehler bereits korrekt. |
| 9 | Wie place/time/interval? | klar auffindbar | Guide: Deklaration, Defaults, Zeitgrenzen, Priorität und Toleranz; Zweck/Abgrenzung noch knapp. |
| 10 | Helper oder Plattform? | klar auffindbar | Guide trennt Fachlogik von Shell; Entscheidungsregel und Rule of Three fehlen. |
| 11 | Navigation im Helper? | klar auffindbar | Guide: Parent-Callback, Remount, Fokus, keine Browser-History. |
| 12 | Accessibility? | klar auffindbar | Guide plus DESIGN; AA und drei aktuelle Themes noch nicht in einer kompakten Helper-Abnahme gebündelt. |
| 13 | Was muss offline gehen? | klar auffindbar | Guide, README und Offline-Gate: Assets und echter Worker. |
| 14 | Welche Dateien normalerweise ändern? | fehlt | Ordnerkonvention vorhanden, aber kein vollständiger Änderungsrahmen inklusive Tests/Release-Dateien. |
| 15 | Welche Tests ausführen? | nur durch Code-Lesen herausfindbar | `npm test` klar; Browserfunktionen benötigen ein externes Tool. Keine fokussierte Helper-Testauswahl; veraltete feste Gate-Zahl. |
| 16 | Wann fertig? | klar auffindbar | Guide hat bereits eine Checkliste; ein expliziter Umgang mit nicht ausführbaren Browserprüfungen fehlt. |
| 17 | Was ausdrücklich nicht bauen? | klar auffindbar | README Non-Goals und Guide; zusätzliche Features wie eigene History/Settings noch nicht ausdrücklich als optionale Fachentscheidungen benannt. |

Fazit: kein Architekturproblem. Den vorhandenen Guide gezielt ergänzen, Einstieg
und Contribution-Weg verbinden; keine zweite Architektur- oder Authoring-Dokumentation.

Weitere geprüfte Widersprüche: README nennt Retention nur für Schmerz, obwohl Trinken
ebenfalls optiert. Die Schmerz-README schließt Charts aus, obwohl `index.js` einen
dokumentierten SVG-Verlauf rendert. DESIGN enthält eine alte Release-Anweisung für
0.5.8. Diese Dokumentationsstellen werden am vorhandenen Code ausgerichtet.

## Phase 2: Entscheidungen

- Kurze Root-`AGENTS.md`; vorhandene CONTRIBUTING und den Guide weiterverwenden.
- Eine Helper-Idee braucht sechs Angaben in einer Issue-Vorlage. Den kurzen
  Agentenauftrag direkt in CONTRIBUTING aufnehmen, keine weitere Prompt-Datei.
- Vertrag bleibt ausführbares JavaScript: `validateHelper`, `validateRegistry`,
  `helperDefaults` und vorhandene Tests genügen. Keine zusätzliche Schema-Schicht.
- Kein Generator: Ordner/Default-Export und ein Registry-Eintrag sind überschaubar;
  zusätzliche Assets sind nur bei Bedarf zu deklarieren.
- Einzeilige Korrektur im Pages-Test für das optionale Feld; keine Runtime-Änderung.
- API-Grenze ehrlich dokumentieren: `saveEntry()` prüft keinen bestehenden Besitzer
  einer frei gewählten ID. IDs sind im gemeinsamen Store eindeutig zu halten;
  dies bleibt eine Contributor-Regel, kein behaupteter technischer Zugriffsschutz.

## Phase 3: Cold-Start-Simulation

Gedankenauftrag: „Erstelle einen neuen Helper ‘Beispiel’, der eine einfache
erfolgreiche Aktion lokal speichert.“ Reine Simulation anhand der Repo-Dateien,
kein separater Agentenlauf und kein implementierter Beispiel-Helper.

1. **Zuerst öffnen:** [AGENTS.md](../AGENTS.md) →
   [HELPER_AUTHORING.md](HELPER_AUTHORING.md) →
   [Trinken/index.js](../src/helpers/drink/index.js).
   Für die ausgelagerte Speichersequenz bei Bedarf dessen
   [model.js](../src/helpers/drink/model.js). Kein Lesen von `app.js`/`db.js`,
   anderen Helpern, Git-Historie oder Chat-Verläufen nötig.
2. **Dokumentumfang:** zwei Onboarding-Dokumente und eine Referenzimplementierung
   (Trinken hat Einstieg und Modell in zwei Dateien). Beim Ausführen eines externen
   Browsertools ist der gezielte Browser-Abschnitt in `tests/README.md` nachschlagbar;
   er ist keine zusätzliche Architekturlektüre.
3. **Referenzentscheidung:** Trinken zeigt eine bewusst ausgelöste lokale Aktion,
   Busy-Zustand, Commit, separaten Metadatenfehler und Ergebnisfokus. Für „Beispiel“
   keine Trinkhistorie, Intervall-Defaults, Retention oder Zusatzsettings übernehmen.
   Annahme für diesen abstrakten Auftrag: Die bewusste Bestätigung ist die Fachaktion;
   gespeichert wird ein Ereignis, keine zusätzliche Verlaufsoberfläche.
4. **Voraussichtlicher Diff:** `src/helpers/example/index.js`, bei ausgelagerter
   Fachvalidierung/Speichersequenz `model.js`, einmal `registry.js`,
   `tests/example.mjs`, `tests/example-browser-check.js`, ein fachlicher Offline-Flow
   in `tests/helpers-offline-check.js`, Paket-/Cacheversion in `package.json`/`sw.js`.
   Bestehende Controls genügen ohne eigenes CSS. Falls `model.js` entsteht, gehört es
   in `offlineAssets`; sonst ist das Feld optional. Keine Änderungen an Plattform,
   Stores, Context-Engine oder Router nötig.
5. **Prüfplan:** `npm test`, Syntaxkommandos und `git diff --check` aus dem Guide,
   `bin/build-pages`; fokussiert `node --test tests/example.mjs`.
   Browser: eigener Gate plus `browser-check.js`, `navigation-browser-check.js`,
   `design-check.js`, `helpers-offline-check.js`. Der neue Flow prüft Öffnen ohne
   Eintrag/Nutzung, Commit vor Erfolg/`recordUse()`, Quota-/Validierungsfehler,
   Metadatenfehler ohne Doppeleintrag, Mehrfachklick, Unmount, Wiederherstellung,
   Importvalidierung, Tastatur/Fokus, drei Themes und Offline-Reload.
6. **Offene Fragen:** keine Architekturfrage für diese einfache Aktion. Bei einem
   echten Fachauftrag bleibt die genaue Bedeutung von „erfolgreich“ fachlich zu
   klären, nicht durch Repo-Exploration. Automatisierte Browserabnahme setzt weiter
   ein passendes externes Tool voraus; der Guide benennt den manuellen Prüfweg und
   die verbleibende Prüflücke ausdrücklich.

Die Simulation bestätigt den Einstieg über zwei Dokumente plus einen Helper.
IDs, Importkompatibilität, Navigation, Context-Verzicht und Prüfgrenzen sind ohne
plattformweite Exploration ableitbar. Es wurde weder „Beispiel“ noch „Parken“ angelegt.

## Validierung dieses Audits

- `npm test` mit Node.js 22.23.2/npm 10.9.8: alle zehn Testdateien bestanden,
  einschließlich isolierter Pages-Builds, Registry, Schema und Worker.
- Syntax aller `src`-/`tests`-JS/MJS-Dateien sowie `sw.js` und `bin/build-pages` geprüft.
- `git diff --check` ohne Befund; lokale Dokumentlinks und Abschnittsziele geprüft.
- Keine Browserläufe für diesen Dokumentations-/Testfix; keine Runtime-Änderung.
  Der vorhandene `dist/`-Ordner wurde nicht ersetzt; Buildprüfungen laufen isoliert.

## Agent Readiness und Remaining Friction

**Ausreichend:** Ein fremder Agent kann einen normalen Helper ohne Chat-Kontext
implementieren. Der Weg zur vollständigen automatisierten Browserabnahme hängt
noch von der externen Testumgebung ab. Kein Generator und keine neue Plattform-API nötig.

Höchstens drei mögliche nächste Verbesserungen, hier ausdrücklich nicht umgesetzt:

1. Ein portabler Aufruf der vorhandenen Browserfunktionen für Umgebungen ohne Agenten-Browsertool.
2. Technische Besitzprüfung bei Updates frei gewählter Entry-IDs, falls die Plattform diese Regel künftig erzwingen soll.
3. Reale Zielbrowser-/Screenreader-Abnahme der Referenzabläufe dokumentieren.
