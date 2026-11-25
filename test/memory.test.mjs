import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {convert} from '../src/index.js';

test('dense CFF allocation exhaustion is structured and the next worker still works', async () => {
  // Generate with python test/make-memory-fixture.py; wholly original outlines.
  const dense = new Uint8Array(gunzipSync(await readFile('test/fixtures/memory.otf.gz')));
  await assert.rejects(convert(dense, {format:'ttf'}), {code:'OUT_OF_MEMORY'});
  const small = new Uint8Array(await readFile('test/fixtures/fixture.otf'));
  const output = await convert(small, {format:'ttf'});
  assert.deepEqual([...output.subarray(0,4)], [0,1,0,0]);
});
