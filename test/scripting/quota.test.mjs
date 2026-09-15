// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import createModule from '../../dist/fontforge-script.mjs';
import { installQuota } from '../../src/script-quota.js';
import { SCRIPT_LIMITS } from '../../src/script-validate.js';
async function fixture(limits) {
  const { FS } = await createModule({ noInitialRun: true });
  const events = [];
  installQuota(FS, { ...SCRIPT_LIMITS, ...limits }, e => events.push(e));
  return { FS, events };
}
test('real MEMFS sparse writes and truncation are checked before allocating storage', async () => {
  for (const operation of ['write', 'truncate', 'msync']) {
    const { FS, events } = await fixture({ maxFileSystemBytes: 1024 });
    const stream = FS.open('/tmp/test', 'w+');
    const execute = operation === 'truncate' ? () => FS.truncate('/tmp/test', 1025) : operation === 'msync' ? () => stream.stream_ops.msync(stream, new Uint8Array(1), 1024, 1, 0) : () => FS.write(stream, new Uint8Array(1), 0, 1, 1024);
    assert.throws(execute);
    assert.equal(stream.node.contents.length, 0);
    assert.equal(events[0].code, 'FILESYSTEM_LIMIT');
  }
});
test('delete/recreate and truncation cannot reset cumulative budgets', async () => {
  const { FS, events } = await fixture({ maxFileSystemBytes: 8 });
  FS.writeFile('/tmp/first', new Uint8Array(8));
  FS.truncate('/tmp/first', 0);
  FS.unlink('/tmp/first');
  assert.throws(() => FS.writeFile('/tmp/second', new Uint8Array(1)));
  assert.equal(events[0].code, 'FILESYSTEM_LIMIT');
  const entry = await fixture({ maxEntries: 1 });
  entry.FS.mkdir('/tmp/one'); entry.FS.rmdir('/tmp/one');
  assert.throws(() => entry.FS.mkdir('/tmp/two'));
  assert.equal(entry.events[0].code, 'FILESYSTEM_LIMIT');
});
