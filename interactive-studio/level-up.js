import { parseStructured } from './structured.js';
import { beeId, loadBee } from './bumblebee.js?v=3';
import { carolId, loadCarol } from './carol.js?v=1';
export { carolId };
export { beeId };

export const levelUpId = 'level-up';
export const compactScore = matchMedia('(max-width: 680px)');
export const beginnerId = 'beginner-pack';
export const duetId = 'holiday-duet-lab';
export const snareId = 'snare-course';
export const isPackId = id => [levelUpId, beginnerId, duetId, snareId, beeId, carolId].includes(id);
export const lessonKey = id => id === snareId ? 'exercise' : id === duetId ? 'arrangement' : id === beginnerId ? 'tune' : 'level';
const programs = new Map();
const archives = new Map();

async function loadProgram(id) {
  if (!programs.has(id)) {
    const response = await fetch('./' + id + '/program.json');
    if (!response.ok) throw Error('The practice pack could not load. Please try again.');
    programs.set(id, await response.json());
  }
  return programs.get(id);
}

async function openArchive(packId, instrument) {
  const path = './' + packId + '/' + instrument + '.zip' + (packId === duetId ? '?edition=2' : '');
  if (!archives.has(path)) {
    const pending = (async () => {
      const response = await fetch(path);
      if (!response.ok) throw Error('This instrument could not load. Please try again.');
      const archive = await JSZip.loadAsync(await response.arrayBuffer());
      return {archive, lessons: JSON.parse(await archive.file('songs.json').async('string'))};
    })();
    archives.set(path, pending);
    pending.catch(() => archives.delete(path));
  }
  return archives.get(path);
}

async function loadPages(archive, lesson) {
  const resolvePage = async page => ({
    ...page, src: 'data:image/svg+xml;base64,' + await archive.file(page.src).async('base64')
  });
  const [page, mobilePage] = await Promise.all([resolvePage(lesson.page), resolvePage(lesson.mobilePage)]);
  return {...lesson, page, mobilePage};
}

async function readSequence(exercise) {
  const bytes = Uint8Array.from(atob(exercise.midi), c => c.charCodeAt(0));
  return parseStructured(new Blob([bytes]));
}

function assignTrack(sequence, instrument, track, accents = [], velocities) {
  const marked = new Set(accents);
  return sequence.notes.map((note, i) => ({
    ...note, part: track,
    ...(instrument === 'snare' ? {sample: 0, velocity: velocities?.[i] ?? (marked.has(i) ? 103 : 76)} : {})
  }));
}

export async function loadLevel(id, partId, levelNumber, query) {
  if (id === beeId) return loadBee(partId, levelNumber);
  if (id === carolId) return loadCarol(partId, levelNumber);
  const data = await loadProgram(id);
  const part = data.parts.find(p => p.id === partId) || data.parts.find(p => p.id === 'clarinet') || data.parts[0];
  const number = Number(levelNumber);
  const level = Number.isInteger(number) && number >= 1 && number <= data.levels.length ? number : 1;
  let exercise, duet, partnerNotes = [];
  let usesSnare = part.id === 'snare';
  if (id === levelUpId) {
    exercise = part.exercises[level - 1];
  } else {
    const {archive, lessons} = await openArchive(id, part.id);
    const lesson = lessons[level - 1];
    if (id === duetId) {
      const role = query?.get('role') === 'b' ? 'b' : 'a';
      const partner = data.parts.find(p => p.id === query?.get('partner')) ||
        data.parts.find(p => p.id === (part.id === 'mallets' ? 'clarinet' : 'mallets'));
      const other = (await openArchive(id, partner.id)).lessons[level - 1];
      const partnerLine = other[role === 'a' ? 'b' : 'a'];
      const partnerTrack = 'partner ' + partner.name;
      partnerNotes = assignTrack(await readSequence(partnerLine), partner.id, partnerTrack);
      usesSnare ||= partner.id === 'snare';
      duet = {role, partner: partner.id, partnerTrack};
      const ranges = [
        [part, lesson[role]], [partner, partnerLine]
      ].map(([instrument, line]) => instrument.name + ' ' + (line.writtenRange || '(unpitched)'));
      exercise = {...await loadPages(archive, lesson[role]), cue: lesson.cue};
      duet.writtenRanges = 'Written ranges · You: ' + ranges[0] + ' · Partner: ' + ranges[1];
    } else {
      exercise = await loadPages(archive, lesson);
    }
  }
  const sequence = await readSequence(exercise);
  const notes = assignTrack(sequence, part.id, part.id, exercise.accents, exercise.velocities);
  if (duet) {
    notes.push(...partnerNotes);
    notes.sort((a, b) => a.t - b.t);
  }
  return {
    id, title: data.title ?? (duet ? 'Holiday Duet Lab' : id === beginnerId ? 'Beginner Pack' : 'LEVEL UP!'),
    kind: duet ? 'Duet practice' : 'Solo practice', credit: 'Derby Middle School Band', duet,
    level, levelTitles: data.levels, cue: exercise.cue, selectedPart: part.id, pdf: duet ? part.pdf + '?edition=2' : part.pdf,
    parts: data.parts.map(({id, name}) => ({id, name})),
    page: exercise.page, mobilePage: exercise.mobilePage,
    notes, bpm: sequence.bpm, duration: sequence.duration, measures: sequence.measures,
    ...(id === snareId ? {clickDuration: sequence.duration, clickMap: sequence.measures} : {}),
    ...(usesSnare ? {sampleZones: [[0, .28]], bankResource: './level-up/snare.wav'} : {})
  };
}
