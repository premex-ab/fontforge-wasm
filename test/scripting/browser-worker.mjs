// SPDX-License-Identifier: GPL-3.0-or-later
import { run } from './runtime.mjs';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ result: await run(data, log => self.postMessage({ log })) }); }
  catch (error) { self.postMessage({ error: `${error?.name}: ${error?.message || String(error)}\n${error?.stack || ""}` }); }
};
