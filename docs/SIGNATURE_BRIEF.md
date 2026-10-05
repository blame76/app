# Wiederverwendbares Briefing · Signature / Mono Editorial

## Kopiervorlage

> Gestalte ausschließlich den Signature-Modus im Stil „Monochromes Luxury Editorial
> / Modern Classic“. Verwende die beigefügte Referenz und die freigegebenen
> 0815-Screenshots als visuelle Vorgabe. Farblich ruhig, typografisch ausdrucksstark:
> Anthrazit, Elfenbein, gestufte Grauflächen, kontrastreiche klassische Serifenschrift
> und ein sparsamer kalligrafischer Kapitelakzent. Die Notizübersicht soll wie ein
> komponiertes Journal wirken: ein Serif-/Script-Auftakt, Tageskapitel mit Haarlinien,
> eine helle Fläche für den jüngsten Gedanken und dunkle Flächen für weitere Einträge.
> Übernimm die folgenden Farben, Schriftdateien, Rollen und Größen. Prüfe kurze und
> lange echte Inhalte bei 390 und 1280 px; zeige einen ersten Entwurf und einen
> nach eigener visueller Kritik überarbeiteten zweiten Pass. Light, Dark und die
> vorhandenen Abläufe bleiben erhalten. Liefere die Schriften lokal und offline aus;
> die installierte PWA muss neue Releases übernehmen, ohne Eingaben zu verlieren.

## Verbindliche visuelle Vorgaben

**Referenzen:** die vom Nutzer gezeigten schwarzweißen Editorial-Terminvorlagen
sind die Stilreferenz. Ihre Kalender-/Termin-Funktionen sind keine neue Anforderung.
Die hier archivierten finalen App-Aufnahmen sind die reproduzierbare Umsetzung:
[Notizen mobil](../design/signature-reference/integrated/mono-390-notes.png),
[Notizen Desktop](../design/signature-reference/integrated/mono-1280-notes.png),
[weitere Ansichten](../design/signature-reference/comparison.html).

| Rolle | Vorgabe |
| --- | --- |
| Seite / Browserrahmen | Anthrazit `#171716` |
| Dunkle Lesefläche | `#252523` |
| Helferfläche | `#363633` |
| Primärtext / Auswahl | Elfenbein `#eeece4` |
| Sekundärtext dunkel | `#b7b7ae` |
| Helle Notizfläche | `#e8e6de` mit Text `#252522`, Metadaten `#61615a` |
| Haarlinie / Kontrollrand | `#4c4c47` / `#92928a` |
| Ecken | 4–5 px, flächige Form statt stark gerundeter Karten |
| Bewegung | 140 ms; Reduced Motion entfernt Übergänge und Pressed-Bewegung |

**Schriften sind eine konkrete Vorgabe:** Cormorant Garamond, aufrecht, Gewichte
500/600 für Inhalt und Titel; Great Vibes 400 nur für „Journal“ im Kapitelauftakt.
System-Sans bleibt für Bedienung, Uhrzeiten, Metadaten, Eingaben und Auswahlziffern.
Die exakten WOFF2-Dateien liegen in `assets/fonts/`; Revision und Prüfsummen in
[`SOURCE.json`](../assets/fonts/SOURCE.json). Keinen Ersatz allein anhand des Wortes
„elegant“ auswählen. Script nicht für Notiztexte, Fragen, Zahlen oder Buttons verwenden.

| Element | Größe bei 16-px-Grundschrift | Komposition |
| --- | --- | --- |
| NOTIZEN | 50–64 px, Gewicht 600, Zeile .95 | Zentrierte Versalien, Laufweite −.04 em |
| Journal | 48–58 px, Gewicht 400, Zeile 1.1 | Direkt darunter mit −.45 rem Abstand, rein dekorativ |
| Tageskapitel | 14 px System-Sans | Versalien, .12 em Laufweite, anschließende Haarlinie |
| Jüngster kurzer Gedanke | 34–40 px, Zeile 1.2 | Eine helle Fläche für den ersten Eintrag der Liste |
| Weitere kurze Gedanken | 30 px, Zeile 1.25 | Dunkle Leseflächen, .75 rem Abstand zwischen Einträgen |
| Lange Notizen | 24 px, Zeile 1.5 | Absätze erhalten, keine Kürzung und keine feste Höhe |
| Jetzt / Hauptgedanke | 34–40 / 38–48 px | Inhalt stärker als die Navigation gewichten |
| Schmerzfrage / aktueller Wert | 40–52 / 76 px | Serif; native Auswahlziffern bleiben Sans |

Notes-Lesebreite maximal 712 px, App maximal 920 px. Zwischen Tagen 3 rem.
Bis 560 px stehen Uhrzeiten über dem Text; darüber links in einer 2.75-rem-Spalte.
Script und Schriftgrößen allein reichen nicht: Flächenkontrast, Tagespausen und
unterschiedliche Textmaßstäbe müssen im Screenshot gemeinsam erkennbar sein.

## Abnahme

- Bestehende Funktionen und Datenmodelle verwenden; Signature-Regeln unter
  `html[data-theme="signature"]` kapseln. Light/Dark mit identischen Inhalten vor/nach
  der Änderung bei 390/1280 px pixelweise vergleichen.
- Jetzt, Notizen, Detail und Schmerz in beiden Breiten aufnehmen; bei 320/768 px
  sowie 320 px mit 200 % Text auf Reflow prüfen. Notizen mit einem kurzen Gedanken,
  einer mittleren Notiz, mehrabsätziger Prosa, Uhrzeiten und Kontext verwenden.
- Textkontrast AA, sichtbarer 3-px-Fokus und mindestens 44-px-Touchflächen;
  native Radios erhalten. Dekoratives „Journal“ ist für Screenreader ausgeblendet.
- Schriften und Lizenzen mit ausliefern und precachen. Im Pages-Build alle
  Runtime-Dateien hashen; neue Release-ID auch bei einer reinen Schrift-/CSS-Änderung.
- Drei Releases mit echten Service Workern testen: automatischer Wechsel auf der
  Startseite, Schutz eines offenen Entwurfs, Übernahme nach Speichern/Rückkehr und
  aktueller Offline-Neustart einschließlich beider Schriften und lokaler Designwahl.

„Ruhig“, „hochwertig“ oder „Signature“ allein lassen zu viel Spielraum. Für das
nächste Briefing immer **Stilbezeichnung + Referenz + konkrete Schriftrollen +
Komposition + Prüfkriterien** mitsenden. Die freigegebenen Screenshots und Dateien
sind die dauerhafte Referenz; systemabhängige Pixelgleichheit wird nur innerhalb
der gleichen Browser-/Betriebssystemumgebung erwartet.
