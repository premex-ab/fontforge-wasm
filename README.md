# fontforge-wasm

**FontForge for WebAssembly — a portable engine for browsers and Node.js.**

This alpha exposes conversion first. The product direction is a broader FontForge
port, including native scripting and a future web editor; it is not yet a full
CLI or Python port. See the [development plan](ROADMAP.md).

**[Try the live demo →](https://warting.github.io/fontforge-wasm/)**

Select a hosted Roboto example in any supported input format, or choose
your own font. Demo fonts retain their Apache 2.0 license; see
[their provenance and license](examples/fonts/README.md). Press **Convert locally** to start.
The timestamped activity log shows engine loading, worker initialization, native
FontForge conversion time, and preview preparation. Total time starts at the
Convert click; example loading is separate. Assets may already be cached.
Use **Clear demo cache & reload** to remove the demo offline cache and test
with engine/example requests bypassing browser caches and offline preloading
paused. Each conversion in this mode fetches the engine again. CDN, connection
and WASM compilation caches are outside the demo’s control. Return to normal
caching using the link beside the button.

Convert static web, desktop and legacy fonts in a browser or Node.js worker.
Fonts stay in the worker's memory. There is no upload, server fallback, telemetry,
Python runtime or FontForge GUI.

This is an **experimental alpha**, independently maintained and not affiliated
with or endorsed by the FontForge project. It is not a replacement for the full
FontForge application.

## Install

Download the npm-compatible `.tgz` from [Releases](https://github.com/warting/fontforge-wasm/releases)
and install it:

```sh
npm install ./warting-fontforge-wasm-0.3.0-alpha.1.tgz
```

The alpha is distributed through GitHub Releases; an npm registry publication is
not required. The package includes the compiled WASM engine and has no JavaScript
runtime dependencies.

## Use

```js
import { convert } from '@warting/fontforge-wasm';

const ttf = new Uint8Array(await file.arrayBuffer());
const otf = await convert(ttf, { format: 'otf' });
const blob = new Blob([otf], { type: 'font/otf' });
```

Node.js 22 or later:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { convert } from '@warting/fontforge-wasm';

const result = await convert(await readFile('input.otf'), { format: 'ttf' });
await writeFile('output.ttf', result);
```

Each call starts a disposable worker with a fresh FontForge instance and virtual
filesystem, then terminates it after success, failure, cancellation or timeout.
The input buffer is copied and remains usable. Calls can run concurrently, but
applications should limit concurrency to avoid multiplying memory use.

```js
const controller = new AbortController();
const result = await convert(bytes, {
  format: 'ttf',
  timeoutMs: 60_000,
  signal: controller.signal,
});
// Call controller.abort() while the conversion is running to cancel it.
```

`convert()` returns `Promise<Uint8Array>`. Errors expose a `code`, including
`UNSUPPORTED_FORMAT`, `UNSUPPORTED_FONT`, `INVALID_FONT`, `INPUT_TOO_LARGE`,
`INVALID_FACE_INDEX`, `ABORTED`, `TIMEOUT`, `WORKER_ERROR` and `CONVERSION_FAILED`.

## Supported in this alpha

| Formats | Import | Export | Details |
| --- | --- | --- | --- |
| TTF, OTF, WOFF, WOFF2 | Yes | Yes | Static TrueType/CFF; webfont outputs use quadratic outlines |
| EOT | Yes | Yes | Uncompressed; compressed/XOR-obfuscated variants are rejected |
| SVG | Yes | Yes | Legacy SVG fonts, not illustrations |
| PFA, PFB, PS, PT3, CFF, T42 | Yes | Yes | PostScript font resources; PS exports Type 1; CFF is raw |
| T11 | Yes | Yes | CID-keyed TrueType; exported CID mapping covers BMP Unicode |
| DFONT, SUIT, BIN | Yes | Yes | Mac data-fork/MacBinary fonts; SUIT and BIN use portable MacBinary wrappers |
| TTC | Yes | Yes | `faceIndex` selects the imported face; export contains one face |
| UFO | Yes | Yes | ZIP containing one UFO source directory; export is `.ufo.zip` |
| FON | Yes | Yes | Export: 16 px Windows ANSI bitmap. Import: rectangular pixel contours, no smoothing |
| SFD | Yes | Yes | Editable FontForge source for single static fonts |
| BDF, FNT, OTB, Palm PDB | Yes | Yes | Monochrome bitmaps; outline export rasterizes at 16 px |
| PCF | Yes | No | X11 bitmap input; independent fixtures made with bdftopcf |
| AFM, PFM, TFM | No | Yes | Metrics only, with no outlines; PFM/TFM use Windows ANSI encoding |

The exported `FORMATS` registry describes capabilities, file extensions and notes.
Variable fonts, CFF2, color fonts, multiple-master fonts and CID subfont collections
remain unsupported. Unsupported SFNT tables are checked **after** WOFF/WOFF2
decoding too. Type 11 imports without an embedded Unicode cmap may not recover
character mappings: a CID number alone is not necessarily a Unicode code point.

```js
const woff2 = await convert(input, { format: 'woff2' });
const secondFace = await convert(ttcBytes, { format: 'ttf', faceIndex: 1 });
const ufoZip = await convert(input, { format: 'ufo' });
const fromUfo = await convert(ufoZip, { format: 'otf', inputFormat: 'ufo' });
const metrics = await convert(input, { format: 'afm' });
```

`inputFormat` is optional; bytes are inspected. It disambiguates PostScript and
MacBinary aliases. The existing `convert(bytes, options)` API still returns font
bytes (ZIP bytes for UFO, metrics bytes for AFM/PFM/TFM). No separate local/server
mode is needed. EOT/TTC/ZIP containers are handled by the wrapper; FontForge,
WOFF2, Brotli, zlib and legacy encoding conversion run in WebAssembly.

`onProgress(event)` reports real lifecycle stages with an optional measured
`durationMs` for the native conversion. Observer exceptions are ignored.
`cache: 'no-store'` bypasses browser HTTP and in-memory engine asset caching.
Legacy demo previews use a separately logged TTF conversion; metrics previews
show the source font and are labelled accordingly.

Outline conversion is not lossless. Hinting and unsupported/custom tables can
change or disappear. Inspect rendered text and validate output before production
use. The tests cover synthetic outlines, Unicode mappings, advance widths, font
names, ligature and kerning tables; they do not establish compatibility with all
fonts. Input and decoded webfonts are limited to 16 MiB; UFO extraction is limited to
4096 entries and 64 MiB total, each file at most 16 MiB. WASM linear memory is
limited to 512 MiB, and the default wall-clock timeout is 30 seconds (including startup/download). Worker overhead
and JavaScript buffers consume additional memory.

## Browsers and bundlers

Serve `src/` and `dist/` from the same package directory over HTTP(S), preserving
their relative paths. Serve `.mjs`/`.js` as JavaScript and `.wasm` as
`application/wasm`. The browser example works without a bundler. Bundlers need to
copy or resolve both worker modules and the WASM asset; automatic compatibility
with every bundler is not promised in this alpha.

The build is single-threaded inside each worker and does not require
`SharedArrayBuffer` or COOP/COEP headers. For a strict CSP allow the module scripts,
WebAssembly compilation (`wasm-unsafe-eval`), and `worker-src blob:`. The browser
worker is bundled and created from a Blob; its engine bytes are fetched once and
kept in memory for subsequent jobs.
Once the assets are cached, conversion needs no network access; the package does
not itself install a service worker or guarantee offline page loading. The
standalone browser demo includes an optional service worker that caches only
application/engine assets and the bundled public Roboto examples, never
user-selected fonts or their conversion outputs.

## Build and test

Requirements: Docker with BuildKit, Node.js 22+, Python 3 and fontTools 4.59.0 with Brotli 1.2.0 for
independent output verification.

```sh
npm ci
npm run build
python3 -m venv .venv
.venv/bin/pip install fonttools==4.59.0 brotli==1.2.0
.venv/bin/python test/make-fixtures.py
npm test
.venv/bin/python test/verify-output.py
.venv/bin/python test/verify-formats.py
npm pack
```

The Docker recipe builds Emscripten 5.0.7's pinned FontForge 20251009 source and
verified dependencies. No host FontForge installation is used. The first build
takes several minutes; later builds reuse Docker layers. `artifacts/sources/`
contains original archives for redistribution and `dist/` contains the engine.
See [CONTRIBUTING.md](CONTRIBUTING.md) for browser tests and release instructions.

To run the demo after building:

```sh
python3 -m http.server 8090
# Open http://localhost:8090/examples/browser/
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the product direction, milestones, format gaps
and acceptance criteria: OFC adoption, native FontForge scripting/CLI semantics,
format and feature parity, stateful editing API, then a web-native editor.

## License

**GPL-3.0-or-later**, matching FontForge as a whole. See [NOTICE.md](NOTICE.md) for
upstream notices and corresponding source. Packaging this engine separately does
not remove the license obligations of applications distributing a combined work.

The live demo is hosted on GitHub Pages. Successful builds of `main` deploy it
automatically after the native and browser tests pass. Run `node build/pages.mjs`
after building to assemble the same static site locally.

### Native scripting development

An opt-in [native scripting proof](docs/native-scripting-proof.md) runs the real
FontForge interpreter in a separate WASM build. See the reproduction instructions
and remaining API/sandbox work there. It is not part of the released converter.
