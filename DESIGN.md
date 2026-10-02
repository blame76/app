# Personal Object / Everyday Jewellery

Die technische Baseline bleibt unter `baseline-v0.4.1` eingefroren. Dieser Design-Pass
setzt auf dem bestehenden Schmerz-Workflow auf. v0.5.2 versioniert die Darstellung;
der Service Worker erhält ausschließlich einen neuen Cache-Namen für diese Assets.

0815 besitzt eine ruhige, warme Seitenfläche. Fragen und dokumentierte Werte tragen
die Identität; Bedienelemente ordnen sich ihnen unter. Das Material entsteht durch
Flächenfarbe, Typografie, Proportion und wenige Linien. Keine Texturen, Bildassets,
externen Schriften, neuen Icons oder Runtime-Abhängigkeiten.

## Palette

Die kleine Palette liegt als Arbeits-Tokens in `assets/styles.css`, ohne stabile API:

| Rolle | Farbe | Verwendung |
| --- | --- | --- |
| Hintergrund | `#f6f5f1` | warme, freie Seitenfläche; unverändert |
| Papier | `#fffefa` | Jetzt-Kachel und Eingabeflächen |
| Graphit/Grün | `#293b32` | Text, primäre Handlung, Tastaturfokus |
| Sekundärtext | `#606359` | Zeit, Hinweise, optionale Navigation |
| Bronze | `#806445` | Auswahl, Signatur, Speicherbestätigung |
| Heller Bronzeton | `#eee5d8` | gewählte Antwort und Kachel-Hover |
| Gefahr | `#852d2b` | ausschließlich gefährliche Aktionen; unverändert |

Textkontrast auf den verwendeten Flächen: mindestens 5,03:1 für den Akzent und
5,18:1 für Sekundärtext. Eingabekonturen erreichen mindestens 3,72:1, Auswahlmarken
4,40:1. Feine Trennlinien sind keine alleinigen Grenzen interaktiver Controls.

## Typografie

Display: `ui-serif, Charter, "Iowan Old Style", "Palatino Linotype", Georgia, serif`.
Die installierte lokale Schrift entscheidet; es wird nichts nachgeladen.

- Helper-Titel: 1,5–1,875 rem, Serif, normales Gewicht.
- Zentrale Frage: 2,125–3,25 rem, Serif, kompakter, gut lesbarer Zeilenabstand.
- Dokumentierter Hauptwert: 2,5–3,5 rem, Serif; die dokumentierte Zeit bleibt separat.
- Bestätigung und Seitenüberschrift: 2–2,75 rem, Serif.
- Interface: System-Sans, 1 rem; kleine Zeit-/Kontextangaben mindestens 0,875 rem.

Großbuchstaben und starke Gewichte sind kein durchgängiges Gestaltungsprinzip.
Lange Namen dürfen umbrechen. Antworten und Skalen reduzieren ihre Spaltenzahl bei
Textvergrößerung, statt kurze Wörter oder die Zahl 10 zu zerlegen.

## Fläche und Signatur

Der Helper besitzt die Seite selbst: kein äußerer Kartenrahmen und keine umrahmten
Fieldsets. Native Legends bleiben die Fragen. Antworten besitzen große Touchflächen,
eine leise Grundlinie und das native Radio als eindeutig erkennbare Auswahl.

Die einzige Signatur ist die um 18 px angeschnittene obere rechte Ecke, begleitet
von einer bronzefarbenen Diagonale. Sie sitzt an den Jetzt-Kacheln; nach dem Speichern
erscheint dieselbe kurze Diagonale über der Bestätigung. Keine Facetten an Controls.
Nur die gemalte Kachelfläche wird angeschnitten, der Button und sein Fokus bleiben
vollständig rechteckig und ungeclippt. Die Signatur trägt keine fachliche Information.

Jetzt-Kacheln haben ein helles Material und eine klare Hierarchie aus Helper und Grund.
Der Jetzt-Bereich selbst hat keinen Container. Favoriten, alle Helfer und Einstellungen
verwenden Typografie und Linien. Schatten bleiben auf überlagerte Menüs, Composer und Rückmeldungen
beschränkt. Die Historie bleibt eine Liste dokumentierter Ereignisse, keine Reihe
von Karten.

## Interaktion

Eine dunkle primäre Handlung; sekundäre Möglichkeiten mit ruhiger Fläche; optionale
Navigation ohne Rahmen. Touch-Größen werden erhalten, Antworten haben mindestens
60 px Höhe. Der Footer ist eine schlichte Werkzeugzeile mit oberer Haarlinie,
48+ px Bedienflächen und drei bestehenden Aktionen. Composer bleiben scrollbar
und berücksichtigen auch bei Textvergrößerung den Platz des Footers.

Auswahl und Hover wechseln ihre Farbe in 140 ms. Neue Fragen und die Bestätigung
kommen über eine einmalige Bewegung von 2 px in 140 ms an. Keine Transparenzänderung,
die kurzzeitig Textkontraste reduziert, keine fortlaufende Bewegung. Reduced Motion
entfernt Animation und Transition vollständig. Erfolgreiches Speichern bestätigt
sich im bestehenden Inhalt und Live-Status; es wird kein Erfolgs-Toast hinzugefügt.

## Regression Gate

`npm test` sowie alle vier Browser-Gates aus `tests/README.md` laufen mit dem bestehenden
Workflow. Der zusätzliche Personal-Object-Gate prüft Kontraste, Touchflächen,
200 % Text bei 320 CSS px, lesbare Skalen, ungeclippten Tastaturfokus, Composer auf
kurzem Viewport und Reduced Motion. Sichtprüfung des echten Helpers in Chromium
bei 390 und 1280 px, ergänzt um Reflow bei 320 px und echte Offline-Nutzung.

Fachmodell, Workflow, Kontext, Ort/Zeit/Intervall, Storage, Import/Export, Retention
und Helper Contract bleiben unverändert. Die einzige Helper-DOM-Anpassung ist eine
Darstellungsklasse an der vorhandenen Bestätigungsüberschrift. Echte Screenreader,
Installation und weitere Zielbrowser wurden in diesem Pass nicht geprüft.
