# Signature · Mono Editorial

**0.6.6 · 5. Oktober 2026 · `feature/signature-v2`**

Die neue Bildreferenz des Nutzers präzisiert die Richtung: monochromes Luxury
Editorial mit klassischer Serif- und sparsam eingesetzter Script-Typografie.
Die vorherigen Studien C und A/v2 bleiben historische Entwürfe.

[Vergleich öffnen](./comparison.html) · [Studie Notizen](./?screen=notes) ·
[Kritik der beiden Passes](./CRITIQUE.md) ·
[Wiederverwendbares Briefing](../../docs/SIGNATURE_BRIEF.md) ·
[Umsetzung und Prüfungen](../../docs/SIGNATURE_REFERENCE.md)

`index.html` + `study.js` verwenden die vorhandenen Notes-Renderer mit festen
Fixture-Daten, ohne Speicherzugriff, Service Worker oder App-Bootstrap. Die
aktuelle `draft.css` ist der zweite Pass. Produktiv enthält `assets/signature.css`
dieselben Regeln mit korrigierten relativen Font-Pfaden.

`capture.js` erzeugt acht Motive pro Pass: Jetzt, Notizen, Detail und Schmerz bei
390/1280 px. Im bereitgestellten Browser zuerst `?pass=1` bzw. `?pass=2` öffnen,
dann die Funktion ausführen. Je Pass werden 48 Reflow-/Kontrast-/Bedienungs- und
Ressourcenchecks ausgeführt. Pass 1 ist vor der Revision archiviert; erneutes
Ausführen nach einer Änderung überschreibt Bilder, deshalb neue Revisionen in
neuen Pass-Verzeichnissen speichern.

`integrated/` zeigt die echte App mit realen Renderern/IndexedDB bei 390/1280 px,
zusätzlich mit Einstellungen, Trinken und Rabatt. Nur für Full-Page-Aufnahmen
steht der Footer am Dokumentende; die App selbst behält die feste Navigation.
Studien, Screenshots und Dokumentation werden nicht mit der PWA ausgeliefert.

Rohprüfungen und Pixel-Hashes werden in `checks.json` archiviert. Prüfung in
Chromium; Standalone im Update-Test simuliert, keine reale OS-Installation oder
Screenreader-/Geräteprüfung. Offline steht die zuletzt vollständig geladene
Version bereit. Das Update berücksichtigt einen offenen Entwurf vor dem Reload.
