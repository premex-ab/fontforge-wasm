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
let controller, url, face, selectedFile;

function clearOutput() {
  download.hidden = preview.hidden = true;
  if (url) { URL.revokeObjectURL(url); url = undefined; }
  if (face) { document.fonts.delete(face); face = undefined; }
}
function busy(value) {
  submit.disabled = fileInput.disabled = format.disabled = value;
  for (const button of samples) button.disabled = value;
  cancel.hidden = !value;
}
fileInput.onchange = () => {
  selectedFile = fileInput.files[0];
  selected.textContent = selectedFile ? `Selected: ${selectedFile.name}` : 'Choose an example above or a font from your device.';
  for (const button of samples) button.setAttribute('aria-pressed', 'false');
  if (selectedFile) format.value = /\.otf$/i.test(selectedFile.name) ? 'ttf' : 'otf';
  clearOutput();
};
cancel.onclick = () => controller?.abort();

async function runConversion(loadInput) {
  controller = new AbortController();
  busy(true);
  clearOutput();
  try {
    const file = await loadInput(controller.signal);
    status.textContent = 'Converting in a local worker…';
    const started = performance.now();
    const result = await convert(new Uint8Array(await file.arrayBuffer()), { format: format.value, signal: controller.signal, timeoutMs: 60_000 });
    url = URL.createObjectURL(new Blob([result], { type: `font/${format.value}` }));
    download.href = url;
    download.download = file.name.replace(/\.(ttf|otf)$/i, '') + '.' + format.value;
    download.hidden = false;
    status.textContent = `Ready · ${(result.length / 1024).toFixed(1)} KiB · ${((performance.now() - started) / 1000).toFixed(2)}s · no upload`;
    try {
      face = new FontFace('ConvertedPreview', result);
      await face.load();
      document.fonts.add(face);
      preview.style.fontFamily = 'ConvertedPreview, serif';
      preview.hidden = false;
    } catch { status.textContent += ' · Preview unavailable in this browser'; }
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'ABORTED: Conversion was cancelled.' : `${error.code || 'ERROR'}: ${error.message}`;
  } finally {
    busy(false);
  }
}
form.onsubmit = async event => {
  event.preventDefault();
  if (!selectedFile) {
    status.textContent = 'Choose an example or select a TTF or OTF font first.';
    return;
  }
  await runConversion(() => selectedFile);
};
for (const button of samples) {
  button.onclick = async () => {
    const inputFormat = button.dataset.sample;
    format.value = inputFormat === 'ttf' ? 'otf' : 'ttf';
    fileInput.value = '';
    selectedFile = undefined;
    for (const sample of samples) sample.setAttribute('aria-pressed', String(sample === button));
    selected.textContent = `Roboto Regular · hosted ${inputFormat.toUpperCase()} example`;
    status.textContent = 'Loading the hosted example…';
    await runConversion(async signal => {
      const name = `Roboto-Regular.${inputFormat}`;
      const response = await fetch(new URL(`../fonts/${name}`, import.meta.url), { signal });
      if (!response.ok) throw new Error('Could not load the example font. Please try again.');
      selectedFile = new File([await response.arrayBuffer()], name, { type: `font/${inputFormat}` });
      return selectedFile;
    });
  };
}
// Resolve these links relative to this module, both at the Pages root and /examples/browser/.
for (const link of document.querySelectorAll('[data-font-asset]')) {
  link.href = new URL(`../fonts/${link.dataset.fontAsset}`, import.meta.url).href;
}

// Cache public demo assets and examples, never user-selected fonts or outputs.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../../demo-service-worker.js', import.meta.url))
    .then(() => navigator.serviceWorker.ready)
    .then(() => { document.documentElement.dataset.offlineReady = 'true'; })
    .catch(() => { document.documentElement.dataset.offlineReady = 'false'; });
}
