// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Public scripting API test</title>'); return; }
  if (!/^\/(src|dist)\/[a-z-]+\.(js|mjs|wasm)$/.test(req.url) && req.url !== '/test/fixtures/fixture.ttf') { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', req.url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'); res.end(await readFile('.'+req.url)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const [name, engine] of [['Chrome', chromium], ['WebKit', webkit]]) {
    const profile = await mkdtemp(join(tmpdir(), 'ff-api-'));
    const context = await engine.launchPersistentContext(profile, name === 'Chrome' ? { channel: process.env.BROWSER_CHANNEL || 'chrome' } : {});
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(async () => {
        self.sdk = await import('/src/index.js');
        self.font = new Uint8Array(await (await fetch('/test/fixtures/fixture.ttf')).arrayBuffer());
        await self.sdk.execute('Print("loaded");');
      });
      const requests = [];
      await context.route(/^https?:\/\//, route => { requests.push(route.request().url()); return route.abort(); });
      if (name === 'Chrome') await context.setOffline(true);
      const actual = await page.evaluate(async () => {
        const { execute } = self.sdk;
        const result = await execute('Open($1); Generate($2);', { args: ['/work/in.ttf', '/work/out.otf'], files: { '/work/in.ttf': self.font }, outputPaths: ['/work/out.otf'] });
        const code = async promise => { try { await promise; return 'unexpected success'; } catch(e) { return e.code; } };
        const quota = await code(execute('while (1)\nWriteStringToFile("1234567890", "/work/out", 1);\nendloop', { limits: { maxFileSystemBytes: 8192 } }));
        const capability = await code(execute('AskUser("hello");'));
        const logs = await code(execute('while (1)\nPrint("");\nendloop', { limits: { maxLogBytes: 16 } }));
        const controller = new AbortController();
        const abort = await code(execute('Print("ready"); while (1)\nendloop', { signal: controller.signal, onLog: () => controller.abort() }));
        const timeout = await code(execute('while (1)\nendloop', { timeoutMs: 500 }));
        const parallel = await Promise.all(['one', 'two'].map(x => execute('Print($1);', { args: [x] })));
        return { exit: result.exitCode, signature: new TextDecoder().decode(result.files['/work/out.otf'].slice(0,4)), quota, capability, logs, abort, timeout, parallel: parallel.map(r => r.stdout) };
      });
      assert.deepEqual(actual, { exit: 0, signature: 'OTTO', quota: 'FILESYSTEM_LIMIT', capability: 'UNSUPPORTED_CAPABILITY', logs: 'LOG_LIMIT', abort: 'ABORTED', timeout: 'TIMEOUT', parallel: ['one', 'two'] });
      assert.deepEqual(requests, []);
      console.log(`${name}: public execute API, quotas, capabilities, cancellation and concurrency passed without HTTP`);
    } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
  }
} finally { server.close(); }
