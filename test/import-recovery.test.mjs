import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{convert,inspectFont}from'../src/index.js';
function os2(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<v.getUint16(4);i++){const at=12+i*16;if(v.getUint32(at)===0x4f532f32)return v.getUint32(at+8)}throw Error('Missing OS/2')}
test('restricted outlines need explicit permission and retain their embedding flags',async()=>{
 const source=new Uint8Array(await readFile('test/fixtures/fixture.otf'));new DataView(source.buffer).setUint16(os2(source)+8,0x102);
 assert.equal((await inspectFont(source)).requiresEditPermission,true);
 await assert.rejects(convert(source,{format:'ttf'}),{code:'FONT_PERMISSION_REQUIRED'});
 const output=await convert(source,{format:'ttf',allowRestricted:true});assert.equal(new DataView(output.buffer,output.byteOffset).getUint16(os2(output)+8),0x102);
 assert((await convert(source,{format:'woff2'})).length>0,'container wrapping preserves the restricted font without editing outlines');
 await assert.rejects(convert(source,{format:'ttf',allowRestricted:'yes'}),TypeError);
});
test('WOFF2 output is bounded independently of its estimated SFNT size',async()=>{
 const source=new Uint8Array(await readFile('test/fixtures/fixture.ttf'));const compressed=await convert(source,{format:'woff2'});const v=new DataView(compressed.buffer,compressed.byteOffset,compressed.byteLength);
 v.setUint32(16,v.getUint32(16)-4);const decoded=await convert(compressed,{format:'ttf'});assert.deepEqual(decoded,await convert(await convert(source,{format:'woff2'}),{format:'ttf'}));
 v.setUint32(16,17*1024*1024);await assert.rejects(convert(compressed,{format:'ttf'}));
});

test('WOFF wrapping preserves variable axes without selecting an instance',async()=>{
 const input=new Uint8Array(await readFile('test/fixtures/variable.ttf'));const woff=await convert(input,{format:'woff'});
 assert.deepEqual(await inspectFont(woff),await inspectFont(input));
 const roundtrip=await convert(woff,{format:'ttf'});const tables=bytes=>{const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return Array.from({length:v.getUint16(4)},(_,i)=>{const at=12+i*16,tag=v.getUint32(at),start=v.getUint32(at+8),data=bytes.slice(start,start+v.getUint32(at+12));if(tag===0x68656164)data.fill(0,8,12);return {tag,data}})};
 assert.deepEqual(tables(roundtrip),tables(input));
});
