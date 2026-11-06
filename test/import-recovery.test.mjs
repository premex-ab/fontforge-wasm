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

test('TrueType-specific head flags do not shift CFF outline positions',async()=>{
 const source=new Uint8Array(await readFile('test/fixtures/fixture.otf'));
 function table(bytes,tag){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<v.getUint16(4);i++){const at=12+16*i;if(v.getUint32(at)===tag)return [v.getUint32(at+8),v.getUint32(at+12)]}}
 const view=new DataView(source.buffer);const [head]=table(source,0x68656164);view.setUint16(head+16,view.getUint16(head+16)|2);const before=await convert(source,{format:'ttf'});
 view.setUint16(head+16,view.getUint16(head+16)&~2);const after=await convert(source,{format:'ttf'});
 for(const tag of [0x676c7966,0x686d7478]){const [a,al]=table(before,tag),[b,bl]=table(after,tag);assert.deepEqual(before.slice(a,a+al),after.slice(b,b+bl))}
});

test('legacy Apple TrueType headers convert without mutating input or losing glyph tables',async()=>{
 const original=new Uint8Array(await readFile('test/fixtures/fixture.ttf'));
 const legacy=Uint8Array.from(original);new DataView(legacy.buffer).setUint32(0,0x74727565);
 const saved=Uint8Array.from(legacy);
 const ttf=await convert(legacy,{format:'ttf'});assert.equal(new DataView(ttf.buffer).getUint32(0),0x10000);
 assert.deepEqual(legacy,saved);assert.deepEqual((await inspectFont(legacy)).axes,[]);
 let sum=0;for(let at=0;at<ttf.length;at+=4){let word=0;for(let j=0;j<4;j++)word=(word<<8)|(ttf[at+j]||0);sum=(sum+(word>>>0))>>>0;}assert.equal(sum,0xb1b0afba);
 const table=(bytes,tag)=>{const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<v.getUint16(4);i++){const at=12+16*i;if(String.fromCharCode(...bytes.slice(at,at+4))===tag)return bytes.slice(v.getUint32(at+8),v.getUint32(at+8)+v.getUint32(at+12));}throw Error(tag)};
 for(const format of ['woff','woff2']) {
  const packed=await convert(legacy,{format});const roundtrip=await convert(packed,{format:'ttf'});
  for(const tag of ['cmap','hmtx','maxp'])assert.deepEqual(table(roundtrip,tag),table(original,tag));
 }
 assert((await convert(legacy,{format:'otf'})).length>0);
 const broken=legacy.slice(0,20);await assert.rejects(convert(broken,{format:'woff2'}),{code:'INVALID_FONT'});
});

test('CFF outlines mislabeled as TrueType normalize without losing tables or mutating input',async()=>{
 const {normalizeTrueType,validateSfnt}=await import('../src/validate.js');
 const original=new Uint8Array(await readFile('test/fixtures/fixture.otf'));
 const wrong=Uint8Array.from(original);new DataView(wrong.buffer).setUint32(0,0x10000);const saved=Uint8Array.from(wrong);
 const fixed=normalizeTrueType(wrong);assert.equal(new DataView(fixed.buffer).getUint32(0),0x4f54544f);assert.deepEqual(wrong,saved);
 const table=(bytes,tag)=>{const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<v.getUint16(4);i++){const p=12+16*i;if(String.fromCharCode(...bytes.slice(p,p+4))===tag)return bytes.slice(v.getUint32(p+8),v.getUint32(p+8)+v.getUint32(p+12));}throw Error(tag)};
 for(const tag of ['CFF ','cmap','hmtx','maxp','name','OS/2'])assert.deepEqual(table(fixed,tag),table(original,tag));
 let sum=0;for(let at=0;at<fixed.length;at+=4){let word=0;for(let j=0;j<4;j++)word=(word<<8)|(fixed[at+j]||0);sum=(sum+(word>>>0))>>>0}assert.equal(sum,0xb1b0afba);
 assert.deepEqual(await inspectFont(wrong),await inspectFont(original));
 for(const format of ['ttf','woff','woff2'])assert.deepEqual(await convert(wrong,{format}),await convert(fixed,{format}));
 const truncated=wrong.slice(0,100);assert.throws(()=>normalizeTrueType(truncated),{code:'INVALID_FONT'});
 // A partial TrueType outline set is ambiguous and must not be relabeled.
 const mixed=Uint8Array.from(wrong),v=new DataView(mixed.buffer);for(let i=0;i<v.getUint16(4);i++){const p=12+16*i;if(v.getUint32(p)===0x706f7374)v.setUint32(p,0x676c7966)}
 assert.throws(()=>validateSfnt(mixed),{code:'INVALID_FONT'});
});

test('nameless subsets retain outlines and metrics when converted to OTF',async()=>{
 const {validateSfnt}=await import('../src/validate.js');
 function without(input,tag){const b=Uint8Array.from(input),v=new DataView(b.buffer);const count=v.getUint16(4);let out=0;for(let i=0;i<count;i++){const at=12+i*16;if(String.fromCharCode(...b.slice(at,at+4))===tag)continue;b.copyWithin(12+out*16,at,at+16);out++}v.setUint16(4,out);const power=2**Math.floor(Math.log2(out));v.setUint16(6,power*16);v.setUint16(8,Math.log2(power));v.setUint16(10,out*16-power*16);return b}
 function table(bytes,tag){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<v.getUint16(4);i++){const at=12+16*i;if(String.fromCharCode(...bytes.slice(at,at+4))===tag)return bytes.slice(v.getUint32(at+8),v.getUint32(at+8)+v.getUint32(at+12));}throw Error(tag)}
 for(const kind of ['ttf','otf']){
  const source=new Uint8Array(await readFile('test/fixtures/fixture.'+kind));const nameless=without(source,'name'),saved=Uint8Array.from(nameless);
  assert.equal(validateSfnt(nameless),kind);assert.deepEqual(await inspectFont(nameless),await inspectFont(source));
  const output=await convert(nameless,{format:'otf'}),reference=await convert(source,{format:'otf'});
  assert.equal(validateSfnt(output),'otf');assert.deepEqual(nameless,saved);if(kind==='ttf')assert(table(output,'name').length>0);
  for(const tag of ['cmap','hmtx','maxp'])assert.deepEqual(table(output,tag),table(reference,tag));
  if(kind==='ttf')for(const required of ['head','hhea','hmtx','maxp','cmap','glyf','loca'])assert.throws(()=>validateSfnt(without(nameless,required)),{code:'INVALID_FONT'});
 }
});
