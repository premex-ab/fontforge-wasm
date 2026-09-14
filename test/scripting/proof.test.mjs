// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { executeProof } from './runner.mjs';
const input = new Uint8Array(await readFile(new URL('../fixtures/fixture.ttf', import.meta.url)));
test('native interpreter opens SFD, reads metadata and generates OTF', async () => {
  const preparation = await executeProof({ script: 'Open($1); Save($2);', args: ['/work/input.ttf', '/work/input.sfd'], files: { '/work/input.ttf': input }, outputPaths: ['/work/input.sfd'] });
  assert.equal(preparation.exitCode, 0, preparation.stderr);
  const script = 'Open($1); Print($fontname); Print($2); Generate($2);';
  const result = await executeProof({ script, args: ['/work/input.sfd', '/work/output.otf'], files: preparation.files, outputPaths: ['/work/output.otf'] });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /\/work\/output.otf/);
  assert.equal(new TextDecoder().decode(result.files['/work/output.otf'].slice(0, 4)), 'OTTO');
  await mkdir('test/results/scripting', { recursive: true });
  await writeFile('test/results/scripting/input.sfd', preparation.files['/work/input.sfd']);
  await writeFile('test/results/scripting/proof.pe', script);
  await writeFile('test/results/scripting/wasm.otf', result.files['/work/output.otf']);
  await writeFile('test/results/scripting/wasm.json', JSON.stringify(result));
});
test('inline native script preserves Unicode and arguments without shell parsing', async () => {
  const result = await executeProof({ mode: '-c', script: 'Print($1);', args: ['å字 $(not-a-shell); "quoted"'] });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'å字 $(not-a-shell); "quoted"');
});
test('native errors and explicit exits preserve exit code and stderr', async () => {
  for (const script of ['UnknownCommand();', 'Open("/work/missing.sfd");']) {
    const result = await executeProof({ script });
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.length);
  }
  assert.equal((await executeProof({ script: 'Quit(7);' })).exitCode, 7);
});
test('concurrent and repeated scripts cannot share globals or virtual files', async () => {
  const results = await Promise.all(['one', 'two'].map(value => executeProof({ script: 'Print($1);', args: [value] })));
  assert.deepEqual(results.map(r => r.stdout), ['one', 'two']);
  assert.notEqual((await executeProof({ script: 'Open("/work/input.sfd");' })).exitCode, 0);
});
test('timeout and cancellation stop a running interpreter', async () => {
  await assert.rejects(executeProof({ script: 'while (1)\nendloop' }, { timeoutMs: 1000 }), /TIMEOUT/);
  const controller = new AbortController();
  await assert.rejects(executeProof({ script: 'Print("ready"); while (1)\nendloop' }, { signal: controller.signal, onLog: () => controller.abort() }), /ABORTED/);
  assert.equal((await executeProof({ script: 'Print("still works");' })).stdout, 'still works');
});

test('bounded logs fail explicitly; observer exceptions do not kill scripts', async () => {
  await assert.rejects(executeProof({ script: 'while (1)\nPrint("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");\nendloop' }), /log limit/i);
  const result = await executeProof({ script: 'Print("ok");' }, { onLog: () => { throw new Error('observer'); } });
  assert.equal(result.stdout, 'ok');
});
test('invalid paths and arguments fail before script execution', async () => {
  await assert.rejects(executeProof({ script: 'Print("no");', args: ['bad\0argument'] }), /Invalid arguments/);
  await assert.rejects(executeProof({ script: 'Print("no");', files: { '/work/../escaped': input } }), /Invalid input file/);
  await assert.rejects(executeProof({ script: 'Print("no");', outputPaths: ['/etc/passwd'] }), /Invalid output path/);
});
