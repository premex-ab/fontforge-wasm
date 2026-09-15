// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeProof } from './runner.mjs';
const dir = await mkdtemp(join(tmpdir(), 'fontforge-parity-'));
try {
  await cp('test/results/scripting/input.sfd', join(dir, 'input.sfd'));
  const input = new Uint8Array(await readFile(join(dir, 'input.sfd')));
  for (const [name, script, args, mode] of [
    ['export', 'Open($1); Print($fontname); Print($2); Generate($2);', ['/work/input.sfd', '/work/output.otf'], '-script'],
    ['arguments', 'Print($1);', ['å字 $(not-a-shell); "quoted"'], '-c'],
    ['syntax-error', 'UnknownCommand();', [], '-script'],
    ['missing-file', 'Open("/work/missing.sfd");', [], '-script'],
    ['exit', 'Quit(7);', [], '-script'],
  ]) {
    await writeFile(join(dir, 'script.pe'), script);
    let native;
    try {
      native = { status: 0, stdout: execFileSync('docker', ['run', '--rm', '--network=none', '-e', 'LANG=C.UTF-8', '-v', `${dir}:/work`, '-w', '/work', 'fontforge-wasm:scripting-native', '-lang=ff', mode, mode === '-c' ? script : '/work/script.pe', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (error) {
      if (typeof error.status !== 'number') throw error;
      native = error;
    }
    const wasm = await executeProof({ script, args, mode, files: { '/work/input.sfd': input }, outputPaths: name === 'export' ? ['/work/output.otf'] : [] });
    assert.equal(wasm.exitCode, native.status, name);
    assert.equal(wasm.stdout.trim(), native.stdout.trim(), name);
    if (name === 'export') {
      await cp(join(dir, 'output.otf'), 'test/results/scripting/native.otf');
      await writeFile('test/results/scripting/wasm.otf', wasm.files['/work/output.otf']);
    }
    console.log(`Native/WASM parity: ${name}, exit ${wasm.exitCode}`);
  }
} finally { await rm(dir, { recursive: true, force: true }); }
