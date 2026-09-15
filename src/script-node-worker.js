// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort } from 'node:worker_threads';
import { run } from './script-runtime.js';
parentPort.once('message', async request => {
  try { parentPort.postMessage({ result: await run(request, log => parentPort.postMessage({ log })) }); }
  catch (error) { parentPort.postMessage({ error: { code: error.code || 'EXECUTION_ERROR', message: error.message } }); }
});
