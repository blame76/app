# Eigene Zeitfenster · Implementierungsnotiz

## Ausgangslage

0815 kann Kontext aktuell über Ort, Tageszeit und Intervall bestimmen. Die Tageszeit war
bisher vollständig fest verdrahtet:

- `morning` · morgens · 05–11 Uhr
- `midday` · mittags · 11–15 Uhr
- `evening` · abends · 15–22 Uhr
- `night` · nachts · 22–05 Uhr

Das ist als Default brauchbar, bildet aber persönliche Tagesrhythmen wie Nachtschicht,
Tea Time oder ein legitimes „Zweites Frühstück“ nicht ab.

## Ziel dieses Features

Zusätzlich zu den vier bestehenden Standards können Nutzer eigene, frei benannte
Zeitfenster lokal anlegen. Die bestehenden IDs und gespeicherten `timeBuckets` bleiben
kompatibel; es gibt keine Migration und kein neues Storage-System.

Beispiele:

- Zweites Frühstück · 09:30–10:30 Uhr
- Tea Time · 16–17 Uhr
- Nachtschicht · 22–06 Uhr

Eigene Zeitfenster dürfen sich mit Standards oder miteinander überlappen und dürfen
über Mitternacht laufen.

## Datenmodell

Die vier Standards bleiben Code-Defaults in `src/time-windows.js` und werden nicht in
IndexedDB dupliziert.

Eigene Zeitfenster liegen im bestehenden Store `settings`:

```js
{
  id: 'time-windows',
  value: [
    {
      id: 'time-<stabile-id>',
      label: 'Zweites Frühstück',
      startMinute: 570,
      endMinute: 630
    }
  ]
}
```

`startMinute` und `endMinute` sind Minuten seit 00:00. Start ist inklusive, Ende
exklusive. Gleiche Start- und Endzeit ist bewusst ungültig; ein 24-Stunden-Fenster ist
in diesem Schnitt kein Anwendungsfall.

Neue IDs entstehen über die bestehende `makeId('time')`-Funktion. Damit bleibt die ID
stabil, wenn Label oder Uhrzeit später geändert werden.

## Rückwärtskompatibilität

Der bestehende Feldname `timeBuckets` in Helper-Regeln und Notiz-Kontexten bleibt
absichtlich erhalten. Alte Daten wie

```js
timeBuckets: ['morning', 'evening']
```

bleiben unverändert gültig.

Zusätzlich sind IDs im Format `time-…` zulässig. Eine Regel oder Notiz darf eine solche
ID auch dann noch enthalten, wenn das zugehörige Zeitfenster später gelöscht wurde.
Das entspricht dem bestehenden Verhalten bei gelöschten Orten: Referenzen werden nicht
stillschweigend umgeschrieben oder kaskadierend gelöscht.

Die UI zeigt einen solchen Verweis als „Zeitfenster nicht mehr vorhanden“. Beim nächsten
bewussten Speichern kann der Nutzer die Verknüpfung entfernen.

## `src/time-windows.js`

Neues, DOM-freies Kernmodul mit:

- `TIME_WINDOW_SETTING_ID`
- `DEFAULT_TIME_WINDOWS`
- `DEFAULT_TIME_WINDOW_IDS`
- ID- und Strukturvalidierung
- Zusammenführen von Standards und eigenen Fenstern
- Lookup nach stabiler ID
- Umrechnung `HH:MM <-> Minuten seit Mitternacht`
- zentrale Beschriftung der Zeitfenster

Die bisherigen vier Labels und Grenzen bleiben in der Darstellung kompatibel, also
z. B. `morgens · 05–11 Uhr`. Minutengenaue eigene Fenster erscheinen beispielsweise
als `Zweites Frühstück · 09:30–10:30 Uhr`.

## Context Engine

`src/context.js` kann jetzt mit einer konkreten Liste von Zeitfenstern arbeiten.

Neu ist insbesondere `matchingTimeWindows(date, timeWindows)`. Anders als der alte
einzelne `timeBucket()`-Wert kann die Funktion mehrere gleichzeitig passende Fenster
zurückgeben. Das ist notwendig, weil z. B. „morgens“ und „Zweites Frühstück“ gleichzeitig
gelten können.

Die alten Exporte `TIME_BUCKETS`, `TIME_BUCKET_IDS`, `timeBucket()` und
`timeBucketLabel()` bleiben für bestehende Aufrufer kompatibel. Ohne explizit
übergebene Fenster arbeiten sie weiterhin mit den vier Standards.

`evaluateHelperContext(...)` erhält optional die vollständige Zeitfensterliste. Für jede
aktuell passende und in der Regel ausgewählte Zeitfenster-ID wird ein Zeitgrund mit Rang
200 erzeugt. Die bestehende Priorität bleibt damit:

1. Ort · 400
2. Intervall · 300
3. Zeitfenster · 200

Bei mehreren gleichzeitig passenden ausgewählten Zeitfenstern kann „Warum jetzt?“ mehrere
Zeitgründe nennen.

`nextTimeBoundary()` betrachtet jetzt Start UND Ende aller übergebenen Zeitfenster.
Das ist wichtig, weil ein eigenes Fenster mitten in einem bestehenden Standard beginnen
oder enden kann. Der Homescreen kann dadurch sowohl beim Eintritt als auch beim Verlassen
eines eigenen Fensters neu bewerten.

## Dashboard / „Jetzt“

`dashboardCandidates()` lädt neben Orten, Einträgen und Personen auch die lokalen
Zeitfenster.

Aus der aktuellen Uhrzeit werden alle aktiven Zeitfenster-IDs bestimmt. Dieselbe
Zeitfensterliste wird an Helper-Auswertung, Notiz-Auswertung und
`nextTimeBoundary()` weitergereicht.

Es gibt keinen zweiten Timer-Mechanismus und kein Polling.

## Helper-Einstellungen

Helper mit `contexts: ['time']` zeigen jetzt nicht mehr nur die vier fest verdrahteten
Tageszeiten, sondern:

- alle vier Standards
- alle lokal angelegten eigenen Zeitfenster
- gegebenenfalls bereits gespeicherte, inzwischen fehlende Zeitfenster als
  „Zeitfenster nicht mehr vorhanden“

Intern wird weiterhin in `rule.timeBuckets` gespeichert.

Die Nutzerbezeichnung wurde von „Zu einer Tageszeit“ auf „In einem Zeitfenster“
umgestellt.

## Notizen und Personen-Notizen

Notizen verwenden dieselben eigenen Zeitfenster wie Helper.

Dafür wurden `noteLinks()`, `relevantNotes()` und die Note-Views um die jeweilige
Zeitfensterliste erweitert. Bestehende Aufrufe ohne diese Liste verwenden weiterhin die
Standards.

Die UI spricht jetzt von „Zeitfenster“ statt „Tageszeit“.

Ein gelöschtes eigenes Zeitfenster zerstört keine Notiz. Die Verknüpfung bleibt als
fehlender Kontext sichtbar und kann bewusst entfernt werden.

## Einstellungen / CRUD

Unter „Verknüpfungen & Orte“ gibt es einen neuen Block „Zeitfenster“.

Dort werden die vier Standards read-only angezeigt. Sie sind in diesem Feature bewusst
nicht umbenennbar oder löschbar.

Darunter kann ein eigenes Zeitfenster angelegt werden mit:

- Name, max. 60 Zeichen
- Von, minutengenau
- Bis, minutengenau

„Zweites Frühstück“ ist der Placeholder / das Beispiel, wird aber nicht ungefragt als
Datensatz angelegt.

Eigene Zeitfenster können nachträglich umbenannt und zeitlich geändert werden. Die
stabile ID bleibt erhalten.

Beim Entfernen wird transparent darauf hingewiesen, dass bestehende Verknüpfungen
gespeichert bleiben, aber nicht mehr aktiv sind.

## Persistenz, Import und Export

Es gibt keine DB-Migration und keinen neuen Store.

Der bestehende `settings`-Store nimmt den Datensatz `time-windows` auf. Dadurch ist er
automatisch Teil des bestehenden Exports, Imports, Gesamtlöschens und der lokalen
IndexedDB-Transaktionen.

`schema.js` validiert:

- eigene Zeitfenster im Settings-Datensatz
- stabile Zeitfenster-IDs in Helper-Regeln
- stabile Zeitfenster-IDs in Notiz-Kontexten

Ungültige Uhrzeiten, leere Labels, Start == Ende und doppelte IDs werden abgelehnt.

## Offline / Release

`src/time-windows.js` wurde in die Runtime-Whitelist von `bin/build-pages` und in
`APP_SHELL` des Service Workers aufgenommen.

Version / Cache wurden von 0.7.4 auf 0.7.5 erhöht.

## Bewusste Non-Goals dieses Schnitts

Nicht enthalten sind:

- Bearbeiten oder Löschen der vier Standard-Zeitfenster
- unterschiedliche Zeitfenster je Wochentag
- Kalenderregeln
- Feiertage
- Zeitzonenprofile oder Reiseautomatik
- automatische Schichtplan-Erkennung
- Benachrichtigungen
- Cloud-Sync
- ein generisches Rules-Framework
- automatische Migration von `timeBuckets` auf einen neuen Feldnamen

Das Feature erweitert ausschließlich die vorhandene Kontextmaschine.

## Geänderte Dateien

Neu:

- `src/time-windows.js`

Geändert:

- `src/context.js`
- `src/schema.js`
- `src/app.js`
- `src/notes.js`
- `src/note-views.js`
- `index.html`
- `bin/build-pages`
- `sw.js`
- `package.json`
- `README.md`
- `docs/NOTES.md`

## Test-Handoff für Codex

Die Implementierung wurde bewusst ohne neue oder angepasste Tests abgeschlossen. Codex
soll die Tests unabhängig aus dem Verhalten ableiten und bestehende Regressionen finden.

Mindestens zu prüfen:

1. Alle vier alten Default-Buckets funktionieren unverändert an ihren Grenzen.
2. Ein eigenes Fenster innerhalb eines Defaults matcht zusätzlich, nicht statt des Defaults.
3. Ein Fenster über Mitternacht, z. B. 22:00–06:00, matcht auf beiden Seiten von 00:00.
4. Start ist inklusive, Ende exklusive.
5. `nextTimeBoundary()` reagiert auf Start UND Ende eigener Fenster.
6. Mehrere überlappende ausgewählte Zeitfenster können gleichzeitig „Warum jetzt?“ erklären.
7. Helper können eigene Zeitfenster speichern und nach Reload wieder auswählen.
8. Notizen und Personen-Notizen können eigene Zeitfenster speichern und unter „Jetzt“ wieder auftauchen.
9. Umbenennen oder Zeitänderung behält dieselbe ID und bestehende Verknüpfungen.
10. Löschen entfernt nur die Definition, nicht Helper-Regeln oder Notizdaten.
11. Fehlende Zeitfenster werden verständlich dargestellt und crashen nicht.
12. Ungültige Daten werden abgelehnt: leerer Name, >60 Zeichen, ungültige Uhrzeit,
    Start == Ende, doppelte IDs.
13. Import/Export transportiert den Settings-Datensatz vollständig.
14. Alte Exporte ohne `time-windows` funktionieren unverändert.
15. Eigene Zeitfenster erzeugen keine Netzwerkrequests.
16. Reflow / Bedienung bei 320 CSS px und 200 % Text bleibt brauchbar.
17. Offline-Build enthält `src/time-windows.js`.
18. Bestehende Tests, die explizit „Tageszeit“ als UI-Text erwarten, müssen fachlich auf
    „Zeitfenster“ angepasst werden, nicht durch Compatibility-Hacks im Produktcode.

## Branch / Commits

Branch: `feature/custom-time-windows`

Bisherige Implementierungscommits:

- `fe06dd38` · `feat: add custom time window model`
- `1a912267` · `feat: manage named time windows`

Die unabhängige Prüfung ist im [Prüfbericht](TIME_WINDOWS_TESTS.md) dokumentiert,
einschließlich neuer Tests, einer Reflow-Korrektur und verbleibender Prüflücken.
