// SPDX-License-Identifier: GPL-3.0-or-later
import { FontForgeError } from './validate.js';
export const SCRIPT_LIMITS = Object.freeze({ maxFileSystemBytes: 64 * 1024 * 1024, maxEntries: 1024, maxOutputBytes: 32 * 1024 * 1024, maxLogBytes: 65536 });
const invalid = message => { throw new FontForgeError('INVALID_REQUEST', message); };
export function validateScript({ script, args, files, outputPaths, limits }) {
  if (typeof script !== 'string' || script.includes('\0')) invalid('script must be a string without NUL.');
  if (!Array.isArray(args) || args.length > 64 || args.some(a => typeof a !== 'string' || a.includes('\0'))) invalid('args must contain up to 64 strings without NUL.');
  if (!files || typeof files !== 'object' || Array.isArray(files)) invalid('files must map paths to Uint8Array data.');
  if (!Array.isArray(outputPaths) || outputPaths.length > 64 || new Set(outputPaths).size !== outputPaths.length) invalid('Select up to 64 unique output paths.');
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) invalid('Invalid limits.');
  const budgets = { ...SCRIPT_LIMITS };
  for (const [key, value] of Object.entries(limits)) {
    if (!Object.hasOwn(budgets, key) || !Number.isSafeInteger(value) || value < 1 || value > budgets[key]) invalid('Limits must be positive integers no higher than SCRIPT_LIMITS.');
    budgets[key] = value;
  }
  const pathOK = path => typeof path === 'string' && path.startsWith('/work/') && path.length <= 1024 && path !== '/work/script.pe' && path.split('/').slice(2).every(p => p && p !== '.' && p !== '..' && !/[\\\0]/.test(p));
  let size = new TextEncoder().encode(script).length + args.reduce((n, a) => n + new TextEncoder().encode(a).length, 0);
  const copied = {};
  const entries = Object.entries(files);
  if (entries.length > 64) invalid('Supply up to 64 files.');
  for (const [path, data] of entries) {
    if (!pathOK(path) || !(data instanceof Uint8Array)) invalid('Invalid input file.');
    size += data.byteLength;
    if (size > 16 * 1024 * 1024) invalid('Inputs exceed 16 MiB.');
    copied[path] = Uint8Array.from(data);
  }
  if (size > 16 * 1024 * 1024) invalid('Inputs exceed 16 MiB.');
  for (const path of outputPaths) if (!pathOK(path) || Object.hasOwn(files, path)) invalid('Invalid output path.');
  return { script, args: [...args], files: copied, outputPaths: [...outputPaths], limits: budgets };
}
