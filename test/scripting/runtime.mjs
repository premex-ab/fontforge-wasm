// SPDX-License-Identifier: GPL-3.0-or-later
// Internal proof harness, not the public execute() API.
import createModule from '../../artifacts/scripting/fontforge-script.mjs';
export async function run({ script, args = [], files = {}, outputPaths = [], mode = '-script', wasmBinary }, report = () => {}) {
  if (typeof script !== 'string' || script.includes('\0')) throw new Error('Invalid script');
  if (!Array.isArray(args) || args.length > 64 || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new Error('Invalid arguments');
  const scriptBytes = new TextEncoder().encode(script).length;
  const argumentBytes = args.reduce((sum, arg) => sum + new TextEncoder().encode(arg).length, 0);
  if (scriptBytes + argumentBytes > 16 * 1024 * 1024) throw new Error('Input limit exceeded');
  let exitCode;
  let logBytes = 0;
  let logLimitExceeded = false;
  const logs = { stdout: [], stderr: [] };
  const started = performance.now();
  const log = stream => message => {
    if (logLimitExceeded) return;
    logBytes += new TextEncoder().encode(message).length;
    if (logBytes > 65536) {
      // libc can swallow exceptions thrown by print callbacks as write errors.
      // Notify the supervisor instead; only worker termination reliably stops C.
      logLimitExceeded = true;
      report({ fatal: 'Script log limit exceeded' });
      return;
    }
    logs[stream].push(message);
    report({ stream, message, elapsedMs: performance.now() - started });
  };
  const module = await createModule({ noInitialRun: true, ...(wasmBinary ? { wasmBinary, locateFile: name => name } : {}),
    print: log('stdout'), printErr: log('stderr'),
    onExit: code => { exitCode = code; },
    // Do not let Emscripten change a Node worker's process exit status.
    quit: (code, error) => { throw error; },
  });
  const { FS } = module;
  FS.mkdir('/work'); FS.chdir('/work');
  const validPath = path => typeof path === 'string' && /^\/work\/(?!\.\.?($|\/))[^\0\\]+$/.test(path)
    && path.split('/').every(part => part !== '..' && part !== '.');
  let inputBytes = scriptBytes + argumentBytes;
  if (Object.keys(files).length > 64 || outputPaths.length > 64) throw new Error('File count limit exceeded');
  for (const [path, bytes] of Object.entries(files)) {
    if (!validPath(path) || path === '/work/script.pe' || !(bytes instanceof Uint8Array)) throw new Error('Invalid input file');
    inputBytes += bytes.byteLength;
    if (inputBytes > 16 * 1024 * 1024) throw new Error('Input limit exceeded');
    FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
    FS.writeFile(path, bytes);
  }
  for (const path of outputPaths) {
    if (!validPath(path) || path === '/work/script.pe' || Object.hasOwn(files, path)) throw new Error('Invalid output path');
    FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
  }
  if (mode !== '-script' && mode !== '-c') throw new Error('Invalid script mode');
  FS.writeFile('/work/script.pe', script);
  const status = module.callMain(['-lang=ff', mode, mode === '-c' ? script : '/work/script.pe', ...args]);
  if (logLimitExceeded) throw new Error('Script log limit exceeded');
  if (exitCode === undefined) throw new Error(`Interpreter did not exit normally (${status})`);
  const outputs = {};
  let total = 0;
  for (const path of outputPaths) {
    if (!FS.analyzePath(path).exists) continue; // A script error may leave partial output.
    const size = FS.stat(path).size;
    total += size;
    if (total > 32 * 1024 * 1024) throw new Error('Output limit exceeded');
    outputs[path] = FS.readFile(path).slice();
  }
  return { exitCode, files: outputs, stdout: logs.stdout.join('\n'), stderr: logs.stderr.join('\n') };
}
