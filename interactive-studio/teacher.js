import {
  $,
  esc,
  options,
  uid,
  handle,
  tell,
  saveRevision,
  saveBlob
} from './common.js';
import {
  parseStructured
} from './structured.js';
import {
  modes,
  modeName,
  duration,
  measures,
  sections,
  newPiece,
  mapRows,
  sectionRows,
  locationRows,
  exportPack
} from './model.js';
const click = (id, fn) => $(id).onclick = handle(fn),
  val = id => $(id).value.trim();
export class Teacher {
  constructor(api) {
    this.api = api
  }
  render(id = this.id) {
    const {
      catalog
    } = this.api;
    const s = catalog.get(id) || [...catalog.values()][0];
    this.id = s.id;
    const part = s.parts.find(p => p.id === this.p) || s.parts[0];
    this.p = part?.id;
    const ms = modes(s);
    if (!ms.includes(this.mode)) this.mode = s.preferredMode && ms.includes(s.preferredMode) ? s.preferredMode : ms[
      0] || 'none';
    const m = this.mode,
      map = measures(s, m);
    $('teacherBody').innerHTML =
      '<div class="teacherGrid"><div class="teacherList"><button id="newPiece" class="primary">＋ Add composition</button>' +
      [...catalog.values()].map(x => '<button class="' + (s.id === x.id ? 'selected' : '') + '" data-edit="' + esc(x
        .id) + '">' + esc(x.title) + '</button>').join('') + '</div><div><div class="editcard"><h2>' + esc(s.title) +
      '</h2><p>Edits stay in this browser. Export a practice pack to move your edits and attached files to another device.</p><div class="formgrid"><label>Composition title<input id="editTitle" value="' +
      esc(s.title) + '"></label><label>Composer / arranger<input id="credit" value="' + esc(s.credit) +
      '"></label></div><div class="btnrow"><button id="saveMeta">Save title &amp; credit</button><button id="preview" class="primary">Student preview</button><button id="packOut">Export practice pack</button></div></div>' +
      '<div class="editcard"><h2>Instrumental parts</h2><div class="formgrid"><label>Selected part<select id="editPart">' +
      (part ? options(s.parts.map(p => [p.id, p.name]), part.id) : '<option>Add a part below</option>') +
      '</select></label><label>New part name<input id="newPartName" placeholder="e.g. B♭ Clarinet 2"></label></div><div class="btnrow"><button id="addPart">Add part</button></div>' +
      (part ? '<div class="resourceRow"><span>' + esc(part.name) + ' · ' + (part.pdfBlob ? 'Attached PDF' : part.pages
          ?.length ? part.pages.length + ' engraved pages' : 'Awaiting notation') +
        '</span></div><label class="field">Assign or replace part PDF<input type="file" accept=".pdf,application/pdf" id="pdfFile"></label>' :
        '') + '</div>' +
      '<div class="editcard"><h2>Ensemble playback</h2><p>MusicXML and MIDI produce synthesized playback. Audio stems should share a start time. A full mix supports tempo and looping. Individual muting needs a mapped score track or stem.</p><label class="field">MusicXML or MIDI arrangement<input type="file" id="seqFile" accept=".musicxml,.xml,.mxl,.mid,.midi"></label>' +
      (s.structuredName ? '<p>Imported ' + esc(s.structuredName) + '</p>' : '') + (s.warnings?.length ?
        '<div class="inlineNote">' + s.warnings.map(esc).join('<br>') + '</div>' : '') +
      (s.notes?.length && part ? '<label class="field">Playback track for ' + esc(part.name) +
        '<select id="assignTrack">' + options([
          ['', 'Unassigned'], ...(s.trackNames || s.parts.filter(p => s.notes.some(n => n.part === p.id))).map(
            p => [p.id, p.name])
        ], part.track ?? part.id) + '</select></label>' : '') +
      '<label class="field">Full ensemble recording<input id="mixFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"></label>' +
      (s.mix ? '<div class="resourceRow"><span>' + esc(s.mixName) +
        '</span><button id="removeMix">Remove mix</button></div>' : '') + (part ?
        '<label class="field">Audio stem for ' + esc(part.name) +
        '<input id="stemFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"></label>' : '') + (s.stems || [])
      .map(st => '<div class="resourceRow"><span>' + esc(s.parts.find(p => p.id === st.part)?.name) + ' · ' + esc(st
        .name) + '</span><button data-rmstem="' + esc(st.part) + '">Remove</button></div>').join('') +
      '<details><summary>Set up a metronome timeline</summary><p>For a PDF-only work, set a practice duration and click tempo, then enter your measure times below. The metronome is an independent practice aid.</p><div class="formgrid"><label>Duration (seconds)<input type="number" id="clickLength" min="1" max="7200" value="' +
      (s.clickDuration || 60) +
      '"></label><label>Click tempo (BPM)<input id="clickBPM" type="number" min="20" max="400" value="' + (s.bpm ||
        96) + '"></label></div><button id="saveClick">Save metronome timeline</button></details>' +
      (ms.length ? '<div class="formgrid"><label>Student playback source<select id="modeEdit">' + options(ms.map(
          x => [x, modeName[x]]), m) +
        '</select></label><label>Count-off tempo (BPM)<input id="bpm" type="number" min="20" max="400" value="' + (s
          .bpm || 96) +
        '"></label></div><div class="btnrow"><button id="saveAudio">Save playback settings</button></div>' : '') +
      '</div>' +
      (ms.length ? '<div class="editcard"><h2>Timing &amp; rehearsal sections</h2><p>These settings apply to ' + esc(
          modeName[m]) +
        '. Each recording has its own map. Confirm measure times against this exact performance.</p><label class="field">Load timing CSV<input type="file" id="mapFile" accept=".csv,.txt"></label><label class="field">Measure, start second, end second, rehearsal letter<textarea id="mapText" spellcheck="false" placeholder="1,0,2.5,A">' +
        esc(map.map(x => [x.n, x.t, x.end, x.label || ''].join(',')).join('\n')) +
        '</textarea></label><label class="field">Section name, first measure, last measure<textarea id="sectionsText" spellcheck="false" placeholder="Opening,1,4">' +
        esc(sections(s, m).map(x => [x.name, x.from, x.to].join(',')).join('\n')) +
        '</textarea></label><button id="saveMap">Save timing &amp; sections</button>' +
        (part ? '<details><summary>Score highlight positions · ' + esc(part.name) +
          '</summary><p>For each mapped measure enter its page and rectangle as percentages of the page. Use the printed part to verify each position. Omit positions to show the measure number alone.</p><label class="field">Measure, page, left %, top %, width %, height %<textarea id="boxesText" placeholder="1,1,12,24,19,8">' +
          esc((part.locations || []).map(x => [x.n, x.page, x.x, x.y, x.w, x.h].join(',')).join('\n')) +
          '</textarea></label><button id="saveBoxes">Save positions</button></details>' : '') + '</div>' : '') +
      '<div class="editcard"><h2>Classroom links &amp; hosting</h2><p>Open Student preview, choose the instrument and passage, then use the link button beside Record take. A private studio link opens only for accounts with access. Send the practice pack separately for device-local edits.</p><p>This edition can be hosted directly on GitHub Pages or Cloudflare Pages. Published parts can be opened locally from an authorized teacher practice pack.</p></div></div></div>';
    const commit = async (copy, message) => {
      copy.revision = uid();
      await saveRevision(copy, copy.id === s.id ? s.revision : undefined);
      catalog.set(copy.id, copy);
      this.render(copy.id);
      tell(message)
    };
    const change = async (fn, msg) => {
      const copy = structuredClone(s);
      await fn(copy);
      await commit(copy, msg)
    };
    const patchPart = (copy) => copy.parts.find(x => x.id === this.p);
    $('teacherBody').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      this.p = null;
      this.mode = null;
      this.render(b.dataset.edit)
    });
    click('newPiece', async () => {
      const title = prompt('Composition title');
      if (!title?.trim()) return;
      await commit(newPiece(title.trim()), 'Composition added.')
    });
    click('saveMeta', () => change(c => {
      if (!val('editTitle')) throw Error('Enter a composition title.');
      c.title = val('editTitle');
      c.credit = val('credit')
    }, 'Title and credit saved.'));
    click('addPart', () => change(c => {
      const name = val('newPartName');
      if (!name) throw Error('Enter the new part name.');
      this.p = uid();
      c.parts.push({
        id: this.p,
        name,
        pages: []
      })
    }, 'Instrumental part added.'));
    $('editPart').onchange = e => {
      this.p = e.target.value;
      this.render()
    };
    click('preview', () => this.api.preview(s.id, this.p));
    click('packOut', async () => {
      saveBlob(await exportPack(s), s.title.replace(/[^a-z0-9-]/gi, '-') + '.dms');
      tell('Practice pack exported. Distribute published music only through approved class channels.')
    });
    const onFile = (id, fn) => {
      if ($(id)) $(id).onchange = handle(async e => {
        const f = e.target.files[0];
        if (!f) return;
        e.target.value = '';
        await fn(f)
      })
    };
    onFile('pdfFile', f => change(async c => {
      const p = patchPart(c);
      const lib = await import('./vendor/pdf/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf/pdf.worker.min.mjs', import.meta.url).href;
      const doc = await lib.getDocument({
        data: new Uint8Array(await f.arrayBuffer()),
        isEvalSupported: false
      }).promise;
      p.pageCount = doc.numPages;
      await doc.destroy();
      p.pdfBlob = f;
      p.pdfName = f.name;
      p.pages = [];
      delete p.pdfResource;
      delete p.locations
    }, 'Printed part saved.'));
    onFile('seqFile', f => change(async c => {
      const seq = await parseStructured(f);
      c.notes = seq.notes.sort((a, b) => a.t - b.t);
      c.measures = seq.measures;
      c.sections = [];
      c.duration = seq.duration;
      c.bpm = seq.bpm;
      c.warnings = seq.warnings;
      c.trackNames = seq.parts;
      c.structuredName = f.name;
      c.structuredFile = f;
      c.preferredMode = 'synth';
      this.mode = 'synth';
      for (const p of c.parts) {
        p.track = '';
        delete p.locations;
        if (p.pages) p.pages = p.pages.map(page => ({
          ...page,
          boxes: []
        }))
      }
      for (const track of seq.parts) {
        const exact = c.parts.find(p => p.id === track.id) || c.parts.find(p => p.name === track.name && !p
          .track);
        if (exact) exact.track = track.id;
        else c.parts.push({
          ...track,
          track: track.id,
          pages: []
        })
      }
    }, 'Structured arrangement imported. Check track assignments before sharing.'));
    if ($('assignTrack')) $('assignTrack').onchange = handle(e => change(c => {
      patchPart(c).track = e.target.value
    }, 'Part assignment saved.'));
    for (const [id, key] of [
        ['mixFile', 'mix'],
        ['stemFile', 'stems']
      ]) onFile(id, f => change(async c => {
      if (f.size > 100 * 1024 * 1024) throw Error('Choose an audio file under 100 MB.');
      const ctx = await this.api.engine.unlock();
      const buffer = await ctx.decodeAudioData(await f.arrayBuffer());
      if (key === 'mix') {
        c.mix = f;
        c.mixDuration = buffer.duration;
        c.mixName = f.name
      } else {
        c.stems = (c.stems || []).filter(st => st.part !== this.p);
        c.stems.push({
          file: f,
          part: this.p,
          duration: buffer.duration,
          name: f.name
        })
      }
      c[key + 'Map'] = [];
      c[key + 'Sections'] = [];
      this.mode = key;
      c.preferredMode = key
    }, 'Audio saved. Confirm the timing map for this recording.'));
    click('saveClick', () => change(c => {
      const d = +val('clickLength'),
        b = +val('clickBPM');
      if (!(d >= 1 && d <= 7200 && b >= 20 && b <= 400)) throw Error(
        'Choose a duration from 1–7200 seconds and tempo from 20–400 BPM.');
      if (c.clickDuration !== d || c.bpm !== b) {
        c.clickMap = [];
        c.clickSections = []
      }
      c.clickDuration = d;
      c.bpm = b;
      c.preferredMode = 'click';
      this.mode = 'click'
    }, 'Metronome timeline saved.'));
    if ($('removeMix')) click('removeMix', () => change(c => {
      delete c.mix;
      c.mixMap = [];
      c.mixSections = []
    }, 'Recording removed.'));
    document.querySelectorAll('[data-rmstem]').forEach(b => b.onclick = handle(() => change(c => {
      c.stems = c.stems.filter(st => st.part !== b.dataset.rmstem);
      c.stemsMap = [];
      c.stemsSections = []
    }, 'Stem removed.')));
    if ($('modeEdit')) {
      $('modeEdit').onchange = e => {
        this.mode = e.target.value;
        this.render()
      };
      click('saveAudio', () => change(c => {
        const bpm = +val('bpm');
        if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) throw Error('Choose a BPM between 20 and 400.');
        c.bpm = bpm;
        c.preferredMode = m
      }, 'Playback settings saved.'))
    }
    onFile('mapFile', async f => {
      const text = await f.text();
      mapRows(text, duration(s, m));
      $('mapText').value = text;
      tell('Timing CSV loaded. Save timing to apply it.')
    });
    if ($('saveMap')) click('saveMap', () => change(c => {
      const rows = mapRows($('mapText').value, duration(c, m));
      const ss = sectionRows($('sectionsText').value, rows);
      if (m === 'synth') {
        c.measures = rows;
        c.sections = ss
      } else {
        c[m + 'Map'] = rows;
        c[m + 'Sections'] = ss
      }
    }, 'Timing and sections saved.'));
    if ($('saveBoxes')) click('saveBoxes', () => change(c => {
      const p = patchPart(c),
        rows = locationRows($('boxesText').value, p.pageCount || p.pages?.length || 0, map);
      if (rows.length) p.locations = rows;
      else delete p.locations
    }, 'Printed measure positions saved.'));
  }
}
