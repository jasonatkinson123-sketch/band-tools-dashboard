// Structured resources are decoded on the student's device. All exported times are
// seconds in the source performance. Note numbers are always sounding (concert) MIDI.
const EPS = 1e-7;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_NOTES = 180000;
const MAX_BARS = 20000;
const MAX_EVENT = 1000000;

function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}

function positive(value, label) {
  const n = Number(value);
  requireValue(Number.isFinite(n) && n > 0, 'Invalid ' + label + '.');
  return n;
}

function addTempo(list, q, bpm) {
  positive(bpm, 'tempo');
  list.push({
    q,
    bpm
  });
}

function tempoClock(changes) {
  const sorted = changes.slice().sort((a, b) => a.q - b.q);
  const points = [];
  for (const {
      q,
      bpm
    }
    of sorted) {
    const prev = points.at(-1);
    if (prev && Math.abs(q - prev.q) < EPS) {
      requireValue(Math.abs(bpm - prev.bpm) < 0.02,
        'Conflicting tempos at the same position. Export one conductor tempo map.');
    } else {
      points.push({
        q,
        bpm
      });
    }
  }
  if (!points.length || points[0].q > EPS) points.unshift({
    q: 0,
    bpm: 120
  });
  let prior;
  for (const point of points) {
    point.t = prior ? prior.t + (point.q - prior.q) * 60 / prior.bpm : 0;
    prior = point;
  }
  return {
    bpm: points[0].bpm,
    at(q) {
      let lo = 0,
        hi = points.length;
      while (lo + 1 < hi) {
        const mid = Math.floor((hi + lo) / 2);
        if (points[mid].q <= q + EPS) lo = mid;
        else hi = mid;
      }
      const p = points[lo];
      return p.t + (q - p.q) * 60 / p.bpm;
    }
  };
}

function finish(parts, events, bars, tempos, qEnd, warnings) {
  requireValue(events.length > 0, 'The file has no playable notes.');
  requireValue(bars.length <= MAX_BARS && events.length <= MAX_NOTES,
    'This score exceeds the studio import size limit.');
  const clock = tempoClock(tempos);
  return {
    parts,
    notes: events.map(e => ({
      part: e.part,
      midi: e.midi,
      t: clock.at(e.q),
      d: clock.at(e.end) - clock.at(e.q)
    })).sort((a, b) => a.t - b.t),
    measures: bars.map(({
      n,
      q,
      end,
      label
    }) => ({
      n,
      t: clock.at(q),
      end: clock.at(end),
      ...(label ? {
        label
      } : {})
    })),
    bpm: clock.bpm,
    duration: clock.at(qEnd),
    warnings: [...warnings]
  };
}

class MidiCursor {
  constructor(bytes, start = 0, end = bytes.length) {
    Object.assign(this, {
      bytes,
      p: start,
      end
    });
  }
  take(n) {
    requireValue(n >= 0 && this.p + n <= this.end, 'The MIDI file is truncated.');
    const p = this.p;
    this.p += n;
    return this.bytes.subarray(p, p + n);
  }
  byte() {
    return this.take(1)[0];
  }
  data() {
    const b = this.byte();
    requireValue(b < 128, 'Invalid MIDI event data.');
    return b;
  }
  uint(n) {
    return this.take(n).reduce((value, byte) => value * 256 + byte, 0);
  }
  varint() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.byte();
      value = value * 128 + (b & 127);
      if (b < 128) return value;
    }
    throw new Error('Invalid MIDI variable-length value.');
  }
  tag() {
    return String.fromCharCode(...this.take(4));
  }
}

function parseMidi(bytes) {
  const file = new MidiCursor(bytes);
  requireValue(file.tag() === 'MThd', 'Missing MIDI file header.');
  const header = new MidiCursor(file.take(file.uint(4)));
  const format = header.uint(2),
    trackCount = header.uint(2),
    ppq = header.uint(2);
  requireValue((format === 0 || format === 1) && trackCount > 0 && (format !== 0 || trackCount === 1),
    'Use a format 0 or 1 MIDI file with simultaneous tracks.');
  requireValue(ppq > 0 && !(ppq & 0x8000), 'SMPTE timecode MIDI cannot supply a beat grid. Export using PPQ.');
  const tempos = [],
    meters = [],
    events = [],
    parts = [],
    markers = [];
  const warnings = new Set([
    'MIDI measure numbers follow its meter grid. Align any printed pickup or different bar numbers in the teacher timing map.'
  ]);
  let totalTicks = 0,
    eventCount = 0;
  for (let ti = 0; ti < trackCount; ti++) {
    requireValue(file.tag() === 'MTrk', 'Missing MIDI track chunk.');
    const track = new MidiCursor(file.take(file.uint(4)));
    let tick = 0,
      status = 0,
      title = '',
      instrument = '',
      ended = false;
    const channels = new Map();

    function channelAt(channel) {
      let channelState = channels.get(channel);
      if (!channelState) {
        channelState = {
          part: 'midi-' + (ti + 1) + '-' + (channel + 1),
          keys: new Map(),
          pedal: false,
          held: [],
          used: false
        };
        channels.set(channel, channelState);
      }
      return channelState;
    }

    function close(state, key, start) {
      if (tick > start) {
        requireValue(events.length < MAX_NOTES, 'This MIDI file has too many notes.');
        events.push({
          part: state.part,
          midi: key,
          q: start / ppq,
          end: tick / ppq
        });
        state.used = true;
      }
    }

    function releasePedal(state) {
      for (const [key, start] of state.held) close(state, key, start);
      state.held.length = 0;
    }

    function endKeys(state) {
      for (const [key, starts] of state.keys)
        for (const t of starts) close(state, key, t);
      state.keys.clear();
      releasePedal(state);
    }
    while (track.p < track.end && !ended) {
      requireValue(++eventCount <= MAX_EVENT, 'This MIDI file has too many events.');
      tick += track.varint();
      let lead = track.bytes[track.p];
      if (lead >= 128) {
        track.byte();
      } else {
        requireValue(status !== 0, 'MIDI running status is missing.');
        lead = status;
      }
      if (lead === 0xff) {
        status = 0;
        const type = track.byte(),
          data = track.take(track.varint());
        const txt = () => new TextDecoder().decode(data).replace(/[\x00-\x1f]/g, '').trim().slice(0, 120);
        if (type === 0x03) title = txt();
        if (type === 0x04) instrument = txt();
        if (type === 0x06) markers.push({
          q: tick / ppq,
          label: txt()
        });
        if (type === 0x51) {
          requireValue(data.length === 3, 'Malformed MIDI tempo event.');
          const us = data[0] * 65536 + data[1] * 256 + data[2];
          addTempo(tempos, tick / ppq, 60000000 / positive(us, 'MIDI tempo'));
        }
        if (type === 0x58) {
          requireValue(data.length === 4 && data[0] > 0 && data[1] <= 8 && data[3] === 8,
            'Unsupported MIDI time signature or nonstandard notation beat scale.');
          meters.push({
            q: tick / ppq,
            len: data[0] * 4 / 2 ** data[1]
          });
        }
        if (type === 0x2f) ended = true;
        continue;
      }
      if (lead === 0xf0 || lead === 0xf7) {
        status = 0;
        track.take(track.varint());
        continue;
      }
      requireValue(lead >= 0x80 && lead < 0xf0, 'Unsupported MIDI system event.');
      status = lead;
      const op = lead >> 4,
        state = channelAt(lead & 15),
        a = track.data();
      const b = op === 12 || op === 13 ? 0 : track.data();
      if (op === 9 && b) {
        const starts = state.keys.get(a) || [];
        starts.push(tick);
        state.keys.set(a, starts);
      } else if (op === 8 || op === 9) {
        const starts = state.keys.get(a);
        if (!starts?.length) continue;
        const start = starts.shift();
        if (state.pedal) state.held.push([a, start]);
        else close(state, a, start);
      } else if (op === 11 && a === 64) {
        state.pedal = b >= 64;
        if (!state.pedal) releasePedal(state);
      } else if (op === 11 && (a === 120 || a === 123)) {
        endKeys(state);
      } else if (op === 14 && (a !== 0 || b !== 64)) {
        warnings.add('Pitch bends are omitted in the studio synthesizer.');
      }
    }
    for (const [channel, state] of channels) {
      endKeys(state);
      if (state.used) {
        const base = title || instrument || ('Track ' + (ti + 1));
        parts.push({
          id: state.part,
          name: base + (channels.size > 1 ? ' · Ch. ' + (channel + 1) : '')
        });
        if (channel === 9) warnings.add(
          'Percussion MIDI keys use the studio synthesizer. Add a drum stem for authentic percussion sounds.');
      }
    }
    totalTicks = Math.max(totalTicks, tick);
  }
  const end = totalTicks / ppq;
  const sorted = meters.sort((a, b) => a.q - b.q);
  const grid = [];
  for (const m of sorted) {
    if (grid.at(-1)?.q === m.q) {
      requireValue(grid.at(-1).len === m.len, 'Conflicting MIDI meter events at the same time.');
    } else grid.push(m);
  }
  if (!grid.length || grid[0].q > 0) grid.unshift({
    q: 0,
    len: 4
  });
  const labels = new Map(markers.map(m => [m.q, m.label]));
  const bars = [];
  for (let mi = 0; mi < grid.length; mi++) {
    const m = grid[mi],
      segmentEnd = grid[mi + 1]?.q ?? end;
    for (let q = m.q; q < segmentEnd - EPS; q += m.len) {
      requireValue(bars.length < MAX_BARS, 'MIDI measure count exceeds the import limit.');
      bars.push({
        n: bars.length + 1,
        q,
        end: Math.min(segmentEnd, q + m.len),
        label: labels.get(q)
      });
    }
  }
  return finish(parts, events, bars, tempos, end, warnings);
}

const children = (element, name) => Array.from(element?.children || []).filter(c => c.localName === name);
const child = (el, name) => Array.from(el?.children || []).find(c => c.localName === name);
const val = (el, name) => child(el, name)?.textContent.trim();
const descendants = (el, name) => Array.from(el.getElementsByTagNameNS('*', name));
const STEPS = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};
const UNITS = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125
};

function meterLength(time) {
  requireValue(!child(time, 'senza-misura') && !child(time, 'interchangeable'),
    'Free time and interchangeable meters need a manual timing map.');
  const beats = children(time, 'beats'),
    units = children(time, 'beat-type');
  requireValue(beats.length && beats.length === units.length, 'Malformed MusicXML meter.');
  return beats.reduce((sum, el, i) => {
    const numerator = el.textContent.trim().split('+').reduce((s, n) => s + positive(n, 'MusicXML meter'), 0);
    return sum + 4 * numerator / positive(units[i].textContent, 'MusicXML meter unit');
  }, 0);
}

function soundDirectives(element, at, measure, divisions, warnings) {
  const direct = element.localName === 'direction';
  const offset = direct ? child(element, 'offset') : null;
  const sound = direct ? child(element, 'sound') : element;
  const soundOffset = sound && child(sound, 'offset');
  let q = at;
  if (soundOffset) q += Number(soundOffset.textContent) / divisions;
  else if (offset && offset.getAttribute('sound') === 'yes') q += Number(offset.textContent) / divisions;
  requireValue(Number.isFinite(q), 'Invalid MusicXML direction offset.');
  if (sound) {
    for (const k of ['dacapo', 'dalsegno', 'tocoda', 'fine', 'forward-repeat', 'time-only']) {
      requireValue(!sound.hasAttribute(k), 'Export an expanded MusicXML performance without jumps or repeats.');
    }
  }
  const tempoAttr = sound?.getAttribute('tempo');
  if (tempoAttr) addTempo(measure.tempos, q, positive(tempoAttr, 'MusicXML playback tempo'));
  if (!direct) return;
  for (const dt of children(element, 'direction-type')) {
    const rehearsal = val(dt, 'rehearsal');
    if (rehearsal && Math.abs(q) < EPS) measure.label = rehearsal.slice(0, 100);
    const words = val(dt, 'words') || '';
    requireValue(!/\b(?:D\s*\.?\s*[SC]\.(?=\s|$)|da capo\b|dal segno\b|al coda\b|to coda\b|al fine\b)/i.test(words),
      'Expand MusicXML jumps before importing the score.');
    const met = child(dt, 'metronome');
    if (met && !tempoAttr) {
      const perMinute = Number(val(met, 'per-minute'));
      const unit = UNITS[val(met, 'beat-unit')];
      const dots = children(met, 'beat-unit-dot').length;
      requireValue(perMinute > 0 && unit && children(met, 'beat-unit').length === 1,
        'Add a numeric playback tempo to metric modulations or tempo ranges.');
      addTempo(measure.tempos, q, perMinute * unit * (2 - 2 ** -dots));
    }
    if (/\b(rit\.?|rall\.?|accel\.?|rubato)\b/i.test(words)) {
      warnings.add('Expressive tempo text follows only explicit machine-readable tempo events.');
    }
  }
}

function readXmlPart(element, part, percussion, warnings) {
  const notes = [],
    rows = [];
  let divisions = 1,
    meter = null,
    defaultShift = 0,
    shiftByStaff = new Map();
  let transposeSeen = false;
  for (const measure of children(element, 'measure')) {
    requireValue(rows.length < MAX_BARS, 'MusicXML measure count exceeds the import limit.');
    const row = {
      extent: 0,
      tempos: [],
      label: '',
      implicit: measure.getAttribute('implicit') === 'yes',
      printed: measure.getAttribute('number')
    };
    let cursor = 0,
      previousOnset;
    for (const e of measure.children) {
      switch (e.localName) {
        case 'attributes': {
          if (child(e, 'divisions')) divisions = positive(val(e, 'divisions'), 'divisions');
          for (const time of children(e, 'time')) {
            requireValue(Math.abs(cursor) < EPS && !time.hasAttribute('number'),
              'Mid-measure or independent staff meters require a manual timing map.');
            meter = meterLength(time);
          }
          for (const tr of children(e, 'transpose')) {
            const shift = Number(val(tr, 'chromatic')) + 12 * Number(val(tr, 'octave-change') || 0);
            requireValue(Number.isInteger(shift) && !child(tr, 'double'), 'Unsupported MusicXML transposition.');
            transposeSeen = true;
            if (tr.hasAttribute('number')) shiftByStaff.set(tr.getAttribute('number'), shift);
            else {
              defaultShift = shift;
              shiftByStaff.clear();
            }
          }
          break;
        }
        case 'sound':
        case 'direction':
          soundDirectives(e, cursor, row, divisions, warnings);
          break;
        case 'backup':
        case 'forward': {
          const amount = positive(val(e, 'duration'), 'voice movement') / divisions;
          cursor += e.localName === 'backup' ? -amount : amount;
          requireValue(cursor >= -EPS, 'A MusicXML voice moves before its measure.');
          row.extent = Math.max(row.extent, cursor);
          previousOnset = undefined;
          break;
        }
        case 'note': {
          if (child(e, 'grace')) {
            warnings.add('Grace notes are omitted. Written beat durations are preserved.');
            break;
          }
          requireValue(!child(e, 'cue') || child(e, 'duration'), 'This cue has no duration.');
          const d = positive(val(e, 'duration'), 'MusicXML note duration') / divisions;
          const chord = !!child(e, 'chord');
          requireValue(!chord || previousOnset !== undefined, 'A chord note is missing its starting note.');
          const q = chord ? previousOnset : cursor;
          if (!chord) {
            previousOnset = q;
            cursor += d;
          }
          row.extent = Math.max(row.extent, cursor, q + d);
          if (child(e, 'rest') || child(e, 'cue') || e.getAttribute('play') === 'no') break;
          const staff = val(e, 'staff') || '1',
            voice = val(e, 'voice') || '1';
          const pitch = child(e, 'pitch');
          let midi;
          if (pitch) {
            const step = STEPS[val(pitch, 'step')],
              octave = Number(val(pitch, 'octave'));
            const alter = Number(val(pitch, 'alter') || 0);
            const shift = shiftByStaff.get(staff) ?? defaultShift;
            midi = 12 * (octave + 1) + step + alter + shift;
            requireValue(Number.isInteger(midi) && midi >= 0 && midi <= 127,
              'This MusicXML has an invalid or microtonal pitch.');
          } else if (child(e, 'unpitched')) {
            const id = child(e, 'instrument')?.getAttribute('id');
            midi = percussion.get(id);
            if (midi === undefined && percussion.size === 1) midi = [...percussion.values()][0];
            if (midi === undefined) {
              warnings.add('Unpitched percussion without a MIDI key is silent. Attach a percussion stem.');
              break;
            }
            warnings.add(
            'Mapped percussion keys use the studio synthesizer. Attach a drum stem for realistic timbres.');
          } else throw new Error('Unrecognized MusicXML note type.');
          const ties = children(e, 'tie').map(t => t.getAttribute('type'));
          requireValue(notes.length < MAX_NOTES, 'This part has too many notes.');
          notes.push({
            row: rows.length,
            part: part.id,
            midi,
            q,
            d,
            voice,
            staff,
            startTie: ties.includes('start'),
            stopTie: ties.includes('stop')
          });
          break;
        }
      }
    }
    row.meter = meter;
    rows.push(row);
  }
  if (!transposeSeen && /clarinet|trumpet|sax|horn|cornet/i.test(part.name)) {
    warnings.add(part.name + ' has no encoded transposition. Verify that its pitches were exported at concert pitch.');
  }
  return {
    rows,
    notes
  };
}

function parseXml(text) {
  requireValue(!/<!ENTITY\s/i.test(text), 'MusicXML entity declarations are unsupported.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const root = doc.documentElement;
  requireValue(!descendants(doc, 'parsererror').length && root.localName === 'score-partwise',
    'Use a well-formed, uncompressed score-partwise MusicXML file.');
  for (const tag of ['repeat', 'ending', 'measure-repeat', 'multiple-rest', 'beat-repeat', 'segno', 'coda',
      'octave-shift', 'scordatura', 'swing'
    ]) {
    requireValue(!descendants(root, tag).length, 'Expand or resolve “' + tag +
      '” in the MusicXML before importing, or use a rendered audio track.');
  }
  const scoreParts = child(root, 'part-list'),
    metadata = new Map();
  for (const sp of children(scoreParts, 'score-part')) {
    const id = sp.getAttribute('id'),
      percussion = new Map();
    for (const mi of children(sp, 'midi-instrument')) {
      const key = val(mi, 'midi-unpitched');
      if (key !== undefined) {
        const midi = Number(key) - 1;
        requireValue(Number.isInteger(midi) && midi >= 0 && midi <= 127, 'Invalid percussion key.');
        percussion.set(mi.getAttribute('id'), midi);
      }
    }
    requireValue(id && !metadata.has(id), 'Missing or duplicate MusicXML part ID.');
    metadata.set(id, {
      part: {
        id: 'xml-' + id,
        name: val(sp, 'part-name') || id
      },
      percussion
    });
  }
  const warnings = new Set(),
    parsed = [],
    parts = [],
    ids = new Set();
  for (const p of children(root, 'part')) {
    const original = p.getAttribute('id'),
      info = metadata.get(original);
    requireValue(info && !ids.has(original), 'MusicXML part list does not match its parts.');
    ids.add(original);
    parsed.push(readXmlPart(p, info.part, info.percussion, warnings));
    parts.push(info.part);
  }
  requireValue(parsed.length > 0 && parsed.every(p => p.rows.length === parsed[0].rows.length),
    'All parts must use the same expanded measure sequence.');
  const bars = [],
    tempos = [],
    events = [];
  let end = 0;
  for (let i = 0; i < parsed[0].rows.length; i++) {
    const rows = parsed.map(p => p.rows[i]);
    const actual = Math.max(...rows.map(r => r.extent));
    const meter = rows.find(r => r.meter !== null)?.meter;
    requireValue(!meter || rows.every(r => r.meter === null || Math.abs(r.meter - meter) < EPS),
      'Different meters across parts need a manual timing map.');
    const implicit = rows.some(r => r.implicit);
    const len = actual && (implicit || i === 0) ? actual : Math.max(actual, meter || 0);
    requireValue(len > 0, 'Cannot determine the length of an empty MusicXML bar.');
    if (meter && actual > meter + EPS && !implicit) {
      throw new Error('MusicXML measure ' + (i + 1) +
        ' exceeds its meter. Resolve the voice durations before importing.');
    }
    const written = rows[0].printed;
    requireValue(rows.every(r => !r.printed || !written || r.printed === written),
      'Part measure numbers do not agree. Align the parts before importing.');
    let label = rows.find(r => r.label)?.label;
    if (!label && written && written !== String(i + 1)) label = 'Printed m. ' + written;
    bars.push({
      n: i + 1,
      q: end,
      end: end + len,
      label
    });
    for (const row of rows) {
      for (const change of row.tempos) {
        requireValue(change.q >= -EPS && change.q <= len + EPS, 'A tempo direction falls outside its measure.');
        addTempo(tempos, end + Math.max(0, change.q), change.bpm);
      }
    }
    end += len;
  }
  for (const p of parsed) {
    const tied = new Map();
    for (const note of p.notes) {
      const q = bars[note.row].q + note.q;
      const key = [note.voice, note.staff, note.midi].join('/');
      let e = tied.get(key);
      if (note.stopTie && e && Math.abs(e.end - q) < EPS) {
        e.end = q + note.d;
      } else {
        if (note.stopTie) warnings.add('A tie with no matching start was played as a new note.');
        e = {
          part: note.part,
          midi: note.midi,
          q,
          end: q + note.d
        };
        events.push(e);
      }
      if (note.startTie) tied.set(key, e);
      else tied.delete(key);
    }
  }
  if (!tempos.length) warnings.add(
    'No numeric source tempo was found. Playback starts at 120 quarter notes per minute.');
  return finish(parts, events, bars, tempos, end, warnings);
}

export async function parseStructured(file) {
  requireValue(file && file.size > 0 && file.size <= MAX_BYTES,
    'Choose a nonempty MIDI or MusicXML file under 16 MiB.');
  const data = new Uint8Array(await file.arrayBuffer());
  const signature = String.fromCharCode(...data.subarray(0, 4));
  if (signature === 'MThd') return parseMidi(data);
  if (signature.startsWith('PK') || /\.mxl$/i.test(file.name || '')) {
    requireValue(typeof JSZip !== 'undefined', 'The MusicXML ZIP reader is unavailable.');
    const archive = await JSZip.loadAsync(data);
    const manifest = archive.file('META-INF/container.xml');
    requireValue(manifest && manifest._data.uncompressedSize < 65536, 'This MXL has no valid container manifest.');
    const doc = new DOMParser().parseFromString(await manifest.async('string'), 'application/xml');
    const entry = Array.from(doc.getElementsByTagNameNS('*', 'rootfile')).find(x => !x.hasAttribute('media-type') || x
      .getAttribute('media-type').includes('musicxml'));
    const score = entry && archive.file(entry.getAttribute('full-path'));
    requireValue(score && score._data.uncompressedSize <= MAX_BYTES,
      'The MXL score must be present and under 16 MiB.');
    return parseXml(await score.async('string'));
  }
  requireValue(!/\.midi?$/i.test(file.name || ''), 'Invalid MIDI file header.');
  let encoding = 'utf-8';
  if (data[0] === 0xff && data[1] === 0xfe) encoding = 'utf-16le';
  if (data[0] === 0xfe && data[1] === 0xff) encoding = 'utf-16be';
  return parseXml(new TextDecoder(encoding).decode(data));
}
