// SPDX-License-Identifier: GPL-3.0-or-later
import { FontForgeError, MAX_INPUT_BYTES, validateSfnt } from './validate.js';
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const bad = message => { throw new FontForgeError('INVALID_FONT', message); };
function table(bytes, tag) {
  const v = view(bytes);
  for (let i=0;i<v.getUint16(4);i++) {
    const at=12+i*16;
    if (String.fromCharCode(...bytes.subarray(at,at+4)) === tag) return bytes.subarray(v.getUint32(at+8), v.getUint32(at+8)+v.getUint32(at+12));
  }
}
export function extractCollection(bytes, index = 0) {
  const v=view(bytes), count=v.getUint32(8);
  if (!Number.isInteger(index) || index<0 || index>=count) throw new FontForgeError('INVALID_FACE_INDEX', `Choose a face index from 0 to ${count-1}.`);
  const offset=v.getUint32(12+4*index);
  if (offset>bytes.length-12) bad('Invalid collection face offset.');
  const n=v.getUint16(offset+4);
  if (!n || n>256 || offset+12+n*16>bytes.length) bad('Invalid collection table directory.');
  let size=12+n*16;
  const records=[];
  for (let i=0;i<n;i++) {
    const at=offset+12+16*i, pos=v.getUint32(at+8), len=v.getUint32(at+12);
    if (pos>bytes.length || len>bytes.length-pos) bad('Invalid collection table.');
    records.push({at,pos,len,out:size});size+=Math.ceil(len/4)*4;
    if (size>MAX_INPUT_BYTES) throw new FontForgeError('INPUT_TOO_LARGE','Collection face exceeds 16 MiB.');
  }
  const result=new Uint8Array(size), rv=view(result);
  result.set(bytes.subarray(offset,offset+12+n*16));
  for (const [i,r] of records.entries()) { result.set(bytes.subarray(r.pos,r.pos+r.len),r.out);rv.setUint32(12+16*i+8,r.out); }
  // The standalone SFNT checksum differs from the collection's offsets.
  const head=table(result,'head');
  if (head?.length>=12) {
    view(head).setUint32(8,0);let sum=0;
    for (let i=0;i<result.length;i+=4) sum=(sum+rv.getUint32(i))>>>0;
    view(head).setUint32(8,(0xb1b0afba-sum)>>>0);
  }
  validateSfnt(result);return result;
}
export function wrapCollection(bytes) {
  const result=new Uint8Array(bytes.length+16), v=view(result);
  v.setUint32(0,0x74746366);v.setUint32(4,0x10000);v.setUint32(8,1);v.setUint32(12,16);result.set(bytes,16);
  const head=table(bytes,'head');
  for (let i=0;i<view(bytes).getUint16(4);i++) { const at=28+16*i;v.setUint32(at+8,v.getUint32(at+8)+16); }
  if (head?.length>=12) v.setUint32(16+head.byteOffset-bytes.byteOffset+8,0);
  return result;
}
export function unwrapEot(bytes) {
  const v=view(bytes), size=v.getUint32(4,true);
  const result=bytes.slice(bytes.length-size);validateSfnt(result);return result;
}
export function wrapEot(bytes) {
  const os2=table(bytes,'OS/2'), head=table(bytes,'head'), names=table(bytes,'name');
  if (!os2 || os2.length<64 || !head || !names) bad('EOT needs OS/2, head and name tables.');
  const nv=view(names), strings=[];
  for (const id of [1,2,5,4]) {
    let text=new Uint8Array();
    for (let i=0;i<nv.getUint16(2);i++) {
      const at=6+12*i;if (at+12>names.length) bad('Invalid name table.');
      if (nv.getUint16(at)===3 && nv.getUint16(at+6)===id) {
        const len=nv.getUint16(at+8), offset=nv.getUint16(4)+nv.getUint16(at+10);
        if (offset+len>names.length || len%2) bad('Invalid font name.');
        text=names.slice(offset,offset+len);
        for(let j=0;j<len;j+=2) [text[j],text[j+1]]=[text[j+1],text[j]];
        if(nv.getUint16(at+4)===0x409) break;
      }
    }
    strings.push(text);
  }
  const headerSize=80+strings.reduce((sum,s)=>sum+4+s.length,0);
  const result=new Uint8Array(headerSize+bytes.length), v=view(result), o=view(os2);
  v.setUint32(0,result.length,true);v.setUint32(4,bytes.length,true);v.setUint32(8,0x10000,true);
  result.set(os2.subarray(32,42),16);result[26]=1;result[27]=o.getUint16(62)&1;
  v.setUint32(28,o.getUint16(4),true);v.setUint16(32,o.getUint16(8),true);v.setUint16(34,0x504c,true);
  for(let i=0;i<4;i++) v.setUint32(36+i*4,o.getUint32(42+i*4),true);
  if(os2.length>=86) {v.setUint32(52,o.getUint32(78),true);v.setUint32(56,o.getUint32(82),true);}
  v.setUint32(60,view(head).getUint32(8),true);
  let at=80;
  for(const s of strings) {v.setUint16(at+2,s.length,true);result.set(s,at+4);at+=4+s.length;}
  result.set(bytes,at);return result;
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
export function zipFiles(files) {
  const encoder=new TextEncoder(), parts=[], directory=[];let offset=0;
  for(const [name,bytes] of files) {
    const encoded=encoder.encode(name), checksum=crc(bytes), local=new Uint8Array(30+encoded.length), v=view(local);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,encoded.length,true);local.set(encoded,30);
    const central=new Uint8Array(46+encoded.length), c=view(central);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,checksum,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,encoded.length,true);c.setUint32(42,offset,true);central.set(encoded,46);
    parts.push(local,bytes);directory.push(central);offset+=local.length+bytes.length;
  }
  const size=directory.reduce((n,b)=>n+b.length,0), end=new Uint8Array(22), e=view(end);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+size+22);let at=0;for(const part of [...parts,...directory,end]){result.set(part,at);at+=part.length;}return result;
}
export function unpackUfo(bytes, module) {
  const v=view(bytes);let end=bytes.length-22;
  while(end>=Math.max(0,bytes.length-65557) && v.getUint32(end,true)!==0x06054b50)end--;
  if(end<0 || v.getUint32(end,true)!==0x06054b50 || end+22+v.getUint16(end+20,true)!==bytes.length) bad('Invalid UFO ZIP directory.');
  const count=v.getUint16(end+10,true), directory=v.getUint32(end+16,true);
  if(!count || count>4096 || v.getUint16(end+4,true) || v.getUint16(end+6,true) || v.getUint16(end+8,true)!==count || directory+v.getUint32(end+12,true)!==end)bad('Unsupported UFO ZIP structure.');
  let at=directory,total=0;const files=[],seen=new Set();
  for(let i=0;i<count;i++) {
    if(at+46>end || v.getUint32(at,true)!==0x02014b50)bad('Invalid UFO ZIP entry.');
    const method=v.getUint16(at+10,true), packed=v.getUint32(at+20,true), size=v.getUint32(at+24,true), length=v.getUint16(at+28,true), local=v.getUint32(at+42,true), next=at+46+length+v.getUint16(at+30,true)+v.getUint16(at+32,true);
    if(next>end || v.getUint16(at+8,true)&1 || ![0,8].includes(method) || size>MAX_INPUT_BYTES || (total+=size)>MAX_INPUT_BYTES*4)bad('Unsupported or oversized UFO ZIP entry.');
    const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(at+46,at+46+length));
    if(!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').some(p=>p==='.'||p==='..') || seen.has(name))bad('Unsafe or duplicate UFO ZIP path.');
    seen.add(name);
    if(local+30>directory || v.getUint32(local,true)!==0x04034b50)bad('Invalid UFO ZIP local header.');
    const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
    if(start>directory || packed>directory-start)bad('Truncated UFO ZIP data.');
    let content=bytes.slice(start,start+packed);
    if(method===8) {
      module.FS.writeFile('/packed',content);
      if(module.ccall('ff_inflate_raw','number',['string','string','number'],['/packed','/unpacked',size]))bad('Could not decompress UFO ZIP entry.');
      content=module.FS.readFile('/unpacked');module.FS.unlink('/packed');module.FS.unlink('/unpacked');
    }
    if(content.length!==size || crc(content)!==v.getUint32(at+16,true))bad('UFO ZIP checksum mismatch.');
    if(!name.endsWith('/'))files.push([name,content]);at=next;
  }
  if(at!==end)bad('Invalid UFO ZIP directory length.');
  const roots=files.filter(([name])=>/(^|\/)metainfo\.plist$/.test(name));
  if(roots.length!==1)bad('Upload a ZIP containing exactly one UFO font.');
  const root=roots[0][0].slice(0,-'metainfo.plist'.length);
  if (!files.some(([name]) => name === root + 'glyphs/contents.plist')) bad('UFO is missing its default glyph layer.');
  module.FS.mkdir('/input.ufo');
  for(const [name,content]of files) {
    if(!name.startsWith(root))continue;
    const relative=name.slice(root.length);if(!relative)continue;
    if(/\.(plist|glif|xml)$/i.test(relative)) {
      const text=new TextDecoder().decode(content);
      if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text))bad('XML entities are not supported in UFO files.');
    }
    const path='/input.ufo/'+relative;module.FS.mkdirTree(path.slice(0,path.lastIndexOf('/')));module.FS.writeFile(path,content);
  }
  return '/input.ufo';
}
export function packUfo(module) {
  const files=[];
  function walk(path) {for(const name of module.FS.readdir(path)) {if(name==='.'||name==='..')continue;const p=path+'/'+name;if(module.FS.isDir(module.FS.stat(p).mode))walk(p);else files.push([p.slice(1),module.FS.readFile(p)]);}}
  walk('/output.ufo');return zipFiles(files);
}
