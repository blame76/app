# Einen 0815-Helper hinzufügen

Ein Helper ist eine kleine eigenständige Funktion in der Shell. Fachlogik und UI
liegen in `src/helpers/<id>/`; Navigation, Einstellungen und Speicherung stellt
die Shell bereit. Es gibt eine statische Registry, keine dynamische Installation.
Dies ist der kanonische Guide für Menschen und Coding-Agenten. Er beschreibt den
vorhandenen Code, insbesondere
[`contract.js`](../src/helpers/contract.js) und [`app.js`](../src/app.js).

## Golden Path und Änderungsumfang

Nach [AGENTS.md](../AGENTS.md): diesen Guide lesen, einen passenden Referenz-Helper
ansehen, fachlichen MVP festlegen, Helper anlegen, registrieren, prüfen und die
Checkliste unten durchgehen. README und Architektur-/Design-Archive sind dafür
nicht erforderlich.

| Normalerweise ändern | Wofür |
| --- | --- |
| `src/helpers/<id>/index.js` | Default-Export mit Deklaration und `mount()`; Fach-UI |
| optional `model.js`, `styles.css`, lokale Assets im selben Ordner | testbare Fachlogik, benötigte Darstellung; CSS unter eigener Helper-Klasse begrenzen |
| `src/helpers/registry.js` | einmaliger Import und Eintrag in `HELPERS` |
| `tests/<id>.mjs`, `tests/<id>-browser-check.js` | Fachverhalten und echter Browserablauf nach vorhandenen Mustern |
| `tests/helpers-offline-check.js` | neuen fachlichen Offline-Flow ergänzen; Asset-Prüfung nutzt schon die Registry |
| `package.json`, `sw.js` | bei Runtime-Integration Version und Cache-Namen gemeinsam erhöhen |
| kurze Helper-README / relevante bestehende Dokumentation | Datenbedeutung und bewusst gewählter Scope, falls erklärungsbedürftig |

Für einen normalen Helper braucht es keine Änderung an `src/app.js`, `db.js`,
`schema.js`, `context.js`, Navigation, `index.html`, globalem CSS oder Build-Whitelist.
`dist/` und `pages` werden generiert. Bestehende fremde Arbeiten erhalten.

## Helper oder Plattform?

Nur diese Fachdomäne betroffen → Helper: Schmerzereignis, Rabattberechnung oder
eine mögliche aktive Parkposition. Gemeinsame Fähigkeiten → bestehende Plattform:
Place/Time/Interval, Navigation, Storage-Primitiven, Import/Export und allgemeine
Einstellungen. Ort, Notiz und Person im Footer sind Core-Funktionen, keine Helper.

Bestehende Plattformfunktionen wiederverwenden; neue Gemeinsamkeiten nicht
vorsorglich abstrahieren. **Rule of Three / YAGNI:** erst konkrete wiederkehrende
Anwendungsfälle verstehen, dann eine gemeinsame Abstraktion erwägen. Fehlt eine
API für den Kernnutzen, Bedarf und kleinste Erweiterung begründen, bevor die
Plattform geändert wird.

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

Pflicht: nichtleere Strings `id`, `label`, `category` und Funktion `mount`;
`id` ist ein eindeutiger Slug aus Kleinbuchstaben/Ziffern mit einzelnen Bindestrichen.
Optional: `defaultVisible` (boolean), `contexts`, `defaults`, `offlineAssets`,
`validateEntry` (Funktion), `guidance: true`, `retention: { defaultWindow }`.
Die Details folgen unten. Der ausführbare Contract ist die maschinelle Prüfung,
kein zusätzliches JSON-Schema nötig. `npm test` prüft auch die echte Registry.

## Fokus und Lebenszyklus

`mount({ root, api, signal, launchContext })` darf synchron oder asynchron sein und eine synchrone
Cleanup-Funktion zurückgeben. `launchContext` ist optional und enthält ausschließlich
einen Snapshot eines bereits von der Shell aufgelösten Kontexts, zum Beispiel
`{ place: { id, name } }`; direkte Aufrufe können `null` erhalten. Er ist read-only,
keine Abfrage- oder Live-Context-API. Der Helper besitzt nur seinen Contentbereich:
keine eigene globale Navigation, kein Dashboard, keine anderen Helper. Header,
Zurück und Footer gehören zur Shell.

Navigation bricht `signal` ab, trennt den Root vom sichtbaren DOM und führt Cleanup
einmal aus; auch ein verspätet zurückgegebenes Cleanup wird ausgeführt. Nach jedem
`await` vor weiteren UI-Arbeiten `signal.aborted` prüfen. Eigene Timer und Listener
bereinigen. Alte API-Aufrufe werden abgewiesen; schon gestartete Transaktionen
können abschließen. Fehler in eigenen Eventhandlern selbst behandeln. Formulare
synchron mit `preventDefault()` stoppen und Mehrfachspeichern verhindern.

**Back = logische vorherige Ebene.** Beispiele: Schmerzdetails → Verlauf → Schmerz;
Helper-Einstellungen → Helper → Dashboard; Person → Personen → Startseite.
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
| `await api.getPosition()` | aktuelle Position über die gemeinsame Geolocation-Abstraktion; ausschließlich nach bewusster Fachaktion (Parken) | automatische Helper-Ortung oder Hintergrundtracking |
| `await api.deleteEntry(id)` | eigenen Entry nach Besitzerprüfung löschen; löst erst nach Commit auf | fremde Einträge oder globale Orte |
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

`root` und `signal` stehen neben `api` im Mount-Argument, nicht in `api`.
`openSettings()`, `goBack()` und `goHome()` stoßen geschützte Shell-Navigation an;
sie liefern kein Promise, auf dessen Abschluss ein Helper warten könnte.
Es gibt keine Mount-API für Context-Abfragen oder Export.
`getPosition()` und `deleteEntry()` ergänzen die API für den konkreten Parken-Kernnutzen:
eine ausdrücklich angeforderte aktuelle Position und das Entfernen des aktiven Zustands. Browser-DOM-APIs innerhalb des eigenen Roots und reine gemeinsame
Utilities wie `createNavigation()` sind verwendbar; DB-/Shell-Interna nicht umgehen.

## `recordUse()` bedeutet fachlichen Erfolg

Der Nutzer hat die eigentliche fachliche Aktion erfolgreich abgeschlossen.
**Öffnen ist nicht Benutzung.** Auch Klick, begonnenes Formular, noch nicht erfolgreiche
Berechnung und fehlgeschlagenes Speichern zählen nicht. Schmerz gespeichert,
Rabatt berechnet, Getränk dokumentiert: `recordUse()` danach. Dies steuert
den Startpunkt konfigurierter Intervalle. Eine frühere Nutzung allein ist kein Anlass,
den Helper unter „Jetzt“ zu zeigen.
Scheitert nur diese zweite Speicherung, bleibt die erfolgreiche Fachhandlung
erfolgreich. Ergebnis anzeigen und den Metadatenfehler separat melden; keinen
doppelten Eintrag durch einen vermeintlich notwendigen Retry anbieten.
[Trinkens `saveDrink()`](../src/helpers/drink/model.js) zeigt die kleine Sequenz
`await saveEntry(...)` → separat abgesichertes `await recordUse()`; der Mount
zeigt danach das gespeicherte Ergebnis. Öffnen, Lesen und Zurück schreiben nichts.

## Kontext, Favoriten und Sichtbarkeit

Context bietet einen Anlass, den Helper unter „Jetzt“ anzuzeigen:
`place` = bewusst verknüpfter gespeicherter Ort, `time` = lokale Tageszeit,
`interval` = Zeit seit erfolgreicher Nutzung. Er ist kein Hintergrundtracking,
keine Notification Engine, kein Empfehlungssystem und keine KI.

Für den Context-Kern gelten sieben Produktregeln:

1. „Jetzt“ zeigt definierte aktuelle Anlässe, keine Nutzungsvermutungen.
2. Eine passende konfigurierte Bedingung reicht; Contexts sind ODER-verknüpft.
3. Ein Intervall beginnt ausschließlich nach einer erfolgreichen Fachhandlung mit `recordUse()`.
4. Zeitfenster müssen vor der Auswahl verständlich sein.
5. Eine sichtbare Kachel nennt genau einen wahren, verständlichen Grund.
6. Ortung bleibt eine Vordergrundfunktion und darf sichere Inhalte nicht blockieren.
7. Ohne aktuellen Anlass erscheint ein Inhalt nicht unter „Jetzt“.

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
  interval: { value: 1, unit: 'hour' },
  earlyBy: { value: 15, unit: 'minute' }
}
```

Alle Felder sind optional und brauchen ihre deklarierte Kontextart; Ortsdefaults
gibt es nicht. Zeitwerte: `morning` 05–11, `midday` 11–15, `evening` 15–22,
`night` 22–05, lokale Gerätezeit, Endgrenzen exklusiv. Die IDs bleiben dauerhaft;
die sichtbaren Bezeichnungen und Grenzen stammen aus derselben zentralen Definition.
Intervalle verwenden
`{ value, unit }` mit ganzen Zahlen und `minute`, `hour`, `day`, `week`, `month`
oder `year`; die optionale Vorlaufzeit `earlyBy` darf null sein oder muss kürzer
als das Intervall sein. Alte Exportregeln mit `intervalMinutes` und
`toleranceMinutes` bleiben lesbar und werden beim Öffnen in verständliche Einheiten
überführt. Tage/Wochen sowie Monate/Jahre verwenden lokale Kalenderarithmetik;
ein ungültiger Monatstag wird auf den letzten Tag des Zielmonats geklemmt.

Die Shell wählt alternative Gründe, keine UND-Bedingung: passender Ort vor fälligem
Intervall vor Tageszeit. Ein Intervall beginnt erst nach `recordUse()`; ohne erfolgreiche
Nutzung wird es nicht fällig und bleibt danach bis zur nächsten erfolgreichen Handlung
fällig. Die Vorlaufzeit bedeutet „früher anzeigen“, nicht ein symmetrisches „±“:
1 Stunde mit 15 Minuten Vorlauf wird ab Minute 45 fällig. Eine Nutzung ohne aktuell
passende Regel erzeugt keinen eigenen „Jetzt“-Kandidaten.

Die Anzeige wird beim Rendern des Dashboards ausgewertet. Sichere Zeit- und
Intervallgründe erscheinen, ohne auf Geolocation zu warten. Bei sichtbarer Startseite
und tatsächlich vorhandenen Ortsverknüpfungen ergänzen eine frische Positionsabfrage
und der gemeinsame Geolocation-Observer die Ortsgründe. Navigation und Wechsel in den
Hintergrund stoppen Observer und Zeit-Timeout; Rückkehr wertet lokale Gründe sofort aus
und fragt anschließend eine frische Position ab. Ein einzelner Timeout wartet auf die
nächste relevante Tageszeit- oder Intervallgrenze und plant sich danach neu. Ortungsfehler
entfernen ausschließlich Ortsgründe. Kein Polling, keine Benachrichtigungen oder
Hintergrundprüfung. Der gewählte Radius gilt ohne Genauigkeitsaufschlag für die gemeldete
Position; Kategorien ändern das Matching nicht.
Ohne Standortfreigabe bleiben andere Gründe und „Alle Helfer“ nutzbar.
Das ist unabhängig von den bestehenden Vordergrundprüfungen für PWA-Updates.

## Daten, Validierung und Aufbewahrung

IndexedDB (`0815-local`, DB-Version 2) hat fünf Stores:

| Store | Inhalt / Zuständigkeit |
| --- | --- |
| `entries` | eigene Helper-Fachdaten mit `helperId`; daneben Core-Notizen mit `type` |
| `people` | Core-Personen |
| `places` | Core-Orte und Koordinaten |
| `helperRules` | Shell-Regeln je Helper-ID: Sichtbarkeit, Favorit, Context, optionale Guidance/Retention |
| `settings` | allgemeine Einstellungen und `usage:<id>` mit `lastUsedAt` |

Fachdaten gehören in eigene Entries: so klein wie möglich, aber eindeutig. Die
Shell setzt `helperId`, erzeugt ohne eigene ID eine ID und setzt ohne Angabe
`createdAt` auf jetzt. Weitere Felder müssen JSON sein. Nur IDs eigener Einträge
verwenden. Ein Ereignis kann zusätzlich `entryVersion` und `recordedAt` besitzen;
bei Bearbeitung ID und ursprüngliche Zeitstempel bewusst erhalten. Zeitstempel
sind endliche, nichtnegative Millisekunden seit Unix-Epoch im gültigen Datumsbereich, keine
formatierten Texte. Bei Updates ersetzt `saveEntry()` den vollständigen Entry;
es führt keinen Feld-Merge aus.

IDs sind im gesamten `entries`-Store eindeutig. Neue Ereignisse lassen die Shell
eine ID erzeugen; feste Zustands-IDs mit Helper-ID präfixen (wie `discount-history`).
`helperId` ist dauerhaft, nicht aus einem veränderbaren Label ableiten. Achtung:
`saveEntry()` erzwingt zwar die aktuelle `helperId`, prüft aber nicht den Besitzer
einer bereits vorhandenen ID. Die API ist keine Sandbox für fremden Code; niemals
fremde IDs verwenden oder direkt auf IndexedDB/`db.js` ausweichen.

`validateEntry(entry)` ist optional und prüft Fachfelder beim Schreiben **und vor
Import**. Es muss ohne DOM funktionieren und bei ungültigen Daten werfen. Versions-
und Zeitprüfung, gültige Werte und tatsächliche Feldbedeutung gehören hierher.
Die Shell prüft zusätzlich das gemeinsame JSON-/Eintragsformat. Keine spekulativen
Daten, Phantomwerte oder automatische medizinische Aussagen sammeln.

Neue Entries sind automatisch im allgemeinen Export enthalten. Importdaten sind
unvertrauenswürdig: `schema.js` prüft das gemeinsame Format, `db.js` zusätzlich
`validateEntry()` der registrierten Helper beim Import vor dem ersten DB-Zugriff. Import ersetzt
nach Bestätigung alle Stores atomar; Fehler rollen die Transaktion zurück.
Exportformat 2 verlangt alle fünf Stores, Format 1 darf `helperRules` auslassen.
Unbekannte Helper erhalten nur die allgemeine Entry-Prüfung. Kein eigener Export
oder neuer Store für einen normalen Helper.

Bei Schemaänderungen bestehende Einträge/Exporte berücksichtigen: alte Formate
weiter lesen oder eine konkrete Migration planen und testen; IDs/Zeitbedeutung
nicht still ändern. Es gibt keine automatische Fachschema-Migration. Bestehende
Helper nutzen `entryVersion: 1` und lehnen unbekannte Versionen ab.

Entries können einzelne Ereignisse oder kleinen begrenzten Zustand speichern:
Rabatt ersetzt unter seiner eigenen festen ID eine Historie mit höchstens fünf
Berechnungen. Kein zeitbasiertes Retention-System dafür nötig. Ein solcher Entry
wird atomar ersetzt; Lesen und anschließendes Ersetzen sind **keine gemeinsame
Transaktion**. Gleichzeitige Aktualisierungen derselben ID in mehreren Tabs können
einander überschreiben. Die Mount-API bietet eigene Einzellöschung, aber keine
atomaren Lese-Schreib-Operationen. Nicht direkt an der Shell vorbei speichern;
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
Bei Runtime-Integration Paketversion **und** Worker-Cacheversion erhöhen;
reine Dokumentation benötigt keinen Versionssprung. Der Pages-Packager übernimmt
dieselbe Deklaration und ergänzt den Worker-Cache-Namen um einen Runtime-Hash.
Nach erfolgreichem ersten Laden und Worker-Aktivierung müssen Öffnen, Fachaktion,
Speichern und Wiederherstellen nach Reload offline funktionieren. Erstinstallation
braucht Netzwerk; Ortsverfügbarkeit darf den Kernnutzen nicht blockieren.

Kleines Helper-CSS darf bestehende Tokens nutzen (`--text-primary`, `--text-muted`, `--surface-paper`,
`--accent`, `--display-font`). Vorhandene Controls und Focus View bevorzugen.
Keine eigene Markenwelt, externen Fonts, Icons oder Bildassets. App-Sprache:
**ruhig · präzise · selbstverständlich**. Zustände und Handlungen benennen;
keine Selbstdarstellung, „smarte App“-Sprache, Motivation oder Gamification.

Native Labels, Buttons, Fieldsets und `time` bevorzugen. Tastatur und sichtbaren
Fokus erhalten, Zustandswechsel sinnvoll ankündigen oder fokussieren. Mindest-
Touchfläche 48 px, lange Inhalte bei 320 CSS px, Textvergrößerung, `hidden` und
Reduced Motion prüfen. AA-Kontrast in **Light, Dark und Signature** erhalten:
Text mindestens 4,5:1 (großer Text 3:1), relevante Control-Grenzen/Fokus 3:1.
Statusmeldungen über sinnvollen Ergebnisfokus oder `role="status"`/Live-Region
zugänglich machen; Eingaben eindeutig beschriften. Während Speichern `aria-busy`
setzen und Mehrfachaktionen sperren, nach Abschluss auch am abgetrennten Root
wieder entfernen (relevant für den PWA-Updateschutz).
Patterns: [Trinken im Browser](../tests/drink-browser-check.js) für Ergebnisfokus
und [Design-Gate](../tests/design-check.js) für Tastatur/Reflow. Accessibility Tree
unterstützt die Prüfung; reale Screenreader und Zielbrowser zusätzlich manuell prüfen.

Fachdaten bleiben lokal. Ohne ausdrückliche Produktentscheidung keine externen
APIs, Analytics, Telemetrie oder CDN-Ressourcen. Keine stillen Uploads oder
Hintergrundortung. Nutzerdaten niemals ungefiltert in `innerHTML` schreiben;
`textContent` oder HTML-Escaping verwenden.

## Prüfen und fertigstellen

Im Repo-Root, mit Node.js 22 wie in CI (keine Installation von Dependencies nötig):

```bash
npm test
find src tests -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check
node --check sw.js
node --check bin/build-pages
git diff --check
bin/build-pages
```

`bin/build-pages` ersetzt den generierten Ordner `dist/`; niemals dort eigene Arbeit
ablegen. `npm test` umfasst bereits isolierte Build-Tests. Einen einzelnen Fachtest
mit `node --test tests/<id>.mjs` ausführen; bei lokalen Tagesgrenzen zusätzlich
`TZ=Europe/Berlin node --test tests/<id>.mjs` (Platzhalter ersetzen).

`npm test` prüft Registry, Fachvalidierung, Storage-/Importregeln und Worker ohne
Dependencies. Für neue Helper: Registrierung/Defaults, Minimal-Flow, Grenzwerte,
`recordUse()`-Reihenfolge und Fehler prüfen. Browser-Gate mit echten Entries:
Fokusmodus, Kontextintegration, Tastatur/Fokus, Reflow, lokale Speicherung,
Wiederherstellen und keine externen Requests. Offline mit echtem Worker prüfen.
Server: `python3 -m http.server 8080`. Für einen neuen Helper: eigener Browser-Gate,
`browser-check.js`, `navigation-browser-check.js`, `design-check.js` und
`helpers-offline-check.js`; bei neuen Styles auch `signature-browser-check.js`.
Vorhandene betroffene Fach-Gates zusätzlich ausführen, bei Plattformänderungen die
betroffenen Core-Gates. Einstieg/Limitierungen stehen in
[`tests/README.md`](../tests/README.md#browser). Diese `.js`-Dateien sind
Playwright-Funktionen für ein extern bereitgestelltes Browsertool, keine CLI-Skripte;
`npm test`/`node tests/…js` führen sie nicht aus. Ohne passendes Tool die Abläufe
manuell in einem separaten Testprofil prüfen und automatisierte Prüflücken benennen.
Keinen bestandenen Browser-Gate behaupten, wenn nur Node lief.

Fertig heißt: fachlicher MVP inklusive Fehlerfällen, folgende Checkliste geprüft
und tatsächliche Prüfungen/Limitierungen im PR dokumentiert. Offene Browser-/Offline-
oder Accessibility-Prüfungen sind noch offene Abnahme, kein stillschweigendes Bestehen.

## Eine passende Referenz auswählen

Rabattberechnung, Schmerzlogik, Trinkhistorie, Fach-UI und Datenauswertung gehören
in den Helper, nicht in `app.js`. Pain ist eine komplexere Referenz für Tracking,
Guidance und Retention, keine Pflichtvorlage für jeden Utility-Helper.

**Referenz, keine Copy/Paste-Vorlage.** Für den Start einen Helper auswählen:

- Einfach: [Trinken/index.js](../src/helpers/drink/index.js), bei Bedarf seine
  [model.js](../src/helpers/drink/model.js): eine lokale Fachaktion, Commit vor
  Nutzungsmetadaten, Busy-/Fehlerzustand und Ergebnisfokus. Intervall, heutige
  Historie und Retention nur übernehmen, wenn der neue Scope sie braucht.
- Komplexer: [Schmerz/index.js](../src/helpers/pain/index.js): Unteransichten,
  Parent-Navigation, Ereignisse/Details, Guidance und Retention. Körperlogik und
  Darstellung sind spezifisch, kein universelles Template.
- Alternativ bei Berechnung/begrenztem Zustand:
  [Rabatt/index.js](../src/helpers/discount/index.js) mit fester eigener Entry-ID.

## Non-Goals

Ein Helper soll nicht automatisch zu einem Produkt werden. Keine Accounts,
Cloud Sync, Notifications, Gamification, AI, Analytics oder Sharing vorsorglich
ergänzen. Auch History, eigener Export und zusätzliche Einstellungen brauchen
einen konkreten fachlichen Auftrag. Jeder Helper beginnt mit dem kleinsten
vollständigen Nutzen; optionale Contract-Felder sind keine Feature-Checkliste.

## Helper-Checkliste

- [ ] Kleine Fachfunktion und nötige Daten klar begrenzen.
- [ ] Ordner `<id>` einhalten; keine DOM-Arbeit beim Import.
- [ ] Pflichtfelder prüfen; einmal statisch registrieren.
- [ ] Keine unnötige Plattformänderung oder zusätzliche Abstraktion.
- [ ] Nur sinnvolle `contexts` und gültige Defaults deklarieren.
- [ ] Shell-Navigation, Favoriten und Sichtbarkeit verwenden.
- [ ] Eigene Entries und Fachvalidierung mit Version/Zeitstempeln festlegen.
- [ ] Speichern abwarten; Fehler erhalten die Eingabe.
- [ ] `recordUse()` nur nach Erfolg; Metadatenfehler getrennt behandeln.
- [ ] Abbruch, Cleanup und Mehrfachspeichern beachten.
- [ ] Retention/Guidance nur bei fachlichem Bedarf anbieten.
- [ ] Lokale Ressourcen vollständig unter `offlineAssets` aufführen.
- [ ] Bestehende Gestaltung und sachliche Sprache verwenden.
- [ ] Semantik, Labels, Status, Tastatur/Fokus, 48-px-Touch, 320-px-Reflow,
  200 % Text, AA-Kontrast in allen drei Themes und Reduced Motion prüfen.
- [ ] Daten bleiben lokal; keine neuen externen Requests, sichere Textausgabe.
- [ ] Node-/Browser-/Offline-Gates und Syntax ausführen.
- [ ] Paket-/Cacheversion und relevante Dokumentation aktualisieren.
