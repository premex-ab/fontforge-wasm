# Hosted demo fonts

Roboto Regular is copyright Google and licensed under Apache License 2.0.
The full upstream license is included in `LICENSE.txt`. These font files retain
their Apache license; they are not covered by the engine's GPL license.

`Roboto-Regular.ttf` is the unmodified hinted font from:
https://github.com/googlefonts/roboto/blob/38062f4b4a0be4346d07a928408da21602545e9e/src/hinted/Roboto-Regular.ttf

The other `Roboto-Regular.*` files are modified demo derivatives generated
from that TTF by this project's FontForge 20251009 WASM engine. They are not
original Google releases. They retain applicable copyright/license metadata;
all are distributed with `LICENSE.txt` and this modification notice. Legacy
formats can lose metadata, shaping tables and character coverage. FON is a
16-pixel Windows ANSI bitmap font. Metrics files have no outlines. UFO is zipped;
TTC contains one face.

Run `node examples/fonts/generate-examples.mjs` after building the engine to
regenerate every derivative. `checksums.json` records the checked-in files.
TTF/OTF are preloaded for the offline demo. Other public examples are cached on
first use. User-selected fonts and outputs are never added to the offline cache.
