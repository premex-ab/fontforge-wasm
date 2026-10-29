// SPDX-License-Identifier: GPL-3.0-or-later
import {validateSfnt, FontForgeError, requiresEditPermission} from './validate.js';
import {convert} from './index.js';
export async function inspectFont(input, options={}) {
  let bytes=input;
  if (!(bytes instanceof Uint8Array) || bytes.length<12) throw new FontForgeError('INVALID_FONT','Invalid font.');
  const head=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), magic=head.getUint32(0);
  if(magic===0x774f4646 || magic===0x774f4632) bytes=await convert(bytes,{...options,format:head.getUint32(4)===0x4f54544f?'otf':'ttf'});
  validateSfnt(bytes,{preserveTables:true});
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), tables=new Map();
  for(let i=0;i<v.getUint16(4);i++){const at=12+i*16;tables.set(String.fromCharCode(...bytes.slice(at,at+4)),{at:v.getUint32(at+8),length:v.getUint32(at+12)});}
  const restricted=requiresEditPermission(bytes);
  const f=tables.get('fvar');if(!f)return {axes:[],requiresEditPermission:restricted};
  const invalid=()=>{throw new FontForgeError('INVALID_FONT','Invalid variation axis table.');};
  if(f.length<16 || v.getUint16(f.at)!==1)invalid();
  const offset=v.getUint16(f.at+4),count=v.getUint16(f.at+8),size=v.getUint16(f.at+10);
  if(count>64 || size<20 || offset<16 || offset+count*size>f.length)invalid();
  const names=new Map(), name=tables.get('name');
  if(name && name.length>=6){const n=v.getUint16(name.at+2),strings=v.getUint16(name.at+4);
    if(n<=4096 && 6+n*12<=name.length)for(let i=0;i<n;i++){
      const at=name.at+6+i*12, platform=v.getUint16(at),language=v.getUint16(at+4),id=v.getUint16(at+6),length=v.getUint16(at+8),start=strings+v.getUint16(at+10);
      if(start+length>name.length || length>1024 || ![0,3].includes(platform))continue;
      if(!names.has(id)||language===0x409)names.set(id,new TextDecoder('utf-16be').decode(bytes.subarray(name.at+start,name.at+start+length)));
    }
  }
  const labels={wght:'Weight',wdth:'Width',slnt:'Slant',ital:'Italic',opsz:'Optical size',GRAD:'Grade'};
  const axes=Array.from({length:count},(_,i)=>{
    const at=f.at+offset+i*size,tag=String.fromCharCode(...bytes.slice(at,at+4));
    const min=v.getInt32(at+4)/65536,def=v.getInt32(at+8)/65536,max=v.getInt32(at+12)/65536;
    if(!/^[A-Za-z0-9 ]{4}$/.test(tag)||min>def||def>max)invalid();
    return {tag,name:names.get(v.getUint16(at+18))||labels[tag]||tag,min,default:def,max};
  });
  return {axes,requiresEditPermission:restricted};
}

export async function inspectVariations(input, options={}) {return (await inspectFont(input,options)).axes;}
