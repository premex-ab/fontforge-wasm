// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { execute } from '../src/index.js';
import { presets } from '../examples/playground/presets.js';
const bytes = new Uint8Array(await readFile('test/fixtures/fixture.ttf'));
for (const preset of Object.values(presets)) {
  const result = await execute(preset.script, { args: ['/work/input.ttf'], files: { '/work/input.ttf': bytes }, outputPaths: preset.outputs.split('\n') });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(Object.keys(result.files).length, preset.outputs.split('\n').length);
  if (preset === presets.rename) assert.match(new TextDecoder().decode(result.files['/work/renamed.sfd']), /FontName: Playground-Regular/);
}
execFileSync('node', ['build/pages.mjs']);
const root = resolve('_site');
let disconnected = false;
const server = createServer(async (req, res) => {
  if (disconnected) { req.socket.destroy(); return; }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, '.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if (!file.startsWith(root+'/')) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', ({'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.html':'text/html'})[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
await mkdir('test/results/playground', {recursive:true});
try {
  for (const [name, engine] of [['chromium',chromium],['webkit',webkit]]) {
    disconnected = false;
    const profile = await mkdtemp(resolve(tmpdir(), 'ff-playground-'));
    const context = await engine.launchPersistentContext(profile, name==='chromium'?{channel:process.env.BROWSER_CHANNEL || 'chrome'}:{});
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let requests = 0; page.on('request', r => { if(r.url().endsWith('fontforge-script.wasm')) requests++; });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/playground/`);
      await page.locator('#preset option').nth(2).waitFor({state:'attached'});
      assert.equal(requests,0);
      await page.locator('#sample').click();
      await page.waitForFunction(() => document.querySelector('#selected').textContent.includes('Roboto-Regular.ttf'));
      assert.equal(requests,0);
      await page.locator('#run').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent==='Script completed.');
      assert.equal(await page.locator('#results a').count(),1);
      assert.match(await page.locator('#log').innerText(), /stdout: Font name:/);
      const loaded = requests;
      await page.locator('#preset').selectOption('export');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent==='Script completed.');
      assert.equal(await page.locator('#results a').count(),2); assert.equal(requests,loaded);
      const download = await Promise.all([page.waitForEvent('download'),page.locator('#results a').first().click()]);
      assert.equal(download[0].suggestedFilename(),'font.otf');
      await page.locator('#script').fill('UnknownCommand();'); await page.locator('#run').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Script failed'));
      assert.equal(await page.locator('#results a').count(),0);
      await page.locator('#script').fill('Print("ready"); while (1)\nendloop'); await page.locator('#run').click();
      await page.waitForFunction(() => document.querySelector('#log').textContent.includes('stdout: ready'));
      await page.locator('#cancel').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent==='Run stopped.');
      await page.locator('#run').click(); await page.locator('#reset').click();
      assert.equal(await page.locator('#status').innerText(),'Ready when you are.');
      assert.equal(await page.locator('#results a').count(),0);
      await page.locator('#font').setInputFiles('test/fixtures/fixture.ttf');
      await page.locator('#preset').selectOption('rename'); await page.locator('#run').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent==='Script completed.');
      assert.match(await page.locator('#log').innerText(), /Playground-Regular/);
      await page.emulateMedia({colorScheme:'dark'});
      await page.screenshot({path:`test/results/playground/${name}-dark.png`,fullPage:true});
      await page.setViewportSize({width:390,height:844}); await page.emulateMedia({colorScheme:'light'});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({path:`test/results/playground/${name}-mobile.png`,fullPage:true});
      // Cache a navigation controlled by the installed service worker, then reload offline.
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload(); await page.locator('#preset option').nth(2).waitFor({state:'attached'});
      // macOS WebKit's offline emulation breaks navigation and Blob workers.
      // Fail actual HTTP connections instead so the service-worker fallback is exercised.
      if(name==='chromium') await context.setOffline(true);
      else disconnected = true;
      await page.reload(); await page.locator('#preset option').nth(2).waitFor({state:'attached'});
      await page.locator('#sample').click(); await page.waitForFunction(() => document.querySelector('#selected').textContent.includes('Roboto-Regular.ttf'));
      await page.locator('#run').click(); await page.waitForFunction(() => document.querySelector('#status').textContent==='Script completed.');
      assert.deepEqual(errors,[]);
      console.log(`${name}: presets, manual run, local/hosted input, downloads, errors, cancellation, reset, responsive layout and offline reload passed`);
    } finally { await context.close(); await rm(profile, {recursive:true,force:true}); }
  }
} finally { server.close(); }
