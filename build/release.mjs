// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const destination = 'artifacts/release';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
execFileSync('npm', ['pack', '--pack-destination', destination], { stdio: 'inherit' });
execFileSync('tar', ['czf', `${destination}/upstream-sources.tar.gz`, '-C', 'artifacts', 'sources']);
const checksums = [];
for (const name of (await readdir(destination)).filter(n => n !== 'SHA256SUMS').sort()) {
  const data = await readFile(`${destination}/${name}`);
  checksums.push(`${createHash('sha256').update(data).digest('hex')}  ${name}`);
}
await writeFile(`${destination}/SHA256SUMS`, checksums.join('\n') + '\n');
