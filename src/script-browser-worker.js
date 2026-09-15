// SPDX-License-Identifier: GPL-3.0-or-later
import { run } from './script-runtime.js';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ result: await run(data, log => self.postMessage({ log })) }); }
  catch (error) { self.postMessage({ error: { code: error.code || 'EXECUTION_ERROR', message: error.message } }); }
};
