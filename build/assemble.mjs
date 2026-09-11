// SPDX-License-Identifier: GPL-3.0-or-later
import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('artifacts/dist', 'dist', { recursive: true });
await cp('artifacts/licenses', 'licenses', { recursive: true });

const { build } = await import('esbuild');
await build({
  entryPoints: ['src/browser-worker.js'], outfile: 'dist/browser-worker.mjs',
  bundle: true, format: 'iife', define: { 'import.meta.url': 'self.location.href' }, platform: 'browser', external: ['node:*'],
  banner: { js: '// fontforge-wasm — GPL-3.0-or-later. See LICENSE and NOTICE.md.' },
});
