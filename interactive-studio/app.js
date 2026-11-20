import { levelUpId, beginnerId, duetId, lessonKey, isPackId, loadLevel, compactScore } from './level-up.js?v=duets-1';
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
const sleighId = 'sleigh-ride-story-120';
const classroom = new Map();
const studentChoices = [['first-light', 'First Light'], [levelUpId, 'LEVEL UP!'], [beginnerId, 'Beginner Pack'], [duetId, 'Holiday Duet Lab']];
const isPack = () => isPackId(song?.id);
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
  if (song?.id === levelUpId && song.level === 6 && engine.to >= total() - .001) $('finishLevel').hidden = false;
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
let showingScore = false;
async function showNotation() {
  const generation = selection;
  const selected = showingScore ? song.conductor : part;
  if (isPack() && selected) selected.pages = [compactScore.matches ? song.mobilePage : song.page];
  if (!selected) return;
  if (showingScore && !selected.pdfBlob && selected.pdfResource) {
    const response = await fetch(selected.pdfResource);
    if (!response.ok) throw Error('The conductor pages could not load.');
    selected.pdfBlob = await response.blob()
  }
  if (generation !== selection || selected !== (showingScore ? song.conductor : part)) return;
  $('scoreView').textContent = showingScore ? 'Instrumental part' : 'Conductor view';
  await reader.select(selected);
  await reader.highlight(map().find(m => m.t <= engine.position && m.end > engine.position)?.n, true)
}
async function selectSong(id, p, query) {
  if (classroom.has(id) && !catalog.has(id)) {
    const target = new URL(classroom.get(id));
    if (query) for (const [key, value] of query) target.searchParams.set(key, value);
    if (p) target.searchParams.set('part', p);
    location.assign(target.href);
    return;
  }
  const gen = ++selection;
  closeReference();
  pause();
  engine.reset();
  const nextSong = isPackId(id) ? await loadLevel(id, p, query?.get(lessonKey(id)), query) :
    catalog.get(id) || catalog.get('first-light') || catalog.values().next().value;
  if (gen !== selection) return;
  song = nextSong;
  const technique = isPack();
  $('practice').classList.toggle('technique', technique);
  $('lesson').hidden = $('levelPdf').hidden = $('stopExercise').hidden = !technique;
  $('duetControls').hidden = !song.duet;
  if (song.duet) {
    $('duetRole').value = song.duet.role;
    $('duetPartner').innerHTML = options(song.parts.map(p => [p.id, p.name]), song.duet.partner);
  }
  $('finishLevel').hidden = true;
  document.querySelector('label[for="volume"]').textContent = song.duet ? 'Duet volume' : technique ? 'Instrument volume' : 'Ensemble volume';
  if (technique) {
    mic.disable();
    $('level').innerHTML = options(song.levelTitles.map((title, i) => [i+1, (i+1) + ' · ' + title]), song.level);
    document.querySelector('label[for="level"]').textContent = song.duet ? 'Choose an arrangement' : song.id === beginnerId ? 'Choose a tune' : 'LEVEL UP!';
    $('levelCue').textContent = song.cue;
    $('levelPdf').href = song.pdf;
  }
  mode = modes(song).includes(query?.get('source')) ? query.get('source') : modes(song).includes(song.preferredMode) ?
    song.preferredMode : modes(song)[0] || 'click';
  showingScore = false;
  $('scoreView').hidden = !song.conductor;
  loadParts(technique ? song.selectedPart : p);
  $('song').innerHTML = options(studentChoices, song.id);
  $('song').value = song.id;
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
  if (technique) $('pieceInfo').textContent = part.name + ' · ' + map().length + ' measures · ' + (song.duet ? 'Part ' + song.duet.role.toUpperCase() : 'Solo practice');
  if ($('tryDemo')) $('tryDemo').onclick = handle(() => selectSong('first-light'));
  if ($('sourcePick')) $('sourcePick').onchange = handle(e => selectSong(song.id, part?.id, new URLSearchParams({
    source: e.target.value
  })));
  $('referenceLine').hidden = !(song.id === 'sleigh-ride' && mode === 'click');
  $('referenceLine').innerHTML =
    '<span>Practice click · independent tempo</span><button class="textbtn" id="showReference">Listen with score ↗</button>';
  $('showReference').onclick = openReference;
  setRange();
  configureMixer(technique && !song.duet ? 'mine' : query?.get('hear'));
  if (query) {
    if (technique) $('loop').checked = query.get('loop') === '1';
    const speed = +query.get('speed');
    if (speed >= 50 && speed <= 150) {
      $('speed').value = speed;
      engine.rate = speed / 100
    }
    if (query.has('from') && query.has('to')) {
      const from = +query.get('from'),
        to = +query.get('to');
      if (validRange(from, to) && (!technique || (from === 1 && to === map().length))) {
        setCustom(from, to);
        $('loop').checked = query.get('loop') === '1'
      }
    }
    $('mute').checked = !song.duet && query.get('mute') === '1' && $('isolation').value !== 'mine' && canMute();
    if (query.has('count')) $('count').checked = query.get('count') === '1'
  }
  engine.mute($('mute').checked ? muteKey() : '');
  engine.pos = bounds().from;
  drawState();
  try {
    await showNotation()
  } catch (e) {
    if (gen === selection) tell('Could not display this part: ' + e.message)
  }
  if (gen === selection) {
    reader.highlight(map().find(m => m.t <= engine.pos && m.end > engine.pos)?.n, false);
    drawState()
  }
}

function configureMixer(requested) {
  const picker = $('isolation');
  const label = $('isolationLabel');
  if (song.duet) {
    const hear = $('duetHear');
    hear.value = ['all', 'mine', 'partner'].includes(requested) ? requested : 'all';
    picker.innerHTML = hear.innerHTML;
    hear.onchange = () => {
      picker.value = hear.value;
      const track = hear.value === 'mine' ? part.id : song.duet.partnerTrack;
      engine.isolate(hear.value === 'all' ? null : [track]);
      drawState();
    };
    hear.onchange();
    return;
  }
  label.hidden = mode !== 'synth' && mode !== 'stems';
  const ids = new Set(mode === 'stems' ? (song.stems || []).map(s => s.part) : (song.notes || []).map(n => n.part));
  const tracks = song.parts.filter(p => ids.has(p.id));
  const groups = [...new Set(tracks.flatMap(p => [p.family, p.section]).filter(Boolean))];
  const choices = [['all','Full ensemble'], ...(canMute() ? [['mine','My part only']] : []), ...groups.map(g => ['group:' + g,g]),
    ...tracks.map(p => ['part:' + p.id,p.name])];
  picker.innerHTML = options(choices, choices.some(([k]) => k === requested) ? requested : 'all');
  function apply() {
    const id = picker.value;
    if (id === 'mine') {
      $('mute').checked = false;
      engine.mute('');
    }
    $('soloPart').setAttribute('aria-pressed', String(id === 'mine'));
    $('soloPart').textContent = id === 'mine' ? 'Return to ensemble' : 'Solo my part';
    const selected = id === 'mine' ? [muteKey()] : id.startsWith('group:') ? tracks.filter(p => p.family === id.slice(6) || p.section === id.slice(6)).map(p => p.id) :
      id.startsWith('part:') ? [id.slice(5)] : null;
    engine.isolate(selected)
  }
  picker.onchange = () => { apply(); drawState() };
  apply()
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
    'Start metronome' : song.duet ? ({all: 'Play both parts', mine: 'Play my part', partner: 'Play my partner'}[$('duetHear').value]) : $('isolation').value === 'mine' ? 'Play my part' : 'Play ensemble') + '</span>';
  $('play').disabled = locked;
  $('restart').disabled = $('stopExercise').disabled = $('level').disabled = locked;
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
  $('soloPart').hidden = !canMute();
  $('soloPart').disabled = locked;
  $('mute').disabled = busy || !canMute() || $('isolation').value === 'mine';
  $('mute').title = canMute() ? 'Mute the selected playback track' : 'Requires a separate track assigned to this part.';
  for (const id of ['song', 'part', 'share', 'duetRole', 'duetPartner', 'duetHear']) $(id).disabled = locked;
  if ($('sourcePick')) $('sourcePick').disabled = locked;
  $('isolation').disabled = locked;
  $('countLabel').textContent = (song.countBeats || 4) + ' clicks';
  $('speedRead').textContent = (mode === 'synth' || click ? (song.countBeatQuarters === 2 ? 'Half note = ' : '') + Math.round((song.bpm || 96) * engine.rate / (song.countBeatQuarters || 1)) + (song.countBeatQuarters === 2 ? ' · ' : ' BPM · ') :
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
  if (isPack()) $('finishLevel').hidden = true;
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
      if (!isPack()) historyStart = Date.now()
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
  const cards = studentChoices.map(([id, title]) => {
    const description = id === duetId ? 'Three holiday tunes for two players' : id === beginnerId ? 'Ten easy tunes in concert B-flat' : id === levelUpId ? 'Six solo technique studies' : 'Original DMS ensemble study';
    return '<article class="workcard"><div class="cover">' + icon('score') + '</div><h2>' + title +
      '</h2><p>' + description + '</p><button data-open="' + id + '">Open in practice room →</button></article>';
  });
  $('libraryList').innerHTML = '<div class="libraryGrid">' + cards.join('') + '</div>';
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = handle(async () => {
    await switchView('practice', b.dataset.open)
  }))
}
async function switchView(v, pieceId, partId, query, unlocked = false) {
  if (busy) return;
  if (v === 'teacher' && view !== 'teacher' && !unlocked) {
    $('deskForm').reset();
    $('deskError').textContent = '';
    $('deskGate').showModal();
    $('deskPin').focus();
    return;
  }
  if (view === 'teacher' && v !== 'teacher') $('teacherBody').replaceChildren();
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
  else if (song && !isPack() && catalog.get(song.id) !== song) await selectSong(song.id, part?.id);
  window.scrollTo(0, 0)
}

function showLink() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  for (const [k, v] of Object.entries({
      piece: song.id,
      ...(isPack() ? {[lessonKey(song.id)]: song.level} : {}),
      role: song.duet?.role,
      partner: song.duet?.partner,
      part: part?.id,
      source: mode,
      hear: $('isolation').value === 'all' ? null : $('isolation').value,
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

async function validDeskPin(pin) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode('164a3c5e5b9f8c909e7b6a4c66a917b2'), iterations: 180000}, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('') === '95b46dece007173d8040cba889eb32ba26dbcfb2012917403d30c1f95835205c';
}
function wire() {
  $('cancelDesk').onclick = () => $('deskGate').close();
  $('deskGate').onclose = () => $('deskForm').reset();
  $('deskForm').onsubmit = handle(async e => {
    e.preventDefault();
    const pin = $('deskPin').value;
    if (!await validDeskPin(pin)) {
      $('deskError').textContent = 'Incorrect PIN. Try again.';
      $('deskPin').select();
      return;
    }
    if (!$('deskGate').open) return;
    $('deskGate').close();
    await switchView('teacher', undefined, undefined, undefined, true);
  });
  $('soloPart').onclick = () => {
    $('isolation').value = $('isolation').value === 'mine' ? 'all' : 'mine';
    $('isolation').onchange();
  };
  $('scoreView').onclick = handle(async () => { showingScore = !showingScore; await showNotation() });
  $('closePlayer').onclick = closeReference;
  document.querySelectorAll('[data-icon]').forEach(e => e.innerHTML = icon(e.dataset.icon));
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = handle(() => switchView(b.dataset.view)));
  $('song').onchange = handle(e => selectSong(e.target.value, part?.id));
  const changeLevel = (id, level) => selectSong(song.id, id, new URLSearchParams({
    [lessonKey(song.id)]: level,
    ...(song.duet ? {role: $('duetRole').value, partner: $('duetPartner').value, hear: $('duetHear').value} : {}), speed: $('speed').value, count: +$('count').checked,
    loop: +$('loop').checked
  }));
  $('duetRole').onchange = $('duetPartner').onchange = handle(() => changeLevel($('part').value, $('level').value));
  $('level').onchange = handle(e => changeLevel($('part').value, e.target.value));
  $('stopExercise').onclick = () => {
    pause();
    engine.pos = 0;
    $('finishLevel').hidden = true;
    drawState()
  };
  compactScore.addEventListener('change', handle(async () => {
    if (isPack()) await showNotation()
  }));
  $('part').onchange = handle(async e => {
    if (isPack()) return changeLevel(e.target.value, $('level').value);
    pause();
    loadParts(e.target.value);
    configureMixer($('isolation').value);
    engine.mute($('mute').checked ? muteKey() : '');
    if (!canMute()) $('mute').checked = false;
    await showNotation();
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
// The optional public distribution pack is loaded only when it is actually
// present in this GitHub Pages deployment. Do not fall back to ChatGPT hosting.
async function preloadSleighRide() {
  if (catalog.has(sleighId)) return true;
  const resource = './assets/Sleigh-Ride-120.dms';
  let response;
  try {
    response = await fetch(resource);
  } catch {
    return false;
  }
  if (!response.ok) return false;
  try {
    const data = await response.blob();
    const s = await importPack(data, builtins);
    if (s.id !== sleighId) throw Error('The preloaded pack is not Sleigh Ride.');
    catalog.set(s.id, s);
    return true;
  } catch (error) {
    tell('Could not load the GitHub-hosted Sleigh Ride music: ' + error.message);
    return false;
  }
}
async function init() {
  wire();
  const index = await fetch('./catalog.json').then(r => r.json());
  for (const path of index) {
    if (typeof path === 'object' && path.studentURL) {
      classroom.set(path.id, path.studentURL);
      continue;
    }
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
  // Existing unversioned Classroom links also open the current student repertoire.
  const linked = links.get('piece');
  const requested = linked === sleighId && !links.has('rev') ? 'first-light' : linked;
  if (isPackId(requested)) return selectSong(requested, links.get('part'), links);
  if (requested === sleighId && !catalog.has(sleighId)) await preloadSleighRide();
  if (classroom.has(requested) && !links.has('rev')) {
    catalog.delete(requested);
    return selectSong(requested, links.get('part'), links);
  }
  if (requested && (!catalog.has(requested) || (links.get('rev') && links.get('rev') !== catalog.get(requested)
      ?.revision))) {
    pendingLink = links;
    await selectSong('first-light');
    await switchView('library');
    tell(requested === sleighId ? 'Sleigh Ride: open the authorized .dms practice pack from Classroom once. Future visits on this browser open directly.' : 'Open the matching practice pack from your teacher to use this assignment.');
    return
  }
  const first = requested || 'first-light';
  await selectSong(first, links.get('part') || (first === sleighId ? 'clarinet-2' : 'clarinet'), links)
}
init().catch(e => tell('Could not open the studio. ' + e.message));
