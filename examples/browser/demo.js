// SPDX-License-Identifier: GPL-3.0-or-later
import { convert, FORMATS } from '../../src/index.js';
const form = document.querySelector('#converter');
const fileInput = document.querySelector('#font');
const format = document.querySelector('#format');
const submit = document.querySelector('#convert');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const preview = document.querySelector('#preview');
const selected = document.querySelector('#selected-font');
const exampleButtons = document.querySelector('#example-buttons');
const faceIndex = document.querySelector('#face-index');
const formatNote = document.querySelector('#format-note');
const examples = FORMATS.filter(f => f.input);
for (const definition of examples) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.sample = definition.id;
  button.setAttribute('aria-pressed', 'false'); button.textContent = `Use ${definition.id.toUpperCase()} example`;
  exampleButtons.append(button);
}
format.replaceChildren(...FORMATS.filter(f => f.output).map(f => new Option(`${f.id.toUpperCase()} · ${f.label}`, f.id)));
format.value = 'otf';
const samples = [...document.querySelectorAll('[data-sample]')];
function inputHint(file) { return file.name.toLowerCase().endsWith('.zip') ? 'ufo' : file.name.split('.').pop().toLowerCase(); }
function showFormatNote() { formatNote.textContent = FORMATS.find(f => f.id === format.value)?.note || 'Outline conversion can change hinting and layout tables.'; }
for (const definition of FORMATS) {
  const row = document.createElement('tr');
  for (const text of [definition.id.toUpperCase(), definition.input ? 'Yes' : 'Export only', definition.output ? 'Yes' : 'Import only', definition.note || 'Static outlines']) {
    const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
  }
  document.querySelector('#format-support').append(row);
}
showFormatNote();
const cold = new URL(location.href).searchParams.has('cold');
const resetCache = document.querySelector('#reset-cache');
const normalMode = document.querySelector('#normal-mode');
normalMode.hidden = !cold;
const normalUrl = new URL(location.href);
normalUrl.searchParams.delete('cold');
normalMode.href = normalUrl.href;
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
  resetCache.disabled = value;
  fileInput.disabled = format.disabled = faceIndex.disabled = value;
  submit.disabled = value || !selectedFile;
  for (const button of samples) button.disabled = value;
  cancel.hidden = !value;
}
function ready() {
  document.querySelector('#face-control').hidden = inputHint(selectedFile) !== 'ttc';
  showFormatNote();
  selected.textContent = `Selected: ${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KiB`;
  update('Font selected. Choose an output format, then press Convert locally.');
}
fileInput.onchange = () => {
  operationStarted = undefined;
  selectedFile = fileInput.files[0];
  faceIndex.value = 0;
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
format.onchange = () => { clearOutput(); showFormatNote(); if (selectedFile) ready(); };
faceIndex.onchange = () => { clearOutput(); if (selectedFile) ready(); };
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
      cache: cold ? 'no-store' : 'default',
      inputFormat: inputHint(file), faceIndex: Number(faceIndex.value),
      format: format.value, signal: controller.signal, timeoutMs: 60_000,
      onProgress: event => update(event.message + (event.durationMs === undefined ? '' : ` · ${(event.durationMs / 1000).toFixed(3)}s`)),
    });
    update('Preparing downloadable font');
    const target = FORMATS.find(f => f.id === format.value);
    url = URL.createObjectURL(new Blob([result], { type: target.preview ? `font/${format.value}` : 'application/octet-stream' }));
    download.href = url;
    download.download = file.name.replace(/\.(?:ufo\.zip|[^.]+)$/i, '') + '.' + (target.extension || format.value);
    download.hidden = false;
    cancel.hidden = true;
    update('Loading font preview');
    let previewAvailable = true;
    try {
      let previewBytes = result;
      if (!target.preview) {
        update(target.input ? 'Preparing browser preview via a separate TTF conversion' : 'Preparing source font preview; metrics output contains no outlines');
        previewBytes = await convert(target.input ? result : bytes, {
          format: 'ttf', inputFormat: target.input ? target.id : inputHint(file),
          faceIndex: target.input ? 0 : Number(faceIndex.value),
          cache: cold ? 'no-store' : 'default', timeoutMs: 60_000,
          onProgress: event => record(`Preview: ${event.message}`),
        });
      }
      face = new FontFace('ConvertedPreview', previewBytes);
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
    faceIndex.value = 0;
    format.value = inputFormat === 'ttf' ? 'otf' : 'ttf';
    fileInput.value = '';
    selectedFile = undefined;
    clearOutput();
    busy(true);
    for (const sample of samples) sample.setAttribute('aria-pressed', String(sample === button));
    selected.textContent = `Loading Roboto Regular · ${inputFormat.toUpperCase()}`;
    update(cold ? 'Fetching hosted example with browser cache bypassed; conversion has not started' : 'Loading hosted example (network or browser cache); conversion has not started');
    const started = performance.now();
    try {
      const definition = FORMATS.find(f => f.id === inputFormat);
      const name = `Roboto-Regular.${definition.extension || inputFormat}`;
      const response = await fetch(new URL(`../fonts/${name}`, import.meta.url), { signal: controller.signal, cache: cold ? 'no-store' : 'default' });
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
let offlineRegistration;
if (!cold && 'serviceWorker' in navigator) {
  offlineRegistration = navigator.serviceWorker.register(new URL('../../demo-service-worker.js', import.meta.url), { updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { document.documentElement.dataset.offlineReady = 'true'; })
    .catch(() => { document.documentElement.dataset.offlineReady = 'false'; });
}

if (cold) {
  document.querySelector('#cache-note').textContent = 'Uncached test mode: engine and example requests bypass browser caches; offline preloading is paused. Each conversion fetches the engine again. CDN, connection and browser WASM compilation caches may still affect timing.';
  record('Uncached test mode active. Engine fetching starts only when you press Convert.');
}
resetCache.onclick = async () => {
  busy(true);
  cancel.hidden = true;
  update('Clearing demo offline cache and restarting in uncached test mode…');
  try {
    // Let an in-flight installation finish before removing its cache.
    await offlineRegistration;
    if ('serviceWorker' in navigator) {
      const workerUrl = new URL('../../demo-service-worker.js', import.meta.url).href;
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        if ([registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === workerUrl)) await registration.unregister();
      }
    }
    if ('caches' in window) {
      for (const name of await caches.keys()) {
        if (name.startsWith('fontforge-wasm-demo-')) await caches.delete(name);
      }
    }
    const next = new URL(location.href);
    next.searchParams.set('cold', Date.now().toString());
    location.replace(next.href);
  } catch (error) { update(`Could not reset demo cache: ${error.message}`); busy(false); }
};

document.querySelector('#playground-link').href = new URL('../playground/', import.meta.url);
