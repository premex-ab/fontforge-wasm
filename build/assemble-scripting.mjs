// SPDX-License-Identifier: GPL-3.0-or-later
import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist', { recursive: true });
for (const name of ['fontforge-script.mjs', 'fontforge-script.wasm']) await cp(`artifacts/scripting/${name}`, `dist/${name}`);
await build({ entryPoints: ['src/script-browser-worker.js'], outfile: 'dist/script-browser-worker.mjs', bundle: true, platform: 'browser', format: 'iife', define: { 'import.meta.url': 'self.location.href' }, external: ['node:*'] });
