# Warte auf

Der Helper hält offene Wartezustände fest: etwas, bei dem der nächste Schritt gerade
nicht beim Nutzer liegt. Pflicht ist nur der eigene Text; „Von wem?“ bleibt Freitext,
und „Wann wieder zeigen?“ ist ein optionales lokales Kalendertag-Datum.

Das Datum ist eine Wiedervorlage des Nutzers, keine Deadline für eine andere Person.
Ein Eintrag wird ab diesem Tag bei Nutzung von 0815 im Helper unter „Wieder im Blick“
angezeigt. Eine Now-Karte hält den Helper außerdem unter „Jetzt“, solange mindestens
ein datierter Eintrag fällig und offen ist. Ein einzelner Eintrag zeigt seinen Text
und das Wiedervorlagedatum, mehrere ihre Anzahl und den ältesten fälligen Eintrag.
Die Karte öffnet die bestehende Helper-Liste. Sie bleibt, bis alle fälligen Einträge
erledigt oder mit „Weiter warten“ auf später verschoben wurden.
Öffnen, Anzeigen und Zurücksetzen verändern diesen Zustand nicht. Ohne Datum bleibt
der Eintrag offen, wird aber nicht automatisch wieder hervorgehoben.

„Erledigt“ bedeutet nur, dass der Nutzer nicht mehr darauf warten muss. Es speichert
keinen Grund und bewertet keine Person. Der Helper erzeugt keine aktiven Erinnerungen,
Pushs oder System-Notifications. Die reine `nowCard()`-Projektion verwendet nur
eigene Entries; sie benötigt keine Context-Regeln. Ihr `nextChangeAt` sorgt über
den bestehenden Vordergrund-Timer für die nächste lokale Datumsgrenze, auch wenn
die Karte noch nicht aktiv ist. Ausgeblendete Helper bleiben ausgeblendet.
