import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convert} from '../src/index.js';
import {alignSfntTables} from '../src/validate.js';
function tables(bytes) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 return Array.from({length:v.getUint16(4)},(_,i)=>{const at=12+i*16;return {at,tag:v.getUint32(at),offset:v.getUint32(at+8),length:v.getUint32(at+12)}});
}
function unpad(source) {
 const rows=tables(source),end=12+16*rows.length;
 const bytes=new Uint8Array(end+rows.reduce((n,t)=>n+t.length+1,0));
 bytes.set(source.subarray(0,end));const v=new DataView(bytes.buffer);let offset=end;
 for(const t of rows){offset++;bytes.set(source.subarray(t.offset,t.offset+t.length),offset);v.setUint32(t.at+8,offset);offset+=t.length;}
 return bytes;
}
function content(bytes) {
 return tables(bytes).map(t=>{const data=bytes.slice(t.offset,t.offset+t.length);if(t.tag===0x68656164)data.fill(0,8,12);return {tag:t.tag,data}});
}
for(const fixture of ['fixture.ttf','fixture.otf','variable.ttf']) test(`unaligned ${fixture} preserves every table through WOFF2`,async()=>{
 const original=new Uint8Array(await readFile(new URL('./fixtures/'+fixture,import.meta.url)));
 const source=unpad(original),saved=source.slice();
 const normalized=alignSfntTables(source);
 assert(tables(normalized).every(t=>t.offset%4===0));assert.deepEqual(content(normalized),content(original));
 const view=new DataView(normalized.buffer);let sum=0;for(let i=0;i<normalized.length;i+=4)sum=(sum+view.getUint32(i))>>>0;assert.equal(sum,0xb1b0afba);
 const packed=await convert(source,{format:'woff2'});
 const decoded=await convert(packed,{format:fixture.endsWith('.otf')?'otf':'ttf'});
 // The WOFF2 encoder may canonicalize glyf padding; compare with its normal input output.
 const expected=await convert(await convert(original,{format:'woff2'}),{format:fixture.endsWith('.otf')?'otf':'ttf'});
 assert.deepEqual(content(decoded),content(expected));assert.deepEqual(source,saved);
 assert.strictEqual(alignSfntTables(normalized),normalized);
});
test('repacking does not accept an out-of-bounds table',async()=>{
 const source=unpad(new Uint8Array(await readFile(new URL('./fixtures/fixture.ttf',import.meta.url))));
 new DataView(source.buffer).setUint32(20,source.length+1);
 assert.throws(()=>alignSfntTables(source),{code:'INVALID_FONT'});
});
