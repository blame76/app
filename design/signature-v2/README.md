# 0815 · Signature v2

**4. Oktober 2026 · A Editorial Material ausgewählt und integriert · 0.6.5**

Der vorherige C-Entwurf ist verworfen. Beide neuen Varianten beginnen bei der
bestehenden Light-Grundhaltung. Die Studien laden `assets/styles.css`, `assets/notes.css`
und den bestehenden Pain-Stil, anschließend ausschließlich `study.css`.
Der alte Signature-Stil wird weder geladen noch als Grundlage verwendet.

[Vergleich](./comparison.html) · [Studien](./index.html) ·
[Selbstkritik nach Pass 1](./CRITIQUE.md) · [Integration](../../docs/SIGNATURE_V2.md)

Lokaler Vergleich: `http://127.0.0.1:8080/design/signature-v2/comparison.html`.
Der Nutzer hat die Auswahl der überzeugenderen Variante und deren Umsetzung delegiert.

## Zwei kontrollierte Varianten

| | A · Editorial Material | B · Personal Object |
| --- | --- | --- |
| Gemeinsame Basis | Warme neutrale Flächen, Espresso-Text, gedämpfter Aubergine-Akzent, lokale Serif/Sans, vertraute Navigation. | Dieselbe Palette, dieselben Inhalte und dieselbe Grundstruktur. |
| Schwerpunkt | Offene Lesefläche; Tageskapitel; tabellarische Zeit in der Marginalie; subtile Tiefe nur bei Werkzeugen. | Dunklere Werkzeugfläche; etwas weichere Rundung; geringfügig abgestufte Lesefläche; Zeitauftakt oberhalb des Inhalts. |
| Stärke | Notes und Detail brauchen keine umschließende Oberfläche. Die Komposition trägt kurze Gedanken und längere Prosa. | Kleine Werkzeuge wirken greifbarer, ohne eigene Farben oder Mini-Brands. |
| Grenze | Absichtlich sehr nahe an der ruhigen Light-Grundhaltung. Persönlichkeit entsteht aus Feinheiten. | Die verbleibende Hülle und die zehn Zahlenflächen bleiben sichtbarer als nötig. |

## Pass 2 und Auswahl

32 archivierte Screenshots: `screenshots/pass-1/` und `screenshots/pass-2/`, jeweils
A/B × 390/1280 px × Jetzt/Notes/Notizdetail/Pain. Beide Passes wurden mobil und auf
Desktop gesichtet. Die Kritik nach Pass 1 wurde vor der Überarbeitung festgehalten.

Beide erhielten die explizite Inhalts-Serif auf dem Dashboard und eine kürzere Pause
zur Kontextzeile. Der gewählte Schmerz-Wert wurde auf 3,5 rem zurückgenommen. A erhielt
weniger Schatten. B verlor Lesekarten-Schatten, Lichtsaum und starke Innenabstände;
auch die Zahlenflächen bekamen keine eigene Tiefe mehr. Im zweiten Pass wurden
die Studien außerdem an die tatsächlichen Footer-Aktionen und den Pain-Settings-Zugang
angeglichen. Kein neues visuelles Motiv wurde hinzugefügt.

| Selbstkritik nach Pass 2 | A | B |
| --- | --- | --- |
| Etwas nur deshalb groß/bunt/auffällig, damit Signature anders aussieht? | Nein. Jetzt bleibt kleiner als der Gedanke. Nur die ausgewählte Zahl trägt mehr Gewicht. | Keine großen Gesten mehr; Notes-Fläche und Zahlengruppe zeigen aber noch eine zusätzliche Hülle. |
| Funktioniert der Screen ohne Logo als persönliches Produkt? | Ja: Lesemaß, warme Flächen und kleine Zeitmarginalie reichen. | Ja, allerdings mit stärker erkennbarem Oberflächenmotiv. |
| Kann ich das täglich benutzen? | Ja: Inhalt, Auswahl und bekannte Aktionen bleiben unmittelbar. | Ja; längere Notes brauchen durch die Innenabstände etwas mehr Scrollen. |
| Designsystem statt Produkt? | Die Werkzeuge bleiben einfache, leise Inhaltsobjekte ohne eigene Marken. | Die Anzahl gleichförmiger Zahlenflächen erinnert weiterhin mehr an Komponenten. |
| Inhalt wichtiger als Stil? | Ja, auf allen vier Ansichten. | Weitgehend; die Notes-Hülle beansprucht weiterhin Aufmerksamkeit. |

**Auswahl: A · Editorial Material.** A erfüllt „Richer, not louder“ konsequenter.
Es gewinnt durch Komposition und sorgfältige Proportionen. B bleibt als gesichtete
Alternative dokumentiert, wird aber nicht als zusätzlicher Modus ausgeliefert.

Die finale Prüffrage lautet für beide: Würde ich Light/Dark abschalten, weil
Signature lauter ist? A führt zu keinem neuen Lautstärke-Grund. Die Live-Integration
wurde anschließend zusätzlich auf allen sieben dokumentierten Ansichten gesichtet.

## Prüfung und Abgrenzung

`capture.js` im vorhandenen Browsertool ausführen, nachdem `?pass=1` beziehungsweise
`?pass=2` geöffnet wurde. Aktuelle CSS entspricht Pass 2; Pass 1 ist in PNGs archiviert.
Jeder Pass hat 92 bestandene Checks: Reflow/Textkontrast bei 320/390/768/1280 px,
320 px mit 200 % Text, native Tastatur-Radios, 44-px-Zahlenziele, Fokus,
Reduced Motion, lokale Ressourcen und keine Datenbanken/Worker.

Notes und Detail verwenden die tatsächlichen Renderer mit statischen Beispieldaten.
Dashboard und Pain spiegeln die vorhandenen Strukturen; Erfassungsaktionen der Studie
sind ausdrücklich Demonstrationen. Keine Storage-Aufrufe, kein App-Bootstrap,
keine produktive Markup-Kopie. Die Studien sind vom Pages-Build und Precache ausgeschlossen.

Für Full-Page-Fotos steht der fixe Footer am Dokumentende; der inaktive Skip-Link ist
für die Aufnahme verborgen. Die interaktive Studie und die Anwendung behalten den
fixen Footer und den zugänglichen Tastatur-Link. Der Foto-Unterschied ist dokumentiert.

14 reale Aufnahmen stehen unter [`integrated/`](./integrated/). Rohberichte einschließlich
16 identischer Light/Dark-Pixelvergleiche stehen in [`checks.json`](./checks.json).
Chromium ist geprüft; reale Installation, Gerätezoom, weitere Browser und echte
Screenreader wurden nicht geprüft. Kein Deployment und kein Merge.
