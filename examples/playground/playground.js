// SPDX-License-Identifier: GPL-3.0-or-later
import { execute, MAX_INPUT_BYTES } from '../../src/index.js';
import { presets } from './presets.js';
const $ = id => document.getElementById(id);
const urls = [];
let selected, controller, started, timer, selectionVersion = 0;
$('license').href = new URL('../fonts/LICENSE.txt', import.meta.url);
for (const [key, preset] of Object.entries(presets)) $('preset').add(new Option(preset.label, key));
function restore() { const preset = presets[$('preset').value]; $('script').value = preset.script; $('outputs').value = preset.outputs; $('description').textContent = preset.description; }
restore();
function record(message) {
  const elapsed = started === undefined ? '' : ` +${((performance.now() - started) / 1000).toFixed(3)}s`;
  const line = document.createElement('div'); line.textContent = `${new Date().toISOString().slice(11, 23)} UTC${elapsed}  ${message}`;
  $('log').append(line); while ($('log').children.length > 200) $('log').firstElementChild.remove(); $('log').scrollTop = $('log').scrollHeight;
}
function status(message, error = false) { $('status').textContent = message; $('status').dataset.error = error; }
function clearResults() { urls.splice(0).forEach(url => URL.revokeObjectURL(url)); $('results').replaceChildren(); $('output-note').textContent = 'No output files for this run yet.'; }
function busy(value) { for (const id of ['sample','font','preset','restore','script','outputs','timeout','uncached','run']) $(id).disabled = value; $('cancel').hidden = !value; }
function choose(file) {
  if (file.size > MAX_INPUT_BYTES) throw new Error('Choose a font no larger than 16 MiB.');
  selected = file; $('selected').textContent = `${file.name} · ${(file.size/1024).toFixed(1)} KiB · available as $1`;
  status('Font selected. Press Run script when ready.');
}
$('preset').onchange = restore; $('restore').onclick = restore;
$('font').onchange = () => { selectionVersion++; selected = undefined; try { if ($('font').files[0]) choose($('font').files[0]); else $('selected').textContent = 'No font selected.'; } catch(e) { $('selected').textContent = 'No font selected.'; status(e.message, true); } };
$('sample').onclick = async () => {
  const version = ++selectionVersion; busy(true); $('cancel').hidden = true; status('Loading the hosted example…');
  try { const response = await fetch(new URL('../fonts/Roboto-Regular.ttf', import.meta.url)); if (!response.ok) throw new Error('Could not load the hosted example.'); const blob = await response.blob(); if (version !== selectionVersion) return; choose(new File([blob], 'Roboto-Regular.ttf')); $('font').value = ''; }
  catch(e) { if (version === selectionVersion) status(e.message, true); }
  finally { if (version === selectionVersion) busy(false); }
};
$('cancel').onclick = () => controller?.abort();
$('reset').onclick = () => { selectionVersion++; controller?.abort(); controller = undefined; clearInterval(timer); started = undefined; selected = undefined; $('font').value = ''; $('selected').textContent = 'No font selected. Scripts that create a new font can run without one.'; $('preset').value = 'inspect'; restore(); $('timeout').value = 30; $('uncached').checked = false; clearResults(); $('log').textContent = 'Waiting for your first run.'; $('elapsed').textContent = 'Not started'; busy(false); status('Ready when you are.'); };
$('playground').onsubmit = async event => {
  event.preventDefault(); if (controller) return;
  const job = new AbortController(); controller = job; busy(true); clearResults(); $('log').replaceChildren(); started = performance.now();
  const tick = () => { $('elapsed').textContent = `${((performance.now()-started)/1000).toFixed(3)} s`; }; tick(); timer = setInterval(tick, 100);
  record('Run started.'); status('Preparing files…');
  try {
    const files = {}, args = [];
    if (selected) { const extension = selected.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '').slice(0,16) || 'font'; const path = `/work/input.${extension}`; files[path] = new Uint8Array(await selected.arrayBuffer()); args.push(path); }
    if (controller !== job) return;
    const result = await execute($('script').value, { args, files, outputPaths: $('outputs').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean), signal: job.signal, timeoutMs: Number($('timeout').value)*1000, cache: $('uncached').checked ? 'no-store' : 'default', onProgress: e => { if (controller === job) { record(e.message); status(e.stage === 'worker' ? 'Running script…' : e.message); } }, onLog: e => { if (controller === job) record(`${e.stream}: ${e.message}`); } });
    if (controller !== job) return;
    for (const [path, bytes] of Object.entries(result.files)) { const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })); urls.push(url); const link = document.createElement('a'); link.href = url; link.download = path.split('/').pop(); link.className = 'download'; link.textContent = `Download ${link.download} · ${(bytes.length/1024).toFixed(1)} KiB`; $('results').append(link); }
    const count = Object.keys(result.files).length; $('output-note').textContent = result.exitCode ? 'The script failed. Any files below may be incomplete.' : count ? `${count} file${count===1?'':'s'} ready. Only requested files are collected.` : 'No requested files were created. See the log and output paths.';
    record(`Native exit code: ${result.exitCode}. Collected ${count} file(s).`); status(result.exitCode ? `Script failed (exit ${result.exitCode}). See the log.` : 'Script completed.', !!result.exitCode);
  } catch(e) { if (controller === job) { const message = e.code === 'ABORTED' ? 'Run stopped.' : `${e.code || 'ERROR'}: ${e.message}`; record(message); status(message, e.code !== 'ABORTED'); $('output-note').textContent = 'No output files returned.'; } }
  finally { if (controller === job) { tick(); clearInterval(timer); record('Run finished.'); controller = undefined; busy(false); } }
};
window.addEventListener('pagehide', () => { controller?.abort(); urls.splice(0).forEach(url => URL.revokeObjectURL(url)); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('../../demo-service-worker.js', import.meta.url), { updateViaCache: 'none' }).catch(() => {});
