# Changelog

## 0.3.0-alpha.4

- Decode WOFF2 using a bounded output buffer independent of its estimated SFNT size.
- Preserve original tables and variable axes when exporting WOFF; repair whole-font checksums on WOFF decoding.
- Expose `inspectFont` metadata and `FONT_PERMISSION_REQUIRED` for restricted outlines.
- Add explicit `allowRestricted` permission confirmation without clearing embedding restrictions.
- Add synthetic permission, WOFF2-size and variable-WOFF regressions.

## 0.3.0-alpha.3

- Inspect variable-font axes and instantiate selected coordinates locally with HarfBuzz 14.6.0.
- `convert(input, { format: 'otf', variations: { wght: 700 } })` pins omitted axes to defaults and produces a static font before conversion.
- Reject invalid coordinates; preserve variable tables when instancing is not requested.
- Include a generated variable-font fixture and static-instance regression tests.

## 0.3.0-alpha.2

- Flatten CID subfonts before outline conversion.
- Repackage TTF/OTF as WOFF2 and unwrap webfonts without redrawing outlines, preserving variation, color, layout and CID tables.
- Return STATIC_INSTANCE_REQUIRED for unsupported variable-to-outline conversions; never silently discard axes.
- Bound browser asset downloads, validate WASM responses and replace stale cached assets after retry.
- Add synthetic CID and variable-container regression tests.

## 0.3.0-alpha.1

- Add SFD, BDF, FNT, OTB and Palm PDB import/export, and PCF import.
- Separate import and export capabilities in the SDK registry and demo.
- Set FontForge's headless runtime flag explicitly so embedded bitmap strikes
  load without trying to display a desktop selection dialog.
- Preserve contour order and bitmap sources when saving SFD.
- Add a development plan toward a broader FontForge port, native scripting and
  an independent engine API for a future web editor.
- New bitmap formats are monochrome; outline-to-bitmap defaults to 16 px,
  and bitmap-to-outline preserves pixels as rectangles rather than smoothing.


## 0.2.0-alpha.1

- 22 export formats and 19 input formats, with an exported capability registry.
- Native WOFF/WOFF2 decoding and encoding with Brotli; validate decoded tables.
- EOT and TTC containers, face-index selection and zipped UFO source import/export.
- PostScript Type 1/3/11/42, raw CFF, Mac containers and AFM/PFM/TFM metrics.
- FON bitmap export and pixel-preserving rectangular outline import.
- GNU libiconv for legacy encodings; WASM function-pointer compatibility.
- Preserve blank-glyph widths and Unicode cmap in Type 11 round trips.
- Hosted examples, manual Convert, timestamped stage logs, cold-cache demo mode
  and separately labelled legacy previews.
- Full source/output matrix, independent fontTools validation and browser tests.

## 0.1.0-alpha.1

- FontForge 20251009 compiled to WebAssembly with Emscripten 5.0.7.
- Static TTF ↔ OTF/CFF conversion using FontForge's outline engine.
- Promise API, TypeScript declarations, browser and Node.js workers.
- Fresh module and virtual filesystem per conversion; cancellation and timeout.
- Input bounds checks and explicit rejection of unsupported font kinds.
- Browser demo, synthetic fixtures and independent output verification.
- Locked source archives, native build recipe and GPL distribution notices.
