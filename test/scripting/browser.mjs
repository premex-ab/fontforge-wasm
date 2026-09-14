// SPDX-License-Identifier: GPL-3.0-or-later
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
await build({ entryPoints: ['test/scripting/browser-worker.mjs'], outfile: 'artifacts/scripting/browser-worker.mjs', bundle: true, platform: 'browser', format: 'iife', define: { 'import.meta.url': 'self.location.href' }, external: ['node:*'] });
const routes = {
  '/worker.mjs': ['artifacts/scripting/browser-worker.mjs', 'text/javascript'],
  '/fontforge-script.wasm': ['artifacts/scripting/fontforge-script.wasm', 'application/wasm'],
  '/input.sfd': ['test/results/scripting/input.sfd', 'application/octet-stream'],
};
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Native scripting proof</title>'); return; }
  const route = routes[req.url];
  if (!route) { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', route[1]); res.end(await readFile(route[0])); }
  catch { res.writeHead(500); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const [name, engine] of [['Chrome', chromium], ['WebKit', webkit]].filter(([name]) => !process.env.SCRIPT_BROWSER || process.env.SCRIPT_BROWSER === name)) {
    const profile = await mkdtemp(join(tmpdir(), 'fontforge-script-browser-'));
    const browser = await engine.launchPersistentContext(profile, name === 'Chrome' ? { channel: process.env.BROWSER_CHANNEL || 'chrome' } : {});
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const result = page.evaluate(async () => {
        const wasmBinary = await (await fetch('/fontforge-script.wasm')).arrayBuffer();
        const input = new Uint8Array(await (await fetch('/input.sfd')).arrayBuffer());
        const workerCode = await (await fetch('/worker.mjs')).text();
        const execute = (request, abortOnLog = false, timeoutMs = 10000) => new Promise((resolve, reject) => {
          const url = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
          const worker = new Worker(url);
          const done = (error, value) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); error ? reject(error) : resolve(value); };
          const timer = setTimeout(() => done(new Error('TIMEOUT')), timeoutMs);
          worker.onerror = event => done(new Error(`Worker error: ${event.message} ${event.filename}:${event.lineno}`));
          worker.onmessage = ({ data }) => {
            if (data.log?.fatal) { done(new Error(data.log.fatal)); return; }
            if (data.log) { if (abortOnLog && data.log.message === 'ready') done(null, 'cancelled'); return; }
            done(data.error ? new Error(data.error) : null, data.result);
          };
          worker.postMessage({ ...request, wasmBinary });
        });
        // Block all further network access: everything required is already loaded.
        self.proofReady = true;
        await new Promise(resolve => { self.resumeProof = resolve; });
        {
          const converted = await execute({ script: 'Open($1); Print($fontname); Generate($2);', args: ['/work/input.sfd', '/work/out.otf'], files: { '/work/input.sfd': input }, outputPaths: ['/work/out.otf'] });
          const failed = await execute({ script: 'UnknownCommand();' });
          const concurrent = await Promise.all(['one', 'two'].map(word => execute({ script: 'Print($1);', args: [word] })));
          const cancelled = await execute({ script: 'Print("ready"); while (1)\nendloop' }, true);
          const timedOut = await execute({ script: 'while (1)\nendloop' }, false, 500).then(() => false, error => error.message === 'TIMEOUT');
          const after = await execute({ script: 'Print("alive");' });
          return { exit: converted.exitCode, signature: new TextDecoder().decode(converted.files['/work/out.otf'].slice(0, 4)), failed: failed.exitCode, logs: converted.stdout, concurrent: concurrent.map(r => r.stdout), cancelled, timedOut, after: after.stdout };
        }
      });
      await page.waitForFunction(() => self.proofReady);
      // On the tested macOS WebKit runner, setOffline(true) prevents even a
      // trivial blob worker from starting. Block HTTP instead; no SDK upload or
      // asset request is allowed after the explicitly loaded inputs above.
      const unexpectedRequests = [];
      await page.context().route(/^https?:\/\//, route => {
        unexpectedRequests.push(route.request().url());
        return route.abort();
      });
      if (name === 'Chrome') await page.context().setOffline(true);
      await page.evaluate(() => self.resumeProof());
      const actual = await result;
      assert.deepEqual(unexpectedRequests, [], "Script execution must not request network resources");
      assert.equal(actual.exit, 0); assert.equal(actual.signature, 'OTTO'); assert.ok(actual.logs.length);
      assert.notEqual(actual.failed, 0); assert.deepEqual(actual.concurrent, ['one', 'two']);
      assert.equal(actual.cancelled, 'cancelled'); assert.equal(actual.timedOut, true); assert.equal(actual.after, 'alive');
      console.log(`${name}: native script export, errors, concurrency, cancellation and timeout passed (${name === "Chrome" ? "offline" : "HTTP blocked"})`);
    } finally { await browser.close(); await rm(profile, { recursive: true, force: true }); }
  }
} finally { server.close(); }
