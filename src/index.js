// SPDX-License-Identifier: GPL-3.0-or-later
import { FontForgeError, validateFont, MAX_INPUT_BYTES } from './validate.js';
import { FORMATS, getFormat } from './formats.js';
export { FontForgeError, MAX_INPUT_BYTES, FORMATS };
let browserAssets;
// OFC patch: bounded downloads, validated assets, and a revision that bypasses old SW caches.
function loadBrowserAssets(cache) {
  if (cache !== 'no-store' && browserAssets) return browserAssets;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  const asset = name => new URL(`../dist/${name}?v=20261016b`, import.meta.url);
  const pending = Promise.all([
    fetch(asset('browser-worker.mjs'), { cache, signal: controller.signal }),
    fetch(asset('fontforge-core.wasm'), { cache, signal: controller.signal }),
  ]).then(async ([script, wasm]) => {
    if (!script.ok || !wasm.ok) throw new Error('Could not load FontForge engine assets.');
    const [code, wasmBinary] = await Promise.all([script.text(), wasm.arrayBuffer()]);
    const magic = new Uint8Array(wasmBinary, 0, Math.min(4, wasmBinary.byteLength));
    if (magic.length !== 4 || magic.some((value, index) => value !== [0,97,115,109][index]) || /^\s*</.test(code))
      throw new Error('Invalid FontForge engine assets.');
    return {code, wasmBinary};
  }).catch(error => {
    if (browserAssets === pending) browserAssets = undefined;
    throw error;
  }).finally(() => { clearTimeout(timer); controller.abort(); });
  // Successful retries replace failed/stale in-memory assets as well.
  browserAssets = pending;
  return pending;
}

/** Convert in a disposable worker. The caller's input buffer is never detached. */
export async function convert(input, { format, signal, timeoutMs = 30_000, onProgress, cache = 'default', inputFormat, faceIndex = 0, variations } = {}) {
  if (!getFormat(format)?.output) throw new FontForgeError('UNSUPPORTED_FORMAT', 'Choose an output format from FORMATS.');
  if (inputFormat && !getFormat(inputFormat)?.input) throw new FontForgeError('UNSUPPORTED_FONT', 'This input format is not supported; metrics files are export-only.');
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex > 255) throw new FontForgeError('INVALID_FACE_INDEX', 'faceIndex must be an integer from 0 to 255.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new RangeError('timeoutMs must be between 1 and 300000.');
  if (signal?.aborted) throw new FontForgeError('ABORTED', 'Conversion was cancelled.');
  if (cache !== 'default' && cache !== 'no-store') throw new TypeError('cache must be default or no-store.');
  if (variations !== undefined && (!variations || typeof variations !== 'object' || Array.isArray(variations) ||
      Object.keys(variations).length > 64 || Object.entries(variations).some(([tag,value]) => !/^[A-Za-z0-9 ]{4}$/.test(tag) || typeof value !== 'number' || !Number.isFinite(value))))
    throw new FontForgeError('INVALID_VARIATION','Axis values must be finite numbers keyed by four-character axis tags.');
  validateFont(input, inputFormat, {preserveTables:true});
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
        if (finished) return;
        workerUrl = URL.createObjectURL(new Blob([assets.code], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        wasmBinary = assets.wasmBinary;
        worker.onmessage = event => receive(event.data);
        worker.onerror = failed;
        worker.onmessageerror = () => failed(new Error('Invalid message from conversion worker.'));
      }
      worker.postMessage({ bytes, format, wasmBinary, inputFormat, faceIndex, variations }, [bytes.buffer]);
    })().catch(failed);
  });
}

export { execute } from './execute.js';
export { SCRIPT_LIMITS } from './script-validate.js';

export { inspectVariations } from './variations.js';
