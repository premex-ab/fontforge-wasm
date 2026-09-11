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
let controller, url, face;
fileInput.onchange = () => { format.value = /\.otf$/i.test(fileInput.files[0]?.name) ? 'ttf' : 'otf'; };
cancel.onclick = () => controller?.abort();
form.onsubmit = async event => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  controller = new AbortController();
  submit.disabled = fileInput.disabled = format.disabled = true;
  cancel.hidden = false;
  download.hidden = preview.hidden = true;
  if (url) URL.revokeObjectURL(url);
  if (face) document.fonts.delete(face);
  status.textContent = 'Converting in a local worker…';
  try {
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
    status.textContent = `${error.code || 'ERROR'}: ${error.message}`;
  } finally {
    submit.disabled = fileInput.disabled = format.disabled = false;
    cancel.hidden = true;
  }
};

// Offline page/worker loading is the host application's responsibility. This
// optional demo cache is separate from the library and never stores font inputs.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../../demo-service-worker.js', import.meta.url))
    .then(() => navigator.serviceWorker.ready)
    .then(() => { document.documentElement.dataset.offlineReady = 'true'; })
    .catch(() => { document.documentElement.dataset.offlineReady = 'false'; });
}
