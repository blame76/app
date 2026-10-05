# Contributing

0815 verbindet kleine Alltagshelfer mit einer lokalen, offline nutzbaren PWA.
Das Projekt soll leicht zu forken, zu verkleinern und zu erweitern bleiben.
Menschen und Coding-Agenten starten mit [AGENTS.md](AGENTS.md) und dem
[Helper Authoring Guide](docs/HELPER_AUTHORING.md).

## Lokal starten und prüfen

Voraussetzungen: Git, Node.js 22 (wie in CI), npm und Python 3 für den Server.
Keine Pakete installieren; es gibt keine Projektdependencies und keinen Dev-Build.

```bash
python3 -m http.server 8080
```

`http://localhost:8080` öffnen. Prüfungen in einem zweiten Terminal:

```bash
npm test
git diff --check
```

Syntax, Packaging und passende Browser-/Offline-Prüfungen stehen im
[Guide](docs/HELPER_AUTHORING.md#prüfen-und-fertigstellen). `npm test` führt die
Browserfunktionen nicht aus. Ein alter Service Worker kann lokale Änderungen
verdecken: zum Entwickeln gegebenenfalls Worker und Cache in den Devtools entfernen.

## Grundregel

Ein Pull Request für einen neuen Helfer soll **keine** neue globale Navigation und **keine** neue technische Abhängigkeit einführen, wenn die vorhandene Shell ausreicht.

Neue Arbeit auf einem Feature-Branch von `main`, kleine fokussierte PRs zurück nach
`main`. Bestehende uncommitted Arbeiten erhalten; kein ungefragter Architektur-Rewrite.
`pages` und `dist/` sind generierte Ausgaben. Im PR Problem, resultierendes Verhalten,
ausgeführte Prüfungen und verbleibende Prüflücken nennen; bei UI-Änderungen eine
Ansicht zeigen. Datenschutz, Accessibility und Offline-Verhalten gehören zur Abnahme.

## Neuer Helfer

1. Ordner `src/helpers/<id>/` anlegen.
2. `index.js` nach dem [Helper Authoring Guide](docs/HELPER_AUTHORING.md) erstellen.
3. Genau einmal in `src/helpers/registry.js` registrieren.
4. Fachlogik, Darstellung und optionale lokale Historie bleiben im Helfer.
5. `npm test` ausführen.

Die vollständige [Review-Checkliste](docs/HELPER_AUTHORING.md#helper-checkliste)
gilt auch für kleine Helper.

## Helper-Idee ohne Code

Im GitHub-Issue-Dialog **Helper-Idee** wählen
([Vorlage](.github/ISSUE_TEMPLATE/helper-idea.md)). Problem, Kernaktion, minimalen
Nutzen, Context, lokale Daten und ausdrücklich ausgeschlossenen Scope beschreiben.
Ein fertiges Konzept oder Code ist dafür nicht nötig.

## Kleiner Auftrag für einen Coding-Agenten

Diese Vorlage kopieren und fachlich ausfüllen; die Architektur kommt aus dem Repo:

```text
Lies zuerst AGENTS.md und den dort verlinkten Helper Authoring Guide.
Implementiere folgenden Helper innerhalb der bestehenden Architektur:

Feature: …
Kernnutzen / erfolgreiche Fachaktion: …
Contexts (place, time, interval oder keine): …
Persistenz (notwendige lokale Daten): …
Non-Goals: …

Nutze einen passenden bestehenden Helper als Referenz und die Review-Checkliste.
Wenn eine neue Plattform-Abstraktion nötig erscheint, stoppe deren Umsetzung
und begründe den konkreten Bedarf zuerst. Berichte Änderungen und Prüfungen.
```

## Cleanup

Ein Fork darf Helfer einfach aus der Registry entfernen oder über die Einstellungen unsichtbar machen. Die Shell darf mit **null Helfern** sinnvoll funktionieren.

## UI-Regel

Geöffneter Helfer = Fokus. Keine Dashboard-Elemente, keine Helferliste und kein globales Menü innerhalb der Funktion.
