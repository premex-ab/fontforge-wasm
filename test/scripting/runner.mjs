// SPDX-License-Identifier: GPL-3.0-or-later
import { Worker } from 'node:worker_threads';
export function executeProof(request, { timeoutMs = 10000, signal, onLog } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('ABORTED')); return; }
    const worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { execArgv: [] });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new Error('ABORTED'));
    const timer = setTimeout(() => finish(new Error('TIMEOUT')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.on('message', message => {
      if (message.log?.fatal) { finish(new Error(message.log.fatal)); return; }
      if (message.log) { try { onLog?.(message.log); } catch {} return; }
      finish(message.error ? new Error(message.error) : null, message.result);
    });
    worker.on('error', error => finish(error));
    worker.on('exit', code => { if (!finished) finish(new Error(`Worker exited without result: ${code}`)); });
    try { worker.postMessage(request); } catch (error) { finish(error); }
  });
}
