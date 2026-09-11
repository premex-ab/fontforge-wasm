// SPDX-License-Identifier: GPL-3.0-or-later
import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const destination = '_site';
const hash = createHash('sha256');
async function fingerprint(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory()) await fingerprint(file);
    else { hash.update(file); hash.update(await readFile(file)); }
  }
}
for (const path of ['src', 'dist', 'examples']) await fingerprint(path);
hash.update(await readFile('demo-service-worker.js'));
const version = hash.digest('hex').slice(0, 16);
const release = `releases/${version}`;
await rm(destination, { recursive: true, force: true });
await mkdir(`${destination}/${release}`, { recursive: true });
for (const path of ['src', 'dist', 'examples', 'licenses', 'LICENSE', 'NOTICE.md']) {
  await cp(path, `${destination}/${release}/${path}`, { recursive: true });
}
// Keep the module graph and fonts in one immutable, versioned directory.
const script = (await readFile('examples/browser/demo.js', 'utf8'))
  .replaceAll("new URL('../../demo-service-worker.js', import.meta.url)", "new URL('../../../../demo-service-worker.js', import.meta.url)");
await writeFile(`${destination}/${release}/examples/browser/demo.js`, script);
const html = await readFile('examples/browser/index.html', 'utf8');
await writeFile(`${destination}/index.html`, html.replace('src="./demo.js"', `src="./${release}/examples/browser/demo.js"`));
await mkdir(`${destination}/examples/browser`, { recursive: true });
await writeFile(`${destination}/examples/browser/index.html`, html.replace('src="./demo.js"', `src="../../${release}/examples/browser/demo.js"`));
await writeFile(`${destination}/.nojekyll`, '');
const worker = (await readFile('demo-service-worker.js', 'utf8'))
  .replace(/const VERSION = '[^']+';/, `const VERSION = 'fontforge-wasm-demo-${version}';`)
  .replace("const ASSETS = [", "const ASSETS = [\n  './',")
  .replace("].map(path => new URL(path, self.registration.scope).href);",
    `].map(path => new URL(path === './' || path === 'examples/browser/' ? path : '${release}/' + path, self.registration.scope).href);`);
await writeFile(`${destination}/demo-service-worker.js`, worker);
console.log(`GitHub Pages demo assembled: ${version}`);
