# Parken und Orte · Review

## Verhalten

Parken besitzt eine einzelne aktive Position mit optionaler Notiz. Merken und erneutes
Merken fragen ausdrücklich eine aktuelle Position an. Anzeigen zeigt die gespeicherten
Koordinaten; Bearbeiten erhält Position und Zeitpunkt; Löschen entfernt den Zustand.
Karten, Navigation, Historie und automatische Parkerkennung sind nicht enthalten.

Dauerhafte Orte haben eine optionale Kategorie: Zuhause, Arbeit, Einkaufen, Mobilität,
Freizeit oder Sonstiges. Die Ortsliste zeigt ausschließlich belegte Kategorien plus
„Ohne Kategorie“. Kategorie und Radius können auch bei bestehenden Orten geändert
werden. Regeln verknüpfen weiterhin konkrete Place-IDs, niemals Kategorien.

Radiusauswahl: Genau · 20 Meter, 50 Meter, 100 Meter, 250 Meter. Der bisherige Default
250 Meter bleibt bestehen. Bestehende andere Radien bleiben als Auswahl erhalten.
Das Matching verwendet die gemeldete Entfernung ohne bisherigen Genauigkeitsaufschlag.
Ein Radius ist keine Garantie für eine entsprechend genaue Geräteortung, insbesondere
nicht zur Unterscheidung einzelner Läden in Gebäuden.

Unter „Jetzt“ verschwinden reine Ortsnotizen, sobald eine neue Position außerhalb
aller verknüpften Radien liegt. Rückkehr blendet sie wieder ein. Ortungsfehler entfernen
alte Ortsgründe. Eine zusätzlich passende Tageszeit bleibt nach der vorhandenen
ODER-Regel ein eigener Grund. Gespeicherte Notizen und ihre Leseansichten bleiben erhalten.

## Trennung und Kompatibilität

- `places`: dauerhafte Orte, unveränderte IDs/Koordinaten/Zeitstempel, optional `category`.
- `entries`: `helperId: parking`, feste ID `parking-position`, Version 1. Maximal ein
  Zustand; die bereits vorhandene Entry-Architektur genügt.
- Keine DB-Migration, keine erfundenen Kategorien, kein Umschreiben alter Orte.
  Alte Exporte bleiben gültig. Neue Kategorien und Parkdaten werden vor Import validiert.
- Die Helper-API ergänzt `getPosition()` für bewusste Fachaktionen und
  `deleteEntry(id)` mit Besitzerprüfung. So umgeht Parken weder Shell noch Storage-API.

## Standort und Netzwerk

1. Startseite mit tatsächlich benötigten Ortsverknüpfungen: frische Einzelabfrage,
   anschließend gemeinsamer `watchPosition`-Observer für Standortänderungen.
2. Verlassen der Startseite, `pagehide` oder verborgenes Dokument: Observer stoppen,
   verspätete Antworten ignorieren. Rückkehr prüft frisch. Kein Polling und kein
   Hintergrund-Geofencing. Ohne Ortsverknüpfungen gibt es keine automatische Ortung.
3. „Diesen Ort merken“: wie bisher beim bewussten Öffnen des Formulars eine Einzelabfrage.
4. Parken: nur beim Klick auf Merken/Neu merken eine Einzelabfrage. Öffnen, Anzeigen,
   Notizbearbeitung und Löschen orten nicht.

Neue App-Netzwerkrequests an externe Dienste: **keine**. Die neue lokale Moduldatei
`src/places.js` ist Teil des Builds und Offline-Caches. Die UI in Orte und Datenschutz
benennt ausdrücklich mögliche Standortdienste des Browsers/Betriebssystems. Deren
Implementierung und Netzwerkverkehr kontrolliert 0815 nicht.

## Geänderte Dateien

- `src/helpers/parking/{index.js,model.js,README.md}`: Helper und Fachdatensatz.
- `src/helpers/registry.js`: Registrierung.
- `src/{places.js,schema.js}`: feste Optionen, Gruppen und Kategorievalidierung.
- `src/{context.js,app.js}`: Radiusvergleich, Vordergrundbeobachtung, Ortseingabe/-pflege,
  Gruppierung, Transparenz und die beiden konkret benötigten Helper-API-Ergänzungen.
- `index.html`, `assets/styles.css`: Ortshinweise und schlichte Formularlisten.
- `package.json`, `sw.js`, `bin/build-pages`: Version 0.7.0 und Offline-/Build-Integration.
- `tests/{parking.mjs,places.mjs,parking-places-browser-check.js,helpers-offline-check.js,language-browser-check.js,browser-check.js}`:
  Fach-, Browser- und Offline-Prüfungen.
- `docs/HELPER_AUTHORING.md`, `tests/README.md`, dieses Dokument: API und Abnahme.

Die bereits vorhandenen Änderungen in `AGENTS.md` und `docs/HELPER_AUTHORING.md`
bleiben erhalten; `AGENTS.md` wurde im Feature nicht bearbeitet.

## Prüfungen

Ausgeführt mit Node.js 22.23.2 und Chromium 153:

- `npm test`: alle 12 Testdateien erfolgreich, einschließlich neuer Parken-/Ortsfälle.
- Syntaxprüfung aller JS-/MJS-Dateien in `src` und `tests`, `sw.js` und `bin/build-pages`.
- `bin/build-pages`: 39 Runtime-Dateien; `git diff --check` erfolgreich.
- `parking-places-browser-check.js`: 84 Checks über Light, Dark und Signature erfolgreich.
- Bestehende Gates erfolgreich: `browser-check.js` (einschließlich Besitzerprüfung für
  Löschung), `navigation-browser-check.js`, `design-check.js`, `notes-browser-check.js`,
  `person-notes-browser-check.js`, `language-browser-check.js`, `signature-browser-check.js`
  und `discount-browser-check.js`.
- `helpers-offline-check.js`: echter Modul-Worker, Offline-Neuladen und Fachaktionen
  einschließlich Parken erfolgreich. Geräteposition kontrolliert simuliert.
- Sichtprüfung der Parkansicht und gruppierten Ortsformulare in Signature bei 390 px;
  Screenshots unter `/tmp/0815-parking-final.png` und `/tmp/0815-places-final.png`.

Der Sprachtest wurde an die neue frische Position und die Genauigkeitsanzeige angepasst;
seine bisherige Annahme eines fünf Minuten alten Standortcaches gilt bewusst nicht mehr.
Die Designprüfung erzeugte Referenzbilder; diese wurden anschließend auf den vorhandenen
Archivstand zurückgesetzt, da dieses Feature die Designarchive nicht aktualisiert.

Offen: echte Geräteortung, Hersteller-Standortdienste, reale Screenreader und weitere
Zielbrowser. Simulierte Positionen beweisen keine Indoor-Präzision.
