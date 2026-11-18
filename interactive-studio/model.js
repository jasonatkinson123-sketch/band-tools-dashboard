import {
  uid
} from './common.js';
export const modes = s => [...(s.notes?.length ? ['synth'] : []), ...(s.mix ? ['mix'] : []), ...(s.stems?.length ? [
  'stems'
] : []), ...(s.clickDuration ? ['click'] : [])];
export const modeName = {
  synth: 'Score playback',
  mix: 'Full recording',
  stems: 'Instrument stems',
  click: 'Practice metronome',
  none: 'Sheet music only'
};
export const duration = (s, m) => m === 'mix' ? s.mixDuration : m === 'stems' ? Math.max(0, ...s.stems.map(x => x
  .duration)) : m === 'synth' ? s.duration : m === 'click' ? s.clickDuration || 0 : 0;
export const measures = (s, m) => m === 'synth' ? s.measures || [] : s[m + 'Map'] || [];
export const sections = (s, m) => m === 'synth' ? s.sections || [] : s[m + 'Sections'] || [];
export const newPiece = (title) => ({
  id: uid(),
  title,
  credit: '',
  kind: 'Teacher composition',
  bpm: 96,
  duration: 0,
  parts: [],
  notes: [],
  measures: [],
  sections: []
});
export function mapRows(raw, total) {
  let prev = 0;
  return raw.split(/\r?\n/).filter(x => x.trim()).map((line, i) => {
    const [a, b, c, ...rest] = line.split(',').map(x => x.trim());
    const n = +a,
      t = +b,
      end = +c;
    if (!a || !b || !c || !Number.isInteger(n) || n !== i + 1 || !Number.isFinite(t) || !Number.isFinite(end) || t <
      prev - .00001 || end <= t || end > total + .025) throw Error('Timing row ' + (i + 1) +
      ' needs a consecutive measure number, non-overlapping start and end seconds within the recording.');
    prev = end;
    return {
      n,
      t,
      end,
      label: rest.join(', ')
    }
  })
}
export function sectionRows(raw, map) {
  return raw.split(/\r?\n/).filter(x => x.trim()).map(line => {
    const [name, f, e] = line.split(',').map(x => x.trim());
    if (!name || !map.some(x => x.n === +f) || !map.some(x => x.n === +e) || +e < +f) throw Error(
      'Each section needs a name and two valid measures.');
    return {
      name,
      from: +f,
      to: +e
    }
  })
}
export function locationRows(raw, count, map) {
  const seen = new Set();
  return raw.split(/\r?\n/).filter(x => x.trim()).map(line => {
    const fields = line.split(',').map(x => x.trim());
    const [n, page, x, y, w, h] = fields.map(Number);
    if (fields.length !== 6 || fields.some(v => !v) || ![n, page, x, y, w, h].every(Number.isFinite) || !map.some(
        m => m.n === n) || seen.has(n) || !Number.isInteger(page) || page < 1 || page > count || x < 0 || y < 0 ||
      w <= 0 || h <= 0 || x + w > 100.01 || y + h > 100.01) throw Error(
      'Page locations need one valid row per mapped measure. Coordinates are percentages within the page.');
    seen.add(n);
    return {
      n,
      page,
      x,
      y,
      w,
      h
    }
  })
}
export async function exportPack(song) {
  const zip = new JSZip(),
    copy = structuredClone(song);
  let i = 0;

  function file(blob) {
    const name = 'resources/' + (++i);
    zip.file(name, blob);
    return {
      file: name,
      type: blob.type
    }
  }
  for (const p of copy.parts) {
    if (!p.pdfBlob && p.pdfResource) {
      const r = await fetch(p.pdfResource);
      if (!r.ok) throw Error("A printed part could not be exported.");
      p.pdfBlob = await r.blob();
      p.pageCount = p.pages.length
    }
    if (p.pdfBlob) p.pdfBlob = file(p.pdfBlob);
    delete p.pdfResource;
    delete p.pages
  }
  if (copy.mix) copy.mix = file(copy.mix);
  for (const s of copy.stems || []) s.file = file(s.file);
  if (copy.structuredFile) copy.structuredFile = file(copy.structuredFile);
  zip.file('studio.json', JSON.stringify({
    version: 1,
    song: copy
  }));
  return zip.generateAsync({
    type: 'blob',
    compression: 'STORE'
  })
}
const arrays = (s, k, max) => {
  if (!Array.isArray(s[k]) || s[k].length > max) throw Error('Invalid practice pack: ' + k);
  return s[k]
};
export async function importPack(file, builtins) {
  if (file.size > 180 * 1024 * 1024) throw Error('Practice pack exceeds 180 MB.');
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files);
  if (entries.length > 180 || entries.reduce((sum, f) => sum + (f._data?.uncompressedSize || 0), 0) > 200 * 1024 *
    1024) throw Error('Practice pack is too large for this device.');
  const manifest = zip.file('studio.json');
  if (!manifest) throw Error('Missing studio.json. Choose a DMS practice pack.');
  const {
    version,
    song: s
  } = JSON.parse(await manifest.async('string'));
  if (version !== 1 || !s || typeof s.title !== 'string' || !s.title.trim() || typeof s.id !== 'string' || !s.id
    .match(/^[a-zA-Z0-9-]{1,80}$/)) throw Error('Unrecognized practice pack.');
  const parts = arrays(s, 'parts', 128),
    notes = arrays(s, 'notes', 200000);
  if (parts.some(p => typeof p.id !== 'string' || typeof p.name !== 'string') || new Set(parts.map(p => p.id))
    .size !== parts.length) throw Error('Invalid instrumental parts.');
  if (!Number.isFinite(s.duration) || s.duration < 0 || !Number.isFinite(s.bpm) || s.bpm < 0 || s.bpm > 600 || notes
    .some(n => !Number.isFinite(n.t) || !Number.isFinite(n.d) || n.t < 0 || n.d <= 0 || !Number.isInteger(n.midi) || n
      .midi < 0 || n.midi > 127 || typeof n.part !== 'string')) throw Error('Invalid playback data.');
  async function blob(ref) {
    if (!ref || typeof ref.file !== 'string' || !/^resources\/\d+$/.test(ref.file) || !zip.file(ref.file))
    throw Error('Missing pack resource.');
    return new Blob([await zip.file(ref.file).async('arraybuffer')], {
      type: String(ref.type || 'application/octet-stream')
    })
  }
  const base = builtins.get(s.id);
  for (const p of parts) {
    delete p.pages;
    delete p.pdfResource;
    if (p.pdfBlob) p.pdfBlob = await blob(p.pdfBlob);
    else p.pages = base?.parts.find(x => x.id === p.id)?.pages || [];
    if (p.locations && !Array.isArray(p.locations)) throw Error('Invalid score locations.')
  }
  if (s.mix) {
    s.mix = await blob(s.mix);
    if (!(s.mixDuration > 0 && Number.isFinite(s.mixDuration))) throw Error('Invalid recording duration.')
  }
  for (const st of s.stems || []) {
    st.file = await blob(st.file);
    if (!parts.some(p => p.id === st.part) || !(st.duration > 0 && Number.isFinite(st.duration))) throw Error(
      'Invalid stem.')
  }
  if (s.structuredFile) s.structuredFile = await blob(s.structuredFile);
  for (const m of modes(s)) {
    const rows = measures(s, m);
    mapRows(rows.map(r => [r.n, r.t, r.end, r.label || ''].join(',')).join('\n'), duration(s, m));
    sectionRows(sections(s, m).map(r => [r.name, r.from, r.to].join(',')).join('\n'), rows)
  }
  s.notes.sort((a, b) => a.t - b.t);
  return s
}
