// SPDX-License-Identifier: GPL-3.0-or-later
import createModule from '../dist/fontforge-core.mjs';
import { validateFont } from './validate.js';

export async function run({ bytes, format, wasmBinary }, report = () => {}) {
  try {
    const inputFormat = validateFont(bytes);
    report({ stage: 'initialize', message: 'Initializing WebAssembly' });
    const module = await createModule({
      ...(wasmBinary ? { wasmBinary, locateFile: name => name } : {}),
      print() {}, printErr() {},
    });
    report({ stage: 'input', message: 'Writing font to worker memory' });
    module.FS.writeFile(`/input.${inputFormat}`, bytes);
    report({ stage: 'convert', message: 'Converting outlines with FontForge' });
    const started = performance.now();
    const result = module.ccall('ff_convert', 'number', ['string', 'string', 'number'],
      [`/input.${inputFormat}`, `/output.${format}`, format === 'ttf' ? 1 : 2]);
    if (result !== 0) throw new Error(`FontForge could not convert this font (status ${result}).`);
    report({ stage: 'converted', message: 'FontForge conversion finished', durationMs: performance.now() - started });
    report({ stage: 'output', message: 'Reading and validating output font' });
    const output = module.FS.readFile(`/output.${format}`);
    if (validateFont(output) !== format) throw new Error('FontForge returned an unexpected output format.');
    return { bytes: output };
  } catch (error) {
    return { error: { code: error.code || 'CONVERSION_FAILED', message: error.message || String(error) } };
  }
}
