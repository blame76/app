# 0815 für Coding-Agenten

0815 ist eine lokale, offline nutzbare PWA für kleine Alltagshelfer. Eine gemeinsame
Shell übernimmt Kontextanzeige, Navigation, Einstellungen und IndexedDB.
Jeder Helper beginnt mit dem kleinsten vollständigen fachlichen Nutzen.

## Unverhandelbar

- Vanilla HTML/CSS/JavaScript mit ES-Modulen, keine Runtime-Dependencies,
  kein Framework oder Bundler. Der vorhandene Pages-Build kopiert Runtime-Dateien.
- Local-first: keine Cloud-Abhängigkeit, Accounts, Analytics, stillen Uploads,
  externen Requests oder Hintergrundtracking für neue Helper.
- KISS/YAGNI, Mobile First und Accessibility. Vorhandene Architektur und
  Gestaltung respektieren; keine ungefragten Refactorings oder Plattform-Abstraktionen.
- Nutzereingaben sicher als Text rendern; Importdaten sind nicht vertrauenswürdig.
- `recordUse()` erst nach erfolgreicher Fachaktion, bei Persistenz nach Commit.
  Öffnen, Eingabe, Navigation und fehlgeschlagenes Speichern zählen nicht.

## Wenn du einen Helper baust

1. Lies den kanonischen [Helper Authoring Guide](docs/HELPER_AUTHORING.md):
   Contract, vollständige API, Dateiumfang und Review-Checkliste.
2. Sieh **einen** passenden Helper an: normalerweise
   [Trinken](src/helpers/drink/index.js), für Unteransichten/Details
   [Schmerz](src/helpers/pain/index.js). Referenz, keine Copy/Paste-Vorlage.
3. Implementiere im eigenen Helper-Ordner und registriere ihn einmal.
   Die Contract-Zusammenfassung im Guide reicht zum Start; maschinell prüft
   [contract.js](src/helpers/contract.js) die Deklaration.

Vor Änderungen `git status --short` prüfen, bestehende Arbeiten erhalten und
die relevanten Tests kennen. Fachliche Unklarheiten im Auftrag klären; nicht durch
zusätzliche Funktionen lösen. README, Design-Archive und Git-Historie sind keine
Pflichtlektüre für einen neuen Helper.

## Prüfen

Node.js 22 wie in CI, npm; für den lokalen Server Python 3. Kein `npm install` nötig.
Im Repo-Root:

```bash
python3 -m http.server 8080  # eigenes Terminal; http://localhost:8080
npm test
git diff --check
```

Bei Helper-/Runtime-Änderungen zusätzlich Syntax, Pages-Build sowie Browser- und
Offline-Prüfungen gemäß [Guide](docs/HELPER_AUTHORING.md#prüfen-und-fertigstellen).
`bin/build-pages` erzeugt `dist/` neu; nicht dort entwickeln.
Nur Dokumentation: kein Versionssprung oder Browserlauf erforderlich.
Ausgeführte Prüfungen und offene Prüflücken im Ergebnis nennen.
