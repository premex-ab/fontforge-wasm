import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{convert,inspectFont,MAX_INPUT_BYTES}from'../src/index.js';
// Keep the public fixture intact, but add a private-use table beyond the old limit.
export function largeFont(source) {
 const v=new DataView(source.buffer,source.byteOffset,source.byteLength),n=v.getUint16(4),shift=16;
 const bytes=new Uint8Array(18*1024*1024),out=new DataView(bytes.buffer);bytes.set(source.subarray(0,12+n*16));
 bytes.set(source.subarray(12+n*16),12+(n+1)*16);out.setUint16(4,n+1);
 for(let i=0;i<n;i++){const at=12+16*i;out.setUint32(at+8,v.getUint32(at+8)+shift);}
 const at=12+16*n,offset=Math.ceil((source.length+shift)/4)*4;
 out.setUint32(at,0x5a5a5a5a);out.setUint32(at+4,0);out.setUint32(at+8,offset);out.setUint32(at+12,bytes.length-offset);
 let seed=1;for(let i=offset;i<bytes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed&255;}
 const power=Math.floor(Math.log2(n+1));out.setUint16(6,16*2**power);out.setUint16(8,power);out.setUint16(10,(n+1)*16-16*2**power);
 return bytes;
}
test('large public variable font can be inspected, instanced and wrapped',{timeout:120000},async()=>{
 const small=new Uint8Array(await readFile(new URL('./fixtures/variable.ttf',import.meta.url))),source=largeFont(small),saved=source.slice();
 assert.deepEqual(await inspectFont(source),await inspectFont(small));
 const info=await inspectFont(source),variations=Object.fromEntries(info.axes.map(a=>[a.tag,a.default]));
 const staticFont=await convert(source,{format:'ttf',variations,timeoutMs:120000});assert.deepEqual((await inspectFont(staticFont)).axes,[]);
 const packed=await convert(source,{format:'woff2',timeoutMs:120000});assert.deepEqual(await inspectFont(packed),info);assert.deepEqual(source,saved);
});
test('25 MiB remains a hard input bound',async()=>{
 assert.equal(MAX_INPUT_BYTES,25*1024*1024);
 await assert.rejects(convert(new Uint8Array(MAX_INPUT_BYTES+1),{format:'ttf'}),{code:'INPUT_TOO_LARGE'});
 await assert.rejects(inspectFont(new Uint8Array(MAX_INPUT_BYTES+1)),{code:'INPUT_TOO_LARGE'});
});
