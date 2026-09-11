// SPDX-License-Identifier: GPL-3.0-or-later
// One registry shared by the package and demo. IDs match native/convert.c.
export const FORMATS = Object.freeze([
  { id:'ttf', native:1, label:'TrueType', preview:true },
  { id:'otf', native:2, label:'OpenType / CFF', preview:true },
  { id:'woff', native:3, label:'WOFF', preview:true },
  { id:'woff2', native:4, label:'WOFF2', preview:true },
  { id:'eot', native:1, label:'Embedded OpenType', note:'Uncompressed EOT; compressed and XOR-obfuscated EOT are not supported.' },
  { id:'svg', native:5, label:'SVG font', note:'Legacy SVG fonts, not ordinary SVG illustrations.' },
  { id:'pfa', native:6, label:'Type 1 ASCII' },
  { id:'pfb', native:7, label:'Type 1 binary' },
  { id:'cff', native:8, label:'CFF outlines' },
  { id:'t42', native:9, label:'PostScript Type 42' },
  { id:'ps', native:10, label:'PostScript font', note:'Font resources only, not general PostScript documents. Output is Type 1.' },
  { id:'pt3', native:11, label:'PostScript Type 3' },
  { id:'dfont', native:12, label:'Mac data-fork font' },
  { id:'suit', native:13, label:'Mac suitcase', note:'Portable MacBinary wrapper.' },
  { id:'bin', native:14, label:'MacBinary Type 1', note:'A MacBinary font container, not an arbitrary .bin file.' },
  { id:'ufo', native:15, label:'Unified Font Object', extension:'ufo.zip', note:'Upload/download a ZIP containing one .ufo directory.' },
  { id:'ttc', native:1, label:'TrueType collection', note:'Choose a face by index on import. Export contains one face.' },
  { id:'afm', native:16, label:'Adobe Font Metrics', input:false, note:'Metrics export only; no glyph outlines.' },
  { id:'pfm', native:17, label:'Printer Font Metrics', input:false, note:'Metrics export only; Windows ANSI encoding.' },
  { id:'tfm', native:18, label:'TeX Font Metrics', input:false, note:'Metrics export only; Windows ANSI encoding.' },
  { id:'fon', native:19, label:'Windows bitmap font', note:'Export rasterizes Windows ANSI characters at 16 px. Import preserves pixels as rectangular outlines, not smooth curves.' },
  { id:'t11', native:20, label:'PostScript Type 11', note:'CID-keyed TrueType; exported CID mapping covers BMP Unicode (U+0000–FFFF).' },
].map(format => Object.freeze({ input:true, ...format })));
export const getFormat = id => FORMATS.find(format => format.id === id);
