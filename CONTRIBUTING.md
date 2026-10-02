# Contributing

0815 soll leicht zu forken, zu verkleinern und zu erweitern bleiben.

## Grundregel

Ein Pull Request für einen neuen Helfer soll **keine** neue globale Navigation und **keine** neue technische Abhängigkeit einführen, wenn die vorhandene Shell ausreicht.

## Neuer Helfer

1. Ordner `src/helpers/<id>/` anlegen.
2. `index.js` nach dem [Helper Authoring Guide](docs/HELPER_AUTHORING.md) erstellen.
3. Genau einmal in `src/helpers/registry.js` registrieren.
4. Fachlogik, Darstellung und optionale lokale Historie bleiben im Helfer.
5. `npm test` ausführen.

## Cleanup

Ein Fork darf Helfer einfach aus der Registry entfernen oder über die Einstellungen unsichtbar machen. Die Shell darf mit **null Helfern** sinnvoll funktionieren.

## UI-Regel

Geöffneter Helfer = Fokus. Keine Dashboard-Elemente, keine Helferliste und kein globales Menü innerhalb der Funktion.
