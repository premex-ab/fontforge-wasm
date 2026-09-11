// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { convert, MAX_INPUT_BYTES } from '../src/index.js';
const fixtures = new URL('./fixtures/', import.meta.url);

for (const [from, to] of [['ttf', 'otf'], ['otf', 'ttf']]) {
  test(`${from} → ${to}, round trip and input ownership`, async () => {
    const input = await readFile(new URL(`fixture.${from}`, fixtures));
    const before = Buffer.from(input);
    const output = await convert(input, { format: to });
    assert.equal(new DataView(output.buffer).getUint32(0), to === 'otf' ? 0x4f54544f : 0x10000);
    assert.deepEqual(input, before);
    const back = await convert(output, { format: from });
    assert.equal(new DataView(back.buffer).getUint32(0), from === 'otf' ? 0x4f54544f : 0x10000);
    await mkdir('test/results', { recursive: true });
    await writeFile(`test/results/${from}-to-${to}.${to}`, output);
    await writeFile(`test/results/${from}-roundtrip.${from}`, back);
  });
}
test('bad input, unsupported format, size limit and cancellation', async () => {
  await assert.rejects(convert(new Uint8Array(20), { format: 'ttf' }), { code: 'UNSUPPORTED_FONT' });
  await assert.rejects(convert(new Uint8Array(2), { format: 'ttf' }), { code: 'INVALID_FONT' });
  await assert.rejects(convert(new Uint8Array(2), { format: 'woff2' }), { code: 'UNSUPPORTED_FORMAT' });
  await assert.rejects(convert(new Uint8Array(MAX_INPUT_BYTES + 1), { format: 'ttf' }), { code: 'INPUT_TOO_LARGE' });
  const input = await readFile(new URL('fixture.ttf', fixtures));
  await assert.rejects(convert(input, { format: 'otf', signal: AbortSignal.abort() }), { code: 'ABORTED' });
  await assert.rejects(convert(input, { format: 'otf', timeoutMs: 1 }), { code: 'TIMEOUT' });
  const controller = new AbortController();
  const pending = convert(input, { format: 'otf', signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: 'ABORTED' });
  // A terminated conversion must not poison later calls.
  assert.ok((await convert(input, { format: 'otf' })).length > 100);
});
test('rejects variable tables and out-of-bounds directories', async () => {
  const input = await readFile(new URL('fixture.ttf', fixtures));
  const variable = Uint8Array.from(input);
  variable.set(new TextEncoder().encode('fvar'), 12);
  await assert.rejects(convert(variable, { format: 'otf' }), { code: 'UNSUPPORTED_FONT' });
  const truncated = Uint8Array.from(input);
  new DataView(truncated.buffer).setUint32(20, truncated.length + 1);
  await assert.rejects(convert(truncated, { format: 'otf' }), { code: 'INVALID_FONT' });
});
test('concurrent jobs use isolated state', async () => {
  const ttf = await readFile(new URL('fixture.ttf', fixtures));
  const otf = await readFile(new URL('fixture.otf', fixtures));
  const [a, b] = await Promise.all([convert(ttf, { format: 'otf' }), convert(otf, { format: 'ttf' })]);
  assert.equal(new DataView(a.buffer).getUint32(0), 0x4f54544f);
  assert.equal(new DataView(b.buffer).getUint32(0), 0x10000);
});
test('reports real worker stages and native duration without observers breaking conversion', async () => {
  const input = await readFile(new URL('fixture.ttf', fixtures));
  const events = [];
  await convert(input, { format: 'otf', onProgress(event) { events.push(event); } });
  assert.deepEqual(events.map(event => event.stage), ['worker', 'initialize', 'input', 'convert', 'converted', 'output']);
  assert.ok(Number.isFinite(events.find(event => event.stage === 'converted').durationMs));
  assert.ok(events.find(event => event.stage === 'converted').durationMs >= 0);
  const output = await convert(input, { format: 'otf', onProgress() { throw new Error('Observer failed'); } });
  assert.equal(new DataView(output.buffer).getUint32(0), 0x4f54544f);
});
