# Einen 0815-Helper hinzufügen

Ein Helper ist eine kleine eigenständige Funktion in der Shell. Fachlogik und UI
liegen in `src/helpers/<id>/`; Navigation, Einstellungen und Speicherung stellt
die Shell bereit. Es gibt eine statische Registry, keine dynamische Installation.
Dieser Guide beschreibt den vorhandenen Code, insbesondere
[`contract.js`](../src/helpers/contract.js) und [`app.js`](../src/app.js).

## Minimaler Helper und Registrierung

Das kleinste gültige `src/helpers/example/index.js`:

```js
export default {
  id: 'example',
  label: 'Beispiel',
  category: 'Alltag',
  mount({ root }) {
    root.textContent = 'Noch kein Eintrag.';
  }
};
```

In [`registry.js`](../src/helpers/registry.js) importieren und der vorhandenen
`HELPERS`-Liste hinzufügen. Die Shell prüft Pflichtfelder, eindeutige Slug-IDs und
optionale Fähigkeiten mit `validateRegistry()`. Ohne `defaultVisible: false`
erscheint der Helper in „Alle Helfer“. Gespeicherte Sichtbarkeit hat Vorrang.
Keine DOM-Arbeit beim Modulimport: Auch Node und der Service Worker importieren es.

## Fokus und Lebenszyklus

`mount({ root, api, signal })` darf synchron oder asynchron sein und eine synchrone
Cleanup-Funktion zurückgeben. Der Helper besitzt nur seinen Contentbereich:
keine eigene globale Navigation, kein Dashboard, keine anderen Helper. Header,
Zurück und Footer gehören zur Shell.

Navigation bricht `signal` ab, trennt den Root vom sichtbaren DOM und führt Cleanup
einmal aus; auch ein verspätet zurückgegebenes Cleanup wird ausgeführt. Nach jedem
`await` vor weiteren UI-Arbeiten `signal.aborted` prüfen. Eigene Timer und Listener
bereinigen. Alte API-Aufrufe werden abgewiesen; schon gestartete Transaktionen
können abschließen. Fehler in eigenen Eventhandlern selbst behandeln. Formulare
synchron mit `preventDefault()` stoppen und Mehrfachspeichern verhindern.

Die Shell speichert die vorherige Ansicht in einem kleinen internen Stack. Zurück
von Helper-Einstellungen mountet denselben Helper erneut, ohne Benutzung zu
registrieren. Wird er in den Einstellungen ausgeblendet, folgt die Startseite.
Unteransichten des Helpers registrieren mit `api.setBackAction(callback, title)`
ihren Parent; dort stellt der Helper den Fokus auf Überschrift oder Trigger wieder
her. `api.setBackAction(null)` gibt Zurück an die Shell ab. Lokale Zurück-Controls
verwenden `api.goBack()`. Der Callback wird beim Unmount entfernt und alte APIs
bleiben gesperrt. Pain nutzt dafür denselben `createNavigation()`-Stack wie die Shell.
Nach einer Speicherung darf der Eingabe-Stack zurückgesetzt werden, damit Zurück
keinen abgeschlossenen Speicherschritt wieder öffnet.

Browser-/System-Zurück bleibt Dokumentnavigation. Interne Navigation erzeugt keine
History-Einträge; Reload startet auf der Startseite. Es gibt keinen URL-Router.

## Heute verfügbare API

| Funktion / Wert | Zweck und Einsatz | Nicht verwenden für |
| --- | --- | --- |
| `await api.saveEntry(value)` | eigenen Datensatz schreiben; liefert ihn erst nach Commit mit ID zurück; vorhandene eigene ID aktualisiert ihn | fremde IDs, Einstellungen, vorweggenommene Erfolgsmeldung |
| `await api.listEntries()` | eigene gespeicherte Entries ohne Löschungen lesen, danach fachlich sortieren/filtern | andere Helper, Zugriff auf `people`/`places`/`settings` |
| `await api.recordUse()` | Zeitpunkt einer erfolgreichen Fachhandlung speichern | Öffnen, Tippen, ungültige Eingabe oder fehlgeschlagenes Speichern |
| `await api.getGuidance()` | gespeicherte boolesche Hinweiseinstellung lesen | Navigation oder Fachzustand |
| `await api.setGuidance(boolean)` | bei `guidance: true` Hinweiseinstellung unter Erhalt anderer Regeln ändern | Tutorial-Fortschritt, eigene Settings-Seite |
| `api.openSettings()` | zu den gemeinsamen Einstellungen dieses Helpers wechseln | eigene Intervall-/Orts-/Favoritenverwaltung |
| `api.setBackAction(action, title)` | interne Parent-Ansicht registrieren; `null` auf oberster Ebene | eigene globale Zurück-Buttons oder fachliche Aktionen beim Rücksprung |
| `api.goBack()` | denselben Rücksprung wie der globale Zurück-Button ausführen | Speichern oder `recordUse()` |
| `api.goHome()` | nach einer expliziten Handlung zurück zur Startseite | automatisches Verlassen vor einem Commit |
| `api.toast(message)` | konkrete Fehler oder sonst notwendige Rückmeldung | zusätzliche Erfolgsfeier neben einem eindeutigen Ergebnis |
| `signal` | Abbruch des Mounts erkennen, eigene Ressourcen stoppen | Rückgängigmachen eines bereits committed Eintrags |

**Öffnen ist nicht Benutzung.** Schmerz gespeichert, Rabatt berechnet, Getränk
dokumentiert: `recordUse()` danach. Dies steuert „zuletzt verwendet“ und Intervalle.
Scheitert nur diese zweite Speicherung, bleibt die erfolgreiche Fachhandlung
erfolgreich. Ergebnis anzeigen und den Metadatenfehler separat melden; keinen
doppelten Eintrag durch einen vermeintlich notwendigen Retry anbieten. Pain zeigt
dieses Muster in `saveObservation()` und `record()`; keine Schmerzlogik übernehmen.

## Kontext, Favoriten und Sichtbarkeit

Nur sinnvolle Arten in `contexts` deklarieren: Rabatt → `['place']`, Trinken →
`['interval']`, Pain → `['place', 'time', 'interval']`. Ohne Angabe keine Kontextregeln.
Ortsverknüpfungen werden vom Nutzer in den Shell-Einstellungen angelegt, nicht
durch eigene Ortung im Helper. Favorit und Sichtbarkeit sind immer Shell-Aufgaben.
Ausblenden löscht keine Fachdaten.

Die tatsächlich unterstützte Default-Syntax:

```js
contexts: ['time', 'interval'],
defaults: {
  timeBuckets: ['morning'],
  intervalMinutes: 60,
  toleranceMinutes: 15
}
```

Alle Felder sind optional und brauchen ihre deklarierte Kontextart; Ortsdefaults
gibt es nicht. Zeitwerte: `morning` 00–11, `midday` 11–15, `evening` 15–19,
`night` 19–24, lokale Gerätezeit, Endgrenzen exklusiv. Intervall: `null` oder
endlich ab 1 Minute; Toleranz: `null` oder mindestens 0 und kleiner als das Intervall.

Die Shell wählt alternative Gründe, keine UND-Bedingung: passender Ort vor fälligem
Intervall vor Tageszeit vor gespeicherter Nutzung. Ein Intervall beginnt erst nach
`recordUse()`. Fälligkeit ist `lastUsedAt + (intervalMinutes - (toleranceMinutes || 0)) * 60000`;
60/15 wird ab Minute 45 fällig und bleibt es bei Verspätung. Das „±“ im Einstellungslabel bezeichnet
keine symmetrische Zeitspanne. Vor Fälligkeit kann „zuletzt verwendet“ den Helper
weiterhin unter „Jetzt“ zeigen. Keine Timer, Benachrichtigungen oder Hintergrundprüfung.

## Daten, Validierung und Aufbewahrung

Fachdaten gehören in eigene Entries: so klein wie möglich, aber eindeutig. Die
Shell setzt `helperId`, erzeugt ohne eigene ID eine ID und setzt ohne Angabe
`createdAt` auf jetzt. Weitere Felder müssen JSON sein. Nur IDs eigener Einträge
verwenden. Ein Ereignis kann zusätzlich `entryVersion` und `recordedAt` besitzen;
bei Bearbeitung ID und ursprüngliche Zeitstempel bewusst erhalten.

`validateEntry(entry)` ist optional und prüft Fachfelder beim Schreiben **und vor
Import**. Es muss ohne DOM funktionieren und bei ungültigen Daten werfen. Versions-
und Zeitprüfung, gültige Werte und tatsächliche Feldbedeutung gehören hierher.
Die Shell prüft zusätzlich das gemeinsame JSON-/Eintragsformat. Keine spekulativen
Daten, Phantomwerte oder automatische medizinische Aussagen sammeln.

Entries können einzelne Ereignisse oder kleinen begrenzten Zustand speichern:
Rabatt ersetzt unter seiner eigenen festen ID eine Historie mit höchstens fünf
Berechnungen. Kein zeitbasiertes Retention-System dafür nötig. Ein solcher Entry
wird atomar ersetzt; Lesen und anschließendes Ersetzen sind **keine gemeinsame
Transaktion**. Gleichzeitige Aktualisierungen derselben ID in mehreren Tabs können
einander überschreiben. Die Mount-API bietet derzeit weder einzelne Löschung noch
atomare Lese-Schreib-Operationen. Nicht direkt an der Shell vorbei speichern;
eine generische Erweiterung erst bei einem konkreten fachlichen Bedarf prüfen.

`retention: { defaultWindow: 'always' }` aktiviert die gemeinsamen Optionen `7d`,
`30d`, `365d`, `always`. Betroffen sind nur Entries dieses Helpers anhand von
`createdAt <= jetzt − N × 24 Stunden`, auch wenn er ausgeblendet ist. Einstellungen
und Core-Daten bleiben erhalten. Pruning geschieht beim Start, bei direkten
DB-Lesezugriffen auf Entries und vor Export. Die Helper-API liest für reine
Navigation ohne Pruning. Regeländerung und Löschung committen atomar; Import prüft
zuerst und pruned nach importierter Regel vor dem atomaren Ersetzen. Kein Timer
und keine Löschgarantie bei geschlossener App. Ohne Retention-Opt-in unbegrenzt.

Guidance ist optionale Microcopy, kein Tutorial-System: `guidance: true` aktiviert
den Shell-Schalter, Default an. Der Helper blendet Erklärungen aus, erhält aber
Fragen, notwendige Hinweise und denselben Ablauf. Hilfe ohne zweiten UX-Flow.

## Offline, Gestaltung, Sprache und Privacy

Der Worker precached automatisch `./src/helpers/<id>/index.js` aus der Registry.
**Ordner und Hauptmodul müssen dieser Konvention entsprechen**, auch wenn der
Registry-Import technisch anders möglich wäre. Weitere importierte Module, CSS
und lokale Assets ausdrücklich in `offlineAssets` nennen; Imports werden nicht
rekursiv entdeckt. Zum Beispiel `['./src/helpers/example/model.js']`. Pfade relativ
zur App, ohne Query, Fragment oder `..`. CSS im Mount lokal laden und mit dem Root
oder Cleanup entfernen. Keine zweite Liste von Helpern im Worker pflegen.
Bei Integration Paketversion **und** Worker-Cacheversion erhöhen.

Kleines Helper-CSS darf bestehende Tokens nutzen (`--text-primary`, `--text-muted`, `--surface-paper`,
`--accent`, `--display-font`). Vorhandene Controls und Focus View bevorzugen.
Keine eigene Markenwelt, externen Fonts, Icons oder Bildassets. App-Sprache:
**ruhig · präzise · selbstverständlich**. Zustände und Handlungen benennen;
keine Selbstdarstellung, „smarte App“-Sprache, Motivation oder Gamification.

Native Labels, Buttons, Fieldsets und `time` bevorzugen. Tastatur und sichtbaren
Fokus erhalten, Zustandswechsel sinnvoll ankündigen oder fokussieren. Mindest-
Touchfläche 48 px, lange Inhalte bei 320 CSS px, Textvergrößerung, `hidden` und
Reduced Motion prüfen. Accessibility Tree unterstützt die Prüfung; reale
Screenreader und Zielbrowser müssen zusätzlich manuell geprüft werden.

Fachdaten bleiben lokal. Ohne ausdrückliche Produktentscheidung keine externen
APIs, Analytics, Telemetrie oder CDN-Ressourcen. Nutzerdaten niemals ungefiltert
in `innerHTML` schreiben; `textContent` oder HTML-Escaping verwenden.

## Tests und Grenze der Shell

`npm test` prüft Registry, Fachvalidierung, Storage-/Importregeln und Worker ohne
Dependencies. Für neue Helper: Registrierung/Defaults, Minimal-Flow, Grenzwerte,
`recordUse()`-Reihenfolge und Fehler prüfen. Browser-Gate mit echten Entries:
Fokusmodus, Kontextintegration, Tastatur/Fokus, Reflow, lokale Speicherung,
Wiederherstellen und keine externen Requests. Offline mit echtem Worker prüfen.
Die vorhandenen Browserfunktionen laufen über das bereitgestellte Playwright-Tool,
siehe [`tests/README.md`](../tests/README.md); keine neue Testdependency nötig.

Rabattberechnung, Schmerzlogik, Trinkhistorie, Fach-UI und Datenauswertung gehören
in den Helper, nicht in `app.js`. Pain ist eine komplexere Referenz für Tracking,
Guidance und Retention, keine Pflichtvorlage für jeden Utility-Helper.

Die drei vorhandenen Referenzen:

- [Pain](../src/helpers/pain/README.md): Ereignisse, Historie, Guidance, Retention.
- [Rabatt](../src/helpers/discount/README.md): Berechnung, Ort, begrenzter Zustand.
- [Trinken](../src/helpers/drink/README.md): kleines Ereignis, Intervall, Retention.

## New Helper Checklist

- [ ] Kleine Fachfunktion und nötige Daten klar begrenzen.
- [ ] Ordner `<id>` einhalten; keine DOM-Arbeit beim Import.
- [ ] Pflichtfelder prüfen; einmal statisch registrieren.
- [ ] Nur sinnvolle `contexts` und gültige Defaults deklarieren.
- [ ] Shell-Navigation, Favoriten und Sichtbarkeit verwenden.
- [ ] Eigene Entries und Fachvalidierung mit Version/Zeitstempeln festlegen.
- [ ] Speichern abwarten; Fehler erhalten die Eingabe.
- [ ] `recordUse()` nur nach Erfolg; Metadatenfehler getrennt behandeln.
- [ ] Abbruch, Cleanup und Mehrfachspeichern beachten.
- [ ] Retention/Guidance nur bei fachlichem Bedarf anbieten.
- [ ] Lokale Ressourcen vollständig unter `offlineAssets` aufführen.
- [ ] Bestehende Gestaltung und sachliche Sprache verwenden.
- [ ] Tastatur, Fokus, Touch, Reflow, Reduced Motion und Privacy prüfen.
- [ ] Node-/Browser-/Offline-Gates und Syntax ausführen.
- [ ] Paket-/Cacheversion und relevante Dokumentation aktualisieren.
