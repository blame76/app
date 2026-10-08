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

## Personen und wichtige Daten · v0.9.0

Eine Person besteht aus ihrem Datensatz in `people` sowie verknüpften
Notizen/Geschenkideen (`person-note`) und wichtigen Daten (`person-date`) in `entries`.
„Person bearbeiten“ ändert nur den getrimmten, nichtleeren Namen; ID, `createdAt`
und alle Einträge bleiben erhalten. „Person löschen“ verlangt eine Bestätigung mit
aktuellen Anzahlen. Person und **alle** Einträge mit derselben `personId` werden
atomar gelöscht, einschließlich unbekannter künftiger Typen. Ein abgebrochener
Schreibvorgang lässt den gesamten Bestand unverändert. Personenbezogene Schreibvorgänge
prüfen die Person in derselben Transaktion, damit ein spätes Speichern nach einer
Löschung keine verwaisten Einträge erzeugt.

Wichtige Daten besitzen `id`, `type: 'person-date'`, `personId`, einen freien `label`
(maximal 100 Zeichen), `createdAt`, `recurrence` und `showBeforeDays` (0–365 ganze Tage).
`once` speichert ein vollständiges lokales `date: 'YYYY-MM-DD'`; `yearly` speichert
nur `month` und `day`, ohne bedeutungsloses Jahr oder Altersberechnung. Die jeweils
andere Datumsdarstellung und unbekannte Felder werden abgewiesen. Der 29. Februar
ist jährlich erlaubt und wird ausschließlich in Schaltjahren fällig.

Die Personenseite bietet Anlegen, Öffnen, Bearbeiten und bestätigtes Einzellöschen.
„Jetzt“ zeigt jede relevante Gelegenheit als eigene Karte: Person, etwa
„Geburtstag in 7 Tagen“, und Datum. Der Vorlauf beginnt am lokalen Tagesanfang,
der Ereignistag ist eingeschlossen; danach verschwindet die Karte, der Eintrag
bleibt gespeichert. Die Berechnung nummeriert lokale Kalenderkomponenten statt
verstrichene Stunden zu zählen und funktioniert über Sommerzeit- und Jahresgrenzen.
Jährliche Daten werden für das nächste gültige Jahr berechnet, auch bei Vorlauf
im Dezember für einen Januartermin.

Eine reine Projektion trägt den Vorlaufbeginn und während der Sichtbarkeit die
nächste lokale Mitternacht zum vorhandenen Context-Timeout bei. Dadurch wechseln
Sichtbarkeit und Tagesangabe auch bei geöffnetem Dashboard. Keine zweite Planung,
kein Polling, keine neuen Context-Typen. Von einer Jetzt-Karte führt Zurück:
Datum → Person → Startseite; von der Personenübersicht bleibt diese als Parent erhalten.

Exportformat 1/2 und DB-Version 2 bleiben erhalten. Neue Datumseinträge werden
exportiert und vor Import streng geprüft, einschließlich ihrer Personenzuordnung.
Alte Exporte bleiben gültig. Alle Abläufe bleiben lokal und offline.
**Kein Kalender und keine allgemeinen Terminserien**, Uhrzeiten oder Benachrichtigungen.

Neue Prüfdateien: `tests/person-dates.mjs` und `tests/people-dates-browser-check.js`.
Der Browser-Gate verwendet isolierte Daten, prüft den Mitternachtstimer, Navigation,
Bearbeitung, Tastaturbestätigung, Cascade-Rollback, Import/Export und echte Offline-
Abläufe sowie 320 CSS px / 200 % Text in Light, Dark und Signature.

Prüflauf dieser Erweiterung (Chromium, isolierte Profile):

| Gate | Bestandene Checks |
| --- | ---: |
| `people-dates-browser-check.js` (online und wirklich offline) | 83 |
| `person-notes-browser-check.js` | 90 |
| `notes-browser-check.js` | 120 |
| `read-browser-check.js` | 40 |
| `browser-check.js` | 28 |
| `navigation-browser-check.js` | 26 |
| `context-core-browser-check.js` | 17 |
| `now-surface-browser-check.js` | 84 |
| `design-check.js` | 22 |
| `signature-browser-check.js` | 107 |
| `helpers-offline-check.js` | 36 |

`npm test` mit Node 22.23.2: alle 19 Testdateien bestanden. Zusätzlich bestanden:
Berliner Zeitzone für Personen-Daten, Personen-Notizen, Notizen und Leseansichten;
Syntax aller JS-/MJS-Dateien, Worker und Buildskript; `git diff --check` und
Pages-Build (51 Dateien). Datensatzvalidierung und Import/Export bleiben im
unveränderten Format. Der bestehende Now-Browser-Gate wurde an den bereits auf
`main` vorhandenen Trainingsstart angepasst; keine Änderung am Training selbst.

Automatisiert geprüft sind Labels/Fieldset, Fokus nach Speichern und Löschen,
Escape/Enter im Löschdialog, Reflow bei 320 px / 200 % Text sowie bestehende
Kontrast- und Reduced-Motion-Gates. Personenansicht und Datumsformular wurden
zusätzlich als Chromium-Screenshots visuell geprüft.
Offen bleiben echte Screenreader, Geräte-/Browserzoom, Safari/Firefox und eine
installierte PWA auf Mobilgeräten. Diese manuellen Abnahmen sind nicht durch die
Chromium-Automation abgedeckt.
