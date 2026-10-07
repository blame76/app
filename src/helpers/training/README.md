# Training

Training hilft beim Anfangen und Weitermachen: Eine offene Session lässt sich
fortsetzen, Zuhause und Gym sind gleichwertige Orte. Aktivitäten sind Freitext
mit einer von drei Erfassungsarten: Sätze & Wiederholungen, Zeit oder Strecke.
Intern bleiben dies `sets`, `duration` und `distance`; das Datenformat bleibt v1.

Neue Trainings beginnen mit „Was steht heute an?“. Der optionale Name hilft beim
Wiederfinden; „Ohne Bezeichnung starten“ führt direkt zur ersten Aktivität.
Die Auswahlflächen erklären die Erfassungsarten mit Beispielen. Bekannte Namen
verwenden die jüngste dokumentierte Erfassungsart aus abgeschlossenen Trainings
als änderbare Vorgabe, ohne Synonyme oder Übungsdatenbank.

Nach einem Commit stehen heutige Sätze einzeln und in Reihenfolge unter „Heute“.
Der gespeicherte Eintrag erhält den Fokus und eine Live-Meldung bestätigt die Werte.
Gewicht bleibt vorausgefüllt, Wiederholungen werden geleert. Auch Zeit/Strecke
setzen nach dem Speichern keinen Eingabefokus. Aktivitäten mit heutigen Werten
benötigen vor dem Entfernen eine native Browserbestätigung.

„Anderes früheres Training“ öffnet „Frühere Trainings“ mit Name, Datum und
Aktivitäten. Die schnelle Auswahl enthält das jüngste Training je normalisiertem
Namen, ältere Einträge bleiben aufklappbar erreichbar. Details zeigen die Werte.
Wiederholen übernimmt nur Name, Aktivitäten, Reihenfolge und Erfassungsarten;
heutige Ergebnisse bleiben leer. Die gewählte Session bleibt Referenz, auch wenn
sie älter ist. Ohne explizite Auswahl bleiben die bisherigen Ortsreferenzen erhalten.
Es gibt keine neue Split- oder Trainingsplan-Entität.

Eine offene Session führt über „Weiter“ direkt zur Dokumentation. Erst der
erfolgreiche Abschluss eines Trainings mit Werten zählt als `recordUse()`;
ein leeres Training wird entfernt. Training gibt keine Trainingsberatung und
hat weder Push noch ein Statistik-Dashboard. Alle Daten bleiben lokal.
