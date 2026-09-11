// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
execFileSync('node', ['build/pages.mjs'], { stdio: 'inherit' });
let upgraded = false;
const oldHtml = '<!doctype html><p>Previous release</p><script>navigator.serviceWorker.register("./demo-service-worker.js")</script>';
const oldScript = 'document.documentElement.dataset.oldScript = "true";';
const oldWorker = `const cacheName='fontforge-wasm-demo-regression-old';
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(['./','./examples/browser/demo.js'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.open(cacheName).then(async c=>(await c.match(e.request))||fetch(e.request))));`;
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-cache');
  if (!upgraded) {
    res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(pathname.endsWith('demo-service-worker.js') ? oldWorker : pathname.endsWith('demo.js') ? oldScript : oldHtml);
    return;
  }
  const file = resolve('_site', '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(resolve('_site') + '/')) {res.writeHead(403).end();return;}
  try {const data=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data);}
  catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
try {
  for(const engine of [chromium,webkit]) {
    upgraded=false;
    const profile=await mkdtemp('/tmp/fontforge-cache-upgrade-');
    const context=await engine.launchPersistentContext(profile,engine===chromium && process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{});
    try {
      const page=await context.newPage();
      await page.goto(url);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      upgraded=true;
      // A new navigation can receive fresh HTML while the old controller still
      // serves demo.js from its cache. The immutable script URL must bypass it.
      await page.goto(url+'?upgrade=1');
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.oldScript),undefined);
      for(const from of ['ttf','otf']) {
        await page.locator(`[data-sample="${from}"]`).click();
        await page.waitForFunction(() => !document.querySelector('#convert').disabled);
        assert.equal(await page.locator('#download').isVisible(), false, 'Selecting an example must not convert');
        await page.locator('#convert').click();
        await page.locator('#download').waitFor({state:'visible',timeout:60000});
        await page.locator('#preview').waitFor({state:'visible'});
      }
      await page.waitForFunction(()=>document.documentElement.dataset.offlineReady==='true');
      await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await page.reload();
      await page.locator('[data-sample="ttf"]').click();
      await page.waitForFunction(() => !document.querySelector('#convert').disabled);
      assert.equal(await page.locator('#download').isVisible(), false, 'Selecting an example must not convert');
      await page.locator('#convert').click();
      await page.locator('#download').waitFor({state:'visible',timeout:60000});
      console.log(`${engine.name()}: existing stale cache upgraded; both hosted examples work`);
    } finally {await context.close();await rm(profile,{recursive:true,force:true});}
  }
} finally {server.close();}
