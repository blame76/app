# Prüfungen

`npm test` führt ohne Dependencies die Node-Tests für Registry, Defaults,
Import-/Datensatzvalidierung, ungültige Intervalle, Shell/Manifest und
Service-Worker-Cacheverhalten aus. Die Worker-Tests führen den tatsächlichen Worker-Code
mit einer kleinen Cache-/Event-Umgebung aus; es gibt keine Tests, die null Helper erzwingen.

## Browser

`browser-check.js` ist eine Playwright-Funktion für einen bereitgestellten Browser,
kein npm-Paket und keine Projektabhängigkeit. Sie kann mit dem Browsertool über
`browser_run_code_unsafe` und den absoluten Dateipfad ausgeführt werden. Voraussetzung:
`python3 -m http.server 8080`. Die Funktion erzeugt einen isolierten Browserkontext,
ersetzt nur die Registry-Antwort durch Testfixtures und verändert keine Repository-Helper.

Geprüft werden:

- Ausblenden in Jetzt, Favoriten und Alle Helfer; Wiederherstellung sichtbarer Favoriten.
- Öffnen versus `recordUse()`; Fokusansicht und Cleanup beim Navigieren.
- Veralteter asynchroner Mount, abgebrochenes Signal und abgewiesene alte API.
- Abgelehnte Toleranz ohne Veränderung des gespeicherten Werts.
- Ortsformular während ausstehender Ortung; keine Navigation/Query-Übertragung.
- Composer schließen/wechseln, bevor Ortung zurückkommt.
- Echte IndexedDB: unveränderter Bestand bei Validierungsfehler, Rollback bei simuliertem
  Schreibfehler innerhalb der Transaktion und erfolgreicher Gesamtersatz.
- Importierter HTML-Text bleibt Text, erzeugt weder Elemente noch Ressourcenrequests.
- Sichtbarer Tastaturfokus der Dateiauswahl; Reflow der Datenansicht bei 320 CSS px.
- Quota-Fehler hält Formular und Eingabetext offen; Speichern kann wiederholt werden.
- Keine unbehandelten Browserfehler.

Geolocation wird kontrolliert simuliert; das ist kein Test echter Geräteortung.
Service Worker ist für diese isolierten Fixtures ausgeschaltet.

Zusätzlich bei Releases im Browser mit echtem Worker prüfen:

1. In einem frischen Browserkontext vor dem Start einen fremden Cache und einen alten
   `0815-`-Cache anlegen. App starten, Worker-Aktivierung abwarten: fremder Cache bleibt,
   alter App-Cache verschwindet.
2. Browser offline stellen, Seite neu laden, lokale Notiz speichern: Shell und
   IndexedDB müssen funktionieren.
3. Cache-/Paketversion erhöhen und Deployment aktualisieren: nach Worker-Update und
   Neuladen werden die neuen Assets verwendet. Vor öffentlicher Veröffentlichung
   auch Installation auf den Zielbrowsern und Screenreader prüfen.

Die Schritte 1 und 2 wurden während der Stabilisierung in Chromium ausgeführt.
Der Installationsdialog, reale Geolocation, Screenreader und andere Browser wurden
nicht geprüft. Ein statischer localhost-Start ersetzt keinen Hosting-Test mit HTTPS.

## Visuelles Regression Gate

`design-check.js` wird wie `browser-check.js` über den bereitgestellten Browser
ausgeführt. Es prüft echte Tab-/Enter-/Space-Navigation, Dashboard → Helper → Zurück,
den Accessibility Tree der Fokusansicht, alle `hidden`-Elemente, Reflow mehrerer
Ansichten bei 320 CSS px, einen Composer bei 480 px Bildschirmhöhe und Reduced Motion.
Die Registry-Fixture existiert nur in einem isolierten Browserkontext.

Beide Browserprüfungen sind zusätzlich zu `npm test` auszuführen. Visuelle Sichtprüfung
erfolgte in Chromium bei 390 und 1280 px Breite. Reale Screenreader und weitere Browser
bleiben vor Veröffentlichung zu prüfen.

## Schmerz v0.1

`pain.mjs` prüft Fachmodell, Registrierung, Pflichtdaten, `recordUse()` nach erfolgreicher
Speicherung, bewusste Schmerzfreiheit, getrennte Orte, optionale Angaben, qualifizierten
Beginn, Fachvalidierung vor Import und die Aufbewahrungsgrenzen.

`pain-browser-check.js` wird über das vorhandene Browsertool wie die beiden anderen
Browser-Gates ausgeführt. Es verwendet den echten registrierten Helper und echte
IndexedDB in einem isolierten Kontext. Geprüft werden Eingabe, Tastatur, Fokus nach
Speichern, getrennte Ereignisse, Zusatzdaten, Verlauf, HTML als Text, Aus-/Einblenden,
Favorit, Kontextsettings, Aufbewahrung beim Regelwechsel und Import sowie Quota-Fehler.
Zusätzlich geprüft werden die getrennten Fragen, explizites Weiter, Ort ändern und
Zurück mit Erhalt der Auswahl, Fokus auf die jeweilige Frage, verbundene Beschreibungen,
der schnelle Wiedereinstieg, kontextuelles „Schmerz weg“, Fertig → Dashboard,
Guidance-Persistenz über Reload sowie Reaktivierung in den Einstellungen.
Der Helper erzeugt im Test keine externen Requests.

Mit dem echten Modul-Service-Worker wurde zusätzlich geprüft: Alle Pain-Dateien sind
precached; offline öffnen, speichern, neu laden und Wiederherstellen funktionieren.
Reale Geräteortung, andere Browser und echte Screenreader bleiben ungetestet.

## Personal Object

`personal-object-check.js` verwendet den echten Schmerz-Helper im isolierten Kontext.
Es ergänzt die bestehenden Gates um Text-/Control-Kontraste, erhaltene Touch-Höhen,
200 % Textvergrößerung bei 320 CSS px in Fragen, Bestätigung, Historie, Details,
Dashboard und Wiedereinstieg. Es prüft lesbare Ortsnamen und die Zahl 10, Footer-Labels
innerhalb ihrer Bedienflächen, ungeclippten Kachelfokus, einen vergrößerten Composer
bei 480 px Bildschirmhöhe sowie abgeschaltete Schritt-/Auswahl-Motion.

## Sprache und UI

`language-browser-check.js` prüft die Rückmeldungen gegen tatsächliche Speicherung:
Notiz- und Personen-Composer mit erhaltenen Eingaben nach Fehlern, bestehende
Datensatzarten trotz klarerer Labels, Ortsaufnahme und Ortungsfehler, Speicherschutz
sowie Importfehler vor und nach einer erfolgreichen Transaktion. Kontext-Fixtures
prüfen gespeicherte Ortsnamen als sicheren Text, unveränderte Priorität und
Intervalltoleranz, knappe Leerzustände, kompakte Kacheln und lange Namen bei 320 CSS px.
Die Fixtures und Ortungssimulation existieren nur im isolierten Browserkontext.

## Rabatt und gemeinsame Offline-Prüfung

`discount.mjs` prüft Deklaration, deutsche Dezimaleingaben, centgenaue Rundung,
Grenzwerte, Fachvalidierung vor Import, fünf Berechnungen als begrenzten Zustand
und die Reihenfolge von Speicherung und `recordUse()` inklusive Metadatenfehler.
`discount-browser-check.js` verwendet den echten Helper mit IndexedDB: Tastatur,
Fokus, Berechnung/Fehler/Retry, begrenzte Historie, Mehrfach-Submit, 320 CSS px mit
200 % Text, gemeinsame Ortssettings, erkannter Ortsname, Favorit und Ausblenden.
Der Helper selbst fragt keinen Standort ab; Ortung ist im Test kontrolliert simuliert.

`helpers-offline-check.js` prüft den tatsächlichen Modul-Service-Worker und sämtliche
registrierten Module/Assets in einem frischen Kontext. Nach Abschalten des Netzwerks:
Rabatt berechnen, Trinken dokumentieren und beide nach Reload wiederherstellen;
Schmerz speichern und wiederherstellen. Fremde Caches bleiben erhalten.
Kein Worker-Mock in diesem Gate.

## Trinken und Intervallgrenzen

`drink.mjs` prüft den minimalen Ereignisdatensatz, Speicherung vor `recordUse()`,
Metadatenfehler, relativen Zeittext, lokalen Kalendertag, Retention und Fachvalidierung
vor Import. `drink-browser-check.js` verwendet den echten Helper und IndexedDB mit
kontrollierter Testzeit in `Europe/Berlin`: kein Intervall ohne erste Nutzung,
„zuletzt verwendet“ unmittelbar nach Nutzung und bis 44:59,999 Minuten,
Intervallgrund ab Minute 45 bei 60/15; nach Änderung auf 90/15 ab Minute 75.
Keine Echtzeit-Wartezeit und keine geänderte Engine. Außerdem: Tastatur, Fokus,
keine Toast-Dopplung, heutige Historie ohne Löschung älterer Ereignisse, Fehler/Retry,
Metadatenfehler ohne Doppeleintrag, Mehrfachklick, Retention, Ausblenden,
320 CSS px, 200 % Text und Reduced Motion. Eigene Standortabfragen/externe Requests
werden ausgeschlossen. `TZ=Europe/Berlin node --test tests/drink.mjs` prüft die
Tagesgrenzen auch mit Berliner Sommerzeit in Node.

Alle acht Browserdateien sind über das vorhandene Browsertool zusätzlich zu
`npm test` auszuführen. CSS-Textvergrößerung ist ein strenger Layout-Test, kein Ersatz
für einen manuellen Zoom- und Screenreader-Test auf den Zielgeräten.
