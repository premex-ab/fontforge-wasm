// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execute, SCRIPT_LIMITS, FontForgeError } from '../../src/index.js';
const font = new Uint8Array(await readFile(new URL('../fixtures/fixture.ttf', import.meta.url)));
const hasCode = code => error => error instanceof FontForgeError && error.code === code;
test('public API exports fonts, preserves caller bytes and returns partial results on native errors', async () => {
  const original = font.slice();
  const result = await execute('Open($1); Print($fontname); Generate($2); Quit(7);', { args: ['/work/input.ttf', '/work/out.otf'], files: { '/work/input.ttf': font }, outputPaths: ['/work/out.otf', '/work/missing'] });
  assert.equal(result.exitCode, 7);
  assert.equal(new TextDecoder().decode(result.files['/work/out.otf'].slice(0, 4)), 'OTTO');
  assert.ok(result.stdout); assert.deepEqual(font, original);
  assert.equal(result.files['/work/missing'], undefined);
  const failed = await execute('UnknownCommand();');
  assert.notEqual(failed.exitCode, 0); assert.ok(failed.stderr);
});
test('argv, logs, isolated concurrent jobs and observer exceptions', async () => {
  const logs = [];
  const result = await execute('Print($0); Print($1);', { args: ['å字 $(shell);'], onLog: event => { logs.push(event); throw Error('observer'); } });
  assert.equal(result.stdout, '/work/script.pe\nå字 $(shell);');
  assert.ok(logs.every(e => e.stream === 'stdout' && e.elapsedMs >= 0));
  assert.deepEqual((await Promise.all(['one','two'].map(x => execute('Print($1);', { args: [x] })))).map(r => r.stdout), ['one','two']);
  assert.notEqual((await execute('Open("/work/input.ttf");')).exitCode, 0);
});
test('filesystem budget stops repeated writes even when native code ignores ENOSPC', async () => {
  await assert.rejects(execute('while (1)\nWriteStringToFile("0123456789", "/work/out", 1);\nendloop', { limits: { maxFileSystemBytes: 8192 } }), hasCode('FILESYSTEM_LIMIT'));
  await assert.rejects(execute('i=0; while (1)\nWriteStringToFile("", "/tmp/file"+ToString(i)); i=i+1;\nendloop', { limits: { maxEntries: 16 } }), hasCode('FILESYSTEM_LIMIT'));
});
test('log and copied-output budgets have structured errors', async () => {
  await assert.rejects(execute('while (1)\nPrint("");\nendloop', { limits: { maxLogBytes: 16 } }), hasCode('LOG_LIMIT'));
  await assert.rejects(execute('WriteStringToFile("1234", "/work/out");', { outputPaths: ['/work/out'], limits: { maxOutputBytes: 3 } }), hasCode('OUTPUT_LIMIT'));
});
test('unavailable native commands produce capability errors', async () => {
  for (const script of ['AskUser("question");', 'New(); AutoTrace();']) await assert.rejects(execute(script), hasCode('UNSUPPORTED_CAPABILITY'));
});
test('cancellation, timeout and recovery', async () => {
  const controller = new AbortController();
  await assert.rejects(execute('Print("ready"); while (1)\nendloop', { signal: controller.signal, onLog: () => controller.abort() }), hasCode('ABORTED'));
  await assert.rejects(execute('while (1)\nendloop', { timeoutMs: 500 }), hasCode('TIMEOUT'));
  assert.equal((await execute('Print("alive");')).stdout, 'alive');
});
test('request validation rejects invalid limits, paths and nonbytes', async () => {
  for (const options of [{ limits: { maxEntries: SCRIPT_LIMITS.maxEntries + 1 } }, { files: { '/work/../x': font } }, { files: { '/work/x': 'bad' } }, { args: ['a\0b'] }, { outputPaths: ['/work/script.pe'] }, { outputPaths: ['/work//x'] }]) await assert.rejects(execute('', options), hasCode('INVALID_REQUEST'));
});

test('script binary has no Emscripten host-shell import', async () => {
  const module = await WebAssembly.compile(await readFile(new URL('../../dist/fontforge-script.wasm', import.meta.url)));
  assert.ok(!WebAssembly.Module.imports(module).some(entry => /system|spawn|execve/.test(entry.name)));
});
