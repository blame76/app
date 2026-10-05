# Signature · Mono Editorial

**0.6.6 · 5. Oktober 2026 · `feature/signature-v2`**

Die Bildreferenz des Nutzers macht die gewünschte Richtung konkret: monochromes
Luxury Editorial mit klassischer Serif-, sparsamer Script-Typografie und gestuften
Flächen. Die zuvor umgesetzte A/v2-Richtung war dafür zu zurückhaltend. Der aktuelle
Stand übernimmt diese präzisierte visuelle Sprache in den bestehenden Signature-Modus.

[Wiederverwendbares Briefing](SIGNATURE_BRIEF.md) ·
[Vergleich beider Passes und der echten App](../design/signature-reference/comparison.html) ·
[Notizen mobil](../design/signature-reference/integrated/mono-390-notes.png) ·
[Notizen Desktop](../design/signature-reference/integrated/mono-1280-notes.png)

## Umsetzung

Anthrazit `#171716`, elfenbeinfarbener Text, graue Werkzeugflächen und eine helle
Fläche für den jüngsten Gedanken. Cormorant Garamond trägt Titel, Fragen und Inhalte;
Great Vibes erscheint nur beim Notizen-Auftakt als „Journal“ unter Serif-Versalien.
Bedienung, Eingaben, Zeiten und Auswahlziffern bleiben System-Sans. Die Liste nutzt
Tageskapitel mit Haarlinien, Abstände und unterschiedliche Textmaßstäbe; lange
Notizen behalten ihre Absätze und auf Mobil die gesamte Textbreite.

Detailansichten erhalten eine helle Lesefläche. Schmerz nutzt eine klare Seriffrage,
einen lesbaren aktuellen Wert und graue native Auswahlflächen mit heller Auswahl.
Jetzt bleibt kleiner als der Hauptgedanke. Weitere Helfer, Einstellungen und
Formulare verwenden dieselben monochromen Tokens.

Alle neuen visuellen Selektoren sind in `assets/signature.css` auf Signature
begrenzt. Die Basistabelle von Light/Dark bleibt erhalten. Ein zusätzliches,
standardmäßig verborgenes Header-Element ist mit `aria-hidden="true"` dekorativ;
`showView` setzt dafür ausschließlich Darstellungskontext und Text. Die Auswahl
der Notizübersicht erfolgt über die Ansicht, nicht über einen Personen-/Titeltext.
Renderer, Datenmodelle, Datenbankversion, Exportformat und fachliche Abläufe bleiben
unverändert. Font-Lizenzen sind unter App-Info verlinkt.

Beide Schriftdateien liegen lokal unter `assets/fonts/`, einschließlich vollständiger
OFL-Lizenzen und Herkunfts-/Prüfsummenprotokoll. Zusammen 371.172 Bytes, ohne Font-CDN,
Runtime-Framework oder neue npm-Abhängigkeit. Fonts und Lizenzen gehören zur
Runtime-Whitelist und zum Service-Worker-Precache. Die Schriftwahl bleibt dadurch
auch nach Offline-Neustart erhalten.

## Prüfung und PWA-Update

- Zwei vor der Integration gesichtete Studien-Passes: **16 Screenshots**, jeweils
  **48 Checks**. Revision: mobile Uhrzeiten über dem Text, kleineres Jetzt und
  identische Menüstruktur wie die App. Visuelle Kritik ist archiviert.
- **14 gesichtete Live-Aufnahmen** bei 390/1280 px: Jetzt, Notizen, Detail, Schmerz,
  Einstellungen, Trinken und Rabatt. **107 Signature-Checks** einschließlich
  320/768 px, 320 px mit 200 % Text, AA-Textkontrast, Fokus, Touchflächen, Tastatur,
  Reduced Motion, lokal geladener Fonts und vorhandener Speicherabläufe.
- **16 identische Light-/Dark-Pixelpaare** gegen `5f7599b` (0.6.5): Jetzt, Schmerz,
  Notizen und Detail bei 390/1280 px, nachher jeweils gegen die andere Systemeinstellung.
- Alle **14 bestehenden Browser-Gates mit 831 Checks** bestehen; `npm test` mit
  allen **10 Node-Testdateien**, vier Berliner Zeitzonentests und **41 Syntaxprüfungen**.
- **22 PWA-Checks über drei echte gebaute Releases**: verschiedene HTML- und CSS-Bytes,
  trotz `max-age=3600` aktuelles Stylesheet nach automatischem Vordergrund-Update;
  offener Notizentwurf bleibt erhalten, bestehendes Speichern erfolgt vor Reload,
  Rückkehr auf die Startseite übernimmt die letzte Version. Offline-Neustart lädt
  deren Gestaltung, beide Schriftfamilien, Lizenzen und die lokale Designwahl.

Paket und Cache-Version sind gemeinsam **0.6.6**. Der Pages-Build hasht alle
Runtime-Dateien, jetzt auch beide Fonts; eine reine CSS-/Font-Änderung erzeugt daher
auch ohne manuellen Versionssprung einen neuen Worker. Die vorhandene Update-Logik
prüft Start, Wiederaufnahme, Online-Rückkehr und sichtbare Nutzung. Ein Reload wird
bei offenen Eingaben oder laufender Arbeit bis zur sicheren Startseite verschoben.

Rohberichte und Pixel-Hashes:
[`design/signature-reference/checks.json`](../design/signature-reference/checks.json).
Die Prüfung verwendet Chromium; Standalone ist simuliert. Eine echte
Betriebssysteminstallation, andere Browser, Gerätezoom und Screenreader wurden
nicht geprüft. Offline steht die zuletzt vollständig geladene Version bereit.

Studien und Dokumentation bleiben außerhalb des Builds. Kein Merge oder Deployment
wurde vorgenommen; der Stand wird im Feature-Branch gesichert.
