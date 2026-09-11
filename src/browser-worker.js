// SPDX-License-Identifier: GPL-3.0-or-later
import { run } from './runtime.js';
self.onmessage = async ({ data }) => {
  const result = await run(data, progress => self.postMessage({ progress }));
  self.postMessage(result, result.bytes ? [result.bytes.buffer] : []);
};
