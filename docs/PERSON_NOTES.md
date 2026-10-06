# Personen-Notizen · v0.6.1

Der Notes-Branch `feat/notes-complete` wurde zuerst lokal per Fast-forward in `main`
übernommen (`207f349`). Diese Erweiterung entsteht separat auf `feat/person-notes-complete`.

## Für Mama etwas festhalten

`Person → Mama → Notiz → Hinzufügen` speichert die Frage vollständig. Danach lässt
sich freiwillig ein vorhandener Ort („Bei Mama“) oder eine zentrale Tageszeit
verknüpfen. Beide zusammen bedeuten **Ort ODER Tageszeit**. Bei passendem Kontext
zeigt „Jetzt“ den Namen, die Frage und den aktuellen Grund. Ein Blick reicht für den
Inhalt; Öffnen führt zur gemeinsamen Notizdetailansicht und verändert keine Daten.

Ohne Verknüpfung bleibt eine normale Personen-Notiz unter Mama. Beim Erfassen von
Mamas Seite ist sie bereits vorausgewählt. Auf der Personenseite können bestehende
Notizen und Geschenkideen geöffnet, bearbeitet, verknüpft und bestätigt gelöscht
werden. Das Kapitel heißt „Notizen“; der gespeicherte historische `kind: 'reference'`
bleibt erhalten. Geschenkideen behalten `kind: 'gift'` und passende UI-Labels.

## Gemeinsamer Lebenszyklus

Die bestehenden Notes-Modellfunktionen, Views, der Quick-Follow-up, Context-Matching
und Parent-Stack werden wiederverwendet. Kein zweiter Notizbereich, Helper, Store,
Router oder Ortungsmechanismus. Das alte Schema bleibt gültig:

```js
{
  id, type: 'person-note', personId,
  kind: 'reference', // oder 'gift'
  text, createdAt,
  // optional:
  updatedAt,
  context: { placeIds: [], timeBuckets: [] }
}
```

Textbearbeitung erhält ID, Person, Art, Erstellungszeit und Kontext. `updatedAt` ändert
sich nur bei geändertem Inhalt. Kontextänderungen erhalten Text und Zeitstempel.
Jede Verknüpfung ist änderbar und einzeln entfernbar. Kontextfehler verlieren die schon
gespeicherte Notiz nicht. Ein Retry beim Anlegen einer neuen Person verwendet dieselbe
bereits gespeicherte Person, wenn Name und Formular unverändert sind.

Ortsmatches haben wie zuvor Vorrang vor Tageszeiten; danach zählt die neueste
Erstellungszeit. Das Dashboard begrenzt Helper, normale Notizen und Personen-Notizen
gemeinsam ohne stilles Anzeigelimit. Geolocation läuft einmal über die vorhandene Shell, wenn
mindestens eine relevante Ortsverknüpfung besteht. Eine verweigerte Ortung verhindert
keinen Tageszeitmatch. Namen werden aktuell aus `people` gelesen und sicher als Text
gerendert; fehlende Personen bleiben als „Person nicht mehr gespeichert“ erkennbar.

Zurück führt `Personen → Mama → Notiz → Edit/Kontext` jeweils zum Parent und stellt
den Trigger-Fokus wieder her. Löschen aus Mamas Seite führt zurück zu Mama, aus „Jetzt“
zurück zum Dashboard. Gelöscht wird nur der Eintrag einschließlich Kontext, niemals
die Person oder andere Notizen. Abbrechen/Escape und Speicherfehler erhalten Daten.

## Gestaltung, lokal und offline

Personen-Einträge bleiben frei gesetzter Inhalt ohne Einzelkarten. Frage zuerst,
kleines Datum und Kontext danach. In „Jetzt“ bleibt „NOTIZ“ sekundär, während Name
und Frage ohne Öffnen lesbar sind. Die Detailseite nennt die Person vor dem Text.
Light-/Dark-Sichtprüfung: 390 px sowie Desktop; lange Namen/Fragen passen bei
320 CSS px und 200 % Text. Tastatur, Fokus und Reduced Motion sind geprüft.

Alles bleibt lokal, ohne neue Dienste, Kontakte, Analytics oder Notifications. Kein
Todo-Status und kein automatisches Kontextlernen. IndexedDB-Version und Importformat
bleiben unverändert. Die optionale Feldvalidierung gilt nun für beide Notiztypen;
Export/Import erhält die vollständigen Datensätze. Paket-/Cache-Version ist `0.6.1`.

## Prüfungen

`npm test`: alle zehn Node-Testdateien erfolgreich, einschließlich des neuen
`person-notes.mjs` sowie bestehender Notes-, Schema-, Build-, Service-Worker- und Helper-Prüfungen.
Zusätzlich Berliner Zeitgrenzen:

```sh
TZ=Europe/Berlin node --test tests/drink.mjs tests/read-views.mjs tests/notes.mjs tests/person-notes.mjs
```

Browser-Gates verwenden isolierte Chromium-Kontexte und echte IndexedDB:

| Gate | Erfolgreiche Checks |
| --- | ---: |
| `person-notes-browser-check.js` | 90 |
| `notes-browser-check.js` | 120 |
| `read-browser-check.js` | 40 |
| `language-browser-check.js` | 36 |
| `navigation-browser-check.js` | 26 |
| `browser-check.js` | 25 |
| `design-check.js` | 22 |
| `personal-object-check.js` | 30 |
| `editorial-browser-check.js` | 154 |
| `pain-browser-check.js` | 88 |
| `discount-browser-check.js` | 34 |
| `drink-browser-check.js` | 41 |
| `helpers-offline-check.js` | 19 |

Das Personen-Gate prüft alte Notizen, Text/Cancel/Fehler, beide Kontexte und OR-Matching,
sichtbare Person/Frage unter „Jetzt“, Commit vor Follow-up, Kontextfehler ohne Verlust,
vorbelegte Person, Retry, Parent-/Fokus-Navigation, bestätigtes Löschen, unveränderte
andere Datensätze und Import/Export. Der Offline-Gate ergänzt Erfassen, Bearbeiten,
Ort/Tageszeit, „Jetzt“ nach Reload und Löschen einer Personen-Notiz mit echtem Worker.
Die Standortquelle ist kontrolliert simuliert, keine reale Geräteortung.

Screenshots: `/tmp/0815-person-notes-{light,dark}-{now,person,detail,person-desktop}.png`.
Echte Screenreader, Gerätezoom und weitere Browser wurden nicht geprüft.
