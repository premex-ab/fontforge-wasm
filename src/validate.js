// SPDX-License-Identifier: GPL-3.0-or-later
export class FontForgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FontForgeError';
    this.code = code;
  }
}

export const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const unsupported = new Set(['fvar', 'CFF2', 'COLR', 'CBDT', 'sbix', 'SVG ']);

export function validateFont(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Input must be a Uint8Array.');
  if (bytes.length > MAX_INPUT_BYTES) throw new FontForgeError('INPUT_TOO_LARGE', 'Maximum input size is 16 MiB.');
  const invalid = () => { throw new FontForgeError('INVALID_FONT', 'Invalid or truncated SFNT font.'); };
  if (bytes.length < 12) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x4f54544f) {
    throw new FontForgeError('UNSUPPORTED_FONT', 'This alpha accepts single static TTF and CFF-based OTF fonts. Decode WOFF/WOFF2 first.');
  }
  const count = view.getUint16(4);
  if (!count || count > 256 || 12 + count * 16 > bytes.length) invalid();
  const tables = new Set();
  for (let i = 0; i < count; i++) {
    const position = 12 + 16 * i;
    const tag = String.fromCharCode(...bytes.subarray(position, position + 4));
    const offset = view.getUint32(position + 8);
    const length = view.getUint32(position + 12);
    if (tables.has(tag) || offset > bytes.length || length > bytes.length - offset) invalid();
    if (unsupported.has(tag)) throw new FontForgeError('UNSUPPORTED_FONT', `Unsupported table in this alpha: ${tag}`);
    tables.add(tag);
  }
  for (const required of ['head', 'hhea', 'hmtx', 'maxp', 'cmap', 'name']) {
    if (!tables.has(required)) invalid();
  }
  if (signature === 0x00010000 && (!tables.has('glyf') || !tables.has('loca'))) invalid();
  if (signature === 0x4f54544f && !tables.has('CFF ')) invalid();
  return signature === 0x00010000 ? 'ttf' : 'otf';
}
