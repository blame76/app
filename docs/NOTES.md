# Notes Complete · v0.6.0

## Bestehende Basis und Modell

Notizen bleiben Shell-Inhalte im IndexedDB-Store `entries`, keine Helper. Der vorhandene
Quick Composer, die Tagesgruppen in `read-views.js`, die Parent-Navigation und der
generische Import/Export werden weiterverwendet. Neue optionale Felder:

```js
{
  id, type: 'note', text, createdAt,
  updatedAt, // nur bei tatsächlicher Textänderung
  context: { placeIds: [], timeBuckets: [] }
}
```

Alte Datensätze ohne `updatedAt` oder `context` bleiben unverändert gültig. Auch leere
oder teilweise angegebene Kontextobjekte funktionieren. Kein neuer Store, kein
IndexedDB-Versionswechsel und keine Datenmigration. Importversion 1/2 bleibt erhalten;
optionale Zeitstempel, eindeutige Orts-IDs und zentrale Tageszeiten werden validiert.
Der Export enthält die vollständigen Datensätze. Entfernte Orte behalten eine sichtbare,
entfernbare Verknüpfung („Ort nicht mehr gespeichert“), erzeugen aber kein Ortsmatching.

## Lebenszyklus und Kontext

Quick Capture speichert und wartet auf den Commit, bevor „Gespeichert / Wann wieder
zeigen?“ erscheint. „Fertig“ beendet sofort; Orte und Tageszeiten sind freiwillig.
Fehler beim Kontext verlieren die bereits gespeicherte Notiz nicht. Derselbe
Kontexteditor ist später aus der Detailansicht verfügbar. Die Erfassung und spätere
Kontextansichten verwenden eigene Element-IDs, auch wenn beide zugleich geöffnet sind.

Bearbeiten ersetzt den Text desselben Datensatzes, erhält `id`, `createdAt`, Kontext
und weitere Felder. `updatedAt` ändert sich nur bei einer tatsächlichen Textänderung.
Unveränderte importierte Texte einschließlich Rand-Whitespace bleiben erhalten.
Abbrechen und Zurück speichern keinen Entwurf; leerer Text ist nicht speicherbar.

Kontext verwendet gespeicherte `places`, `matchingPlaces()`, `getPosition()` und
`TIME_BUCKETS` (`morning`, `midday`, `evening`, `night`). Jeder Ort und jede Tageszeit
kann ausgewählt, ersetzt und einzeln entfernt werden. Kontextänderungen berühren
weder Text noch Zeitstempel und aktualisieren „Jetzt“.

Die Semantik ist ausdrücklich **Ort ODER Tageszeit**. Ein Ortsmatch hat Rang 400,
ein Tageszeitmatch Rang 200; innerhalb desselben Rangs zählt die ursprüngliche
Erstellungszeit, neueste zuerst, bei Gleichstand die ID. Die bestehenden Helper-Ränge
bleiben erhalten. „Jetzt“ begrenzt Helper und Notizen gemeinsam auf neun Einträge.
Ohne passenden expliziten Kontext erscheint keine Notiz. Standortfehler verhindern
keinen Tageszeitmatch. Es gibt keine zweite Standortabfrage pro Dashboardauswertung.

Öffnen hat keine Schreibwirkung: kein Lesen-/Erledigt-Status, keine Entkopplung.
Löschen ist ausschließlich aus der Detailansicht mit einem nativen Modal erreichbar.
Abbrechen/Escape erhält Daten und stellt Fokus wieder her. Bestätigung entfernt den
ganzen Datensatz einschließlich Kontext; bei Speicherfehler bleiben Modal und Detail
mit erneut nutzbarer Aktion erhalten. Danach führt die Navigation zum tatsächlichen
Parent: Notizen oder Dashboard. Edit- und Kontextansichten verwenden denselben
vorhandenen Parent-Stack; Fokus geht zum ursprünglichen Trigger zurück.

## Gestaltung und zweiter Pass

Kleine Tageskapitel, freie Abstände und mehrzeilige Serifentexte ersetzen Log-Zeilen;
ein Listeneintrag öffnet seine Detailansicht ohne Einzelkarte. Die Detailansicht gibt
dem Text Raum, gefolgt von leisen Zeitangaben, Kontext und Aktionen. Löschen steht
abseits der normalen Aktionen. „Jetzt“-Notizen erhalten einen eigenen offenen Satz
mit sekundärem NOTIZ-Label und Kontext, getrennt von monolithischen Helper-Kacheln.

Nach dem funktionalen Pass wurden anhand der Light-/Dark-Screenshots Kontextabstände
und mobile Metadaten verfeinert. Der doppelte Erfolgs-Toast im Capture-Follow-up wurde
entfernt, damit „Fertig“ vollständig frei bleibt. Kontextfehler stehen direkt im
Formular. Fokus erreicht den Folge-Zustand schon vor dem Laden der Kontextoptionen.
Lange Texte, Reflow, Tastatur, Touchhöhen, Modal-Fokus und Reduced Motion sind geprüft.
Nur lokale Fonts und bestehende Farb-/Abstandstokens werden verwendet.

## Lokal und offline

Keine neuen APIs, externen Requests, Analytics, Notifications oder Berechtigungen.
Geolocation verwendet ausschließlich die vorhandene Plattformfunktion. Die beiden
neuen Shell-Module stehen in Service-Worker-Precache und Pages-Whitelist. Paketversion
und Cache wurden gemeinsam auf `0.6.0` erhöht. Keine Todo- oder Scheduling-Funktion.

## Validierung

Ausgeführt: `npm test` (neun Testdateien: `discount`, `drink`, `notes`, `pages-build`,
`pain`, `read-views`, `schema`, `service-worker`, `smoke`). Zusätzlich Berliner
Zeitgrenzen: `TZ=Europe/Berlin node --test tests/drink.mjs tests/read-views.mjs tests/notes.mjs`.

Browserfunktionen in isolierten Chromium-Kontexten mit echter IndexedDB:

| Gate | Erfolgreiche Checks |
| --- | ---: |
| `notes-browser-check.js` | 120 |
| `browser-check.js` | 25 |
| `design-check.js` | 22 |
| `language-browser-check.js` | 34 |
| `navigation-browser-check.js` | 26 |
| `read-browser-check.js` | 40 |
| `pain-browser-check.js` | 88 |
| `discount-browser-check.js` | 34 |
| `drink-browser-check.js` | 41 |
| `personal-object-check.js` | 30 |
| `editorial-browser-check.js` | 154 |
| `helpers-offline-check.js` | 17 |

Das Notes-Gate prüft alte Notizen, Commit vor Follow-up, beide Kontextarten,
Textbearbeitung/Cancel/Fehler, OR-Matching/Priorisierung/Limit, bestätigtes Löschen und
Fehler/Retry, Parent-Navigation/Fokus, Export/Import, sichere Textdarstellung,
320/390/1280 CSS px, 200 % Text und Reduced Motion in Light/Dark.
Das Offline-Gate verwendet den tatsächlichen Modul-Service-Worker und prüft zusätzlich
Capture, Bearbeiten, Kontext, „Jetzt“ nach Reload und Löschen ohne Netzwerk.

Ein älteres Sprachfixture ließ die simulierte Ortungsverweigerung vor einem späteren
erwarteten Ortsmatch aktiv; es setzt diese nun ausdrücklich zurück. Bestehende
Capture-Gates beenden den neuen freiwilligen Follow-up mit „Fertig“.
Screenshots: `/tmp/0815-notes-{light,dark}-{capture,read,detail,now,read-desktop}.png`.
Reale Geräteortung, echte Screenreader, Gerätezoom und weitere Browser wurden nicht geprüft.
