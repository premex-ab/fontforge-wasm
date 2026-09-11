// SPDX-License-Identifier: GPL-3.0-or-later
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const destination = '_site';
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
for (const path of ['src', 'dist', 'examples', 'licenses', 'LICENSE', 'NOTICE.md']) {
  await cp(path, `${destination}/${path}`, { recursive: true });
}
const html = await readFile('examples/browser/index.html', 'utf8');
await writeFile(`${destination}/index.html`, html.replace('src="./demo.js"', 'src="./examples/browser/demo.js"'));
await writeFile(`${destination}/.nojekyll`, '');
// Invalidate the demo's asset cache whenever a deployed engine or UI changes.
const hash = createHash('sha256');
for (const path of ['index.html', 'examples/browser/demo.js', 'src/index.js', 'src/validate.js', 'dist/browser-worker.mjs', 'dist/fontforge-core.wasm', 'examples/fonts/Roboto-Regular.ttf', 'examples/fonts/Roboto-Regular.otf', 'examples/fonts/LICENSE.txt']) {
  hash.update(await readFile(`${destination}/${path}`));
}
const worker = (await readFile('demo-service-worker.js', 'utf8'))
  .replace(/const VERSION = '[^']+';/, `const VERSION = 'fontforge-wasm-demo-${hash.digest('hex').slice(0, 16)}';`)
  .replace("const ASSETS = [", "const ASSETS = [\n  './',");
await writeFile(`${destination}/demo-service-worker.js`, worker);
console.log('GitHub Pages site assembled in _site/');
