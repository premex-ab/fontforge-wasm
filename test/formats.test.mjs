// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {convert,FORMATS} from '../src/index.js';
import {validateFont} from '../src/validate.js';
import {zipFiles} from '../src/containers.js';
const root=new URL('./fixtures/',import.meta.url);
const outputDir=new URL('./results/formats/',import.meta.url);
await mkdir(outputDir,{recursive:true});
const ttf=await readFile(new URL('fixture.ttf',root));
for(const f of FORMATS.filter(f=>f.output)) {
  test(`TTF → ${f.id} and supported import`,async()=>{
    const bytes=await convert(ttf,{format:f.id});
    assert.ok(bytes.length>20);
    await writeFile(new URL(`fixture.${f.extension||f.id}`,outputDir),bytes);
    if(f.input) {
      assert.equal(validateFont(bytes,f.id),f.id);
      for(const target of ['ttf','woff','woff2']) {
        const back=await convert(bytes,{format:target,inputFormat:f.id});
        assert.equal(validateFont(back),target);
        await writeFile(new URL(`${f.id}-back.${target}`,outputDir),back);
      }
    } else {
      await assert.rejects(convert(bytes,{format:'ttf',inputFormat:f.id}),{code:'UNSUPPORTED_FONT'});
    }
  });
}
test('independent webfonts, CFF-flavoured webfonts and multi-face TTC',async()=>{
  for(const from of ['ttf','otf'])for(const wrapper of ['woff','woff2']) {
    const input=await readFile(new URL(`${from}.${wrapper}`,root));
    for(const format of ['ttf','otf','woff','woff2']) {
      const bytes=await convert(input,{format});
      assert.equal(validateFont(bytes),format);
      await writeFile(new URL(`${from}-${wrapper}-to-${format}.${format}`,outputDir),bytes);
    }
  }
  const collection=await readFile(new URL('collection.ttc',root));
  for(const faceIndex of [0,1])await writeFile(new URL(`face-${faceIndex}.ttf`,outputDir),await convert(collection,{format:'ttf',faceIndex}));
  await assert.rejects(convert(collection,{format:'ttf',faceIndex:2}),{code:'INVALID_FACE_INDEX'});
});
test('rejects compressed unsupported tables and oversized decoded fonts',async()=>{
  for(const extension of ['woff','woff2']) {
    const invalid=await readFile(new URL(`variable.${extension}`,root));
    await assert.rejects(convert(invalid,{format:'ttf'}),{code:'UNSUPPORTED_FONT'});
    const bytes=Buffer.from(await readFile(new URL(`ttf.${extension}`,root)));
    bytes.writeUInt32BE(17*1024*1024,16);
    await assert.rejects(convert(bytes,{format:'ttf'}),{code:'INPUT_TOO_LARGE'});
    const corrupt=Buffer.from(await readFile(new URL(`ttf.${extension}`,root)));
    corrupt.fill(0,extension==='woff'?44+corrupt.readUInt16BE(12)*20:48);
    await assert.rejects(convert(corrupt,{format:'ttf'}));
  }
});
test('ZIP traversal, duplicate paths, malformed archives and checksum failures',async()=>{
  const text=new TextEncoder().encode('bad');
  for(const files of [[['../font.ufo/metainfo.plist',text]],[['font.ufo/metainfo.plist',text],['font.ufo/metainfo.plist',text]]]) {
    await assert.rejects(convert(zipFiles(files),{format:'ttf'}),{code:'INVALID_FONT'});
  }
  const zip=zipFiles([['font.ufo/metainfo.plist',text]]);zip[30+'font.ufo/metainfo.plist'.length]^=1;
  await assert.rejects(convert(zip,{format:'ttf'}),{code:'INVALID_FONT'});
});
test('imports a deflated UFO ZIP produced independently',async()=>{
  const zipped=await readFile(new URL('compressed.ufo.zip',root));
  const bytes=await convert(zipped,{format:'ttf'});
  await writeFile(new URL('compressed-ufo-back.ttf',outputDir),bytes);
});
test('complete supported source/output matrix',async()=>{
  const sources=new Map();
  for(const source of FORMATS.filter(f=>f.input && f.output))sources.set(source.id,await convert(ttf,{format:source.id}));
  sources.set('pcf', await readFile(new URL('fixture.pcf',root)));
  let checked=0;
  for(const [inputFormat,bytes]of sources)for(const target of FORMATS.filter(f=>f.output)) {
    const output=await convert(bytes,{format:target.id,inputFormat});
    assert.ok(output.length>20,`${inputFormat} → ${target.id}`);
    if(target.input)assert.equal(validateFont(output,target.id),target.id,`${inputFormat} → ${target.id}`);
    checked++;
  }
  console.log(`Verified ${checked} source/output combinations with the actual WASM engine`);
});

test('independent PCF input preserves characters through outline exports and is import-only',async()=>{
  const input=await readFile(new URL('fixture.pcf',root));
  for (const format of ['ttf','woff','woff2']) {
    const output=await convert(input,{format,inputFormat:'pcf'});
    await writeFile(new URL(`pcf-back.${format}`,outputDir),output);
  }
  await assert.rejects(convert(ttf,{format:'pcf'}),{code:'UNSUPPORTED_FORMAT'});
  await assert.rejects(convert(input.subarray(0,100),{format:'ttf'}),{code:'INVALID_FONT'});
});
