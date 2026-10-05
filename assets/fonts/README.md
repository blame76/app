# Lokal ausgelieferte Signature-Schriften

Cormorant Garamond (aufrecht, variable Gewichte 300–700) und Great Vibes (400)
werden ausschließlich für Signature verwendet. Die App benötigt keinen Font-CDN.
Beide vollständigen SIL-OFL-1.1-Lizenzen werden mit der PWA ausgeliefert und sind
unter „App-Info & Open Source“ verlinkt.

`SOURCE.json` dokumentiert die unveränderliche Google-Fonts-Repository-Revision,
Quell-URLs und SHA-256-Prüfsummen. Die vollständigen TTFs wurden mit
`fonttools[woff]==4.59.2`, Brotli 1.1.0 und Zopfli 0.4.3 nach WOFF2 konvertiert:

```python
from fontTools.ttLib import TTFont
font = TTFont(source_ttf)
font.flavor = 'woff2'
font.save(target_woff2)
```

Keine Glyphenuntermenge und keine Umbenennung. CSS verwendet die internen Aliase
`0815 Editorial` und `0815 Script`. Für Wiederherstellung/Deployment sind die
committeten WOFF2-Dateien maßgeblich; der Build konvertiert und lädt nichts herunter.
Gemeinsam umfassen sie 371.172 Bytes. Änderungen der Fonts verändern den Release-Hash.
README und Herkunftsprotokoll sind Entwicklungsdokumentation; Fonts und Lizenzen
gehören zur Runtime-Whitelist und zum Offline-Shell-Cache.
