// SPDX-License-Identifier: GPL-3.0-or-later
import { FontForgeError } from './validate.js';
import { validateScript } from './script-validate.js';
let browserAssets;
function loadBrowserAssets(cache) {
  const load = () => Promise.all([
    fetch(new URL('../dist/script-browser-worker.mjs', import.meta.url), { cache }),
    fetch(new URL('../dist/fontforge-script.wasm', import.meta.url), { cache }),
  ]).then(async ([script, wasm]) => {
    if (!script.ok || !wasm.ok) throw new Error('Could not load FontForge engine assets.');
    return { code: await script.text(), wasmBinary: await wasm.arrayBuffer() };
  }).catch(error => { browserAssets = undefined; throw error; });
  if (cache === 'no-store') return load();
  return browserAssets ??= load();
}

/** Execute a native FontForge script in one disposable worker. */
export async function execute(script, { args = [], files = {}, outputPaths = [], limits: suppliedLimits = {}, signal, timeoutMs = 30_000, onLog, onProgress, cache = 'default' } = {}) {
  const request = validateScript({ script, args, files, outputPaths, limits: suppliedLimits });
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new RangeError('timeoutMs must be between 1 and 300000.');
  if (cache !== 'default' && cache !== 'no-store') throw new TypeError('cache must be default or no-store.');
  if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function' || typeof signal.aborted !== 'boolean')) throw new FontForgeError('INVALID_REQUEST', 'signal must be an AbortSignal.');
  if (signal?.aborted) throw new FontForgeError('ABORTED', 'Execution was cancelled.');
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
    const abort = () => finish(new FontForgeError('ABORTED', 'Execution was cancelled.'));
    const report = event => {
      if (finished) return;
      try { onProgress?.(event); } catch { /* Observers cannot interrupt script execution. */ }
    };
    const receive = data => {
      if (finished) return;
      if (data.log?.fatal) { finish(new FontForgeError(data.log.code, data.log.fatal)); return; }
      if (data.log) { try { onLog?.(data.log); } catch {} return; }
      if (data.progress) { report(data.progress); return; }
      if (data.error) finish(new FontForgeError(data.error.code, data.error.message));
      else finish(null, data.result);
    };
    const failed = error => finish(new FontForgeError('WORKER_ERROR', error.message || 'The script execution worker failed.'));
    timer = setTimeout(() => finish(new FontForgeError('TIMEOUT', 'Execution exceeded its time limit.')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    (async () => {
      let wasmBinary;
      if (isNode) {
        report({ stage: 'worker', message: 'Starting script execution worker' });
        const { Worker } = await import('node:worker_threads');
        if (finished) return;
        worker = new Worker(new URL('./script-node-worker.js', import.meta.url), { execArgv: [] });
        worker.on('message', receive);
        worker.on('error', failed);
        worker.on('exit', code => {
          if (!finished) failed(new Error(`Worker exited before returning a script result (${code}).`));
        });
      } else {
        report({ stage: 'assets', message: cache === 'no-store' ? 'Fetching engine assets with browser cache bypassed' : browserAssets ? 'Reusing engine assets in memory' : 'Loading engine assets (network or browser cache)' });
        const assets = await loadBrowserAssets(cache);
        if (finished) return;
        // Keep engine assets in memory so fresh workers need no network, even
        // where a browser does not cache module-worker dependency requests.
        report({ stage: 'worker', message: 'Starting script execution worker' });
        if (finished) return;
        workerUrl = URL.createObjectURL(new Blob([assets.code], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        wasmBinary = assets.wasmBinary;
        worker.onmessage = event => receive(event.data);
        worker.onerror = failed;
        worker.onmessageerror = () => failed(new Error('Invalid message from script execution worker.'));
      }
      worker.postMessage({ ...request, wasmBinary });
    })().catch(failed);
  });
}
