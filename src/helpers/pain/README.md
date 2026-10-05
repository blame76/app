# Schmerz v0.1

Der minimale Eintrag besteht aus einem Körperbereich und Intensität 1–10. „Anderer
Ort“ benötigt eine kurze Bezeichnung. Speicherung setzt den Dokumentationszeitpunkt
automatisch; sie macht keine Aussage über Beginn oder ungemessene Zwischenzeiten.
„Schmerz weg“ erzeugt für denselben Ort ein neues Ereignis mit 0. Keine Einträge werden
rückwirkend als beendet markiert. Kein Eintrag bedeutet unbekannt.

Der Eintrag erfolgt lokal in zwei Schritten: „Wo tut es gerade weh?“ → Weiter →
„Wie stark ist der Schmerz gerade?“ → Speichern. Auswählen allein springt nicht weiter.
„Ort ändern“ und „Zurück“ erhalten die noch nicht gespeicherte Auswahl.

Nach Speichern bleibt die Funktion geöffnet. Die Bestätigung nennt Ort und Stärke,
den letzten davor dokumentierten Wert desselben Orts und „Fertig“ als primäre Aktion.
Weitere Orte, Details und Verlauf sind freiwillig. „Schmerz weg“ steht immer unter
„Ist der Schmerz inzwischen vorbei?“ und nennt den betroffenen Ort. Historie zeigt ausschließlich dokumentierte
Werte. Körperbereiche werden zum Vergleichen nach Unicode, Groß-/Kleinschreibung und
Leerzeichen normalisiert; die erfasste Bezeichnung bleibt sichtbar.

## Hinweise und Wiedereinstieg

`guidance` ist standardmäßig `true`. „Hinweise ausblenden“ speichert `false` in der
bestehenden `helperRules`-Zeile mit ID `pain`. „Hinweise anzeigen“ in den
Helfer-Einstellungen aktiviert sie wieder. Nur Erklärungen werden ausgeblendet;
Fragen, Skalenanker, Dokumentationszeit und fachliche Formulierungen bleiben sichtbar.
Es gibt denselben Ablauf mit und ohne Hinweise, kein eigenes Tutorial.

Bei vorhandenen Einträgen zeigt der Einstieg nur das zeitlich letzte dokumentierte
Ereignis mit Ort, Stärke und Zeit. „Neuen Wert für …“ öffnet direkt die Intensität,
„Anderen Schmerz dokumentieren“ die Ortsauswahl. Ein letztes Null-Ereignis wird als
solches gezeigt und bietet kein erneutes „Schmerz weg“. Auch ältere Einträge dürfen
hier erscheinen: Es wird keine medizinische Aktualitätsgrenze und kein fortdauernder
Schmerz angenommen. Der absolute Zeitpunkt steht zusätzlich am Zeittext als Tooltip.

Native Fieldsets, Legends und Radios bleiben erhalten. Fokus folgt dem Schrittwechsel
zur Frage und dem Speichern zur Bestätigung; erklärende Texte sind über
`aria-describedby` mit der Gruppe verbunden. Der Ablauf benötigt keine Animation.

## Gespeicherter Eintrag

```js
{
  id: 'pain-…',                  // Shell erzeugt die ID
  helperId: 'pain',
  entryVersion: 1,
  bodyArea: 'Bauch',             // genau ein Ort, höchstens 60 Zeichen
  intensity: 4,                 // ganzzahlig 1–10; resolved immer 0
  eventType: 'observation',      // oder resolved
  recordedAt: 1790000000000,     // automatisch; Dokumentation, kein angenommener Beginn
  createdAt: 1790000000000       // identisch; gemeinsame Aufbewahrungsbasis
}
```

Optionale Felder:

- `startedAt: { kind: 'now' | 'today' | 'yesterday' | 'exact', at: number }`.
  Tagesangaben speichern den lokalen Tagesanfang als Referenz mit Qualifikation;
  in der Historie wird dafür ausschließlich das Datum angezeigt, keine behauptete
  Uhrzeit. Bezug ist der Tag der Dokumentation. Beginn darf nicht später liegen.
- `quality: string[]`, `interference: 0–10`, `possibleContext: string`.
- `relief: string[]` dokumentiert Maßnahmen, unter anderem Medikament, ohne Wirkungsaussage.
- `note: string`.

Ergänzen erhält ID, Ort, Intensität und Dokumentationszeit. Alle bekannten Felder
werden beim Speichern und vor Import fachlich validiert. Unbekannte zukünftige
Eintragsversionen werden abgelehnt; eine Migration existiert noch nicht.

## Plattform

Sichtbarkeit, Favorit und optionale Ort-/Zeit-/Intervallregeln stammen aus der Shell.
Es gibt keine Orts-, Tageszeit- oder Intervalldefaults und keine medizinischen Regeln.
Tatsächliche Nutzung wird erst nach erfolgreichem Ereignisspeichern erfasst. Wenn die
separate Speicherung des Nutzungszeitpunkts scheitert, gilt der Eintrag weiterhin als
gespeichert; die UI meldet den fehlenden Startseitenhinweis statt erneut zu speichern.
Zusatzangaben verändern den Nutzungszeitpunkt nicht.

Aufbewahrung verwendet die gemeinsame kleine Bereinigung: 7/30/365 rollende Tage oder
unbegrenzt, Default unbegrenzt. Daten bleiben in IndexedDB. Es gibt keine externen
Ressourcen, Requests, Analyse, Sharing oder speziellen Export. Der allgemeine App-Export
enthält die lokal vorhandenen Schmerzereignisse. Löschung begrenzter Daten wirkt auch
bei ausgeblendetem Helper; Favorit und Konfiguration bleiben erhalten.

## Grenzen

Der bestehende SVG-Verlauf verbindet ausschließlich dokumentierte Werte; die
vollständige Eintragsliste bleibt als zugängliche Alternative erhalten.
Keine Body Map, zusätzlichen Auswertungs-Charts, PEG, Wochenberichte, Arztberichte, Medikamentenverwaltung,
Diagnose, Therapieempfehlung, Notfalllogik oder abgeleitete medizinische Aussagen.
Die aktuelle Iteration dient persönlichem Dogfooding. Echte Screenreader und weitere
Zielbrowser sind vor Veröffentlichung zu prüfen. Kein neuer medizinischer Hinweistext
wurde ergänzt.
