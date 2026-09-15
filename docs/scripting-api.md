# Native scripting API (unreleased)

`execute()` runs FontForge's native scripting language in a disposable worker in
Node >=22 and supported browsers. It is separate from `convert()`: conversion
consumers do not load the scripting WASM. This branch is not an npm release.
Python, the desktop GUI and external helper programs are not provided.

```js
import { execute } from '@warting/fontforge-wasm';

const result = await execute(`
  Open($1);
  Print($fontname);
  Generate($2);
`, {
  args: ['/work/input.sfd', '/work/output.otf'],
  files: { '/work/input.sfd': sourceBytes }, // Uint8Array
  outputPaths: ['/work/output.otf'],
  timeoutMs: 30_000,
  onLog: ({ stream, message, elapsedMs }) => console.log(elapsedMs, stream, message),
});
if (result.exitCode !== 0) throw new Error(result.stderr);
const converted = result.files['/work/output.otf'];
```

## Contract

- Each call has fresh native globals and an in-memory filesystem. No host
  directories are mounted. Inputs are copied and never detached or changed.
- `script` is UTF-8 text without NUL. `$0` is `/work/script.pe`; `$1` onward are
  individual `args` entries. Arguments are never shell-parsed. The working
  directory is `/work`; native relative paths resolve there.
- Supply up to 64 files and select up to 64 unique regular output files. Public
  paths must be absolute `/work/...` paths without empty, dot or parent segments,
  NUL or backslashes. `/work/script.pe` is reserved. Selected output paths cannot equal
  supplied input paths; scripts may modify their own private input copies. Parent directories are created before the script starts.
- Script text, argument text and input bytes total at most 16 MiB. Paths are
  limited to 1024 characters. Argument count is at most 64.
- Native script failures **resolve** with nonzero `exitCode` and captured stderr.
  Requested files that exist are returned, including partial files after failure.
  Missing outputs are omitted. Directories and symlinks are not returned; select
  their individual regular files. Successful exit does not guarantee a requested
  output exists or that a partial font is usable.
- `stdout` and `stderr` join captured lines with `\n`, without a trailing newline.
  `onLog` receives each line with elapsed milliseconds measured inside the worker.
  Exceptions in observers are ignored. `onProgress` reports asset loading and
  worker startup. Diagnostics use a shared UTF-8 budget including line separators.
- `signal` aborts execution by terminating the worker. `timeoutMs` includes asset
  loading and startup, defaults to 30 seconds, and must be 1–300000 ms. A finished
  job's worker is always discarded. No partial files are returned on cancellation
  or infrastructure/resource failures.
- Browser assets are cached in memory between calls. `cache: 'no-store'` bypasses
  both this cache and the browser HTTP cache. First use still needs accessible
  assets; offline reload and application service-worker caching are separate work.
  Serve `src/` and `dist/` with the package layout preserved. Browser CSP must allow
  WASM compilation and blob workers. The host application controls concurrency.

## Limits and errors

`SCRIPT_LIMITS` exposes defaults and ceilings; `limits` may lower them:

| Option | Default / maximum |
| --- | --- |
| `maxFileSystemBytes` | 64 MiB |
| `maxEntries` | 1024 |
| `maxOutputBytes` | 32 MiB |
| `maxLogBytes` | 64 KiB |

Filesystem limits apply **during execution**, including native temporary files
outside `/work`. The byte budget charges peak allocated regular-file storage per MEMFS inode;
truncating or deleting a file does not refund it during that job. Entry counts
include created directories and links, even after deletion. This intentionally
bounds repeated temporary-file creation. Fixed Emscripten startup entries are
excluded. Sparse writes, reallocations, truncation and mmap writeback are guarded
before file growth. These budgets depend on the pinned Emscripten MEMFS internals,
covered by tests; an Emscripten upgrade requires reviewing those hooks.

A quota failure emits a fatal event to the supervisor, which terminates the
worker even if native code ignores the filesystem error. This is necessary because
libc can swallow callback exceptions. WASM linear memory is capped at 512 MiB;
that is not a total process-memory cap (JS objects, copies and reallocation can
use additional memory). This experimental API is not a hosted untrusted-script
sandbox. Use OS-level limits for hostile server workloads.

Infrastructure failures reject with `FontForgeError.code`: `INVALID_REQUEST`,
`FILESYSTEM_LIMIT`, `OUTPUT_LIMIT`, `LOG_LIMIT`, `UNSUPPORTED_CAPABILITY`,
`INVALID_OUTPUT`, `ABORTED`, `TIMEOUT`, `EXECUTION_ERROR`, or `WORKER_ERROR`.
Invalid timeout/cache options throw RangeError/TypeError.

`AskUser`, `AutoTrace` and its `Autotrace` alias explicitly reject as unsupported.
Native `system()` and `popen()` cannot delegate to the Node host; attempted calls
report unsupported capability. Other native features may still report ordinary
script errors when optional libraries, GUI functionality or external resources
are unavailable. This is not a promise that every FontForge command works.

## Build and verify

```sh
npm ci
npm run build
npm run build:scripting
node --test test/scripting/api.test.mjs test/scripting/quota.test.mjs
node test/scripting/api-browser.mjs
npm test
npm pack --dry-run
```

Browser tests default to installed Chrome; set `BROWSER_CHANNEL=chromium` for
Playwright Chromium. WebKit blocks HTTP/HTTPS instead of Playwright offline mode
because the tested macOS runner cannot start even a trivial blob worker in that
mode. Both engines verify zero execution-time HTTP requests after loading assets.

The existing native parity proof remains in `test/scripting/`; see
[native scripting proof](native-scripting-proof.md). Next milestones are more
editing-operation parity cases and a public script playground. OFC's API/backend
and its use of `convert()` do not change in this milestone.
