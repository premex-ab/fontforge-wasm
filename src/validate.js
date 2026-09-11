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

export function validateSfnt(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Input must be a Uint8Array.');
  if (bytes.length > MAX_INPUT_BYTES) throw new FontForgeError('INPUT_TOO_LARGE', 'Maximum input size is 16 MiB.');
  const invalid = () => { throw new FontForgeError('INVALID_FONT', 'Invalid or truncated font.'); };
  if (bytes.length < 12) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  if (signature !== 0x00010000 && signature !== 0x4f54544f) {
    throw new FontForgeError('UNSUPPORTED_FONT', 'Expected a single static TTF or CFF-based OTF font.');
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


export function validateFont(bytes, hint) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Input must be a Uint8Array.');
  if (bytes.length > MAX_INPUT_BYTES) throw new FontForgeError('INPUT_TOO_LARGE', 'Maximum input size is 16 MiB.');
  const invalid = () => { throw new FontForgeError('INVALID_FONT', 'Invalid or truncated font.'); };
  if (bytes.length < 12) invalid();
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = v.getUint32(0);
  if (signature === 0x00010000 || signature === 0x4f54544f) return validateSfnt(bytes);
  if (signature === 0x774f4646 || signature === 0x774f4632) {
    const woff2 = signature === 0x774f4632;
    const header = woff2 ? 48 : 44;
    if (bytes.length < header || v.getUint32(8) !== bytes.length || v.getUint16(14) !== 0) invalid();
    if (![0x10000, 0x4f54544f].includes(v.getUint32(4))) throw new FontForgeError('UNSUPPORTED_FONT', 'Only single-face static webfonts are supported.');
    const count = v.getUint16(12), size = v.getUint32(16);
    if (!count || count > 256 || size < 12 + count * 16) invalid();
    if (size > MAX_INPUT_BYTES) throw new FontForgeError('INPUT_TOO_LARGE', 'Decoded font exceeds 16 MiB.');
    if (woff2) {
      if (!v.getUint32(20) || v.getUint32(20) > bytes.length - 48) invalid();
    } else {
      if (44 + count * 20 > bytes.length) invalid();
      const tags = new Set();
      let total = 12 + count * 16;
      for (let i = 0; i < count; i++) {
        const at = 44 + i * 20, offset = v.getUint32(at + 4), packed = v.getUint32(at + 8), length = v.getUint32(at + 12);
        const tag = String.fromCharCode(...bytes.subarray(at, at + 4));
        if (tags.has(tag) || offset < 44 + count * 20 || offset % 4 || packed > length || offset > bytes.length || packed > bytes.length - offset) invalid();
        if (unsupported.has(tag)) throw new FontForgeError('UNSUPPORTED_FONT', `Unsupported table: ${tag}`);
        tags.add(tag); total += Math.ceil(length / 4) * 4;
      }
      if (total !== size) invalid();
    }
    return woff2 ? 'woff2' : 'woff';
  }
  if (signature === 0x74746366) {
    if (![0x10000, 0x20000].includes(v.getUint32(4))) invalid();
    const count = v.getUint32(8);
    if (!count || count > 256 || 12 + count * 4 > bytes.length) invalid();
    return 'ttc';
  }
  if (bytes.length >= 82 && v.getUint16(34, true) === 0x504c) {
    if (v.getUint32(0, true) !== bytes.length || v.getUint32(4, true) > bytes.length - 82) invalid();
    if (![0x10000, 0x20001, 0x20002].includes(v.getUint32(8, true))) invalid();
    if (v.getUint32(12, true) & (4 | 0x10000000)) throw new FontForgeError('UNSUPPORTED_FONT', 'Compressed or XOR-obfuscated EOT is not supported.');
    return 'eot';
  }
  if (signature === 0x504b0304) return 'ufo';
  if (bytes[0] === 0x80 && bytes[1] === 1) {
    let at = 0, binary = false;
    while (at < bytes.length) {
      if (at + 2 > bytes.length || bytes[at] !== 0x80) invalid();
      const type = bytes[at + 1];
      if (type === 3) { if (at + 2 !== bytes.length || !binary) invalid(); return 'pfb'; }
      if (![1, 2].includes(type) || at + 6 > bytes.length) invalid();
      const length = v.getUint32(at + 2, true);
      if (!length || length > bytes.length - at - 6) invalid();
      binary ||= type === 2; at += 6 + length;
    }
    invalid();
  }
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 16384)));
  if (text.startsWith('%!')) {
    if (/\/FontType\s+11\b|Resource-CIDFont/.test(text)) return 't11';
    if (/PS-TrueTypeFont|\/FontType\s+42\b/.test(text)) return 't42';
    if (/\/FontType\s+3\b/.test(text)) return 'pt3';
    if (/FontType|FontName|FontType1|PS-AdobeFont/.test(text)) return hint === 'ps' ? 'ps' : 'pfa';
    invalid();
  }
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*<svg\b/.test(text) || /<svg\b/.test(text)) {
    const xml = new TextDecoder().decode(bytes);
    if (!/<font[\s>]/.test(xml) || /<!ENTITY|<!DOCTYPE[^>]*\[|<script[\s>]|<image[\s>]/i.test(xml)) invalid();
    return 'svg';
  }
  if (bytes[0] === 1 && bytes[2] >= 4 && bytes[2] <= bytes.length && bytes[3] >= 1 && bytes[3] <= 4) return 'cff';
  // Mac resource forks are not signature-based: require bounded data/map areas.
  if (bytes.length >= 256) {
    const data = v.getUint32(0), map = v.getUint32(4), dataSize = v.getUint32(8), mapSize = v.getUint32(12);
    if (data >= 16 && map >= 16 && dataSize > 0 && mapSize >= 28 && data <= bytes.length && dataSize <= bytes.length-data && map <= bytes.length && mapSize <= bytes.length-map) return 'dfont';
    if (bytes[0] === 0 && bytes[1] > 0 && bytes[1] <= 63 && bytes[74] === 0 && bytes[82] === 0) {
      const dataLength = v.getUint32(83), resourceLength = v.getUint32(87);
      if (resourceLength > 0 && 128 + Math.ceil(dataLength / 128) * 128 + resourceLength <= bytes.length) return hint === 'bin' ? 'bin' : 'suit';
    }
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a && bytes.length >= 64) {
    const at = v.getUint32(60, true);
    if (at > bytes.length - 40 || v.getUint16(at, true) !== 0x454e) invalid();
    return 'fon';
  }
  if (hint && ['afm', 'pfm', 'tfm'].includes(hint)) throw new FontForgeError('UNSUPPORTED_FONT', 'Metrics files contain no outlines and are export-only.');
  throw new FontForgeError('UNSUPPORTED_FONT', 'Unrecognized or unsupported font. Use a supported static font or a ZIP containing one UFO.');
}
