// SPDX-License-Identifier: GPL-3.0-or-later
import { convert } from '../../src/index.js';
const form = document.querySelector('#converter');
const fileInput = document.querySelector('#font');
const format = document.querySelector('#format');
const submit = document.querySelector('#convert');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const preview = document.querySelector('#preview');
const selected = document.querySelector('#selected-font');
const samples = [...document.querySelectorAll('[data-sample]')];
const log = document.querySelector('#activity-log');
let controller, url, face, selectedFile, operationStarted;
function record(message) {
  const line = document.createElement('div');
  const timestamp = new Date().toISOString().slice(11, 23);
  const elapsed = operationStarted === undefined ? '' : ` +${((performance.now() - operationStarted) / 1000).toFixed(3)}s`;
  line.textContent = `${timestamp} UTC${elapsed}  ${message}`;
  log.append(line);
  while (log.children.length > 100) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}
function update(message) { status.textContent = message; record(message); }
function clearOutput() {
  download.hidden = preview.hidden = true;
  if (url) { URL.revokeObjectURL(url); url = undefined; }
  if (face) { document.fonts.delete(face); face = undefined; }
}
function busy(value) {
  fileInput.disabled = format.disabled = value;
  submit.disabled = value || !selectedFile;
  for (const button of samples) button.disabled = value;
  cancel.hidden = !value;
}
function ready() {
  selected.textContent = `Selected: ${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KiB`;
  update('Font selected. Choose an output format, then press Convert locally.');
}
fileInput.onchange = () => {
  operationStarted = undefined;
  selectedFile = fileInput.files[0];
  for (const button of samples) button.setAttribute('aria-pressed', 'false');
  clearOutput();
  if (selectedFile) {
    format.value = /\.otf$/i.test(selectedFile.name) ? 'ttf' : 'otf';
    record(`Selected local file: ${selectedFile.name}`);
    ready();
  } else {
    selected.textContent = 'Choose an example above or a font from your device.';
    update('No font selected.');
  }
  busy(false);
};
format.onchange = () => { clearOutput(); if (selectedFile) ready(); };
cancel.onclick = () => controller?.abort();

form.onsubmit = async event => {
  event.preventDefault();
  if (!selectedFile || submit.disabled) return;
  controller = new AbortController();
  operationStarted = performance.now();
  log.replaceChildren();
  busy(true);
  clearOutput();
  try {
    const file = selectedFile;
    update(`Conversion requested: ${file.name} → ${format.value.toUpperCase()}`);
    update('Reading selected file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await convert(bytes, {
      format: format.value, signal: controller.signal, timeoutMs: 60_000,
      onProgress: event => update(event.message + (event.durationMs === undefined ? '' : ` · ${(event.durationMs / 1000).toFixed(3)}s`)),
    });
    update('Preparing downloadable font');
    url = URL.createObjectURL(new Blob([result], { type: `font/${format.value}` }));
    download.href = url;
    download.download = file.name.replace(/\.(ttf|otf)$/i, '') + '.' + format.value;
    download.hidden = false;
    cancel.hidden = true;
    update('Loading font preview');
    let previewAvailable = true;
    try {
      face = new FontFace('ConvertedPreview', result);
      await face.load();
      document.fonts.add(face);
      preview.style.fontFamily = 'ConvertedPreview, serif';
      preview.hidden = false;
      record('Font preview ready');
    } catch { previewAvailable = false; record('Preview unavailable in this browser; the font can still be downloaded.'); }
    update(`Ready · ${(result.length / 1024).toFixed(1)} KiB · ${((performance.now() - operationStarted) / 1000).toFixed(3)}s total from Convert click · no upload${previewAvailable ? '' : ' · preview unavailable'}`);
  } catch (error) {
    update(error.name === 'AbortError' ? 'ABORTED: Conversion was cancelled.' : `${error.code || 'ERROR'}: ${error.message}`);
  } finally {
    operationStarted = undefined;
    busy(false);
  }
};
for (const button of samples) {
  button.onclick = async () => {
    operationStarted = undefined;
    controller = new AbortController();
    const inputFormat = button.dataset.sample;
    format.value = inputFormat === 'ttf' ? 'otf' : 'ttf';
    fileInput.value = '';
    selectedFile = undefined;
    clearOutput();
    busy(true);
    for (const sample of samples) sample.setAttribute('aria-pressed', String(sample === button));
    selected.textContent = `Loading Roboto Regular · ${inputFormat.toUpperCase()}`;
    update('Loading hosted example (network or browser cache); conversion has not started');
    const started = performance.now();
    try {
      const name = `Roboto-Regular.${inputFormat}`;
      const response = await fetch(new URL(`../fonts/${name}`, import.meta.url), { signal: controller.signal });
      if (!response.ok) throw new Error('Could not load the example font. Please try again.');
      selectedFile = new File([await response.arrayBuffer()], name, { type: `font/${inputFormat}` });
      record(`Hosted example loaded in ${((performance.now() - started) / 1000).toFixed(3)}s`);
      ready();
    } catch (error) {
      selected.textContent = 'No font selected.';
      button.setAttribute('aria-pressed', 'false');
      update(error.name === 'AbortError' ? 'Example loading cancelled.' : error.message);
    } finally { busy(false); }
  };
}
busy(false);
// Resolve these links relative to this module, both at the Pages root and /examples/browser/.
for (const link of document.querySelectorAll('[data-font-asset]')) {
  link.href = new URL(`../fonts/${link.dataset.fontAsset}`, import.meta.url).href;
}

// Cache public demo assets and examples, never user-selected fonts or outputs.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../../demo-service-worker.js', import.meta.url), { updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { document.documentElement.dataset.offlineReady = 'true'; })
    .catch(() => { document.documentElement.dataset.offlineReady = 'false'; });
}
