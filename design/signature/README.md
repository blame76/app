# 0815 · Signature · drei Richtungen

Stand: **zweiter Design-Pass**, 4. Oktober 2026. Feature-Branch:
`feature/signature-design-directions`. Die Auswahl fiel anschließend auf **C**.
Die Integration ab **0.6.4** ist in [`docs/SIGNATURE.md`](../../docs/SIGNATURE.md)
dokumentiert; dieser Bericht hält die ursprünglichen Studien fest.

[Vergleich öffnen](./comparison.html) · [Studien öffnen](./index.html) ·
[Kritik nach Pass 1](./CRITIQUE.md)

Vom Repository aus mit dem bestehenden lokalen HTTP-Server:
`http://127.0.0.1:8080/design/signature/comparison.html`.
Die Studien benötigen wegen der vorhandenen ES-Modul-Renderer einen HTTP-Server.
Keine Dependencies, externen Requests, Bildassets, Fonts oder Storage-Aufrufe.

## Vergleich und Empfehlung

| Richtung | Stärken | Schwächen |
| --- | --- | --- |
| **A · Editorial Scale** | Große Serifenskala; asymmetrischer Dashboard-Gedanke; Oxblood-Klammer kehrt bei Notizdetail und Tagesmarginalie wieder. Pain bleibt offen und schnell. | Näher an der vorhandenen Serif-/Oxblood-Welt; weniger sofortige Eigenständigkeit. Die großen Tageskapitel benötigen bei langen Listen viel Raum. |
| **B · Tactile Object** | Geformte Instrumente mit digitaler Tiefe; asymmetrische Ecke und Farbkapsel in allen Ansichten; besonders ruhiger Pain-Screen. Die durchgehende Notes-Fläche verbindet Inhalte. | Weniger Magazin-Komposition; geformte Flächen können bei sehr langen Inhalten schwerer wirken. Trotz Überarbeitung die größte Nähe zu bekannten Kartenoberflächen. |
| **C · Chromatic Signature** | Kobalt ist bereits in Ruhe erkennbar; kursiver Gedanke als wiederkehrende Geste; Farbkapitel machen Notizen zu Inhalt. Pain hat eine ruhige eigene Terrakotta-Bühne; Helper-Farbkanten unterstützen die Familie. | Die dominante Farbe ist täglich sehr präsent. Beim späteren Einbau müssen lange Texte und leere Ansichten dieselbe Disziplin behalten. |

**Empfehlung: C · Chromatic Signature.** Nach dem zweiten Pass hat C die klarste
Identität ohne Logo. Die reduzierte Helper-Darstellung lässt den Gedanken unter
„Jetzt“ der Hauptdarsteller sein. Kobalt + kursiver Inhalt + präzise Farbkante
funktionieren auf Dashboard, Liste und Detail; Pain bleibt ein eigener, verständlicher
Erfassungsschritt. B wäre die Wahl, wenn digitale Greifbarkeit Vorrang hat; A,
wenn offene Editorial-Komposition Vorrang hat.

Nach dem Vergleich wurde zunächst wie beauftragt gestoppt. Der Nutzer wählte
anschließend **C**, das jetzt als Signature mit den drei expliziten Optionen
Light / Dark / Signature integriert ist. Persistenz nutzt die vorhandenen Settings.
Light und Dark behalten ihre bisherige visuelle Ausgabe.

## Zwei tatsächlich gesichtete Passes

`screenshots/pass-1/` enthält 24 Aufnahmen des ersten Entwurfs;
`screenshots/pass-2/` enthält 24 Aufnahmen nach Kritik und Überarbeitung.
Je Richtung: Jetzt, Schmerz, Notizen und Notizdetail bei **390** und **1280 CSS px**.
Alle 48 Bilder wurden anhand zweier Kontaktübersichten pro Pass visuell geprüft.
Einzelbilder sind über die Vergleichsseite in voller Auflösung erreichbar.

A erhielt eine versetzte Inhaltsachse und eigene Tagesmarginalie. B erhielt eine
zusammenhängende Lesefläche statt einer Tageskarte je Kapitel. C erhielt kleine
Helper-Farbkanten statt gleichgewichtiger gesättigter Blöcke. Controls und Wörter
wurden für Textvergrößerung überarbeitet. Die ursprüngliche Kritik bleibt erhalten.

Full-Page-Aufnahmen setzen den fixen Footer **nur für die Aufnahme** ans Dokumentende,
damit er bei langen Notes-Screens keinen Zwischeninhalt überlagert. Die interaktive
Studie verwendet weiterhin den fixen Footer. Dieser Aufnahmeunterschied ist kein
Vorschlag für eine Änderung der App-Navigation.

## Prüfung nach Pass 2

| Gate | Ergebnis |
| --- | --- |
| Recognition | A: wiederkehrende offene Klammer und Versatz; B: gestufte Ecke und Instrumentfeld; C: Kobalt/Kursiv/Farbkante. C ist ohne Logo am deutlichsten. |
| Hierarchy | Jetzt: verknüpfter Gedanke; Pain: Frage und ausgewählter Wert; Notes: Tagesauftakt und erster kurzer Gedanke; Detail: Text. |
| Restraint | A: Skala + Klammer; B: Form + Tiefe; C: eine Hauptfarbfläche + eigene Helper-Kante. Kein Icon-Raster, keine kontinuierliche Animation. |
| Content | Tatsächliche Notes-Renderer, Absatzumbrüche, Metadaten und Kontext erhalten; Fließtext bleibt auf Lesebreite. |
| Responsiveness | Alle vier Ansichten in allen drei Richtungen bei 320 / 390 / 768 / 1280 CSS px ohne horizontalen Überlauf; zusätzlich 320 px mit 200 % Text. |
| Accessibility | Tastatur-Radiogruppen, sichtbarer 3-px-Fokus, mindestens 44-px-Radioziele, Reduced Motion. Textkontrast aller sichtbaren Inhalte der zwölf Screens erreicht AA-Schwellen. |
| Ressourcen | Nur lokale Ressourcen; keine Worker-Registrierung und keine Storage-Schreibaufrufe in den Studien. |

`capture.js` nutzt die vorhandene Playwright-Infrastruktur. Im Browsertool zuerst
`/design/signature/?pass=2` öffnen, danach die Datei als `filename` ausführen.
Für Pass 1 existieren die archivierten Screenshots; die aktuelle CSS zeigt Pass 2.
`contrast-check.js` prüft die tatsächlichen Textkontraste aller zwölf Screens.
Die Capture-Ausgabe enthält 76 Layout-/Bedien-/Ressourcenchecks. Reale Screenreader,
Gerätezoom und andere Browser sind damit nicht geprüft.

Zusätzlich bestanden `npm test`, die Berliner Tagesgrenzen und alle 14 bestehenden
Browser-Gates mit zusammen **831 Checks**. Der zusätzliche PWA-Deployment-Gate
bestand mit 17 Checks. Die Rohberichte stehen in [`checks.json`](./checks.json).

## Integration vorbereiten, Fachlogik erhalten

Alle drei Richtungen nutzen **dieselbe** Studie und dieselben HTML-Strukturen.
`study.css` kapselt die Richtungen über `data-direction`; bei Auswahl entspricht das
später den ausschließlich auf `data-theme="signature"` begrenzten Regeln.
Es gibt keinen zweiten produktiven View-Satz und keine duplizierte Fachlogik.

Notes Übersicht und Detail verwenden direkt `renderNotes` und `renderNote` aus der
vorhandenen Anwendung, mit ausdrücklich statischen Fixture-Daten. Pain kopiert die
bestehende Fieldset-/Radio-Semantik; einzige vorgeschlagene Zusatzstruktur ist ein
rein darstellendes `output` für den gewählten Wert. Das spätere Update dieses Wertes
gehört an das vorhandene Change-Event und erzeugt keinen neuen Datensatz.

Alle Capture-Aktionen sind Demonstrationen, keine Speicher- oder Löschaktionen.
Die Studien sind von der Pages-Whitelist und dem produktiven Offline-Cache ausgeschlossen.

## Zusätzlich beauftragte PWA-Aktualisierung

Die ausdrückliche Bitte, nach Deployments die installierte PWA zu aktualisieren,
ist als getrennte technische Änderung umgesetzt; die Designstudien bleiben isoliert.

- Der vorhandene Pages-Packager bildet einen reproduzierbaren Inhalts-Hash über
  sämtliche ausgelieferten Dateien. Dieser ergänzt den Worker-Cache-Namen und ändert
  den Worker auch dann, wenn ein manueller Versionssprung vergessen wurde.
- Die App prüft beim Registrieren, Wiederaufnehmen, Online-Wechsel und jede Minute
  im sichtbaren Fenster auf Updates; Worker und Importe umgehen den HTTP-Cache.
- Ein neuer Controller lädt die Startseite genau einmal neu. Erste Installation
  erzeugt kein Neuladen. Helper, Editor, offene Composer, Dialoge und laufende Saves
  verschieben das Neuladen bis zur sicheren Rückkehr auf die Startseite.
- Kein Datenmodell, keine Datenbanklogik, keine Import-/Export-Logik und keine
  Light-/Dark-Styles wurden geändert. Die Worker-Lifecycle-/Fetch-Logik bleibt erhalten;
  nur Release-Name und Precache-Liste wurden angepasst. Version: **0.6.3**.

Der echte Chromium-Worker-Test spielt drei Releases unter `/app/` trotz langlebigem
HTTP-Cache durch: Erstinstallation, automatisches Update, unverlorener offener
Notizentwurf, Commit vor Neuladen, Fremd-Cache-Erhalt und echtes Offline-Neuladen.
Standalone wird im Test simuliert; eine Installation auf einem realen Gerät wurde
nicht getestet. Offline kann die App nur die zuletzt erfolgreich geladene Version
verwenden. Bereits laufende Altversionen ohne den neuen Update-Listener übernehmen
auch diesen Listener beim nächsten Neuladen/Neustart.

Kein Deployment und kein Merge wurden vorgenommen.
