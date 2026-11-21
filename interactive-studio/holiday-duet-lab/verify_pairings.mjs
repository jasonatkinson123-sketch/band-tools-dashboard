// Run with Node 22+ from any directory. Exercise the same loader the practice room uses.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const studio = new URL('../', import.meta.url);
globalThis.matchMedia = () => ({matches: false});
globalThis.JSZip = createRequire(import.meta.url)('../vendor/zip/jszip.min.js');
globalThis.fetch = async path => new Response(await readFile(new URL(path, studio)));
const {loadLevel} = await import('../level-up.js');
const {parts, levels} = JSON.parse(await readFile(new URL('program.json', import.meta.url)));

// Written low, written high, sounding minus written (including the tenor octave).
const ranges = {flute:[65,77,0], clarinet:[60,67,-2], alto:[67,74,-9], tenor:[67,76,-14],
  trumpet:[60,67,-2], horn:[60,69,-7], trombone:[46,53,0], euphonium:[46,53,0], mallets:[65,77,0]};
const canonical = new Map();
let count = 0;
for (const {id} of parts) for (const partner of parts) {
  for (const [index] of levels.entries()) for (const role of ['a','b']) {
    const song = await loadLevel('holiday-duet-lab', id, index+1, new URLSearchParams({role, partner:partner.id}));
    assert.equal(song.selectedPart, id);
    assert.equal(song.duet.partner, partner.id);
    assert.equal(song.duet.role, role);
    assert.equal(song.measures.length, 16);
    assert.equal(song.page.boxes.length, 16);
    assert.equal(song.mobilePage.boxes.length, 16);
    const tracks = [[id, id, role], [partner.id, song.duet.partnerTrack, role === 'a' ? 'b' : 'a']];
    for (const [instrument, track, line] of tracks) {
      const events = song.notes.filter(n => n.part === track).map(n => [n.t, n.d, n.midi]);
      assert(events.length > 0);
      const key = [instrument, index, line].join('/');
      if (canonical.has(key)) assert.deepEqual(events, canonical.get(key), key);
      else canonical.set(key, events);
      for (const [, , pitch] of events) {
        if (instrument === 'snare') assert.equal(pitch,38);
        else {
          const [low,high,shift] = ranges[instrument];
          assert(pitch-shift >= low && pitch-shift <= high, key);
        }
      }
    }
    count++;
  }
}
assert.equal(canonical.size,100);
console.log(count, 'instrument, partner, arrangement and role combinations passed.');
