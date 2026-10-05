# Signature v2 · Editorial Material

> Historischer Stand 0.6.5. Die aktuelle, anhand der Bildreferenz umgesetzte
> Richtung ist [Mono Editorial · 0.6.6](SIGNATURE_REFERENCE.md).

**0.6.5 · 4. Oktober 2026 · `feature/signature-v2`**

Der C-Entwurf aus 0.6.4 ist verworfen. Nach zwei statischen Entwürfen, Screenshots,
Selbstkritik und zweitem Pass wurde **A · Editorial Material** ausgewählt und in
den bestehenden Signature-Modus integriert. Der Nutzer hat die Auswahl und Umsetzung
ausdrücklich delegiert. [Vergleich und Entscheidung](../design/signature-v2/README.md).

## Gestaltung

Signature beginnt bei Light: dieselbe Navigation und dieselben Abläufe, eine wärmere
neutrale Seite, kleine Flächenabstufungen und ein gedämpfter Aubergine-Akzent.
Keine große Akzentfläche, keine Helper-Mini-Brands, keine Texturen oder Bilder.

- **Jetzt:** 1,75-rem-Ebene für die Navigation; der Gedanke besitzt die Inhalts-Serif,
  eine präzise Zeilenlänge und kürzere Meta-Pause. Kacheln erhalten minimale digitale
  Tiefe, ohne Balken, Konturen oder dekorative Ecken. Reihenfolge und Kandidaten
  bleiben ausschließlich Sache der bestehenden Context Engine.
- **Notes:** offene Lesefläche, kleine Serif-Tageskapitel, Zeitmarginalie bei breiter
  Ansicht und Zeitauftakt mobil. Nur echte Tagesgrenzen haben eine Hairline.
  Kurze Gedanken und Prosa erhalten unterschiedliche, ruhige Textproportionen.
- **Detail:** Inhalt bleibt auf der Seite, ohne Fläche oder Hülle. Datum und
  Verknüpfung sitzen auf derselben Inhaltsachse; eine längere Pause führt zu Aktionen.
- **Pain:** vertraute Frage und native Radiogruppe. Die gewählte Zahl erhält 3,5 rem,
  ohne farbige Bühne. Nur die Auswahl bekommt den leisen Akzent. Kein Rot als Schmerzsignal.
- **Formulare und weitere Helfer:** integrierte Felder mit einer Unterkante,
  gleiche Farbwelt und Bedienung. Der Wert beziehungsweise die Hauptaktion trägt
  die Identität. Fokus bleibt deutlich; Pressed bewegt 1 px, Übergänge dauern 140 ms.
  Reduced Motion entfernt Bewegung, ohne Layout-Transforms wie Footer-Zentrierung
  zu verändern.

`assets/signature.css` wurde vollständig durch die ausgewählte A-Studie ersetzt;
alle Regeln sind ausschließlich unter `html[data-theme="signature"]` wirksam.
Light-/Dark-Dateien, Renderer und Helper-Markup sind unverändert. Das bereits
vorhandene, rein darstellende Pain-Output wird weiterverwendet. Kein zusätzliches
produktives Markup, keine zweite Anwendung und keine neue Fachlogik.

## Lokale Wahl und Aktualisierung

Weiterhin genau **Light / Dark / Signature** unter **Verknüpfungen & Orte → Design**.
Vorhandenes IndexedDB-Setting `theme`, Datenbankversion und Exportformat bleiben gleich.
Gespeichertes Signature zeigt nach dem Update automatisch v2; kein neues Setting
und keine Migration. Die einmalige Übernahme der bisherigen Systemdarstellung gilt
weiter nur ohne gespeicherte Wahl. Browserrahmen folgt jetzt der neutralen Seite.

Paket und Worker-Cache wurden gemeinsam auf **0.6.5** erhöht. Der bestehende
Pages-Packager hasht weiterhin alle ausgelieferten Assets. Studien und Screenshots
bleiben außerhalb des Builds. Der vorhandene Update-Listener prüft nach Start und
Wiederaufnahme sowie während sichtbarer Nutzung; offene Eingaben und laufende Saves
verschieben den Reload bis zur sicheren Rückkehr auf die Startseite.

## Prüfung

- **32 Studien-Aufnahmen:** zwei Richtungen, zwei gesichtete Passes, vier Ansichten,
  390 und 1280 px. **92 Checks pro Pass** für Kontrast, Reflow, Tastatur und Ressourcen.
- **14 Live-Aufnahmen:** Jetzt, Notes, Detail, Pain, Einstellungen, Trinken und
  Rabatt bei 390/1280 px. **104 Signature-Checks**, zusätzlich 320/768 px und
  320 px mit 200 % Text, Fehler/Retry, unveränderte Stores, Neustart-Persistenz und
  Wiederherstellung vor dem Anzeigen der App.
- **Light/Dark:** alle 16 Pixelpaare unverändert gegenüber Commit `fdf6fb9` (0.6.4),
  einschließlich gegenteiliger Systemeinstellung im neuen Stand.
- **Bestehende Abläufe:** alle 14 Browser-Gates mit 831 Checks, alle 10 Node-Testdateien
  und vier zusätzliche Tests für Berliner Tagesgrenzen bestehen.
- **Echte PWA-Updates:** 19 Checks über drei gebaute Releases, trotz langlebigem HTTP-Cache.
  Neue Gestaltung, lokale Designwahl, gespeicherte Inhalte und Offline-Neustart erhalten;
  ein offener Entwurf wird vor dem verzögerten Reload über den vorhandenen Ablauf gespeichert.

Rohberichte und Pixel-Hashes: [`design/signature-v2/checks.json`](../design/signature-v2/checks.json).
Fotos verwenden den dokumentierten Footer-am-Dokumentende-Modus und verbergen den
inaktiven Skip-Link. Die App behält feste Navigation und Tastatur-Zugang.

Die Prüfung verwendet Chromium. Standalone ist im Update-Test simuliert; eine reale
Betriebssysteminstallation, Gerätezoom, andere Browser und echte Screenreader wurden
nicht geprüft. Offline ist nur die zuletzt vollständig geladene Version verfügbar.

Kein Merge und kein Deployment wurden vorgenommen.
