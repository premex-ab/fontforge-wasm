import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {convert} from '../src/index.js';
const root=new URL('./fixtures/',import.meta.url);
function tables(bytes){const b=Buffer.from(bytes);const out=new Map();for(let i=0;i<b.readUInt16BE(4);i++){let p=12+i*16;out.set(b.toString('ascii',p,p+4),b.subarray(b.readUInt32BE(p+8),b.readUInt32BE(p+8)+b.readUInt32BE(p+12)));}return out;}
test('CID conversion no longer rejects subfonts; webfont wrapping retains original CFF tables',async()=>{
 const input=await readFile(new URL('cid.otf',root));const packed=await convert(input,{format:'woff2'});const decoded=await convert(packed,{format:'otf'});
 const a=tables(input),b=tables(decoded);for(const tag of ['CFF ','cmap','hmtx','maxp'])assert.deepEqual(a.get(tag),b.get(tag));
 const ttf=await convert(input,{format:'ttf'});assert(tables(ttf).has('glyf'));assert(tables(ttf).get('maxp').readUInt16BE(4)>=a.get('maxp').readUInt16BE(4));
});
test('variable webfonts retain the variation table through decode and encode',async()=>{
 const input=await readFile(new URL('variable.woff2',root));const ttf=await convert(input,{format:'ttf'});assert(tables(ttf).has('fvar'));
 const packed=await convert(ttf,{format:'woff2'});const back=await convert(packed,{format:'ttf'});assert.deepEqual(tables(ttf).get('fvar'),tables(back).get('fvar'));
 await assert.rejects(convert(ttf,{format:'pfb'}),e=>e.code==='STATIC_INSTANCE_REQUIRED' && /static font instance/.test(e.message));
});
