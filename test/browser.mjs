// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { FORMATS } from '../src/formats.js';
const root = resolve('.');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}`;
try {
  for (const engine of [chromium, webkit]) {
    const profile = await mkdtemp(resolve(tmpdir(), 'fontforge-wasm-browser-'));
    const browser = await engine.launchPersistentContext(profile, engine === chromium && process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', req => assert.equal(req.method(), 'GET', 'The demo must not upload fonts'));
      let workers = 0;
      page.on('worker', () => workers++);
      await page.goto(`${url}/examples/browser/`);
      assert.equal(await page.evaluate(() => crossOriginIsolated), false);
      for (const [from, to] of [['ttf', 'otf'], ['otf', 'ttf']]) {
        await page.locator('#font').setInputFiles(`test/fixtures/fixture.${from}`);
        await page.locator('#convert').click();
        await page.locator('#download').waitFor({ state: 'visible', timeout: 60_000 });
        assert.equal(await page.locator('#download').getAttribute('download'), `fixture.${to}`);
        await page.locator('#preview').waitFor({ state: 'visible' });
        assert.match(await page.locator('#status').innerText(), /no upload/);
      }
      for (const [from, to] of [['ttf', 'otf'], ['otf', 'ttf']]) {
        const workersBefore = workers;
        await page.locator(`[data-sample="${from}"]`).click();
        await page.waitForFunction(() => !document.querySelector('#convert').disabled);
        assert.equal(await page.locator('#download').isVisible(), false, 'Selecting an example must not convert');
        assert.equal(workers, workersBefore, 'Selection must not start a conversion worker');
        await page.locator('#convert').click();
        await page.locator('#download').waitFor({ state: 'visible', timeout: 60_000 });
        assert.equal(await page.locator('#download').getAttribute('download'), `Roboto-Regular.${to}`);
        assert.equal(await page.locator('#font').inputValue(), '');
        await page.locator('#preview').waitFor({ state: 'visible' });
        assert.match(await page.locator('#selected-font').innerText(), /Roboto-Regular/);
        await page.waitForFunction(() => !document.querySelector('#convert').disabled);
        const log = await page.locator('#activity-log').innerText();
        assert.match(log, /\d{2}:\d{2}:\d{2}\.\d{3} UTC \+0\.\d{3}s/);
        assert.match(log, /Initializing WebAssembly/);
        assert.match(log, /FontForge conversion finished · \d+\.\d{3}s/);
        assert.match(log, /total from Convert click/);
      }
      // Every public example is a real selectable input, and every output
      // can be downloaded. Legacy previews use a labelled separate TTF job.
      for (const definition of FORMATS.filter(f => f.input)) {
        await page.locator(`[data-sample="${definition.id}"]`).click();
        await page.waitForFunction(() => !document.querySelector('#convert').disabled);
        assert.equal(await page.locator('#download').isVisible(), false);
        await page.locator('#format').selectOption('ttf');
        await page.locator('#convert').click();
        await page.waitForFunction(() => !document.querySelector('#convert').disabled, undefined, { timeout: 60000 });
        assert.equal(await page.locator('#download').isVisible(), true, `${definition.id} example failed: ${await page.locator('#status').innerText()}`);
        assert.equal(await page.locator('#preview').isVisible(), true, `${definition.id} preview failed`);
      }
      await page.locator('[data-sample="woff2"]').click();
      await page.waitForFunction(() => !document.querySelector('#convert').disabled);
      for (const definition of FORMATS) {
        await page.locator('#format').selectOption(definition.id);
        await page.locator('#convert').click();
        await page.waitForFunction(() => !document.querySelector('#convert').disabled, undefined, { timeout: 60000 });
        assert.equal(await page.locator('#download').isVisible(), true, `${definition.id} export failed: ${await page.locator('#status').innerText()}`);
        assert.equal(await page.locator('#download').getAttribute('download'), `Roboto-Regular.${definition.extension || definition.id}`);
        assert.equal(await page.locator('#preview').isVisible(), true, `${definition.id} export preview failed`);
      }
      // The demo's explicit asset cache makes worker loading reliable offline.
      await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      // Read fixture bytes before switching Playwright's network emulation off;
      // this avoids its WebKit file-input transport being treated as a request.
      await page.evaluate(async () => {
        const { convert } = await import('../../src/index.js');
        window.convertOffline = convert;
        window.offlineBytes = new Uint8Array(await (await fetch('../../test/fixtures/fixture.ttf')).arrayBuffer());
      });
      // WebKit's network emulator also blocks starting Blob workers. Stop the
      // actual asset server instead: no engine file can be downloaded.
      await new Promise(resolve => server.close(resolve));
      if (engine === chromium) await page.context().setOffline(true);
      const offlineSignature = await page.evaluate(async () => {
        const bytes = await window.convertOffline(window.offlineBytes, { format: 'otf', timeoutMs: 10_000 });
        return new DataView(bytes.buffer).getUint32(0);
      });
      assert.equal(offlineSignature, 0x4f54544f);
      await page.locator('[data-sample="woff2"]').click();
      await page.waitForFunction(() => !document.querySelector('#convert').disabled);
      assert.equal(await page.locator('#download').isVisible(), false, 'Selecting an example must not convert');
      await page.locator('#convert').click();
      await page.locator('#download').waitFor({ state: 'visible', timeout: 60_000 });
      assert.equal(await page.locator('#download').getAttribute('download'), 'Roboto-Regular.ttf');
      await page.locator('#preview').waitFor({ state: 'visible' });
      if (engine === chromium) await page.context().setOffline(false);
      await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      await mkdir('test/results', { recursive: true });
      await page.screenshot({ path: `test/results/${engine.name()}-light.png`, fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: `test/results/${engine.name()}-dark.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: 19 hosted input formats, 22 exports, FontFace previews, WOFF2 with asset server stopped, no uploads, no cross-origin isolation`);
    } finally { await browser.close(); await rm(profile, { recursive: true, force: true }); }
  }
} finally { server.close(); }
