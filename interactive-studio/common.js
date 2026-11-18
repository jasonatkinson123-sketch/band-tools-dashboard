export const $ = id => document.getElementById(id);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [x]));
export const fmt = v => Math.floor(Math.max(0, v || 0) / 60) + ':' + String(Math.floor(Math.max(0, v || 0) % 60))
  .padStart(2, '0');
export const options = (items, sel) => items.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(sel) === String(
  v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
export function tell(msg) {
  $('notice').textContent = msg;
  $('notice').hidden = false;
  clearTimeout(tell.timer);
  tell.timer = setTimeout(() => $('notice').hidden = true, 8000)
}
export function handle(fn) {
  return async e => {
    try {
      await fn(e)
    } catch (err) {
      tell(err.name === 'NotAllowedError' ?
        'Microphone permission was denied. Allow microphone access in the browser’s site settings, then try again.' :
        err.message || 'The operation could not finish.')
    }
  }
}
export const uid = () => crypto.randomUUID();
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('dms-interactive-studio', 1);
  req.onupgradeneeded = () => {
    for (const name of ['pieces', 'takes', 'history']) req.result.createObjectStore(name, {
      keyPath: 'id'
    })
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error)
});
export async function db(store, op, arg) {
  const conn = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(store, ['put', 'delete'].includes(op) ? 'readwrite' : 'readonly');
    const req = tx.objectStore(store)[op](...(arg === undefined ? [] : [arg]));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error || req.error || Error('Device storage is unavailable.'))
  })
}
export function saveBlob(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 30000)
}
const paths = {
  score: 'M4 5h16v15H4z M8 2v5m8-5v5M7 11h10M7 14h10M7 17h6',
  library: 'M3 4h4v16H3z M10 4h3v16h-3z M15 5l4-1 3 15-4 1z',
  wave: 'M2 11v2m4-6v10m4-14v18m4-16v14m4-12v10m4-6v2',
  sliders: 'M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11M10 3v6m5 0v6m-8 0v6',
  expand: 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',
  restart: 'M5 5v14m14-13L8 12l11 6z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 5h3v14H7zm7 0h3v14h-3z',
  record: 'M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
  stop: 'M6 6h12v12H6z',
  loop: 'M4 9q1-4 5-4h10m-3-3 3 3-3 3M20 15q-1 4-5 4H5m3-3-3 3 3 3',
  volume: 'M3 9h4l5-4v14l-5-4H3z M16 8q4 4 0 8m3-11q7 7 0 14',
  count: 'M4 19 9 4h4l6 15z M11 15l7-10',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 1 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8',
  link: 'M10 7l3-3a5 5 0 0 1 7 7l-3 3M14 17l-3 3a5 5 0 0 1-7-7l3-3m1 6 8-8',
  folder: 'M3 6h6l2 3h10v11H3z'
};
export const icon = k => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="' + (['play', 'pause', 'record', 'stop']
    .includes(k) ? 'currentColor' : 'none') +
  '" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths[k] +
  '"/></svg>';

// An import can finish after another edit or a save from a second tab.
export async function saveRevision(piece, expected) {
  const conn = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('pieces', 'readwrite');
    const store = tx.objectStore('pieces');
    const current = store.get(piece.id);
    let conflict = false;
    current.onsuccess = () => {
      if ((current.result?.revision || '') !== (expected || '')) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(piece);
    };
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(conflict ? Error(
      'A newer edit was saved. Reload the studio before editing this piece again.') : tx.error || Error(
      'Could not save this change.'));
  });
}
