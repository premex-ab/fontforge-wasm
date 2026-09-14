# Native scripting proof

This implements the first feasibility gate in [Epic #1](https://github.com/warting/fontforge-wasm/issues/1).
It is an opt-in development build, not a released `execute()` API or a public
script playground. The existing conversion distribution and OFC integration
are unchanged.

## What runs

`native/script.c` initializes headless FontForge and calls upstream
`ProcessNativeScript`. It accepts only `-lang=ff -script file [args...]` and
`-lang=ff -c script [args...]`. It does not implement a replacement parser or
pretend to support the full CLI, stdin, Python or desktop GUI.

The proof runs this native script against an SFD source:

```text
Open($1);
Print($fontname);
Print($2);
Generate($2);
```

Arguments are passed as argv entries, without a shell. Tests cover Unicode and
shell-like characters, syntax errors, missing files and `Quit(7)`.

## Lifecycle decision

The upstream interpreter owns process-global state and terminates with `exit`.
Normal completion exits 0; non-interactive script errors exit 1. Do not patch
these into returns or reuse a module after exit. One job owns one fresh worker,
module and MEMFS. The supervisor terminates the worker on completion, error,
timeout or cancellation, then releases its browser blob URL.

The generated module uses `noInitialRun`, exported `callMain`, `onExit`, and
`EXIT_RUNTIME=1`. Its filesystem remains readable after a normal interpreter
exit, allowing the harness to copy explicitly requested output files. An
unexpected WASM trap is an execution failure, not a successful script exit.

The conversion build's function-pointer emulation combined with JS-based
setjmp/longjmp produced invalid output from wasm-opt when scripting was linked.
The separate script target uses WASM exceptions (`-fwasm-exceptions` and
`SUPPORT_LONGJMP=wasm`). FreeType must be rebuilt with the same longjmp ABI.
Conversion retains its existing flags and dependency artifacts.

## Reproduce

Prerequisites: Docker, Node >=22, npm dependencies, Python with
`fonttools==4.59.0` and `brotli==1.2.0`, and Playwright Chrome/Chromium + WebKit.
Run from the repository root:

```sh
npm ci
docker build -f build/Dockerfile --target scripting-export --output type=local,dest=artifacts/scripting .
node --test test/scripting/proof.test.mjs
docker build -f build/Dockerfile.scripting-native -t fontforge-wasm:scripting-native .
node test/scripting/parity.mjs
python test/scripting/verify-parity.py
node test/scripting/browser.mjs
```

The browser test defaults to installed Google Chrome. Set `BROWSER_CHANNEL=chromium`
for Playwright's bundled Chromium. `SCRIPT_BROWSER=Chrome` or `WebKit` selects
one engine. Use `PLAYWRIGHT_BROWSERS_PATH` when browsers are installed elsewhere.

The native reference independently downloads and hash-verifies the same pinned
FontForge source in `build/sources.json`; it uses native system dependencies
rather than the WASM dependency builds. Its container has networking disabled
at execution and uses `LANG=C.UTF-8`, matching the proof's UTF-8 arguments.

Results are written below ignored `test/results/scripting/`. Native and WASM
stdout/exit codes are compared. FontTools independently compares cmap, glyph
order, names, metrics, OpenType layout tables and every decomposed glyph outline.
Build timestamps are not required to match.

## Browser verification

The browser harness bundles the same runtime into a disposable worker. It tests
SFD-to-OTF, script failure, concurrent jobs, cancellation of an infinite loop,
timeout and successful execution after cancellation. It loads the worker code,
WASM and input explicitly before running the network-independent tests.

Chrome runs with Playwright offline mode enabled. On the tested macOS WebKit
runner, `setOffline(true)` prevents even a standalone `postMessage("ok")` blob
worker from starting. WebKit therefore runs with HTTP/HTTPS requests blocked,
and the test asserts that execution makes zero such requests. This proves no
network dependency during execution; it does not verify Safari service-worker
caching, offline reload or every Safari release.

## Measured build

With pinned Emscripten 5.0.7, the script WASM is 7,312,950 bytes and its generated
module is 80,624 bytes (uncompressed). The existing conversion WASM is 4,976,470
bytes. Keep scripting as a separate, opt-in download. These are local build
measurements, not a versioned release promise.

## Boundaries still to implement

The internal harness limits supplied files, copied outputs, logs and execution
time. WASM memory is capped at 512 MiB. It is **not** a production sandbox/API:

- Writable filesystem quotas must apply while scripts run, not just when copying
  output. The current harness only limits input to 16 MiB, returned output to
  32 MiB, supplied/selected file counts to 64, and logs to 64 KiB.
- Audit subprocess/network-dependent native commands and provide structured
  capability errors. Existing platform stubs do not establish comprehensive
  command compatibility.
- Define public argv/$0, working-directory, filename, partial-output, directory
  output and error contracts. Tests currently select ordinary output files only.
- Add typed browser/Node `execute()`, complete resource validation, streaming
  diagnostics, bounded assets and browser crash recovery.
- Expand native parity to selection, subsetting, metrics, transforms, contour
  edits, source preservation and multi-file outputs.
- Build the public playground, cache/update integration and offline reload tests
  only after those contracts are ready.

Do not publish this harness as a general-purpose script execution service.
Do not enable it on OFC's server/API endpoints. No product deployment is needed
for this feasibility gate.
