// SPDX-License-Identifier: GPL-3.0-or-later
import createModule from '../dist/fontforge-core.mjs';
import { FontForgeError, validateFont, validateSfnt } from './validate.js';

import { getFormat } from './formats.js';
import { extractCollection, wrapCollection, unwrapEot, wrapEot, unpackUfo, packUfo } from './containers.js';

export async function run({ bytes, format, wasmBinary, inputFormat: hint, faceIndex }, report = () => {}) {
  try {
    let inputFormat = validateFont(bytes, hint);
    const target = getFormat(format);
    report({ stage: 'initialize', message: 'Initializing WebAssembly' });
    const module = await createModule({
      ...(wasmBinary ? { wasmBinary, locateFile: name => name } : {}),
      print() {}, printErr() {},
    });
    report({ stage: 'input', message: 'Writing font to worker memory' });
    if (inputFormat === 'ttc') {
      report({ stage:'decode', message:`Extracting collection face ${faceIndex}` });
      bytes = extractCollection(bytes, faceIndex); inputFormat = validateSfnt(bytes);
    } else if (inputFormat === 'eot') {
      report({ stage:'decode', message:'Unwrapping EOT font' });
      bytes = unwrapEot(bytes); inputFormat = validateSfnt(bytes);
    }
    let inputPath = `/input.${inputFormat === 'suit' ? 'bin' : inputFormat}`;
    if (inputFormat === 'ufo') {
      report({ stage:'decode', message:'Unpacking UFO source files' });
      inputPath = unpackUfo(bytes, module);
    } else {
      module.FS.writeFile(inputPath, bytes);
      if (inputFormat === 'woff' || inputFormat === 'woff2') {
        report({ stage:'decode', message:`Decoding ${inputFormat.toUpperCase()} and validating embedded outlines` });
        if (module.ccall('ff_decode_webfont','number',['string','string'],[inputPath,'/decoded.sfnt'])) throw new FontForgeError('INVALID_FONT','Could not decode webfont.');
        bytes = module.FS.readFile('/decoded.sfnt'); inputFormat = validateSfnt(bytes);
        inputPath = `/decoded.${inputFormat}`; module.FS.writeFile(inputPath,bytes);
      }
    }
    if (inputFormat === 'fon' && format !== 'fon') report({stage:'decode',message:'Tracing bitmap pixels as rectangular outlines (no smoothing)'});
    const nativeExtension = format === 'eot' || format === 'ttc' ? 'ttf' : format;
    const outputPath = `/output.${nativeExtension}`;
    report({ stage: 'convert', message: 'Converting outlines with FontForge' });
    const started = performance.now();
    const result = module.ccall('ff_convert', 'number', ['string', 'string', 'number'],
      [inputPath, outputPath, target.native]);
    if (result === 6) throw new FontForgeError('UNSUPPORTED_FONT','Bitmap-only input needs tracing before outline conversion.');
    if (result === 3) throw new FontForgeError('UNSUPPORTED_FONT','CID subfonts and multiple-master fonts are not supported.');
    if (result !== 0) throw new Error(`FontForge could not convert this font (status ${result}).`);
    report({ stage: 'converted', message: 'FontForge conversion finished', durationMs: performance.now() - started });
    report({ stage: 'output', message: 'Reading and validating output font' });
    let output = format === 'ufo' ? packUfo(module) : module.FS.readFile(outputPath);
    if (!output.length) throw new Error('FontForge returned an empty output.');
    if (format === 'eot') { report({stage:'package',message:'Packaging EOT container'}); output = wrapEot(output); }
    if (format === 'ttc') { report({stage:'package',message:'Packaging single-face TrueType collection'}); output = wrapCollection(output); }
    if (!['afm','pfm','tfm'].includes(format)) {
      const detected = validateFont(output, format);
      if (detected !== format && !(['pfa','ps'].includes(detected) && ['pfa','ps'].includes(format))) throw new Error(`FontForge returned ${detected} instead of ${format}.`);
    }
    return { bytes: output };
  } catch (error) {
    return { error: { code: error.code || 'CONVERSION_FAILED', message: error.message || String(error) } };
  }
}
