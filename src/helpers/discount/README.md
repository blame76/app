# Rabatt

Eine Seite: Preis in Euro und Rabatt in Prozent → Berechnen → Endpreis und Differenz.
Dezimalkomma und Dezimalpunkt, jeweils höchstens zwei Nachkommastellen. Negative,
nichtendliche, exponentielle und mehrdeutige Werte werden abgelehnt. Rabatt 0–100 %.
Ganzzahlige Cents und Prozent-Hundertstel vermeiden Floating-Point-Artefakte;
der Endpreis wird auf den nächsten Cent gerundet (halber Cent aufwärts), die
Ersparnis ist die Differenz zum ursprünglichen Preis. Ausgabe mit `Intl.NumberFormat`.

Ein eigener Entry `discount-history` enthält `helperId: 'discount'`, `entryVersion: 1`,
`createdAt` der letzten Berechnung und maximal fünf `calculations`, neueste zuerst.
Jede speichert nur `priceCents`, `discountBasisPoints`, `recordedAt`; Ergebnisse
werden deterministisch daraus berechnet. Der ganze begrenzte Zustand wird atomar
ersetzt, ohne Lösch-API oder zeitbasierte Retention. Vor jedem Speichern frisch lesen;
gleichzeitige Änderungen desselben Zustands in mehreren Tabs sind nicht atomar
zusammengeführt. Import prüft Format, Werte, Zeit und Grenze vor dem Schreiben.

`recordUse()` folgt erst nach dem erfolgreichen Commit. Scheitert nur die
Nutzungsmetadaten-Speicherung, bleiben Berechnung und Historie erfolgreich.
Eigene Ortung gibt es nicht: nur `contexts: ['place']`. Der Nutzer verknüpft einen
gespeicherten Ort über die Shell-Einstellungen. Favorit und Sichtbarkeit ebenfalls
Shell-Aufgaben. Kein Default-Ort, keine Zeit- oder Intervallregeln.

Keine externen Ressourcen oder Requests. Modell und CSS stehen in `offlineAssets`.
Weitere Integrationsregeln: [Helper Authoring Guide](../../../docs/HELPER_AUTHORING.md).
