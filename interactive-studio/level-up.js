import { parseStructured } from './structured.js';

export const levelUpId = 'level-up';
export const compactScore = matchMedia('(max-width: 680px)');
export const beginnerId = 'beginner-pack';
export const isPackId = id => id === levelUpId || id === beginnerId;
const programs = new Map();
const beginnerParts = new Map();

async function loadProgram(id) {
  if (!programs.has(id)) {
    const response = await fetch('./' + id + '/program.json');
    if (!response.ok) throw Error('The practice pack could not load. Please try again.');
    programs.set(id, await response.json());
  }
  return programs.get(id);
}

async function beginnerExercise(id, index) {
  if (!beginnerParts.has(id)) {
    const response = await fetch('./beginner-pack/' + id + '.zip');
    if (!response.ok) throw Error('This instrument could not load. Please try again.');
    const archive = await JSZip.loadAsync(await response.arrayBuffer());
    const lessons = JSON.parse(await archive.file('songs.json').async('string'));
    beginnerParts.set(id, {lessons, archive});
  }
  const {lessons, archive} = beginnerParts.get(id);
  const lesson = lessons[index];
  const resolvePage = async page => ({
    ...page, src: 'data:image/svg+xml;base64,' + await archive.file(page.src).async('base64')
  });
  const [page, mobilePage] = await Promise.all([resolvePage(lesson.page), resolvePage(lesson.mobilePage)]);
  return {...lesson, page, mobilePage};
}

export async function loadLevel(id, partId, levelNumber) {
  const data = await loadProgram(id);
  const part = data.parts.find(p => p.id === partId) || data.parts.find(p => p.id === 'clarinet');
  const number = Number(levelNumber);
  const level = Number.isInteger(number) && number >= 1 && number <= data.levels.length ? number : 1;
  const exercise = id === beginnerId ? await beginnerExercise(part.id, level - 1) : part.exercises[level - 1];
  const bytes = Uint8Array.from(atob(exercise.midi), c => c.charCodeAt(0));
  const sequence = await parseStructured(new Blob([bytes]));
  const drum = part.id === 'snare';
  const accents = new Set(exercise.accents);
  const notes = sequence.notes.map((note, i) => ({
    ...note, part: part.id,
    ...(drum ? {sample: 0, velocity: accents.has(i) ? 103 : 76} : {})
  }));
  return {
    id, title: id === beginnerId ? 'Beginner Pack' : 'LEVEL UP!', kind: 'Solo practice', credit: 'Derby Middle School Band',
    level, levelTitles: data.levels, cue: exercise.cue, selectedPart: part.id, pdf: part.pdf,
    parts: data.parts.map(({id, name}) => ({id, name})),
    page: exercise.page, mobilePage: exercise.mobilePage,
    notes, bpm: sequence.bpm, duration: sequence.duration, measures: sequence.measures,
    ...(drum ? {sampleZones: [[0, .28]], bankResource: './level-up/snare.wav'} : {})
  };
}
