# Third-party notices and source availability

fontforge-wasm is an independent, unofficial WebAssembly port. It is not endorsed
by the FontForge project. FontForge and its contributors retain their copyrights.

The combined distribution is licensed under **GPL-3.0-or-later**. Our original
wrapper, build scripts, examples and tests use the same license. Individual
upstream files retain their original license notices. See `LICENSE` and the
`licenses/` directory shipped with every package.

Pinned native dependencies are recorded in `build/sources.json`:

- FontForge 20251009: GPL-3.0-or-later as a whole, with substantial BSD-3-Clause code.
- GLib: LGPL-2.1-or-later.
- FreeType: FreeType License or GPL-2.0; the distribution includes both notices.
- libxml2: MIT and included upstream notices.
- libffi: MIT and included upstream notices.
- PCRE2: BSD-3-Clause and included upstream notices.
- zlib: zlib license.
- Emscripten runtime and bundled system libraries: see `licenses/emscripten/`.

For each binary release, the matching Git tag supplies this project's complete
source and build instructions, and `upstream-sources.tar.gz` contains the exact
verified archives used to build its native dependencies. Emscripten 5.0.7 is
available from https://github.com/emscripten-core/emscripten/tree/5.0.7;
its runtime/system library sources are included in the source bundle as well.
To modify or relink the libraries, edit the build recipe and rebuild with Docker.
No proprietary library is required.

Technical background: the Edge-Tools/pdf2htmlex-wasm project demonstrates
cross-compiling FontForge's dependencies. This project's build and wrapper are
independently implemented; no pdf2htmlEX application code is included.

The synthetic test font was created for this repository and is GPL-3.0-or-later.

The hosted Roboto demo fonts in `examples/fonts/` are licensed separately under
Apache License 2.0. Their upstream copyright, license, and modification notice
are included in that directory. They are not licensed under the engine GPL.
