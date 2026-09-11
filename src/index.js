// SPDX-License-Identifier: GPL-3.0-or-later
import { FontForgeError, validateFont, MAX_INPUT_BYTES } from './validate.js';
export { FontForgeError, MAX_INPUT_BYTES };
let browserAssets;
function loadBrowserAssets(cache) {
  const load = () => Promise.all([
    fetch(new URL('../dist/browser-worker.mjs', import.meta.url), { cache }),
    fetch(new URL('../dist/fontforge-core.wasm', import.meta.url), { cache }),
  ]).then(async ([script, wasm]) => {
    if (!script.ok || !wasm.ok) throw new Error('Could not load FontForge engine assets.');
    return { code: await script.text(), wasmBinary: await wasm.arrayBuffer() };
  }).catch(error => { browserAssets = undefined; throw error; });
  if (cache === 'no-store') return load();
  return browserAssets ??= load();
}

/** Convert in a disposable worker. The caller's input buffer is never detached. */
export async function convert(input, { format, signal, timeoutMs = 30_000, onProgress, cache = 'default' } = {}) {
  if (format !== 'ttf' && format !== 'otf') throw new FontForgeError('UNSUPPORTED_FORMAT', 'Output format must be ttf or otf.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new RangeError('timeoutMs must be between 1 and 300000.');
  if (signal?.aborted) throw new FontForgeError('ABORTED', 'Conversion was cancelled.');
  if (cache !== 'default' && cache !== 'no-store') throw new TypeError('cache must be default or no-store.');
  validateFont(input);
  // Buffer.slice() in Node shares storage; Uint8Array.from() always copies.
  const bytes = Uint8Array.from(input);
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  return new Promise((resolve, reject) => {
    let worker, workerUrl, timer;
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker?.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new FontForgeError('ABORTED', 'Conversion was cancelled.'));
    const report = event => {
      if (finished) return;
      try { onProgress?.(event); } catch { /* Observers cannot interrupt conversion. */ }
    };
    const receive = data => {
      if (data.progress) { report(data.progress); return; }
      if (data.error) finish(new FontForgeError(data.error.code, data.error.message));
      else finish(null, new Uint8Array(data.bytes));
    };
    const failed = error => finish(new FontForgeError('WORKER_ERROR', error.message || 'The conversion worker failed.'));
    timer = setTimeout(() => finish(new FontForgeError('TIMEOUT', 'Conversion exceeded its time limit.')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    (async () => {
      let wasmBinary;
      if (isNode) {
        report({ stage: 'worker', message: 'Starting conversion worker' });
        const { Worker } = await import('node:worker_threads');
        if (finished) return;
        worker = new Worker(new URL('./node-worker.js', import.meta.url), { execArgv: [] });
        worker.on('message', receive);
        worker.on('error', failed);
        worker.on('exit', code => {
          if (!finished) failed(new Error(`Worker exited before returning a font (${code}).`));
        });
      } else {
        report({ stage: 'assets', message: cache === 'no-store' ? 'Fetching engine assets with browser cache bypassed' : browserAssets ? 'Reusing engine assets in memory' : 'Loading engine assets (network or browser cache)' });
        const assets = await loadBrowserAssets(cache);
        if (finished) return;
        // Keep engine assets in memory so fresh workers need no network, even
        // where a browser does not cache module-worker dependency requests.
        report({ stage: 'worker', message: 'Starting conversion worker' });
        workerUrl = URL.createObjectURL(new Blob([assets.code], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        wasmBinary = assets.wasmBinary;
        worker.onmessage = event => receive(event.data);
        worker.onerror = failed;
        worker.onmessageerror = () => failed(new Error('Invalid message from conversion worker.'));
      }
      worker.postMessage({ bytes, format, wasmBinary }, [bytes.buffer]);
    })().catch(failed);
  });
}
