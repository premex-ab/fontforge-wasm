// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, stat } from 'node:fs/promises';
for (const file of ['dist/browser-worker.mjs', 'dist/fontforge-core.mjs', 'dist/fontforge-core.wasm', 'LICENSE', 'NOTICE.md', 'licenses/fontforge/LICENSE']) {
  if (!(await stat(file)).size) throw new Error(`Missing distribution file: ${file}. Run npm run build first.`);
}
const wasm = await readFile('dist/fontforge-core.wasm');
if (wasm.subarray(0, 4).toString('hex') !== '0061736d') throw new Error('Invalid WASM artifact.');
