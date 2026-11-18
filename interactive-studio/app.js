import {
  $,
  esc,
  options,
  icon,
  tell,
  handle,
  fmt,
  db,
  saveBlob,
  uid
} from './common.js';
import {
  Transport
} from './audio.js';
import {
  Microphone
} from './microphone.js';
import {
  Reader
} from './reader.js';
import {
  Teacher
} from './teacher.js';
import {
  modes,
  modeName,
  duration,
  measures,
  sections,
  importPack
} from './model.js';
const catalog = new Map(),
  builtins = new Map(),
  links = new URLSearchParams(location.search);
let song, part, mode = 'none',
  view = 'practice',
  busy = false,
  selection = 0,
  historyStart = 0,
  recAt = 0,
  lastStatus = '',
  pendingLink = null;
const engine = new Transport(() => {
  mic.stop();
  endHistory();
  drawState()
});
const mic = new Microphone(engine, (level, text) => {
  $('meter').firstElementChild.style.width = level + '%';
  $('meter').setAttribute('aria-valuenow', level);
  $('signal').textContent = text;
  $('micState').textContent = mic.stream ? 'On' : 'Off';
  $('micBtn').textContent = mic.stream ? 'Turn microphone off' : 'Enable microphone';
  $('calibrate').disabled = !mic.stream
});
const reader = new Reader(n => {
  if (mic.recording || busy) return;
  const m = map().find(x => x.n === n);
  if (m) seek(m.t)
});
const teacher = new Teacher({
  catalog,
  engine,
  preview: async (id, p) => {
    await switchView('practice', id, p)
  }
});
const urls = new Set();
const audioURL = blob => {
  const u = URL.createObjectURL(blob);
  urls.add(u);
  return u
};

function clearURLs() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear()
}
const total = () => song ? duration(song, mode) || 0 : 0,
  map = () => song ? measures(song, mode) : [],
  chosenSections = () => sections(song, mode);
const bounds = () => {
  const t = total(),
    m = map();
  if (!t) return {
    from: 0,
    to: 0
  };
  return m.length ? {
    from: m.find(x => x.n === +$('start').value)?.t ?? 0,
    to: m.find(x => x.n === +$('end').value)?.end ?? t
  } : {
    from: +$('start').value || 0,
    to: +$('end').value || t
  }
};
const muteKey = () => mode === 'synth' ? (part?.track ?? part?.id) : part?.id;
const canMute = () => mode === 'synth' ? song.notes.some(n => n.part === muteKey()) : mode === 'stems' ? song.stems
  .some(t => t.part === part?.id) : false;
const publisher =
  '<a href="https://www.youtube.com/watch?v=kiWhSMmCASo" target="_blank" rel="noopener">Hear Alfred Music’s performance ↗</a>';

function closeReference() {
  $('publisherBody').replaceChildren();
  $('publisherPlayer').hidden = true
}

function openReference() {
  pause();
  closeReference();
  $('publisherPlayer').hidden = false;
  const frame = document.createElement('iframe');
  frame.title = 'Alfred Music · Sleigh Ride, arranged by Michael Story';
  frame.src = 'https://www.youtube-nocookie.com/embed/kiWhSMmCASo';
  frame.allow = 'encrypted-media; fullscreen';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.style.cssText = 'width:100%;aspect-ratio:16 / 9;border:0;border-radius:5px';
  $('publisherBody').append(frame);
  const info = document.createElement('p');
  info.className = 'help';
  info.textContent =
    'Use the video controls while reading your part. The reference plays independently of the studio clock and recorder.';
  $('publisherBody').append(info);
  $('publisherBody').insertAdjacentHTML('beforeend', publisher)
}

function endHistory() {
  if (!historyStart || !song) return;
  const elapsed = (Date.now() - historyStart) / 1000;
  historyStart = 0;
  if (elapsed < .4) return;
  db('history', 'put', {
    id: uid(),
    date: Date.now(),
    title: song.title,
    part: part?.name || 'Unassigned',
    seconds: Math.round(elapsed),
    speed: engine.rate
  }).catch(() => tell('This browser could not save practice history.'))
}

function pause() {
  engine.stop();
  mic.stop();
  endHistory();
  drawState()
}

function loadParts(p) {
  part = song.parts.find(x => x.id === p) || song.parts[0];
  $('part').innerHTML = options(song.parts.map(p => [p.id, p.name]), part?.id);
  if (!part) $('part').innerHTML = '<option>No parts assigned</option>'
}
async function selectSong(id, p, query) {
  const gen = ++selection;
  closeReference();
  pause();
  engine.reset();
  song = catalog.get(id) || catalog.get('first-light') || catalog.values().next().value;
  mode = modes(song).includes(query?.get('source')) ? query.get('source') : modes(song).includes(song.preferredMode) ?
    song.preferredMode : modes(song)[0] || 'click';
  loadParts(p);
  $('song').innerHTML = options([...catalog.values()].map(s => [s.id, s.title]), song.id);
  $('mute').checked = false;
  $('loop').checked = false;
  engine.rate = 1;
  $('speed').value = 100;
  const ms = modes(song);
  $('pieceInfo').innerHTML = '<strong>' + esc(song.title) + '</strong> · ' + esc(song.credit ||
    'Teacher composition') + ' · ' + esc(song.kind) + '<br>' + (mode === 'click' ? (song.id === 'sleigh-ride' ?
        'Use the practice click or record your part. <button class="textbtn" id="tryDemo">Try ensemble playback with First Light →</button>' :
        'Practice metronome · Teacher desk accepts a matching arrangement or recording.') : mode === 'synth' ?
      'Synthesized ensemble · ' + (map().length ? map().length + ' measures' : 'No timing map') + (song.id ===
        'first-light' ? ' · Original DMS study.' : '') : 'Recorded accompaniment · ' + (map().length ?
        'Teacher-mapped measures' : 'Loop by seconds until a timing map is added.')) + (ms.length > 1 ?
      ' <label>Playback source <select id="sourcePick">' + options(ms.map(x => [x, modeName[x]]), mode) +
      '</select></label>' : '');
  if ($('tryDemo')) $('tryDemo').onclick = handle(() => selectSong('first-light'));
  if ($('sourcePick')) $('sourcePick').onchange = handle(e => selectSong(song.id, part?.id, new URLSearchParams({
    source: e.target.value
  })));
  $('referenceLine').hidden = !(song.id === 'sleigh-ride' && mode === 'click');
  $('referenceLine').innerHTML =
    '<span>Practice click · independent tempo</span><button class="textbtn" id="showReference">Listen with score ↗</button>';
  $('showReference').onclick = openReference;
  setRange();
  if (query) {
    const speed = +query.get('speed');
    if (speed >= 50 && speed <= 150) {
      $('speed').value = speed;
      engine.rate = speed / 100
    }
    if (query.has('from') && query.has('to')) {
      const from = +query.get('from'),
        to = +query.get('to');
      if (validRange(from, to)) {
        setCustom(from, to);
        $('loop').checked = query.get('loop') === '1'
      }
    }
    $('mute').checked = query.get('mute') === '1' && canMute();
    if (query.has('count')) $('count').checked = query.get('count') === '1'
  }
  engine.mute($('mute').checked ? muteKey() : '');
  engine.pos = bounds().from;
  drawState();
  try {
    await reader.select(part)
  } catch (e) {
    if (gen === selection) tell('Could not display this part: ' + e.message)
  }
  if (gen === selection) {
    reader.highlight(map().find(m => m.t <= engine.pos && m.end > engine.pos)?.n, false);
    drawState()
  }
}

function validRange(a, b) {
  const m = map();
  return m.length ? Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a && b <= m.at(-1).n : Number.isFinite(
    a) && Number.isFinite(b) && a >= 0 && b > a && b <= total() + .00001
}

function setRange() {
  const m = map(),
    last = m.at(-1)?.n,
    t = total();
  $('startLabel').firstElementChild.textContent = m.length ? 'From measure' : 'From second';
  $('endLabel').firstElementChild.textContent = m.length ? 'Through measure' : 'To second';
  for (const id of ['start', 'end']) {
    Object.assign($(id), {
      min: m.length ? 1 : 0,
      max: last || t,
      step: m.length ? '1' : 'any'
    })
  }
  $('start').value = m[0]?.n ?? 0;
  $('end').value = last ?? t;
  $('passage').innerHTML = options([
    ['all', 'Whole piece'], ...chosenSections().map((s, i) => [String(i), s.name]), ['custom', 'Custom passage']
  ], 'all')
}

function setCustom(a, b) {
  $('start').value = a;
  $('end').value = b;
  const ss = chosenSections(),
    i = ss.findIndex(x => x.from === a && x.to === b);
  $('passage').value = i >= 0 ? String(i) : a === (map().length ? 1 : 0) && b === (map().at(-1)?.n || total()) ? 'all' :
    'custom'
}

function updateRange() {
  const a = +$('start').value,
    b = +$('end').value;
  if (!validRange(a, b)) {
    setRange();
    tell('Choose a valid start and end inside this piece.')
  } else setCustom(a, b);
  pause();
  engine.pos = bounds().from;
  drawState()
}

function drawState() {
  if (!song) return;
  const playing = engine.playing,
    recording = mic.recording,
    locked = busy || recording,
    has = total() > 0,
    click = mode === 'click';
  $('play').innerHTML = icon(playing ? 'pause' : 'play') + '<span>' + (busy ? 'Preparing…' : playing ? 'Pause' : click ?
    'Start metronome' : 'Play ensemble') + '</span>';
  $('play').disabled = locked;
  $('restart').disabled = locked;
  $('record').disabled = busy;
  $('record').classList.toggle('live', recording);
  $('record').innerHTML = icon(recording ? 'stop' : 'record') + '<span>' + (recording ? 'Stop & save' : 'Record take') +
    '</span>';
  for (const id of ['speed', 'resetSpeed', 'count', 'loop', 'passage', 'start', 'end', 'seek']) $(id).disabled =
    locked || !has;
  for (const id of ['speed', 'resetSpeed', 'count']) $(id).disabled = locked;
  $('mixCaption').textContent = click ? 'Include metronome in take' : 'Include ensemble in take';
  $('gain').disabled = busy;
  $('micBtn').disabled = locked;
  $('mix').disabled = locked;
  $('mute').disabled = busy || !canMute();
  $('mute').title = canMute() ? 'Mute the selected playback track' : 'Requires a separate track assigned to this part.';
  for (const id of ['song', 'part', 'share']) $(id).disabled = locked;
  if ($('sourcePick')) $('sourcePick').disabled = locked;
  $('speedRead').textContent = (mode === 'synth' || click ? Math.round((song.bpm || 96) * engine.rate) + ' BPM · ' :
    '') + Math.round(engine.rate * 100) + '%';
  $('seek').max = total() || 1;
  $('statusDot').classList.toggle('hot', recording);
  updateClock()
}

function updateClock() {
  if (!song || view !== 'practice') return;
  const pos = engine.position,
    measure = map().find(x => x.t <= pos + .0001 && x.end > pos + .0001),
    rec = mic.recording;
  const st = busy ? 'Preparing audio…' : engine.counting ? 'Count-off · ' + Math.min(4, engine.counting) : rec ?
    'Recording' + (measure ? ' · Measure ' + measure.n : '') : engine.playing ? (measure ? 'Measure ' + measure.n + (
      measure.label ? ' · ' + measure.label : '') : mode === 'click' ? 'Practice metronome' : 'Playing') : total() ? (
      pos >= total() ? 'Complete' : pos > 0 ? 'Paused' : 'Ready') + (measure ? ' · Measure ' + measure.n : '') :
    'Ready · Independent practice';
  if (st !== lastStatus) {
    $('transportStatus').textContent = st;
    lastStatus = st
  }
  if (document.activeElement !== $('seek') || engine.playing) $('seek').value = pos;
  $('time').textContent = rec && !engine.playing ? 'REC  ' + fmt((Date.now() - recAt) / 1000) : fmt(pos) + (total() ?
    ' / ' + fmt(total()) : '');
  if (!busy) reader.highlight(measure?.n, engine.playing).catch(e => tell(e.message))
}
setInterval(updateClock, 110);
async function start(record = false, withCount = true) {
  if (busy) return;
  if (record && mic.recording) {
    pause();
    return
  }
  if (!record && engine.playing) {
    pause();
    return
  }
  if (record && engine.playing) pause();
  busy = true;
  drawState();
  let didRecord = false;
  try {
    await engine.unlock();
    if (record) await mic.enable();
    await engine.prepare(song, mode);
    const title = song.title,
      name = part?.name || 'Unassigned',
      speed = engine.rate,
      at = engine.pos,
      included = $('mix').checked;
    const begin = () => {
      if (record) {
        recAt = Date.now();
        mic.record(included, (blob, elapsed) => finishTake({
          id: uid(),
          date: Date.now(),
          title,
          part: name,
          speed,
          at,
          included,
          seconds: elapsed / 1000,
          blob
        }));
        didRecord = true
      }
      historyStart = Date.now()
    };
    if (total() || mode === 'click' && (!record || included)) {
      engine.start({
        song,
        mode,
        ...(total() ? bounds() : {
          from: 0,
          to: Infinity
        }),
        loop: $('loop').checked,
        count: withCount && $('count').checked,
        onStart: begin
      })
    } else if (record) begin()
  } catch (e) {
    engine.stop();
    if (didRecord) mic.stop();
    throw e
  } finally {
    busy = false;
    drawState()
  }
}
async function finishTake(t) {
  if (!t.blob.size) {
    tell('The microphone produced an empty take. Check its input and try again.');
    return
  }
  try {
    await db('takes', 'put', t);
    tell('Take saved on this device.');
    if (view === 'takes') await showTakes();
    else {
      clearURLs();
      $('lastTake').innerHTML = '<div class="takecard"><div><h3>Latest take</h3><p>' + esc(t.title) + ' · ' + esc(t
          .part) + '</p></div><audio controls src="' + audioURL(t.blob) +
        '"></audio><button id="allTakes">My takes →</button></div>';
      $('allTakes').onclick = handle(() => switchView('takes'))
    }
  } catch {
    saveBlob(t.blob, 'DMS-take.' + (t.blob.type.includes('mp4') ? 'm4a' : 'webm'));
    tell('Device storage is full or blocked. Your take was offered as a download.')
  }
  drawState()
}
async function seek(t) {
  const was = engine.playing;
  pause();
  const {
    from,
    to
  } = bounds();
  if (t < from || t >= to) {
    setRange();
    $('loop').checked = false
  }
  engine.pos = Math.max(0, Math.min(total(), t));
  if (was) await start(false, false);
  drawState()
}
async function showTakes() {
  clearURLs();
  $('lastTake').replaceChildren();
  const takes = (await db('takes', 'getAll')).sort((a, b) => b.date - a.date);
  $('takesList').innerHTML = takes.length ? takes.map(t => '<div class="takecard"><div><h3>' + esc(t.title) +
      '</h3><p>' + esc(t.part) + ' · ' + new Date(t.date).toLocaleString() + ' · ' + fmt(t.seconds) + ' · ' + (t
        .included ? 'With accompaniment' : 'Microphone only') + '</p></div><audio controls preload="metadata" src="' +
      audioURL(t.blob) + '"></audio><div class="btnrow"><button data-download="' + esc(t.id) +
      '">Download</button><button data-delete="' + esc(t.id) + '">Delete</button></div></div>').join('') :
    '<div class="empty"><h3>Your recordings appear here</h3>Choose Record take in the practice room. Recordings stay in this browser.</div>';
  $('takesList').querySelectorAll('[data-download]').forEach(b => b.onclick = () => {
    const t = takes.find(x => x.id === b.dataset.download);
    saveBlob(t.blob, t.title + ' - ' + t.part + (t.blob.type.includes('mp4') ? '.m4a' : '.webm'))
  });
  $('takesList').querySelectorAll('[data-delete]').forEach(b => b.onclick = handle(async () => {
    if (confirm('Delete this recorded take from this device?')) {
      await db('takes', 'delete', b.dataset.delete);
      await showTakes()
    }
  }));
  const h = (await db('history', 'getAll')).sort((a, b) => b.date - a.date);
  $('history').innerHTML = h.length ? h.slice(0, 40).map(x => '<div class="historyRow"><strong>' + esc(x.title) +
      '</strong> · ' + esc(x.part) + '<small>' + new Date(x.date).toLocaleString() + ' · ' + fmt(x.seconds) + ' · ' +
      Math.round(x.speed * 100) + '% tempo</small></div>').join('') :
    '<p class="muted">Completed practice sessions appear here.</p>'
}

function showLibrary() {
  $('libraryList').innerHTML = '<div class="libraryGrid">' + [...catalog.values()].map(s =>
    '<article class="workcard"><div class="cover">' + icon('score') + '</div><h2>' + esc(s.title) + '</h2><p>' + esc(s
      .credit || s.kind) + '</p><div class="tags">' + esc(s.kind) + ' · ' + s.parts.length + ' parts · ' + (modes(s)
      .length ? 'Ensemble playback' : 'Notation & recording') + '</div><button data-open="' + esc(s.id) +
    '">Open in practice room →</button></article>').join('') + '</div>';
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = handle(async () => {
    await switchView('practice', b.dataset.open)
  }))
}
async function switchView(v, pieceId, partId, query) {
  if (busy) return;
  closeReference();
  pause();
  mic.disable();
  document.querySelectorAll('audio').forEach(a => a.pause());
  document.querySelector('.reader').classList.remove('expanded');
  view = v;
  for (const e of document.querySelectorAll('.view')) e.hidden = e.id !== v;
  for (const b of document.querySelectorAll('[data-view]')) {
    b.classList.toggle('active', b.dataset.view === v);
    if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current')
  }
  if (v === 'teacher') {
    teacher.render(song?.id)
  } else if (v === 'library') showLibrary();
  else if (v === 'takes') await showTakes();
  else if (pieceId) await selectSong(pieceId, partId, query);
  else if (song && catalog.get(song.id) !== song) await selectSong(song.id, part?.id);
  window.scrollTo(0, 0)
}

function showLink() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  for (const [k, v] of Object.entries({
      piece: song.id,
      part: part?.id,
      source: mode,
      from: $('start').value,
      to: $('end').value,
      loop: +$('loop').checked,
      mute: +$('mute').checked,
      count: +$('count').checked,
      speed: $('speed').value,
      rev: song.revision
    }))
    if (v != null) u.searchParams.set(k, v);
  $('linkHelp').textContent = song.revision ?
    'This version uses local teacher edits. Give students the matching practice pack with the link. The studio’s access settings still apply.' :
    'This link opens the selected part and passage for people who can access this studio.';
  $('linkValue').value = u.href;
  $('linkDialog').showModal();
  $('linkValue').select()
}

function wire() {
  $('closePlayer').onclick = closeReference;
  document.querySelectorAll('[data-icon]').forEach(e => e.innerHTML = icon(e.dataset.icon));
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = handle(() => switchView(b.dataset.view)));
  $('song').onchange = handle(e => selectSong(e.target.value));
  $('part').onchange = handle(async e => {
    pause();
    loadParts(e.target.value);
    engine.mute($('mute').checked ? muteKey() : '');
    if (!canMute()) $('mute').checked = false;
    await reader.select(part);
    drawState()
  });
  $('play').onclick = handle(() => start());
  $('record').onclick = handle(() => start(true));
  $('restart').onclick = handle(async () => {
    const was = engine.playing;
    pause();
    engine.pos = bounds().from;
    if (was) await start();
    drawState()
  });
  $('seek').onchange = handle(e => seek(+e.target.value));
  $('mute').onchange = () => engine.mute($('mute').checked ? muteKey() : '');
  $('volume').oninput = e => {
    engine.setVolume(+e.target.value / 100);
    $('volRead').textContent = e.target.value + '%'
  };
  const speed = async () => {
    const was = engine.playing;
    pause();
    engine.rate = +$('speed').value / 100;
    drawState();
    if (was) await start(false, false)
  };
  $('speed').onchange = handle(speed);
  $('resetSpeed').onclick = handle(() => {
    $('speed').value = 100;
    return speed()
  });
  $('passage').onchange = () => {
    const ss = chosenSections()[+$('passage').value];
    if ($('passage').value === 'all') setRange();
    else if (ss) setCustom(ss.from, ss.to);
    pause();
    engine.pos = bounds().from;
    drawState()
  };
  $('start').onchange = updateRange;
  $('end').onchange = updateRange;
  $('loop').onchange = handle(async () => {
    const was = engine.playing;
    pause();
    if (was) await start(false, false)
  });
  $('micBtn').onclick = handle(async () => {
    if (busy) return;
    busy = true;
    drawState();
    try {
      mic.stream ? mic.disable() : await mic.enable()
    } finally {
      busy = false;
      drawState()
    }
  });
  $('gain').oninput = e => {
    mic.setGain(+e.target.value);
    $('gainRead').textContent = (+e.target.value).toFixed(2) + '×'
  };
  $('smart').onchange = e => {
    mic.smart = e.target.checked;
    if (mic.smart) mic.calibrate()
  };
  $('calibrate').onclick = () => mic.calibrate();
  for (const [id, step] of [
      ['prevPage', -1],
      ['nextPage', 1]
    ]) $(id).onclick = handle(async () => {
    reader.page += step;
    await reader.render()
  });
  for (const [id, step] of [
      ['smaller', -15],
      ['bigger', 15]
    ]) $(id).onclick = handle(async () => {
    reader.zoom = Math.max(70, Math.min(220, reader.zoom + step));
    await reader.render()
  });
  $('expand').onclick = () => {
    const expanded = document.querySelector('.reader').classList.toggle('expanded');
    $('expand').setAttribute('aria-label', expanded ? 'Close expanded sheet music' : 'Expand sheet music')
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelector('.reader').classList.remove('expanded')
  });
  $('share').onclick = showLink;
  $('copyLink').onclick = handle(async () => {
    try {
      await navigator.clipboard.writeText($('linkValue').value);
      tell('Practice link copied.')
    } catch {
      $('linkValue').select();
      tell('Select and copy the practice link.')
    }
  });
  document.querySelectorAll('.packageBtn').forEach(b => b.onclick = () => $('packInput').click());
  $('packInput').onchange = handle(async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const s = await importPack(f, builtins);
    if (pendingLink?.get('piece') === s.id && pendingLink.get('rev') && pendingLink.get('rev') !== s.revision)
      throw Error('This pack is a different revision. Open the matching pack for this assignment.');
    if (catalog.get(s.id)?.revision && !confirm('Replace the saved settings for ' + s.title + ' on this device?'))
      return;
    await db('pieces', 'put', s);
    catalog.set(s.id, s);
    const q = pendingLink?.get('piece') === s.id && (!pendingLink.get('rev') || pendingLink.get('rev') === s
      .revision) ? pendingLink : null;
    await switchView('practice', s.id, q?.get('part'), q);
    pendingLink = null;
    tell('Practice pack opened.')
  });
  window.addEventListener('pagehide', () => {
    engine.stop();
    mic.disable();
    endHistory()
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && view === 'practice' && (engine.playing || mic.stream)) {
      pause();
      mic.disable();
      tell('Practice paused when the studio moved to the background.')
    }
  })
}
async function init() {
  wire();
  const index = await fetch('./catalog.json').then(r => r.json());
  for (const path of index) {
    const r = await fetch(path);
    if (!r.ok) throw Error('A composition could not load. Refresh the studio.');
    const s = await r.json();
    s.notes.sort((a, b) => a.t - b.t);
    builtins.set(s.id, s);
    catalog.set(s.id, s)
  }
  try {
    for (const s of await db('pieces', 'getAll')) catalog.set(s.id, s)
  } catch {
    tell('Local storage is unavailable. Practice playback still works.')
  }
  const requested = links.get('piece');
  if (requested && (!catalog.has(requested) || (links.get('rev') && links.get('rev') !== catalog.get(requested)
      ?.revision))) {
    pendingLink = links;
    await selectSong('first-light');
    await switchView('library');
    tell('Open the matching practice pack from your teacher to use this assignment.');
    return
  }
  const first = requested || (catalog.has('sleigh-ride') ? 'sleigh-ride' : 'first-light');
  await selectSong(first, links.get('part') || (first === 'sleigh-ride' ? 'clarinet-2' : 'clarinet'), links)
}
init().catch(e => tell('Could not open the studio. ' + e.message));
