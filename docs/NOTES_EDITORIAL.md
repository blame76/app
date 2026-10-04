# Notes Editorial Craft · 0.6.2

Der fertige funktionale Stand `c01f068` wurde zuerst lokal in `main` übernommen.
Dieser Gestaltungspass entsteht separat auf `feat/notes-editorial-craft`.

## Form und Funktion

Die Notizen-Gestaltung liegt in `assets/notes.css`, getrennt von Shell-Styles und
Notizfunktionen. `src/note-presentation.js` gibt ausschließlich Klassen zurück:
einzeilige Texte bis 80 Zeichen gelten als kurze Gedanken; mehr als 240 Zeichen
oder mehr als drei Zeilen als Fließtext. Diese Darstellungsklassen werden weder
gespeichert noch für Matching, Reihenfolge oder Navigation verwendet.

Die Renderer ergänzen nur Klassen und eine kompakte Darstellung der Bearbeitungszeit.
IDs, Controls, Formulardaten, Events und semantische Lesereihenfolge bleiben erhalten.
`notes.js`, `schema.js`, `context.js`, `db.js`, `retention.js`, `navigation.js` und
die Helper bleiben unverändert. Die Shell-Änderung betrifft nur die Klasse im
Notiz-Kachel-Markup. Kein neues Datenmodell und keine Migration.

Stylesheet und Präsentationsmodul sind im expliziten Pages-Paket sowie im Offline-
Precache enthalten. Package-Version und Cache sind gemeinsam auf `0.6.2` erhöht.
Worker-Verhalten und Speicherlogik bleiben unverändert.

## Composition

Die Liste ist eine offene Leseseite. Kleine Tagesmarken stehen auf breiten Ansichten
am Beginn des Textes; die tabellarische Uhrzeit hängt in einer eigenen Randspalte.
Mobil beginnt der Eintrag mit der Zeit und einem kurzen Abstand zum Text.

Zwischen kurzen Gedanken ist die Pause kleiner als neben längerem Fließtext.
Tageswechsel haben die längste Pause. Erster und letzter Eintrag brauchen keine
zusätzlichen Karten, Rahmen oder Trennlinien. Personen-Kapitel verwenden denselben
Rhythmus; ihr vorhandenes Datum bleibt hinter dem Inhalt.

## Typography

Lokale Serifenschrift für den Text, System-Sans für Zeit, Kapitel und Kontext.
Kurze Gedanken haben einen größeren, leicht gespannten Satz; längere Texte
kleineren Fließtext mit 1,7-facher Zeilenhöhe und bis zu 50 Zeichen Satzbreite.
Mehrzeilige Zwischenformen liegen dazwischen. Absatzumbrüche bleiben unverändert.
`text-wrap: pretty` und deutsche automatische Silbentrennung helfen dem Fließtext;
kurze Gedanken nutzen ausgeglichene Zeilen. Keine geladenen Schriften.

## Detail

Inhalt → Erstellungszeit → Kontext → lange Pause → Aktionen. Metadaten rücken leicht
ein und tragen keinen Rahmen. Bearbeiten ist die erste Textaktion, Kontext die nächste;
Löschen folgt kleiner und mit eigener Pause. Im Hover wird Löschen farblich erkennbar.
Der bestätigende native Löschdialog bleibt erhalten.

„Bearbeitet 11:20“ ersetzt das zweite ausführliche sichtbare Datum. Der vollständige
Zeitpunkt bleibt in `datetime`, Tooltip und zugänglichem Label erhalten.

Der Editor verwendet dieselbe Schrift und Satzbreite wie die gelesene Notiz. Eine
untere Linie markiert das Schreibfeld, eine 3 px starke Fokuslinie dessen aktiven
Zustand. Im erzwungenen Farbmodus bleibt stattdessen die klassische 3-px-Umrandung.
`field-sizing: content` lässt unterstützende Browser den vollständigen Text zeigen;
ohne Unterstützung bleibt das native, vertikal vergrößerbare Textfeld erhalten.

## Now Tile

Die vorgemerkte Notiz bleibt ein vollständig klickbarer Eintrag. Sie steht offen
über die ganze Zeile, mit einer kurzen 2-rem-Linie, sekundärem Label, lesbarem
Serifentext und Kontext darunter. Bei Personen ist der Name sofort sichtbar.
Die vorhandene Begrenzung auf vier Vorschauzeilen bleibt bestehen; die Detailansicht
zeigt weiter den gesamten Text. Helper behalten ihre eigenen Flächen.

Es gibt genau zwei Notes-Signaturen: die hängende Zeitspalte und die kurze Linie
der unter „Jetzt“ hervorgeholten Notiz.

## Microdetails und Light / Dark

Baseline der Zeit, gemeinsamer Textbeginn der Kapitel, differenzierte Lesepausen,
Kontextabstand und ruhige Textaktionen tragen den Pass. Hover erzeugt keine Karte;
Tastaturfokus bleibt sichtbar. Native Mindesthöhen von 48 px bleiben erhalten.
Pressed States und Reduced Motion stammen unverändert aus der Shell.

Beide Ansichten verwenden die bestehenden kontrastreichen Tinten- und Flächentokens:
warme Papierfarbe mit Espresso in Light, warmes Dunkel mit Elfenbein in Dark.
Typografie, Satzbreite und Rhythmus bleiben gleich. Keine Texturen oder Dekoration.

## Second pass

Nach der ersten Umsetzung wurden Liste mobil/breit, kurze/lange Details, Editor,
Personen-Kapitel, Kontext, Auswahl, Löschdialog, „Jetzt“, Einzel- und Leerzustände
anhand eigener Browser-Screenshots in beiden Paletten gesichtet.

Das Review fand zwei konkrete Schwächen: Die reguläre Fokusumrandung machte den
Editor wieder zur harten Formularbox; bei langem Text zeigte das native Feld zuerst
den unteren Absatz. Fokuslinie und CSS-Inhaltsgröße lösen beides als Darstellungsfrage.
Das zweite ausgeschriebene Datum wurde zusätzlich auf eine ruhige Bearbeitungszeit
reduziert. Anschließend wurden die geänderten Screens erneut visuell geprüft.

## Prüfung

Automatisierte und visuelle Prüfungen verwenden isolierte Browser-Kontexte und
synthetische Daten, keine vorhandenen Nutzerdaten. Screenshots liegen unter
`/tmp/0815-notes-craft-{light,dark}-*.png`.

- `npm test`: **10/10 Testsuiten bestanden**, einschließlich Build, Schema, Notes und Worker.
- `TZ=Europe/Berlin node --test tests/drink.mjs tests/read-views.mjs tests/notes.mjs tests/person-notes.mjs`:
  **4/4 bestanden**.
- `node bin/build-pages`: **29 Runtime-Dateien**, einschließlich separater Darstellung.
- Syntaxprüfung aller geänderten JS-Dateien und `git diff --check`: bestanden.
- **14/14 Browser-Gates, 831 bestandene Checks**:

| Gate | Checks |
| --- | ---: |
| Notes Craft | 106 |
| Notes Complete | 120 |
| Personen-Notizen | 90 |
| Read Views | 40 |
| Navigation | 26 |
| Design | 22 |
| Editorial | 154 |
| Sprache | 36 |
| Schmerz | 88 |
| Rabatt | 34 |
| Trinken | 41 |
| Persönliche Einträge | 30 |
| Shell | 25 |
| Echter Offline-Betrieb | 19 |

Der Craft-Gate ergänzt den Bestand um Liste, Detail, Editor, Kontext,
Personen/Geschenke, „Jetzt“, Reflow, Metadaten, Hover/Fokus, Pressed State,
erzwungene Farben, native Größenänderung und unveränderte Stores.

Die bestehenden Browser-Gates ergänzen diese Sichtprüfung um den vollständigen
Notiz-Lebenszyklus, Fehler/Retry, Import/Export, Matching, Navigation und echten Offline-Betrieb.
Browser-Abdeckung ist Chromium; CSS-Inhaltsgröße bleibt eine progressive Erweiterung.
