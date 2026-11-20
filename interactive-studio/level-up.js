import { parseStructured } from './structured.js';

export const levelUpId = 'level-up';
export const compactScore = matchMedia('(max-width: 680px)');
let program;

async function loadProgram() {
  if (program) return program;
  const response = await fetch('./level-up/program.json');
  if (!response.ok) throw Error('The exercises could not load. Choose LEVEL UP! to retry.');
  program = await response.json();
  return program;
}

export async function loadLevel(partId, levelNumber) {
  const data = await loadProgram();
  const part = data.parts.find(p => p.id === partId) || data.parts.find(p => p.id === 'clarinet');
  const number = Number(levelNumber);
  const level = Number.isInteger(number) && number >= 1 && number <= data.levels.length ? number : 1;
  const exercise = part.exercises[level - 1];
  const bytes = Uint8Array.from(atob(exercise.midi), c => c.charCodeAt(0));
  const sequence = await parseStructured(new Blob([bytes]));
  const drum = part.id === 'snare';
  const accents = new Set(exercise.accents);
  const notes = sequence.notes.map((note, i) => ({
    ...note, part: part.id,
    ...(drum ? {sample: 0, velocity: accents.has(i) ? 103 : 76} : {})
  }));
  return {
    id: levelUpId, title: 'LEVEL UP!', kind: 'Technique studies', credit: 'Derby Middle School Band',
    level, levelTitles: data.levels, cue: exercise.cue, selectedPart: part.id, pdf: part.pdf,
    parts: data.parts.map(({id, name}) => ({id, name})),
    page: exercise.page, mobilePage: exercise.mobilePage,
    notes, bpm: sequence.bpm, duration: sequence.duration, measures: sequence.measures,
    ...(drum ? {sampleZones: [[0, .28]], bankResource: './level-up/snare.wav'} : {})
  };
}
