// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { convert } from '../../src/index.js';
const input = await readFile(new URL('./Roboto-Regular.ttf', import.meta.url));
const output = await convert(input, { format: 'otf' });
await writeFile(new URL('./Roboto-Regular.otf', import.meta.url), output);
await writeFile(new URL('./checksums.json', import.meta.url), JSON.stringify({
  'Roboto-Regular.ttf': createHash('sha256').update(input).digest('hex'),
  'Roboto-Regular.otf': createHash('sha256').update(output).digest('hex'),
}, null, 2) + '\n');
