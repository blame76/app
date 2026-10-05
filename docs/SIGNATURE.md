# Design Modes · Signature C

**Historisches Archiv: Diese Richtung ist verworfen.** Ab 0.6.5 gilt
[`Signature v2 · Editorial Material`](./SIGNATURE_V2.md). Der folgende Bericht
dokumentiert ausschließlich den damaligen Stand und seine Prüfungen.

**0.6.4 · 4. Oktober 2026** · `feature/signature-design-directions`.
Der Nutzer hat nach zwei statischen Design-Passes **C · Chromatic Signature** gewählt.
Die Richtung ist jetzt in die vorhandene Anwendung integriert.

## Auswahl und Persistenz

Menü **Verknüpfungen & Orte → Design** bietet genau **Light**, **Dark** und
**Signature** als native Radiogruppe. Änderungen speichern direkt im bestehenden
IndexedDB-Store `settings`, Datensatz `{ id: 'theme', value: 'signature' }`.
Kein neues Storage-System, Account, Cloud oder System-/Auto-Eintrag.

Beim ersten Start ohne gültiges Setting wird die bisherige Light-/Dark-Darstellung
anhand der damaligen Systemeinstellung einmal übernommen und gespeichert. Danach
folgt die App ausschließlich dieser lokalen Wahl. Ein Wechsel wird erst nach dem
Commit sichtbar; bei Fehler bleiben bisheriger Modus und Auswahl erhalten.

Das Setting wird vor dem Anzeigen der App geladen. `color-scheme` und Browserrahmen
folgen der expliziten Auswahl; Signature verwendet native helle Controls. Import
und Gesamtlöschung verwenden ihre vorhandenen Abläufe; die Darstellung liest danach
wieder das gültige Theme-Setting. Datenbankversion und Exportformat bleiben erhalten.

## Gestaltung und Grenzen

`assets/signature.css` kapselt **sämtliche** neuen visuellen Regeln unter
`html[data-theme="signature"]`. `assets/notes.css` und die alten Helper-Styles sind
unverändert. Die Dark-Tokens in `assets/styles.css` bleiben exakt erhalten und werden
nun über das explizite Attribut statt einer laufenden Media Query aktiviert.

- **Jetzt:** Kobalt-Auftakt, ein großer kursiver Hauptgedanke, präzise Helper-Kanten.
  Weitere Notizen sind kleiner und offen. Kandidaten, Priorität und Reihenfolge
  kommen vollständig aus der bestehenden Context Engine.
- **Notes:** Farbkapitel und Zeitmarginalie, große kurze Gedanken, ruhigere Prosa.
  Lesen, Bearbeiten, Kontext, Personen-Notizen und Löschen nutzen dieselben Renderer.
- **Pain:** Terrakotta für das eigene Instrument; Frage und gewählte Stärke erhalten
  Raum. Das zusätzliche, nur in Signature sichtbare `output` spiegelt den bereits
  vorhandenen Radio-Wert; es erzeugt keine Daten und ist für Screenreader verborgen,
  weil die native Radiogruppe die Auswahl bereits zugänglich beschreibt.
- **Weitere Helper:** Trinken besitzt Dunkelgrün, Rabatt Aubergine. Der gemeinsame
  Kobalt-Rahmen und dieselbe Formensprache halten die Familie zusammen.
- **Interaktion:** präzise Farbzustände und kurze Translation; Reduced Motion entfernt
  sie. Keine externen Fonts, Assets, Ressourcen, Bibliotheken oder neue Views.

## Prüfung

16 Pixelvergleiche: Light/Dark × 390/1280 px × Jetzt/Pain/Notes/Detail.
**Alle Bilder sind pixelgleich** zum vor der Integration gesicherten Stand.
Der neue Stand wurde jeweils unter der gegenteiligen Systemeinstellung aufgenommen.

96 Signature-Checks mit realen Daten bei **320 / 390 / 768 / 1280 CSS px** und
**320 px mit 200 % Text** geprüft: keine horizontalen Überläufe; alle betrachteten
Textkontraste erfüllen die AA-Schwelle. Native Radiogruppen, 3-px-Fokus, mindestens
44 × 44 px bei allen Schmerz-Zahlen, Reduced Motion, Speicherfehler/Retry sowie
Schmerz- und Notes-Speicherung funktionieren.

14 Aufnahmen der integrierten Anwendung liegen unter
[`design/signature/integrated/`](../design/signature/integrated/): Jetzt, Pain,
Notes, Detail, Einstellungen, Trinken und Rabatt bei 390/1280 px.
Bei Full-Page-Aufnahmen steht der fixe Footer nur für das Foto am Dokumentende,
damit lange Inhalte vollständig sichtbar bleiben; der inaktive Skip-Link ist für
Fotos verborgen. Die Anwendung behält ihren fixen Footer und den Tastatur-Skip-Link.

Alle 10 Node-Testdateien und 14 bestehenden Browser-Gates mit 831 Checks bestehen
weiterhin für die bisherigen Modi und Fachabläufe. Der echte Worker-Deployment-Gate
besteht mit 19 Checks und prüft drei Releases, erhaltene
Designwahl, einen ungespeicherten Notizentwurf, Commit vor Neuladen und aktuelles
Offline-Neuladen. Signature-Modul und CSS sind in Precache und Pages-Whitelist;
Paket-/Worker-Version wurden gemeinsam erhöht. Der Inhalts-Hash des Packagers
sichert weiterhin Updates bei jedem geänderten ausgelieferten Asset ab.

Rohberichte und Pixel-Prüfwerte:
[`design/signature/integrated/checks.json`](../design/signature/integrated/checks.json).
Chromium wurde geprüft; Standalone ist simuliert. Reale Betriebssysteminstallation,
Gerätezoom, andere Browser und echte Screenreader wurden nicht getestet.

Kein Merge und kein Deployment wurden vorgenommen.
