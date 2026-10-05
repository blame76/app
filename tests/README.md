# Prüfungen

Node.js 22 und npm wie in CI verwenden; `npm install` ist nicht nötig.
Alle Kommandos vom Repo-Root ausführen. Die fokussierte Auswahl für neue Helper
steht im [Helper-Guide](../docs/HELPER_AUTHORING.md#prüfen-und-fertigstellen).

`npm test` führt ohne Dependencies die Node-Tests für Registry, Defaults,
Import-/Datensatzvalidierung, ungültige Intervalle, Shell/Manifest und
Service-Worker-Cacheverhalten aus. Die Worker-Tests führen den tatsächlichen Worker-Code
mit einer kleinen Cache-/Event-Umgebung aus; es gibt keine Tests, die null Helper erzwingen.
Auch Fachmodelle und isolierte Pages-Builds sind enthalten (`tests/*.mjs`).
Die `.js`-Browserdateien werden von `npm test` nicht ausgeführt.

## Browser

`browser-check.js` ist eine Playwright-Funktion für einen extern bereitgestellten Browser,
kein npm-Paket und keine Projektabhängigkeit. Falls das Browsertool
`browser_run_code_unsafe` verfügbar ist, die Datei über ihren absoluten Pfad ausführen.
Bei Tools mit Code-Eingabe den gesamten Dateiinhalt als `async (page) => { … }`
übergeben. Das Tool muss eine echte Playwright-Page mit Zugriff auf
`page.context().browser()` sowie localhost bereitstellen. Voraussetzung:
`python3 -m http.server 8080`. Die Funktion erzeugt einen isolierten Browserkontext,
ersetzt nur die Registry-Antwort durch Testfixtures und verändert keine Repository-Helper.

`node tests/browser-check.js` wertet nur einen Funktionsausdruck aus und führt
**keinen Test** aus. Das Repo enthält derzeit keinen eigenständigen Browser-CLI-Runner;
das Browsertool gehört zur ausführenden Umgebung. Ohne solches Tool: manuell in
einem separaten Browserprofil mit Testdaten prüfen – Öffnen ohne Schreibwirkung,
Kernaktion/Fehler/Mehrfachklick, Reload, Zurück/Einstellungen, Tastatur/Fokus,
320 CSS px/200 % Text, drei Themes und Reduced Motion. Anschließend mit aktivem
echtem Worker offline öffnen, speichern und neu laden. Keine echten Nutzerdaten
für Import-/Löschtests verwenden. Manuelle Prüfungen und nicht ausgeführte
automatisierte Gates getrennt berichten; dies ersetzt keinen bestandenen Gate.

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

Die relevanten Browserdateien sind über das externe Browsertool zusätzlich zu
`npm test` auszuführen; die Abschnitte unten beschreiben weitere Core-/Release-Gates.
CSS-Textvergrößerung ist ein strenger Layout-Test, kein Ersatz
für einen manuellen Zoom- und Screenreader-Test auf den Zielgeräten.

## Notizen und Personen READ

`read-views.mjs` prüft Auswahl, Reihenfolge, lokale Tagesgruppen einschließlich
Jahreswechsel und Sommerzeitgrenzen sowie die Trennung nach Person und Eintragsart.
Zusätzlich mit `TZ=Europe/Berlin node --test tests/read-views.mjs` ausführen.

`read-browser-check.js` prüft die echten Menüansichten und IndexedDB: Empty States,
Tastatur/Fokus, Person → Personen → Startseite, keinerlei Schreibtransaktionen,
unveränderte Stores auch bei Lesefehlern, Retry und Navigation während ausstehender
Lesezugriffe. Gespeichertes Markup bleibt Text; lange Namen und mehrzeilige Notizen
passen bei 320 CSS px und 200 % Text. Bestehende Notiz- und Personen-Erfassung sowie
Neue Referenzen/Geschenkideen werden weiterhin als eigene Einträge angelegt.
Bestehende Einträge öffnen nun die gemeinsame Notizdetailansicht. Keine externen Requests.

## Notes Complete

`notes.mjs` ergänzt die Modellprüfungen für alte Notizen, Text-/Kontextänderungen,
unveränderte Zeitstempel, Ort-ODER-Tageszeit, Ortspriorität und Importvalidierung.
Zusätzlich: `TZ=Europe/Berlin node --test tests/notes.mjs`.

`notes-browser-check.js` prüft den vollständigen Lebenszyklus mit echter IndexedDB
in Light/Dark, einschließlich Save/Cancel, Commit-Reihenfolge, Kontextfehler ohne
Notizverlust, beiden Kontextarten, Matching und Dashboard-Limit, Modal-Löschen/Retry,
Parent-Navigation/Fokus, Import/Export und langen Texten bei 320 CSS px/200 % Text.
Der gemeinsame Offline-Gate prüft auch Bearbeiten, Kontext, Wiederfinden und Löschen
mit dem echten Worker. Details und ausgeführte Gates: [`docs/NOTES.md`](../docs/NOTES.md).

## Personen-Notizen

`person-notes.mjs` prüft den gemeinsamen Lebenszyklus für alte Personen-Notizen,
erhaltene Person/Art/Erstellungszeit, Kontextänderungen, OR-Matching/Priorität und Import.
`person-notes-browser-check.js` prüft Mamas Frage unter „Jetzt“, Ort und Tageszeit,
die wiederverwendeten Detail-/Edit-/Kontextansichten, Person- und Dashboard-Parents,
Speicherfehler und Retry ohne doppelte Person, Gift-Kompatibilität, Import/Export,
Light/Dark, 320 px/200 % Text und Reduced Motion. Der Offline-Gate prüft zusätzlich
Personen-Notizen inklusive Ort und Tageszeit mit dem tatsächlichen Service Worker.
Details und Testbericht: [`docs/PERSON_NOTES.md`](../docs/PERSON_NOTES.md).

## Notes Editorial Craft

`notes-craft-browser-check.js` prüft den rein visuellen Pass in isolierten Light-/Dark-
Kontexten: leere Liste, einzelner Gedanke, zehn Einträge in einem Tag, kurze und lange
Texte, Absatzumbrüche, Tagesabstände, Zeitspalte, Kontext-Marginalien, Personen und
Geschenkideen. Screenshots aller Notes-Ansichten liegen unter
`/tmp/0815-notes-craft-*.png` und dienen dem ausdrücklich getrennten zweiten Sichtungs-Pass.

Es prüft außerdem offene Flächen auch bei Hover, Tastaturfokus, Textaktionen,
Editor-Fokuslinie und progressive Inhaltsgröße, vollständige Zeitmetadaten sowie
Reflow bei 320/560/561/768/1280 CSS px mit 200 % Text. Alle betrachteten Stores bleiben
nach Lesen, Edit-Abbruch und Kontextinspektion identisch. Der bestehende Offline-Gate
prüft die separat gepackten Darstellungsdateien mit dem echten Service Worker.
Die 106 Checks schließen Pressed/Reduced Motion, erzwungene Farben und native
Größenänderung als Fallback für das mitwachsende Schreibfeld ein.
Es gibt keine zusätzliche Testabhängigkeit. Bericht: [`docs/NOTES_EDITORIAL.md`](../docs/NOTES_EDITORIAL.md).

## Zurück-Navigation

`navigation-browser-check.js` prüft die echte Shell, alle drei Helper und IndexedDB:
Dashboard → Helper → Einstellungen → Helper → Dashboard inklusive Fokus auf dem
Einstellungs-Trigger und der ursprünglichen Kachel; wiederholte Einstellungen ohne
doppelte Parent-Ebenen; Schmerz → Verlauf → Details mit lokalem und globalem Zurück;
Fragen und erhaltene Entwürfe; Personen → Person → Personen mit Trigger-Fokus.
Ausstehende Einstellungen-/Mount-Lesezugriffe dürfen neue Ansichten nicht ersetzen
oder deren Fokus stehlen. Alle Stores und Nutzungsmetadaten bleiben identisch, und
keine Navigation öffnet Schreibtransaktionen. Browser-Zurück verlässt die App zum
vorherigen Dokument; interne Navigation erzeugt keine Browser-History-Einträge.
Dieses Gate läuft wie die übrigen Browserfunktionen über das bereitgestellte Tool.

## Editorial Glow Up

`editorial-browser-check.js` prüft den echten Bestand in isolierten Light- und Dark-Kontexten.
Es ergänzt die bestehenden Gates um beide Kontrastpaletten einschließlich Hover, native
Control-Farbwelten, Tagesübersichten, richtige Zeitabstände und ausschließlich dokumentierte
Punkte im SVG-Verlauf. Ein Wert erzeugt keine Linie, 120 Werte bleiben vollständig; Beginn
bleibt qualifiziert und ein dokumentiertes Datum wird nicht zu einer Mitternachtszeit.

Außerdem: 50 Notizen, getrennte Personenabschnitte, lange Texte, leere Historie, 1280 px,
320 px mit 200 % Text, kurze Composer, Tastaturfokus, Touchhöhen und Reduced Motion in
beiden Modi. Alle Leseansichten müssen sämtliche Stores und Nutzungsmetadaten erhalten
und dürfen keine Schreibtransaktion öffnen. Der Rabattablauf zeigt sein gespeichertes
Ergebnis vor der Eingabe. Keine externen Fonts oder Ressourcenrequests.

Das Gate schreibt Screenshots nach `/tmp/0815-editorial-*.png`. Es ist eine Browserfunktion
wie die übrigen Gates und führt keine neue Projektabhängigkeit ein. Sichtprüfung ergänzt
die automatischen Checks; Gerätezoom, echte Screenreader und weitere Browser bleiben offen.

Der Final-Pass ergänzt Kontraste der eigenen Eingabeflächen, inhaltliche DOM-Lesereihenfolge
auf Personenseiten, erhaltene genaue Zeitmetadaten, Composer-Auswahl und vollständig
bewegungsfreie Pressed States bei Reduced Motion. Kontrolliert verzögerte echte
IndexedDB-Commits prüfen `aria-busy`, gesperrte Mehrfachaktionen und den Übergang zu Erfolg
für Schmerz, Rabatt, Trinken und Notizen. Die Verzögerung existiert nur in der isolierten
Testantwort für `db.js`; produktive Datenbank und Speichersequenz bleiben unverändert.

## PWA nach Deployment

`python3 tests/pwa-update-server.py` startet auf localhost:8081 einen vollständig
wegwerfbaren Release-Server. Er baut drei Snapshots mit derselben Paketversion über
den tatsächlichen Pages-Packager, liefert sie unter `/app/` mit langlebigem HTTP-Cache
aus und schaltet sie über `/__release?version=one|two|three` um. Er verwendet weder
die produktiven Daten noch den vorhandenen `dist/`-Ordner; Fixtures werden beim
Beenden entfernt.

Danach `pwa-update-browser-check.js` wie die übrigen Browserfunktionen ausführen.
Der Test prüft echte Modul-Worker, CacheStorage und IndexedDB: erste Installation
ohne Reload, automatisches Update beim Wiederaufnehmen, unverlorener Notizentwurf,
Commit vor Aktualisierung, Update bei Rückkehr auf die Startseite, Fremd-Cache-Erhalt
und aktuelles Offline-Neuladen. Standalone ist simuliert; die Betriebssysteminstallation
und Zielgeräte sind nicht geprüft.

`pages-build.mjs` ergänzt dazu Hash-Reproduzierbarkeit, neue Releases bei CSS-/Helper-/
Shell-Änderungen ohne Versionssprung und Ausschluss der Signature-Studien aus dem Build.
Die isolierten Signature-Aufnahmen und deren Reflow-/Bedienprüfungen stehen in
[`design/signature/README.md`](../design/signature/README.md).

## Design Modes und Signature / Mono Editorial

`signature-browser-check.js` nutzt echte Settings und IndexedDB. Es prüft exakt drei
Optionen, einmalige Übernahme des bisherigen Modus, explizites Light/Dark gegen die
Systemeinstellung, Neustart-Persistenz, Fehler/Retry und unveränderte Fachdatenspeicher.
Die reale Signature-Ausgabe wird bei 320/390/768/1280 px und 320 px mit 200 % Text auf
Reflow, Textkontraste, Tastatur, Fokus und Reduced Motion geprüft. Schmerz und Notes
speichern weiter über die bestehenden Abläufe. Aufnahmen stehen unter
`design/signature-reference/integrated/`; nur für Full-Page-Aufnahmen sitzt der Footer am
Dokumentende und der inaktive Skip-Link wird verborgen.

`theme-screenshots.js` erfasst identische reale Fixtures vor/nach der Integration
unter `.playwright-mcp/theme-before-*` und `theme-after-*`. Nachher läuft jeder Modus
gegen die entgegengesetzte Systemeinstellung. Die archivierte Pixelgleichheit aller
16 Paare steht in `design/signature-reference/checks.json`. Für einen neuen Vergleich
den Ausgangsstand vor Änderungen mit `?phase=before` und den neuen Stand mit
`?phase=after` im bereitgestellten Browser erfassen und die PNG-Pixel vergleichen.

Der PWA-Gate prüft zusätzlich, dass Signature nach einem Deployment gewählt bleibt
und Modul, Stylesheet sowie lokales Setting auch nach Offline-Neuladen verfügbar sind.

`design/signature-v2/capture.js` prüft die zwei isolierten Varianten mit 92 Checks
pro Pass. Über den bereitgestellten Browser zuerst `design/signature-v2/?pass=1`
beziehungsweise `?pass=2` öffnen, dann die Datei ausführen. Je Pass entstehen 16
Screenshots. Pass 1 ist archiviert; aktuelle CSS zeigt Pass 2. Die Studien laden
keine verworfenen C-Styles, registrieren keinen Worker und erstellen keine Datenbanken.

`design/signature-reference/capture.js` prüft die neue Bildreferenz mit 48 Checks
und acht Screenshots je Pass. Ausgangsseite `design/signature-reference/?pass=1`
bzw. `?pass=2`. Beide Passes sind archiviert; aktuelle CSS entspricht Pass 2.
Der Live-Gate prüft zusätzlich beide geladenen Schriftdateien, Serif-Inhalte und
das dekorative, für Screenreader ausgeblendete Script im Notes-Kapitel. Der echte
PWA-Gate lädt beide Schriftfamilien offline und prüft deren Fonts/OFL-Dateien im
aktuellen Cache. Der Pages-Gate prüft CSS-Font-URLs unter `/app/` und Release-Hashes
nach Änderungen beider Binärdateien. Die vorigen A/B-Studien bleiben historische Tests.

## Parken und Orte

`parking.mjs` und `places.mjs` prüfen den einzelnen Parkzustand, Validierung vor
Import, Speicherung vor Nutzungsmetadaten, alte und kategorisierte Orte, Gruppierung
sowie Radiusgrenzen ohne Genauigkeitsaufschlag und das Beenden des Observers.

`parking-places-browser-check.js` prüft echte IndexedDB in Light, Dark und Signature:
bewusste Ortung, Speichern/Ersetzen/Notizänderung/Löschen, Fehler/Retry, späte Antworten,
Gruppierung, alte Radien, Auswahl und Bearbeitung, Ein-/Ausblenden ohne Navigation,
Ortungsfehler, Vordergrundlebenszyklus, Fokus, 320 px/200 % Text und externe Requests.
`helpers-offline-check.js` ergänzt Speichern, Reload, Anzeigen und Löschen des
Parkplatzes mit echtem Worker und kontrollierter Geräteposition. Reale Geräteortung
und Betriebssystem-Standortdienste werden dadurch nicht geprüft.
