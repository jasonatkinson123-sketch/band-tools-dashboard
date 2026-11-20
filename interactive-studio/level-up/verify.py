"""Check the built student assets against the engraving engine and written score."""
import base64
import io
import json
from xml.etree import ElementTree as ET

import fitz
import mido
import verovio
from build import OUT, SVG, compile_exercise
from scores import TITLES

# Conservative written ranges for this edition, inclusive MIDI numbers.
LIMITS = {'clarinet': (60, 72), 'flute': (70, 79), 'tenor': (62, 76),
          'alto': (62, 76), 'horn': (60, 72), 'trumpet': (60, 69),
          'euphonium': (44, 55), 'trombone': (46, 55), 'mallets': (60, 72)}
OFFSETS = {'flute': 0, 'clarinet': -2, 'alto': -9, 'tenor': -14, 'horn': -7,
           'trumpet': -2, 'euphonium': 0, 'trombone': 0, 'mallets': 0}


def attacks(blob):
    midi = mido.MidiFile(file=io.BytesIO(blob))
    events = []
    for track in midi.tracks:
        tick = 0
        for msg in track:
            tick += msg.time
            if msg.type == 'note_on' and msg.velocity:
                events.append((tick / midi.ticks_per_beat, msg.note))
    return events


def verify():
    manifest = json.loads((OUT/'program.json').read_text())
    count = 0
    for part in manifest['parts']:
        pid = part['id']
        doc = fitz.open(OUT.parent / part['pdf'])
        assert len(doc) == 1 and doc[0].rect == fitz.Rect(0, 0, 612, 792)
        page = doc[0].get_text()
        assert all(title in page for title in TITLES)
        for i, ex in enumerate(part['exercises']):
            xml, original_midi, written, _, _ = compile_exercise(pid, i)
            midi = base64.b64decode(ex['midi'])
            assert original_midi == midi
            tk = verovio.toolkit()
            assert tk.loadData(xml)
            actual = attacks(midi)
            # Independent performance of the notation, including transpositions and rests.
            assert attacks(base64.b64decode(tk.renderToMIDI())) == actual, (pid, i)
            if pid in LIMITS:
                low, high = LIMITS[pid]
                assert low <= min(written) and max(written) <= high
                assert [n for _, n in actual] == [n + OFFSETS[pid] for n in written]
            else:
                assert all(note == 38 for _, note in actual)
            measures = ET.fromstring(xml).findall('part/measure')
            assert len(measures) == 4
            track = mido.MidiFile(file=io.BytesIO(midi)).tracks[0]
            gates = [m.time for m in track if m.type == 'note_off']
            notes = [n for bar in measures for n in bar.findall('note')]
            for bar in measures:
                assert sum(int(n.text) for n in bar.findall('note/duration')) == 8
            expected_gates = [round(240*int(n.findtext('duration')) * (
                .49 if n.find('.//staccato') is not None else .95)) for n in notes if n.find('rest') is None]
            assert gates == expected_gates
            if pid == 'clarinet':
                if i < 3:
                    assert max(written) < 71
                if i >= 3:
                    assert 71 in written and 69 in written
                if i == 3:
                    assert list(zip(written, written[1:])).count((69, 71)) >= 3
            for field, rows in [('page', 1), ('mobilePage', 2)]:
                asset = ex[field]
                root = ET.parse(OUT.parent/asset['src'])
                assert len(root.findall(f'.//{SVG}g[@class="system"]')) == rows
                assert len(root.findall(f'.//{SVG}g[@class="note"]')) == len(actual)
                assert len(root.findall(f'.//{SVG}g[@class="rest"]')) == sum(n.find('rest') is not None for n in notes)
                assert [box['n'] for box in asset['boxes']] == [1, 2, 3, 4]
                for box in asset['boxes']:
                    assert 0 <= box['x'] < box['x'] + box['w'] <= asset['width'] + 1
                    assert 0 <= box['y'] < box['y'] + box['h'] <= asset['height']
            count += len(actual)
        print(f'{pid}: six exercises and one Letter PDF passed')
    print(f'{count} MIDI attacks matched notation, onset by onset.')


if __name__ == '__main__':
    verify()
