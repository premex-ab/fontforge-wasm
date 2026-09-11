# fontforge-wasm

**Real FontForge outline conversion, running locally in WebAssembly.**

**[Try the live demo →](https://warting.github.io/fontforge-wasm/)**

Select a hosted Roboto TTF or OTF example, or choose
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

Convert static TrueType and OpenType/CFF fonts in a browser or Node.js worker.
Fonts stay in the worker's memory. There is no upload, server fallback, telemetry,
Python runtime or FontForge GUI.

This is an **experimental alpha**, independently maintained and not affiliated
with or endorsed by the FontForge project. It is not a replacement for the full
FontForge application.

## Install

Download the npm-compatible `.tgz` from [Releases](https://github.com/warting/fontforge-wasm/releases)
and install it:

```sh
npm install ./warting-fontforge-wasm-0.1.0-alpha.1.tgz
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
`ABORTED`, `TIMEOUT`, `WORKER_ERROR` and `CONVERSION_FAILED`.

## Supported in this alpha

| Input | Output | Conversion |
| --- | --- | --- |
| Static TTF with quadratic outlines | OTF/CFF | FontForge converts outlines to cubic curves |
| Static OTF/CFF | TTF | FontForge approximates cubic outlines with quadratic curves |
| Static TTF or OTF/CFF | Same format | FontForge regenerates the font |

WOFF and WOFF2 are containers: decode them with an appropriate codec first, then
pass the resulting TTF/OTF bytes to this engine. WOFF2 is **not** implemented here
yet. Variable fonts, CFF2, collections and color fonts are rejected. Type 1, SVG,
UFO and other FontForge formats are outside this alpha's API.

Outline conversion is not lossless. Hinting and unsupported/custom tables can
change or disappear. Inspect rendered text and validate output before production
use. The tests cover synthetic outlines, Unicode mappings, advance widths, font
names, ligature and kerning tables; they do not establish compatibility with all
fonts. Input is limited to 16 MiB, WASM linear memory to 512 MiB, and the default
wall-clock timeout is 30 seconds (including startup/download). Worker overhead
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

Requirements: Docker with BuildKit, Node.js 22+, Python 3 and fontTools 4.59.0 for
independent output verification.

```sh
npm ci
npm run build
python3 -m venv .venv
.venv/bin/pip install fonttools==4.59.0
.venv/bin/python test/make-fixtures.py
npm test
.venv/bin/python test/verify-output.py
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

- Broader real-world font corpus and fuzz testing.
- WOFF/WOFF2 integration without an upload or a separate conversion mode.
- Smaller download and lower startup cost.
- Bundler recipes, reusable worker pool and batch conversion.
- Additional formats only when their conversion paths are tested.

## License

**GPL-3.0-or-later**, matching FontForge as a whole. See [NOTICE.md](NOTICE.md) for
upstream notices and corresponding source. Packaging this engine separately does
not remove the license obligations of applications distributing a combined work.

The live demo is hosted on GitHub Pages. Successful builds of `main` deploy it
automatically after the native and browser tests pass. Run `node build/pages.mjs`
after building to assemble the same static site locally.
