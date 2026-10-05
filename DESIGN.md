# 0815 – Editorial Glow Up

Aktuell: **Signature · Mono Editorial · 0.6.6**, anhand der Bildreferenz des Nutzers.
Die folgenden Grundregeln beschreiben Light/Dark. Die zusätzliche Signature-
Gestaltung steht am Ende und in [`docs/SIGNATURE_REFERENCE.md`](docs/SIGNATURE_REFERENCE.md).
Verbindliche Wiederholungsvorgaben: [`docs/SIGNATURE_BRIEF.md`](docs/SIGNATURE_BRIEF.md).

`0.6.2` verfeinert ausschließlich die Darstellung der Notizen und Personen-Notizen.
`assets/notes.css` enthält deren Komposition; `src/note-presentation.js` liefert nur
Typografieklassen anhand der Textlänge. Funktionaler Stand bleibt `0.6.1`.
Kurze Gedanken, längerer Fließtext, Uhrzeit und Kontext erhalten eigene Maßstäbe.
Der vollständige erste und zweite Sichtungs-Pass steht in
[`docs/NOTES_EDITORIAL.md`](docs/NOTES_EDITORIAL.md).

Der ergänzende Notes-Complete-Pass (`0.6.0`) gestaltet die dauerhafte Notizdetailansicht,
Bearbeitung und Kontextverwaltung sowie eigene Note-Kacheln unter „Jetzt“.
Tagesüberschriften bleiben kleine Kapitel; Text und Freiraum tragen die Liste.
Der visuelle zweite Pass, Kompatibilität und Prüfungen stehen in [`docs/NOTES.md`](docs/NOTES.md).

`0.6.1` übernimmt den Notiz-Lebenszyklus für Personen. Name und Frage stehen bereits
unter „Jetzt“; die Personenseite hat nun ein Kapitel „Notizen“ mit Serifentexten und
direkt öffnungsfähigen Einträgen. Datum und Kontext bleiben sekundär. Editor,
Kontextverwaltung und Löschdialog verwenden die vorhandenen Notes-Ansichten.

## Visual language

Ein persönliches Notizbuch ist die Richtung: warme, ruhige Flächen, große Serifentitel,
präzise System-Sans für Bedienung und Metadaten. Abstand und feine Linien gliedern die
bestehenden Ansichten. Es gibt keine neuen Marketingtexte, Bilder, externen Fonts,
Frameworks oder Chart-Libraries. Fragen und gespeicherte Inhalte tragen die Gestaltung.

## Art direction / Signature

Die Sichtung vor diesem Final-Pass unterscheidet drei Gruppen:

- **KEEP:** lokale Serif-/Sans-Spannung, monolithische Kacheln, native Fragenführung,
  Fokusnavigation, eigenständige Farbwelten und der ausschließlich dokumentierte SVG-Verlauf.
- **REFINE:** optische Zahlenhierarchie, Pfeile, Plus/Minus, Eingabeflächen,
  Settings-Kapitel, Composer, Auswahl, Pressed States und Zustände beim Speichern.
- **REDESIGN:** der gleichmäßige Zeilenrhythmus der Notizen, der bisher knappe
  Einstieg einer Personenseite und die vertikale Log-Liste heutiger Trinkzeitpunkte.

Die 0815-Signatur besteht aus genau drei wiederkehrenden Entscheidungen:

1. **Inhalt bekommt Raum:** Serif für Fragen, Namen und zentrale Werte; kleine Sans
   für Bedienung und Kontext. Ein Personenname eröffnet seine Seite auf der Lesebreite.
2. **Kurze Linie, lange Pause:** kurze Akzentstriche an Kacheln und Bestätigungen;
   größere Abstände zwischen Kapiteln. Linien bleiben dort, wo sie Orientierung geben.
3. **Präzise Zeit, bewusste Zahl:** kleine tabellarische Uhrzeiten neben Inhaltswerten;
   der letzte Schmerzwert ist stärker gewichtet als der erste Erfassungszeitpunkt.

Keine der Entscheidungen braucht überall Serif oder Akzentfarbe. Der Seiteneinstieg,
die Nähe zusammengehöriger Information und Pausen zwischen Tagen tragen die Komposition.

## Light / Dark

Light und Dark sind explizite Modi (`data-theme="light"` / `data-theme="dark"`).
Die ursprünglichen Farben und Komponenten bleiben erhalten. Beim ersten Start ohne
gespeicherte Wahl wird die bisherige Systemdarstellung einmal übernommen und lokal
gespeichert; spätere Systemänderungen wechseln den Modus nicht. `color-scheme` stimmt
native Formulare auf den ausgewählten Modus ab; Theme-Metas folgen derselben Wahl.
Das Manifest nutzt die Light-Grundfarbe als statischen Startwert.

| Rolle | Light | Dark |
| --- | --- | --- |
| Seite | Alabaster `#f5f2eb` | Obsidian `#211f1e` |
| Papierfläche | `#fbf9f3` | angehoben `#292625` |
| Eingabe | helleres `#fffdf8` | zurückgenommenes `#242120` |
| Sekundäre Fläche | `#ece7de` | `#34302d` |
| Text | Espresso `#302c29` | Elfenbein `#e8e1d6` |
| Sekundärtext | Taupe `#686057` | `#b6aaa0` |
| Akzent | Oxblood `#783d49` | gedämpftes Rosé `#c9959d` |

Dark besitzt eigene Flächen- und Linienabstände in der Helligkeit. Primäre Controls
tragen dort ein ruhiges Elfenbein statt Reinweiß. Die Akzentfamilie bleibt sparsam:
Auswahl, kurze Kachelsignatur, Verlaufspunkte und Interaktionszustände.

Die Tokens liegen in `assets/styles.css`: `--surface-*`, `--text-*`, `--border-*`,
`--accent-*`, `--color-danger*`, fünf Abstände, zwei Radien, ein Overlay-Schatten und
eine gemeinsame Bewegung. Helper verwenden dieselben Tokens.

## Typography

`--display-font`: `ui-serif, Charter, "Iowan Old Style", "Palatino Linotype", Georgia, serif`.
`--interface-font`: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
Nur lokal verfügbare Schriften; nichts wird geladen.

- Titel und Fragen: Serif, normales Gewicht, ruhiger Zeilenabstand, leicht negatives Tracking.
- Schlüsselwerte: große Serifenziffern, tabellarische Zahlen bei Uhrzeiten und Beträgen.
- Navigation, Formulare und Metadaten: System-Sans; kleine Daten mindestens 0,875 rem.
- Versalien nur für Referenzen und Geschenkideen als gezielte Abschnittsmarkierung.

Die Kopfzeile trägt den Seitentitel. Identische Titel in Einstellungen, Daten und
Infoseiten bleiben als semantische Abschnittsüberschrift visuell verborgen.

## Data presentation

Schmerz-Verläufe bleiben pro Ort und lokalem Kalendertag getrennt. Vor den einzelnen
Einträgen stehen erste Dokumentation, letzter dokumentierter Wert und dessen Uhrzeit.
Ein vorhandener Beginn beim ersten Eintrag ist ausdrücklich ungefähr; Tagesangaben
bleiben ein Datum, keine erfundene Mitternachtszeit. Weitere Beginnangaben gehören zum
jeweiligen Eintrag. Ohne Beginn wird ausschließlich die erste Dokumentation genannt.

Der SVG-Verlauf verwendet nur gespeicherte Intensitäten. Horizontale Abstände entsprechen
den Erfassungszeiten; die Linie verbindet die dokumentierten Punkte. Ein einzelner Wert
hat einen Punkt ohne Linie. Es gibt keine Glättung, Prognose oder medizinische Bewertung.
Die vollständige Liste bleibt als lesbare und zugängliche Alternative erhalten, auch
bei vielen Punkten. Optionale Details verwenden native Definitionslisten und erhalten
mehr Raum; Notizen darin sind typografisch hervorgehoben.

Notizen bleiben nach Tagen gruppiert. Datum, kleine Uhrzeit und großer, mehrzeiliger
Text bilden einen Leserythmus ohne Einzelkarten oder Linien zwischen Gedanken. Auf breiten
Ansichten stehen Zeit und Text nebeneinander; mobil bekommt jeder Gedanke einen eigenen
Zeitauftakt. Personen erhalten eine ruhige Namensliste und einen großzügigen Seitentitel;
Referenzen und Geschenkideen sind getrennte Kapitel. Dort folgt das Datum dem Inhalt auch
in der DOM-Lesereihenfolge. Die genaue Uhrzeit bleibt im semantischen `datetime`, Tooltip
und zugänglichen Label erhalten, ohne jeden Eintrag mit einem Zeitstempel zu beschweren.

Rabatt zeigt das Ergebnis vor der Eingabemaske. Frühere Berechnungen unterscheiden
kleine Ausgangsdaten vom hervorgehobenen Ergebnis. Trinken behält den letzten
dokumentierten Zeitpunkt als Hauptinformation. Die heutigen Uhrzeiten bilden eine kompakte,
umfließende Reihe; neue Einträge und ihre Reihenfolge bleiben vollständig erhalten.

## Microdetails / Second pass

Plus/Minus besitzen eine feste, zentrierte Fläche und dieselbe Sans-Baseline, auch neben
großer Serif. Pfeile behalten ihre Breite bei langen Namen und sitzen optisch 2 px höher.
Schmerzzeiten bekommen eine eigene Spalte; Details-Aktionen bleiben bei normaler mobiler
Breite neben dem Wert und dürfen bei vergrößerter Schrift unter ihn fließen.

Hover, native Auswahl, 3-px-Fokus, deaktivierte Aktionen und vorhandene Erfolgsrückmeldungen
bleiben unterscheidbar. Ein Pressed State bewegt Controls um genau 1 px. Composer-Trigger
melden `aria-expanded` und behalten während der Erfassung eine leise Auswahlfläche.
Speichervorgänge setzen `aria-busy`, sperren wie bisher Mehrfachaktionen und geben die
Controls nach Commit oder Fehler wieder frei. Es gibt keine künstliche Wartezeit.

Nach dem ersten eigenen Screen-Review wurden mobile Notizpausen und Personenabschnitte
getrennt feinjustiert, die Namenskomposition bereits vor dem asynchronen Laden gesetzt,
Hover vom Tastaturfokus getrennt und Bewegung auch während gedrückter Controls für Reduced
Motion entfernt. Der Reflow-Check fand anschließend einen langen Settings-Titel bei
320 px und 200 % Text; auch dieser darf jetzt vollständig umbrechen.

Bewusst zurückgenommen: Linien zwischen Notizen und Geschenkideen, ständig sichtbare
Personen-Uhrzeiten und die getrennten Log-Zeilen fürs Trinken. Die freie Fläche bei wenigen
Einträgen bleibt frei. Diagramme erhalten keine Raster, Flächenfüllung oder Bewertung.

## Helper tiles / Reduced

Monolithische Kacheln mit feinem Rahmen, 4 px Radius und kurzer Oxblood-Linie ersetzen
die angeschnittenen Ecken. Name zuerst, Kontextgrund danach. Lange Namen dürfen umbrechen;
bei 320 px passen zwei normale Kacheln nebeneinander, bei Textvergrößerung eine.

Kein Kartenrahmen um Helper oder Datensätze, keine Box um Tagesübersichten und kein
Schatten auf Kacheln oder Buttons. Schatten bleiben auf echte Überlagerungen beschränkt:
Menü, Composer, Toast. Controls haben 3 px Radius. Gemeinsame Übergänge: 180 ms mit
`cubic-bezier(0.16, 1, 0.3, 1)`; Reduced Motion entfernt Bewegung vollständig.

## Accessibility / Tests

Geprüft in Chromium: Light und Dark, 320 / 390 / 1280 CSS px, 200 % Text bei 320 px,
Tastatur, sichtbarer Fokus, native Semantik, Touchflächen, Reduced Motion, lange Texte,
leere Ansichten, einzelne und 120 Schmerzwerte pro Tag sowie 50 Notizen.
Die Textvergrößerung ergänzt Reflow. Echte Browser-Zoom-Shortcuts ändern im bereitgestellten
Testbrowser die Skalierung nicht; Gerätezoom, echte Screenreader und weitere Browser
wurden deshalb nicht geprüft.

Textkontraste über alle eingesetzten Flächen: Light mindestens 4,87:1, Dark mindestens
5,51:1. Eingaberänder mindestens 3,14:1 beziehungsweise 3,97:1; primäre und gefährliche
Controls einschließlich Hover mindestens 4,5:1. Fokus bleibt mindestens 3 px stark.

`npm test`, die Berliner Zeitgrenzen und sämtliche elf Browser-Gates aus `tests/README.md`
prüfen Verhalten, Speicherung, Import/Export, Retention, Navigation, echte Offline-Nutzung
und den Design-Pass. Der zusätzliche Editorial-Gate prüft Zeitabstände und Datenvollständigkeit
im Plot, ungefähren Beginn, unveränderte Stores ohne Schreibtransaktionen sowie beide Paletten.
Screenshots der wichtigen Ansichten werden nach `/tmp/0815-editorial-*.png` geschrieben.

Datenmodelle, Helper Contract, Context Engine, Storage, Retention,
Import/Export und Navigationslogik sind unverändert. Für die Veröffentlichung auf
`main` werden App-Version und Service-Worker-Cache gemeinsam auf `0.5.8` erhöht.
Die Worker-Logik bleibt unverändert; die Prüfung verwendet frische Browserkontexte.

## Design Modes · Signature / Mono Editorial

Genau Light / Dark / Signature, lokal im vorhandenen Settings-Store gespeichert.
Die jüngste Bildreferenz präzisiert Signature und ersetzt die vormalige warme,
sehr zurückhaltende A/v2-Richtung. Light/Dark behalten die oben beschriebenen Regeln;
alle neuen visuellen Selektoren stehen unter `html[data-theme="signature"]`.

**Farblich ruhig, typografisch ausdrucksstark:** Anthrazit `#171716`, Elfenbein
`#eeece4`, gestufte Grauflächen und eine helle erste Notiz. Lokale Cormorant Garamond
trägt Titel und Inhalte. Great Vibes erscheint nur als dekoratives „Journal“ unter
„NOTIZEN“; Bedienung, Uhrzeiten, Eingaben und Auswahlziffern bleiben System-Sans.
Der helle/dunkle Materialkontrast und die typografische Komposition entsprechen
nun der visuellen Vorlage. Jetzt bleibt kleiner als der Hauptgedanke.

Hier erlaubt die ausdrückliche Bildreferenz einen ausdrucksstarken Kapitelauftakt
und eine Schreibschrift. Die Regeln „ruhig“ und „Richer, not louder“ werden deshalb
auf die Farbgebung und Lesbarkeit bezogen. Die früheren Einschränkungen des
A/v2-Briefings sind in `docs/SIGNATURE_V2.md` ausschließlich historisch dokumentiert.
Keine Termin- oder Kalenderfunktion der Bildvorlage wird übernommen.

Neu hinzu kommt nur ein dekoratives, für Screenreader verborgenes Header-Element.
Die Darstellung verwendet lokale Fonts statt systemabhängiger Ersatzschriften;
beide WOFF2s und OFL-Lizenzen werden precached, ohne Font-CDN oder Runtime-Framework.
Framework-/Bundlerfreiheit, AA-Kontraste, 320-px-Reflow, 200 % Text, Reduced Motion,
Tastaturbedienung, Fokus und bestehende Funktionen bleiben verbindlich.

Umsetzung: [`docs/SIGNATURE_REFERENCE.md`](docs/SIGNATURE_REFERENCE.md).
Exakte Farben, Schriftrollen, Größen und Abnahme:
[`docs/SIGNATURE_BRIEF.md`](docs/SIGNATURE_BRIEF.md).
Zwei gesichtete Passes: [`design/signature-reference/README.md`](design/signature-reference/README.md).
