# Trinken

Ohne Eintrag: „Gerade etwas getrunken?“ → „Ja“. Danach und beim Wiedereinstieg:
„Zuletzt dokumentiert“, Zeit seit dem letzten Eintrag und „Ja, gerade“. Der Helper
bleibt geöffnet. Der neue Zeitpunkt ist die Bestätigung; kein zusätzlicher Erfolgs-
Toast. Die absolute Zeit steht als `datetime` und Tooltip bereit. „Heute“ zeigt nur
Ereignisse des lokalen Kalendertags, neueste zuerst; ältere Daten bleiben gespeichert.

Jede Handlung erzeugt einen eigenen Entry:
`{ id, helperId: 'drink', entryVersion: 1, recordedAt, createdAt }`.
ID aus der Shell; Zeitstempel automatisch und identisch. Keine Menge, kein Ziel,
keine Bewertung. `validateEntry` prüft das Format beim Schreiben und vor Import.
`recordUse()` erst nach Commit; scheitert nur der Nutzungszeitpunkt, bleibt das
Getränk dokumentiert und wird nicht erneut zum Speichern angeboten.

Nur `contexts: ['interval']`, Defaults 60 Minuten und 15 Minuten Toleranz.
Produkt-/Interaktionsdefaults, keine medizinische Empfehlung. Die Shell wird nicht
verändert: Intervall fällig ab Minute 45, bleibt später fällig. Vorher kann „zuletzt
verwendet“ den Helper unter „Jetzt“ zeigen. Noch kein `recordUse()` → kein Intervall-
Kandidat. Geändertes Intervall und Toleranz wirken auf denselben Nutzungszeitpunkt.
Die Dashboard-Berechnung läuft bei dessen Rendern, nicht durch einen Hintergrundtimer.

Retention über die Shell: `always` als konservativer Default, optional 7/30/365
rollende Tage. Pruning gilt auch ausgeblendet, löscht weder Regeln noch Favoriten
oder andere Helper-Daten. Intervall, Toleranz, Sichtbarkeit und Favorit nur in den
gemeinsamen Einstellungen. Keine eigene Ortung, Tageszeitregeln oder Guidance.

Keine externen APIs oder Assets, Benachrichtigungen, Alarme oder Trinkempfehlungen.
Modell und CSS sind deklarierte `offlineAssets`.
[Helper Authoring Guide](../../../docs/HELPER_AUTHORING.md).
