// SPDX-License-Identifier: GPL-3.0-or-later
// Charge peak capacity per inode, including deleted files, for the job lifetime.
// This also bounds temporary files and repeated create/delete loops.
export function installQuota(FS, limits, report) {
  const mem = FS.filesystems.MEMFS;
  const peaks = new Map();
  let bytes = 0, entries = 0, failed = false;
  const fail = () => {
    if (!failed) report({ fatal: 'Script filesystem budget exceeded.', code: 'FILESYSTEM_LIMIT' });
    failed = true;
    throw new FS.ErrnoError(51); // ENOSPC; parent also terminates native loops.
  };
  const charge = (node, size) => {
    const previous = peaks.get(node) || 0;
    if (!Number.isSafeInteger(size) || size < 0 || failed || bytes + Math.max(0, size - previous) > limits.maxFileSystemBytes) fail();
    bytes += Math.max(0, size - previous);
    peaks.set(node, Math.max(previous, size));
  };
  const create = mem.createNode;
  mem.createNode = function(...args) {
    if (failed || entries >= limits.maxEntries) fail();
    const node = create.apply(this, args);
    entries++;
    return node;
  };
  const expand = mem.expandFileStorage;
  mem.expandFileStorage = function(node, capacity) {
    const previous = node.contents.length;
    if (capacity > previous) {
      capacity = Math.max(capacity, previous * (previous < 1048576 ? 2 : 1.125) >>> 0);
      if (previous) capacity = Math.max(capacity, 256);
    }
    charge(node, Math.max(capacity, previous));
    return expand.call(this, node, capacity);
  };
  const resize = mem.resizeFileStorage;
  mem.resizeFileStorage = function(node, size) { charge(node, size); return resize.call(this, node, size); };
  const write = mem.stream_ops.write;
  const guardedWrite = function(stream, buffer, offset, length, position, canOwn) {
    charge(stream.node, Math.max(stream.node.contents.length, position + length));
    return write.call(this, stream, buffer, offset, length, position, canOwn);
  };
  // msync calls mem.stream_ops.write directly; normal writes use ops_table.
  mem.stream_ops.write = mem.ops_table.file.stream.write = guardedWrite;
}
