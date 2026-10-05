# Warte auf

Der Helper hält offene Wartezustände fest: etwas, bei dem der nächste Schritt gerade
nicht beim Nutzer liegt. Pflicht ist nur der eigene Text; „Von wem?“ bleibt Freitext,
und „Wann wieder zeigen?“ ist ein optionales lokales Kalendertag-Datum.

Das Datum ist eine Wiedervorlage des Nutzers, keine Deadline für eine andere Person.
Ein Eintrag wird ab diesem Tag bei Nutzung von 0815 im Helper unter „Wieder im Blick“
angezeigt und bleibt dort, bis der Nutzer „Erledigt“ oder „Weiter warten“ wählt.
Öffnen, Anzeigen und Zurücksetzen verändern diesen Zustand nicht. Ohne Datum bleibt
der Eintrag offen, wird aber nicht automatisch wieder hervorgehoben.

„Erledigt“ bedeutet nur, dass der Nutzer nicht mehr darauf warten muss. Es speichert
keinen Grund und bewertet keine Person. Der Helper erzeugt keine aktiven Erinnerungen,
Pushs oder System-Notifications. Die bestehende „Jetzt“-Ansicht kann keine einzelnen
Helper-Einträge anzeigen; dafür wurde keine Plattformfunktion ergänzt.
