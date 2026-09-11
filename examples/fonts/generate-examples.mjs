// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { convert, FORMATS } from '../../src/index.js';
const root = new URL('./', import.meta.url);
const input = await readFile(new URL('Roboto-Regular.ttf',root));
const checksums={};
for (const format of FORMATS) {
  const name=`Roboto-Regular.${format.extension || format.id}`;
  const bytes=format.id==='ttf'?input:await convert(input,{format:format.id,timeoutMs:60000});
  if(format.id!=='ttf')await writeFile(new URL(name,root),bytes);
  checksums[name]=createHash('sha256').update(bytes).digest('hex');
  console.log(name,bytes.length);
}
await writeFile(new URL('checksums.json',root),JSON.stringify(checksums,null,2)+'\n');
