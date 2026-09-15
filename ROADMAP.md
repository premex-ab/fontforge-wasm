# FontForge WASM roadmap

## Product direction

`fontforge-wasm` is a port of the FontForge engine to WebAssembly, with a browser
and Node SDK. Conversion is the first application of the port, not its product
boundary. The GitHub Pages converter is a demonstration client. A future font
editor will be a separate web interface using the same engine.

OnlineFontConverter consumes the released SDK for browser conversion. Its HTTP
API, durable jobs, server converters and server archives remain available. There
is one browser conversion engine: this package. An unsupported local operation
can fall back to OFC's server when that server advertises the requested path.
No endpoint, credential, upload or application-specific policy belongs in this SDK.

## Baseline for 0.3 alpha

The build links FontForge and its required libraries into WASM. JavaScript adds
workers, bounded virtual files, cancellation, validation and container handling.
The native entry point is currently a conversion adapter, not FontForge's CLI.
Native scripting, Python and the desktop GUI are disabled. SFD is now an import
and export option; it does not yet provide an editing session API.

The registry is the source of truth for separate import/export capabilities.
Tests cover real WASM conversions, independent semantic checks, and Chrome and
WebKit. A passing small-fixture matrix does not imply all variants of a format
work or that conversion is lossless. Variable and color fonts remain rejected by
the conversion adapter; unsupported input must not be silently flattened.

## Milestone 1 — reliable port boundary and OFC adoption

- Ship the SDK and source bundle as one reproducible, versioned release. Keep
  native dependency revisions, notices and checksums together.
- Use that exact release in OFC. Cache its entire module/worker/WASM graph for
  offline use; retain atomic updates and cancellation of running work.
- Merge local capabilities into OFC's picker without changing the server API's
  advertised capabilities. Show failures for local-only paths without uploading
  them to endpoints that cannot perform them.
- Retain incremental results, reload persistence, reset, folder output and ZIPs.
- Add capability metadata for outline/bitmap/metrics/source, lossy operations,
  feature restrictions, collection selection and limits. Separate detection from
  conversion eligibility so an editor can open data the converter cannot export.

Acceptance: real legacy + modern inputs convert offline after a reload, no font
bytes leave the browser on successful local work, API smoke tests still pass,
and only missing server-supported outputs use fallback.

## Milestone 2 — FontForge native scripting and CLI semantics

The first [native scripting proof](docs/native-scripting-proof.md) is implemented
as an opt-in development target: real upstream scripts, disposable workers,
exit/log capture, native parity and browser tests. It is not yet a public SDK API
or a released scripting feature; the work below remains the milestone scope.

Enable FontForge's own scripting interpreter in a separate build target. Start
with `fontforge -lang=ff -script` semantics and then `-c`; do not label a custom
command parser as CLI compatibility. Python support is a later milestone.

Proposed API (design, not shipped):

```js
const result = await execute({
  language: 'ff',
  script: 'Open($1); SelectWorthOutputting(); Simplify(); Generate($2);',
  args: ['/work/input.sfd', '/work/output.otf'],
  files: { '/work/input.sfd': inputBytes },
  signal,
  onLog: ({ stream, message, elapsedMs }) => {},
});
// result: { exitCode, files, stdout, stderr }
```

- Audit native initialization, headless choices, exit handling, locale, Unicode
  filenames and process-global state. Use a disposable worker initially.
- Return stdout/stderr, exit status and all requested generated files, including
  multi-file output. Limit file count, total bytes, memory and execution time.
- Explicitly reject operations requiring unavailable processes, network, GUI or
  installed files. Mount supplied resources in the virtual filesystem.
- Test the same scripts against the same pinned native FontForge source build.
  Cover metadata, glyph selection/subsetting, transforms, metrics, contour edits,
  SFD round trips and multiple outputs. Validate semantic results independently.

Acceptance: documented native scripts behave equivalently in native and WASM
builds; cancellation kills work; repeated and concurrent jobs cannot leak state.

## Milestone 3 — comprehensive format and feature coverage

Track every upstream importer/exporter individually. Do not count file extensions
as independent technologies or imply symmetric import/export support.

| Family | Work / verification needed |
| --- | --- |
| SFD, UFO | Preserve editing data, layers, references and metadata; directory/multiple-file API; compressed sources and UFO variants. |
| TTF, OTF, WOFF, WOFF2 | Preserve supported tables, outline flavor and hinting where possible; explicit policies for signatures and metadata. |
| Variable fonts, CFF2, multiple masters | Audit upstream support and native/WASM parity; explicit instance selection or retention, no silent default-instance export. |
| Color fonts | COLR/CPAL versions, SVG glyphs, CBDT/CBLC and sbix; determine required image libraries and upstream gaps. |
| TTC/OTC, Mac collections | Enumerate/select faces, preserve collection names and export multiple faces. |
| CID/PostScript | Distinguish Type 1 CID, CFF CID and Type 11; subfont selection, mapping resources and non-BMP coverage. |
| BDF, PCF, FNT, FON, OTB, Palm PDB | Multiple strikes/depths, pixel-size options, encoding and naming; retain bitmap data without tracing in editing sessions. PCF is import-only upstream. |
| TeX PK/GF, Ikarus | Importers exist upstream; obtain redistributable independent fixtures, test encoding and actual glyph geometry before adding to the public registry. |
| BinHex HQX, compressed fonts | Audit internal decoders versus external commands; bounded unpacking and round-trip fixtures. |
| PDF/PS font extraction | A document extraction operation with font enumeration, not a PDF-to-font filename alias; separate API. |
| METAFONT | Upstream invokes external tools. Requires a separate portable dependency or an explicitly unavailable capability. |
| AFM/PFM/TFM and OFM | Metrics export and attachment to an existing font; do not claim that metrics alone contain outlines. |
| Aliases (PF3, GSF, PMF, etc.) | Normalize documented aliases to their actual format, validate with genuine samples. |

For every entry: identify native read/write functions and dependencies, record
native parity, add valid/malformed/oversized fixtures, verify with an independent
reader and test supported browser paths. Record unsupported variants with a
reason. Retain the old server engine for broader OFC compatibility until parity
is established. The format milestone is not complete while the above gaps remain.

## Milestone 4 — stateful engine API for an editor

Add typed `open`, `inspect`, `listGlyphs`, `readGlyph`, `updateGlyph`, `save` and
`close` operations. Keep font ownership inside a worker and exchange serializable
geometry and metadata. Define session lifetime, undo/redo, autosave snapshots,
crash recovery and change transactions before building editing controls.

Expose diagnostics and structured capabilities. Test preservation of untouched
glyphs/features, deterministic round trips, cancellation, session recovery and
large fonts on constrained devices. Support SFD as the editable project format.

## Milestone 5 — FontForge web UI

Build a web-native interface over the engine API: open/inspect, glyph grid,
text preview, glyph contours and metrics, then editing and export. Add keyboard
navigation, accessible controls, zoom/pan, undo/redo and local autosave. Directory
access is optional; standard upload/download must remain usable in Safari/Firefox.

Keep the engine usable without the UI. Do not attempt to compile desktop GDraw
windows into DOM controls. Advanced editors (kerning, OpenType features, bitmap
strikes, variable/color editing) follow demonstrated engine capabilities.

## Python and release maturity

Investigate Python scripting separately: CPython/WASM integration, bindings,
virtual files and dependencies have substantial download/runtime implications.
Native-script compatibility can ship without promising Python compatibility.

Before a stable release: broaden real-world/font-feature fixtures, fuzz parsers,
measure memory/download/startup costs, publish browser support and compatibility
matrices, review third-party source distribution, and define semver guarantees
for the SDK, worker protocol and native ABI. Keep non-stable APIs explicitly
experimental until these gates pass.

The unreleased [execute API](docs/scripting-api.md) now adds typed Node/browser
execution, live diagnostics, cumulative filesystem budgets and explicit capability
errors. Public playground and broader editing-operation parity remain next.

A separate script playground now exercises this API with inspect/export/rename
presets, editable scripts, manual execution, bounded logs, cancellation and output
file downloads. Broader native parity for actual outline editing remains next.
