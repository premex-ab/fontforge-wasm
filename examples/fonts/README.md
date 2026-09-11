# Hosted demo fonts

Roboto Regular is copyright Google and licensed under Apache License 2.0.
The full upstream license is included in `LICENSE.txt`. These font files retain
their Apache license; they are not covered by the engine's GPL license.

`Roboto-Regular.ttf` is the unmodified hinted font from:
https://github.com/googlefonts/roboto/blob/38062f4b4a0be4346d07a928408da21602545e9e/src/hinted/Roboto-Regular.ttf

`Roboto-Regular.otf` is a modified version generated from that TTF with this
project's FontForge 20251009 WASM engine, converting quadratic outlines to CFF.
It is a demo derivative, not an official Google OTF release. Copyright and license
metadata are preserved. Run `node examples/fonts/generate-otf.mjs` after building
the engine to regenerate it. `checksums.json` records the checked-in files.

Only these public sample fonts are cached for offline demos. User-selected fonts
and conversion outputs are never added to the service worker cache.
