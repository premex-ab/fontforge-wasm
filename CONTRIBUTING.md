# Contributing

This repository contains only the standalone WASM product. Please keep integrations
with unrelated applications in their own repositories.

Use the build and test commands in the README. Tests execute the actual WASM
artifact; mocks are not a substitute for conversion coverage. Never add customer
fonts or fonts without redistribution permission. The fixture generator creates
original synthetic fonts for this purpose.

For browser tests install Playwright locally and its browsers:

```sh
npm ci
npx playwright install chromium webkit
npm run test:browser
```

`BROWSER_CHANNEL=chrome` selects an installed Chrome instead of Playwright Chromium.
The test starts its own HTTP server without COOP/COEP and exercises actual
conversion and browser font loading. No external application is needed.

## Native changes

`build/sources.json` pins archives and their SHA-256 digests. `build/patch.py`
contains small checked platform changes; `native/patch-formats.py` preserves
Unicode information in Type 11 exports. The C adapter exposes only a narrow
conversion ABI. A separate scripting target exposes the upstream interpreter;
see docs/scripting-api.md and run both scripting test suites for changes to it. Keep browser filesystem access
inside Emscripten's in-memory filesystem and run each job in its own worker.
The WASM memory ceiling is a linear-memory limit, not a total process limit.

Changes to upstream or native dependencies must pass the complete format matrix,
round trips, independent fontTools checks, cancellation and browser tests.
Do not broaden the supported-format matrix before adding fixtures and validation.

## Release

1. Update the version, changelog and README install filename.
2. Build and run the complete test suite and `npm pack`.
3. Review `npm pack --dry-run` and the git diff for accidental/private contents.
4. Run `node build/release.mjs` to collect the installable package, all upstream
   source archives, runtime sources and SHA-256 checksums in `artifacts/release/`.
5. Commit, tag `v<version>`, and attach those files to a GitHub prerelease. The tag
   must contain the exact wrapper and build scripts corresponding to the binary.
6. Verify the public assets and checksums after upload.

CI builds and tests pull requests but has no publishing credentials. Creating a
tag or running CI does not automatically publish to npm. If an npm release is
added later, configure trusted publishing and preserve source availability.

Contributions are licensed GPL-3.0-or-later. Preserve upstream copyright notices.
