# Language & UI Consistency – Inventur vor Änderung

Ausgangsstand: `487cd57`. Geprüft wurden alle sichtbaren Texte in `index.html`,
`src/app.js`, Schmerz-Helper, Manifest und Metadaten, einschließlich bedingter
Einstellungen, Composer, Empty States, Statusmeldungen und Fehlergrenzen.
Dynamische Nutzerdaten und native Browser-Validierung werden nicht umformuliert.

Die Kategorien beschreiben die Entscheidung vor Umsetzung. KEEP erhält Wortlaut
und Bedeutung; SHORTEN kürzt; REMOVE entfernt; CLARIFY präzisiert; MOVE hält
Implementierungsinformationen in Info/Entwicklerkontexten; VISUAL ändert Darstellung.
Diese Datei ist ein Review-Protokoll, keine zur Laufzeit verwendete Copy Registry.

## Startseite, Navigation und Metadaten

| Vorhandener Text / Zustand | Kategorie | Entscheidung |
| --- | --- | --- |
| 0815; Zur Startseite; Zurück zur Startseite | KEEP | Marke und eindeutige Navigation |
| Zum Inhalt; Menü öffnen; Helfer-Einstellungen; Schließen | KEEP | zugängliche Namen |
| Jetzt; Favoriten; Alle Helfer | KEEP | direkte Arbeitsoberfläche |
| Deine Alltagshelfer | REMOVE | wiederkehrende Selbstdarstellung |
| Für die kleinen Dinge im Alltag. | REMOVE | Marketingüberschrift; unsichtbare Überschrift „Startseite“ erhält die Semantik |
| Ein guter Platz für das, was dir hilft. | REMOVE | kommentiert den Nutzen |
| Passende Helfer für diesen Moment. | REMOVE | erklärt die Auswahlleistung |
| Helfer suchen; Helfer suchen …; Kategorie filtern; Alle Kategorien | KEEP | Such-/Filterzweck |
| Helper-Name und Kategorie aus gespeicherter Registry | KEEP | tatsächliche Funktionsbezeichnung, keine neue Benennung |
| Jetzt-Kachel mit Helper und Kontextgrund; Favorit ohne Grund | VISUAL | kompakte Anwendungsobjekte statt breiter Content-Cards |
| passt zu diesem Ort | CLARIFY | gespeicherter Name des passenden Orts, ersatzweise „Ort“ |
| Intervall · ca. N Min. | SHORTEN | „Intervall · N Min.“ nennt die konfigurierte Dauer; Berechnung unverändert |
| morgens; mittags; abends; nachts; zuletzt verwendet | KEEP | sachliche Gründe |
| Noch keine Helfer eingebaut oder sichtbar. | CLARIFY | „Keine sichtbaren Helfer.“ oder „Keine Helfer gefunden.“ je nach Filterzustand |
| Leeres Jetzt / leere Favoriten | KEEP | keine zusätzliche Ansprache |
| Verknüpfungen & Orte; Daten; Datenschutz; Impressum; App-Info & Open Source; Installieren | KEEP | bestehende Ziele |
| Schnell erfassen; Ort; Notiz; Person | KEEP | Footer und zugängliche Bereichsnamen |
| 0815 – Alltagshelfer; lokale Alltagshelfer ohne Account, Tracking oder Cloud | CLARIFY | Metadaten nennen lokale Speicherung statt einer mehrdeutigen Tracking-Aussage |
| Lokale Alltagshelfer im passenden Kontext – ohne Account, Tracking oder Cloud. | SHORTEN | Manifest-Beschreibung auf lokal gespeicherte Inhalte reduzieren |

## Einstellungen und Daten

| Vorhandener Text / Zustand | Kategorie | Entscheidung |
| --- | --- | --- |
| Favorit; Im Favoriten-Tab anzeigen. | CLARIFY | „In „Favoriten“ anzeigen.“ – der Bereich ist kein Tab |
| Sichtbar; In „Alle Helfer“ anzeigen. | KEEP | erklärt genau den Schalter |
| Ort; Tageszeit; Intervall; Minuten; Toleranz ± Minuten | KEEP | die vorhandenen Regeln sind in Einstellungen bewusst erklärbar |
| Noch kein Ort gespeichert.; Name eines gespeicherten Orts | KEEP | tatsächlicher Zustand |
| Aufbewahrung; 7 Tage; 30 Tage; 365 Tage; Unbegrenzt | KEEP | Auswahl und Konsequenz erhalten |
| Bei begrenzter Dauer werden ältere Einträge gelöscht. Eine kürzere Dauer löscht betroffene Daten beim Speichern. Einstellungen bleiben erhalten. | SHORTEN | Löschfolge beim Speichern und erhaltene Einstellungen ausdrücklich bewahren |
| Hinweise anzeigen; Kurze Erklärungen beim Dokumentieren anzeigen. | KEEP | sichtbarer Ort für die Reaktivierung |
| Speichern; Gespeichert. | CLARIFY | Aktion erhalten; Erfolg als „Einstellungen gespeichert.“ |
| Verknüpfungen; Orte; Helfer | KEEP | Einstellungsgruppen |
| Favorit; N Ort(e); Tageszeitliste; N Min.; Keine Verknüpfung | CLARIFY | richtige Singular-/Pluralform für Ortszahl |
| Noch keine Verknüpfungen.; Radius N m; Entfernen | KEEP | Zustand, gespeicherte Größe und Handlung |
| Hier werden eingebaute Helfer ein- oder ausgeblendet. Ausblenden löscht keine Daten. | SHORTEN | Implementierungssprache streichen, Datenfolge behalten |
| Noch keine Helfer eingebaut. Neue Helfer werden einzeln in src/helpers/ ergänzt. | MOVE | Entwicklungsschritte bleiben in Entwicklerdokumentation; UI: „Keine Helfer verfügbar.“ |
| Alle Inhalte liegen lokal in diesem Browser. Export ist die einfache Sicherung. | CLARIFY | lokale Speicherung und Exportkopie sachlich beschreiben |
| Speicher schützen | CLARIFY | Zweck der Browserfreigabe: vor automatischem Löschen schützen |
| Persistenter Browser-Speicher wird nicht unterstützt. | CLARIFY | „Speicherschutz ist hier nicht verfügbar.“ |
| Browser meldet persistenten Speicher. | CLARIFY | „Schutz vor automatischem Löschen aktiv.“ |
| Speicher ist derzeit nicht als persistent markiert. | CLARIFY | mögliche automatische Löschung bei Speichermangel erklären |
| Nicht unterstützt.; Persistenter Speicher angefragt.; Browser hat persistenten Speicher nicht zugesagt. | CLARIFY | tatsächliche Freigabe oder Ablehnung anzeigen, keine Erfolgsgarantie behaupten |
| Exportieren; Importieren; Alle lokalen Daten löschen | KEEP | konkrete Handlungen |
| Import ersetzt alle lokalen Daten dieser App. Fortfahren? | KEEP | notwendige destruktive Folge |
| Alle lokalen Daten dieser App wirklich löschen? | KEEP | notwendige Bestätigung |
| Import abgeschlossen.; Lokale Daten gelöscht. | CLARIFY / KEEP | „Daten importiert.“; Löschbestätigung erhalten |

## Footer-Composer

| Vorhandener Text / Zustand | Kategorie | Entscheidung |
| --- | --- | --- |
| Schnelle Notiz | SHORTEN | „Notiz“ |
| Notiz; Was willst du festhalten?; Speichern; Notiz gespeichert. | SHORTEN / KEEP | Placeholder „Notiz“, zugänglicher Name und Erfolg erhalten |
| Diesen Ort merken; Name; z. B. Einkaufszentrum; Ort speichern; Ort gespeichert. | KEEP | verständliche Ortsaufnahme |
| Standort fehlt. | CLARIFY | „Standort noch nicht verfügbar.“ |
| Standort wird nur für dieses Speichern abgefragt … | SHORTEN | „Standort wird abgefragt …“ – Abfrage beginnt bereits beim Öffnen |
| Standort bereit. | KEEP | beobachtbarer Zustand |
| Standort-/Browser-Exception direkt im Status | CLARIFY | verständliche Freigabe-/Verfügbarkeitsmeldung, kein Exception-Text |
| Person; Neue Person; gespeicherte Namen; Name; Notiz | KEEP | vorhandene Daten und Eingabezwecke |
| Hinzufügen als Auswahlüberschrift; Referenz als Auswahlwert | CLARIFY | „Art des Eintrags“; „Notiz“, gespeicherter Wert `reference` bleibt erhalten |
| Geschenkidee; Hinzufügen | KEEP | bestehende Art und Handlung |
| Name fehlt. | CLARIFY | „Bitte einen Namen angeben.“ |
| Hinzugefügt. | CLARIFY | „Geschenkidee gespeichert.“ oder „Notiz zur Person gespeichert.“ |

## Schmerz

| Vorhandener Text / Zustand | Kategorie | Entscheidung |
| --- | --- | --- |
| Schmerz; Wohlbefinden | KEEP | Name und Kategorie |
| Ich führe dich kurz durch den Eintrag. Du brauchst nur Ort und Stärke. Alles Weitere ist freiwillig. | SHORTEN | „Für einen Eintrag reichen Ort und Stärke.“ |
| Ich weiß Bescheid | CLARIFY | „Hinweise ausblenden“ beschreibt die Handlung |
| Hinweise ausgeschaltet. In den Helfer-Einstellungen kannst du sie wieder einschalten. | SHORTEN | „Hinweise ausgeblendet.“ |
| Hinweise konnten nicht ausgeschaltet werden. Bitte erneut versuchen. | CLARIFY | „ausgeblendet“ auch im Fehlerfall |
| Wo tut es gerade weh? | KEEP | zentrale Frage |
| Wähle den Ort, den du jetzt dokumentieren möchtest. Einen weiteren kannst du danach hinzufügen. | SHORTEN | ein Ort, weitere danach; keine Selbsterklärung |
| Kopf; Nacken; Rücken; Bauch; Arm/Hand; Bein/Fuß; Anderer Ort; Kurze Bezeichnung | KEEP | vorhandene Auswahl und Eingabe |
| Weiter; Ort ändern; Zurück | KEEP | explizite Navigation |
| Bitte benenne den Schmerzort. | CLARIFY | „Bitte einen Schmerzort angeben.“ |
| Wie stark ist der Schmerz gerade?; 1–10; 1 = wenig · 10 = sehr stark | KEEP | Frage und wichtige Skalenanker |
| Wähle die Zahl, die sich im Moment am ehesten richtig anfühlt. | SHORTEN | subjektive Wahl verständlich und knapper |
| Speichern; Eintrag gespeichert.; Ort · Wert gespeichert | KEEP | sachliche Bestätigung |
| Dokumentiert: Datum/Zeit; Schmerz weg; schmerzfrei | KEEP | explizit dokumentierte Information |
| Letzter dokumentierter Wert für Ort: Wert / Zeit; Erster dokumentierter Wert für Ort. | KEEP | keine erfundenen Zwischenzustände |
| Du bist fertig. Wenn du möchtest, kannst du noch etwas ergänzen. | REMOVE | die vorhandenen Aktionen erklären die Möglichkeiten |
| Fertig; Weiteren Schmerzort dokumentieren; Details ergänzen; Verlauf ansehen | KEEP | eindeutige Handlungen |
| Beginn, Schmerzart, mögliche Zusammenhänge oder Notiz. | KEEP | optionale Details erklären; Guidance schaltet diese Erklärung aus |
| Ist der Schmerz inzwischen vorbei?; Schmerz weg; Für Ort | KEEP | bewusste Null-Dokumentation mit Ortsbezug |
| Zuletzt dokumentiert; Ort · Wert; vor N Minuten/Stunden/Tagen; gerade eben | KEEP | Zeit seit Dokumentation, kein behaupteter Schmerzstatus |
| Neuen Wert für Ort; Anderen Schmerz dokumentieren | KEEP | schneller Einstieg |
| Schmerzort; Ort auswählen | KEEP | ortsbezogener Verlauf |
| Details ergänzen · Ort; Wert · dokumentiert Datum/Zeit. Alle Angaben sind freiwillig. | KEEP | Zeitpunkt und Freiwilligkeit |
| Seit wann ungefähr?; Keine Angabe; gerade eben; am Tag der Dokumentation; am Vortag; genauer …; Beginn | CLARIFY / KEEP | „gerade eben“ in nachträglichen Details als „zum Zeitpunkt der Dokumentation“ präzisieren; Bezug und Wahlwerte bleiben gleich |
| Wie fühlt sich der Schmerz an?; stechend; dumpf; brennend; ziehend; pochend; anderes | KEEP | vorhandene Frage und Arten |
| Wie sehr stört er dich gerade?; Keine Angabe; 0 · gar nicht bis 10 · sehr stark | KEEP | vorhandene Skala |
| Ist dir etwas aufgefallen, das damit zusammenhängen könnte? | KEEP | keine kausale Behauptung |
| Was hast du getan?; Wärme; Ruhe; Bewegung; Medikament; anderes | KEEP | dokumentierte Maßnahmen ohne Wirkungsbehauptung |
| Notiz; Angaben speichern | KEEP | optionale Angaben |
| Angaben gespeichert. | CLARIFY | „Details gespeichert.“ passend zur Aktion |
| Ort · Verlauf; Angezeigt werden nur dokumentierte Werte. | KEEP | wichtige Interpretationsgrenze |
| Heute; Gestern; Datum; Uhrzeit; Wert; 0 · schmerzfrei · Schmerz weg | KEEP | ausschließlich dokumentierte Ereignisse |
| Noch keine dokumentierten Werte für diesen Ort.; Wert dokumentieren | KEEP | notwendiger Leerzustand und Handlung |
| Beginn ungefähr; Schmerzart; Wie sehr gestört; Möglicher Zusammenhang; Was getan wurde; Notiz | KEEP | gespeicherte Details |
| Browser-Speicher voll. Eintrag konnte nicht gespeichert werden. | CLARIFY | Ursache und erhaltener Eingabestand; Wiederholung möglich |
| error.message als allgemeiner Speicherfehler | CLARIFY | verständliche Meldung an der UI-Grenze, keine technischen Feldnamen |
| Eintrag gespeichert. Der Startseitenhinweis konnte nicht aktualisiert werden. | CLARIFY | tatsächlich betroffene Anzeige „Zuletzt verwendet“ nennen; Eintrag gilt weiterhin als gespeichert |

## Fehlergrenzen, Datenschutz und Info

| Vorhandener Text / Zustand | Kategorie | Entscheidung |
| --- | --- | --- |
| Browser-Speicher voll. Bitte Daten exportieren und Speicher freigeben. | KEEP | konkreter Speicherfehler |
| Speichervorgang abgebrochen. Bitte erneut versuchen. | KEEP | konkreter Vorgang |
| Browser-Speicher nicht verfügbar. Bitte Browsereinstellungen prüfen. | SHORTEN | „Speicher nicht verfügbar. Bitte Browsereinstellungen prüfen.“ |
| Aktion fehlgeschlagen. Bitte erneut versuchen. | CLARIFY | unbekannte Exceptions nicht direkt anzeigen; Formularfehler nennen erhaltene Eingabe |
| Datenbank-Update blockiert. Bitte andere Tabs dieser App schließen. | CLARIFY | Speicher nicht geöffnet; andere Tabs schließen und Seite neu laden |
| Intervall muss mindestens eine Minute betragen.; Toleranz muss eine nichtnegative Zahl sein.; Toleranz benötigt ein Intervall und muss kleiner als dieses sein. | KEEP | Werteprüfung unverändert; lokale UI erklärt die Intervall-/Toleranzgrenzen bei Ablehnung |
| Validierungsfehler zu Schema, Stores, helperId, entryVersion, IDs, JSON, Prototype-Schlüsseln und internen Feldern | MOVE | bleiben intern/Entwicklerdiagnostik; Import-UI nennt unlesbare/ungeeignete Datei und unveränderten Bestand |
| Offline-Speicher konnte nicht eingerichtet werden. | CLARIFY | „Offline-Nutzung konnte nicht eingerichtet werden.“ |
| Datenschutz: lokale Inhalte; kein Benutzerkonto; keine Analytics / kein eigenes Tracking | CLARIFY | lokale Speicherung und keine Übertragung erfasster Inhalte; keine missverständliche Aussage über persönliche Dokumentation |
| Standortfreigabe, lokale Auswertung, keine Hintergrund-Geofencing-Funktion | CLARIFY | tatsächliche Abfrage auf der Startseite und beim Öffnen des Orts-Composers benennen |
| Vor Veröffentlichung: tatsächliche Server-Logs des Hosters ergänzen | KEEP | ehrlicher unvollständiger Veröffentlichungsstand |
| Impressum: Platzhalter – vor Veröffentlichung ergänzen.; Name / Anschrift / Kontakt des verantwortlichen Anbieters. | KEEP | keine Anbieterangaben erfinden |
| 0815 ist eine Vanilla-JavaScript-PWA unter MIT-Lizenz. | CLARIFY | installierbare Web-App, MIT-Lizenz; Technik ist hier zulässig |
| Keine Runtime-Abhängigkeiten, kein Framework, kein Account, keine Cloud. Helfer werden als kleine unabhängige Komponenten ergänzt. | SHORTEN / MOVE | faktische Technik kurz in App-Info; Komponentenablauf bleibt in Entwicklerdokumentation |
| Browsermeldungen zu Pflichtfeld, Typ, Länge, Minimum/Maximum | KEEP | native Semantik und Browserlokalisierung |

## Scope und Umsetzung

Kein neues Glyph-Set vorhanden; nur vorhandene CSS-Facette, Typografie und Proportion.
Ortsname ersetzt ausschließlich den dargestellten Kontextgrund. Rangfolge, Ortung,
Intervall- und Tageszeitberechnung bleiben erhalten. Fehlertexte werden an bestehenden
UI-Grenzen formuliert; Modell, Storage, Importprüfung und Transaktionen bleiben unverändert.
Nach erfolgreichem Import darf ein späterer Anzeigefehler keine unveränderten Daten
behaupten. Diese Unterscheidung betrifft ausschließlich die Rückmeldung.

## Ergebnis und Prüfung

Umgesetzt in v0.5.3: direkte Startseite mit einer für assistive Technik erhaltenen
Überschrift, gekürzte Guidance, konkrete Status-/Fehlertexte und kompakte,
facettierte Kacheln. Lange Namen und Gründe bestimmen die nötige Kachelhöhe;
Text und Fokusrahmen werden nicht abgeschnitten. Favoriten verwenden die ruhigere
Materialfarbe; „Alle Helfer“ bleibt eine Liste.

- `npm test`: alle vier Testdateien mit insgesamt 27 Prüffällen erfolgreich.
- Syntax: alle 19 JavaScript-Dateien geprüft; `git diff --check` ohne Befund.
- Browser-Gates in Chromium: 24 Shell-, 22 Design-, 88 Schmerz-,
  30 Personal-Object- und 33 Language-Checks, insgesamt 197 erfolgreich.
- Enthalten: Dashboard → Helper → Zurück, native Tastaturbedienung und Fokus,
  Guidance an/aus, Einstellungen, alle drei Composer, `hidden`, 320 CSS px,
  200 % Textvergrößerung, Reduced Motion und erhaltene Eingaben bei Fehlern.
- Echter Service Worker: sieben erfolgreiche Checks zu v0.5.3, Cache-Abgrenzung,
  aktualisierten Assets, Offline-Öffnen, Speichern und Wiederherstellen.
- Sichtprüfung mit mehreren Kontext-Fixtures bei 320/1280 px sowie echtem
  Schmerz-Helper bei 390 px. Keine neuen Bildassets oder Abhängigkeiten.

Geolocation war kontrolliert simuliert. Reale Screenreader und weitere Browser
wurden in diesem Durchlauf nicht manuell geprüft. Offene sprachliche oder visuelle
Entscheidungen aus diesem Pass: keine.
