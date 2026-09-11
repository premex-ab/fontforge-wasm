// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort } from 'node:worker_threads';
import { run } from './runtime.js';
parentPort.once('message', async data => {
  const result = await run(data);
  parentPort.postMessage(result, result.bytes ? [result.bytes.buffer] : []);
});
