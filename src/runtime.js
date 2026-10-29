// SPDX-License-Identifier: GPL-3.0-or-later
import createModule from '../dist/fontforge-core.mjs';
import { FontForgeError, validateFont, validateSfnt, requiresEditPermission } from './validate.js';

import { getFormat } from './formats.js';
import { extractCollection, wrapCollection, unwrapEot, wrapEot, unpackUfo, packUfo } from './containers.js';

export async function run({ bytes, format, wasmBinary, inputFormat: hint, faceIndex, variations, allowRestricted }, report = () => {}) {
  try {
    let inputFormat = validateFont(bytes, hint, {preserveTables:true});
    const target = getFormat(format);
    report({ stage: 'initialize', message: 'Initializing WebAssembly' });
    const module = await createModule({
      ...(wasmBinary ? { wasmBinary, locateFile: name => name } : {}),
      print() {}, printErr() {},
    });
    report({ stage: 'input', message: 'Writing font to worker memory' });
    if (inputFormat === 'ttc') {
      report({ stage:'decode', message:`Extracting collection face ${faceIndex}` });
      bytes = extractCollection(bytes, faceIndex); inputFormat = validateSfnt(bytes, {preserveTables:true});
    } else if (inputFormat === 'eot') {
      report({ stage:'decode', message:'Unwrapping EOT font' });
      bytes = unwrapEot(bytes); inputFormat = validateSfnt(bytes, {preserveTables:true});
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
        bytes = module.FS.readFile('/decoded.sfnt'); inputFormat = validateSfnt(bytes, {preserveTables:true});
        inputPath = `/decoded.${inputFormat}`; module.FS.writeFile(inputPath,bytes);
      }
    }
    if (['ttf','otf'].includes(inputFormat) && requiresEditPermission(bytes) && !allowRestricted &&
        (variations !== undefined || ![inputFormat,'woff','woff2'].includes(format)))
      throw new FontForgeError('FONT_PERMISSION_REQUIRED','This font is marked restricted. Confirm that you have permission to modify it before converting its outlines.');
    if (variations !== undefined) {
      if (!['ttf','otf'].includes(inputFormat)) throw new FontForgeError('INVALID_VARIATION','Static instancing requires an OpenType variable font.');
      report({stage:'instance',message:'Creating a static font at the selected axis values'});
      const coordinates=Object.entries(variations).map(([tag,value])=>`${tag}=${value}`).join(',');
      if (module.ccall('ff_instance','number',['string','string','string'],[inputPath,'/instance.sfnt',coordinates]))
        throw new FontForgeError('INVALID_VARIATION','Could not create a static instance. Check that every axis and value is supported by this font.');
      bytes=module.FS.readFile('/instance.sfnt');inputFormat=validateSfnt(bytes);
      inputPath=`/instance.${inputFormat}`;module.FS.writeFile(inputPath,bytes);
    }
    // Repackage rather than redraw: retain variation/color/CID tables and glyph IDs.
    if (['ttf','otf'].includes(inputFormat)) {
      if (format === inputFormat) return {bytes};
      if (format === 'woff2' || format === 'woff') {
        report({stage:'package',message:'Compressing original font tables as a webfont'});
        if (module.ccall(format === 'woff' ? 'ff_encode_woff' : 'ff_encode_woff2','number',['string','string'],[inputPath,'/packed.'+format]))
          throw new FontForgeError('CONVERSION_FAILED','Could not compress font tables.');
        const output = module.FS.readFile('/packed.'+format);
        validateFont(output, format, {preserveTables:true});
        return {bytes:output};
      }
      // Outline editing still requires a static font; never silently drop axes.
      validateSfnt(bytes);
    }
    if (inputFormat === 'fon' && format !== 'fon') report({stage:'decode',message:'Tracing bitmap pixels as rectangular outlines (no smoothing)'});
    const nativeExtension = format === 'eot' || format === 'ttc' ? 'ttf' : format;
    const outputPath = `/output.${nativeExtension}`;
    report({ stage: 'convert', message: 'Converting outlines with FontForge' });
    const started = performance.now();
    const result = module.ccall('ff_convert_with_options', 'number', ['string', 'string', 'number', 'number'],
      [inputPath, outputPath, target.native, allowRestricted ? 1 : 0]);
    if (result === 6) throw new FontForgeError('UNSUPPORTED_FONT','Bitmap-only input needs tracing before outline conversion.');
    if (result === 3) throw new FontForgeError('UNSUPPORTED_FONT','Multiple-master fonts require a static instance.');
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
