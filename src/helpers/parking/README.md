# Parken

Eine aktive Position im `entries`-Store: feste ID `parking-position`, `helperId: parking`,
`entryVersion: 1`, `lat`, `lon`, `accuracy` (Meter), `createdAt` (Zeit der Speicherung),
optionale Notiz bis 500 Zeichen. Erneutes Merken ersetzt diesen Datensatz vollständig;
Löschen entfernt ihn. Keine Historie, kein Eintrag in `places`, keine Retention.
Bei konkurrierenden Tabs gewinnt wie bei anderen begrenzten Helper-Zuständen der
letzte Commit. Import erlaubt nur diese eine Zustands-ID.

Ortung ausschließlich nach „Parkplatz merken“/„Parkplatz neu merken“ über
`api.getPosition()`. Navigation vor Rückkehr der Ortung verhindert das Speichern.
Ortungs-/Speicherfehler erhalten vorhandene Daten. `recordUse()` folgt ausschließlich
einer erfolgreich gespeicherten Position; Notizpflege und Löschen ändern diesen
Nutzungszeitpunkt nicht. Ein Metadatenfehler verwirft keinen bereits gespeicherten Ort.

„Parkplatz anzeigen“ zeigt gespeicherte Koordinaten und die gemeldete Genauigkeit.
Keine Karte, Navigation, Netzwerk-API oder laufende Standortabfrage im Helper.
Ohne erneute Ortung bleiben Lesen, Bearbeiten und Löschen offline möglich; eine neue
Position setzt voraus, dass der Browser auch offline einen Standort liefern kann.
