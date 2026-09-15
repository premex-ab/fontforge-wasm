// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort } from 'node:worker_threads';
import { run } from './runtime.mjs';
parentPort.once('message', async request => {
  try { parentPort.postMessage({ result: await run(request, log => parentPort.postMessage({ log })) }); }
  catch (error) { parentPort.postMessage({ error: error.message }); }
});
