"""Rebuild with the LEVEL UP! Python environment. MusicXML drives print, screen and playback."""
import base64
import io
import json
import sys
import textwrap
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import cairosvg
import fitz
import mido

from lessons import LESSONS

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parent / 'level-up'))
from build import add, engrave, pdf_text

# Twelve divisions per quarter represent sixteenths and eighth-note triplets exactly.
CELLS = {'q': [12], 'ee': [6, 6], 'four': [3]*4, 'ess': [6, 3, 3], 'sse': [3, 3, 6],
         'ses': [3, 6, 3], 'sync': [6, 12, 6], 'dot': [9, 3], 'trip': [4]*3,
         'whole': [48], 'flam': [12], 'buzz': [24], 'shortbuzz': [12]}
TYPES = {48: 'whole', 24: 'half', 12: 'quarter', 9: 'eighth', 6: 'eighth', 4: 'eighth', 3: '16th'}
DYNAMICS = {'p': 59, 'mf': 79, 'f': 96}


def staff_note(measure, hand, length, grace=False):
    note = add(measure, 'note')
    if grace:
        add(note, 'grace', slash='yes')
    if hand == '-':
        add(note, 'rest')
    else:
        position = add(note, 'unpitched')
        add(position, 'display-step', 'E')
        add(position, 'display-octave', 4)
    if not grace:
        add(note, 'duration', length)
    if hand != '-':
        add(note, 'instrument', id='sn')
    add(note, 'type', 'eighth' if grace else TYPES[length])
    if length == 9:
        add(note, 'dot')
    if length == 4:
        tm = add(note, 'time-modification')
        add(tm, 'actual-notes', 3)
        add(tm, 'normal-notes', 2)
    if hand != '-' and length < 48:
        add(note, 'stem', 'up')
    return note


def cell(measure, shape, hands):
    lengths = CELLS[shape]
    for i, (length, hand) in enumerate(zip(lengths, hands, strict=True)):
        assert hand in 'rlRL-'
        if shape == 'flam':
            grace_hand = 'l' if hand.lower() == 'r' else 'r'
            small = staff_note(measure, grace_hand, 6, True)
            add(add(small, 'lyric'), 'text', grace_hand)
        note = staff_note(measure, hand, length)
        # Keep the primary beam inside one beat and show the secondary beam/hook on sixteenths.
        if len(lengths) > 1 and shape != 'sync' and '-' not in hands:
            add(note, 'beam', 'begin' if i == 0 else 'end' if i == len(hands)-1 else 'continue', number='1')
            if length == 3:
                left = i > 0 and lengths[i-1] == 3
                right = i+1 < len(lengths) and lengths[i+1] == 3
                beam = ('continue' if right else 'end') if left else ('begin' if right else 'forward hook' if i == 0 else 'backward hook')
                add(note, 'beam', beam, number='2')
        notation = ET.Element('notations')
        if shape == 'trip' and i in (0, 2):
            add(notation, 'tuplet', type='start' if i == 0 else 'stop', bracket='yes')
        if shape in ('buzz', 'shortbuzz'):
            add(add(notation, 'ornaments'), 'tremolo', 3, type='single')
        if hand.isupper():
            add(add(notation, 'articulations'), 'accent')
        if len(notation):
            note.append(notation)
        if hand != '-':
            add(add(note, 'lyric'), 'text', hand.upper())
    return sum(lengths)


def score(lesson):
    root = ET.Element('score-partwise', version='4.0')
    listed = add(add(root, 'part-list'), 'score-part', id='P1')
    add(listed, 'part-name', 'Snare Drum')
    add(add(listed, 'score-instrument', id='sn'), 'instrument-name', 'Snare Drum')
    midi = add(listed, 'midi-instrument', id='sn')
    add(midi, 'midi-channel', 10)
    add(midi, 'midi-unpitched', 39)
    part = add(root, 'part', id='P1')
    measures = lesson.music.split('|')
    for i, source in enumerate(measures, 1):
        measure = add(part, 'measure', number=str(i))
        if i == 1:
            att = add(measure, 'attributes')
            add(att, 'divisions', 12)
            time = add(att, 'time')
            add(time, 'beats', 4)
            add(time, 'beat-type', 4)
            clef = add(att, 'clef')
            add(clef, 'sign', 'percussion')
            add(clef, 'line', 2)
            add(add(att, 'staff-details'), 'staff-lines', 1)
        duration = 0
        for token in source.split():
            if token in DYNAMICS:
                direction = add(measure, 'direction', placement='above')
                add(add(add(direction, 'direction-type'), 'dynamics'), token)
            else:
                shape, hands = token.split(':') if ':' in token else ('q', token)
                duration += cell(measure, shape, hands)
        assert duration == 48, (lesson.title, i, duration)
    add(add(measure, 'barline', location='right'), 'bar-style', 'light-heavy')
    return root


def performance(root, bpm):
    hits, tick, volume = [], 0, DYNAMICS['mf']
    for event in root.findall('./part/measure/*'):
        if event.tag == 'direction':
            volume = DYNAMICS[event.find('.//dynamics')[0].tag]
        if event.tag != 'note':
            continue
        if event.find('grace') is not None:
            # The quiet grace stroke leads into the main stroke by about 30 ms at the starting tempo.
            hits.append((tick-round(.030*bpm*480/60), round(volume*.48)))
            continue
        length = int(event.findtext('duration'))*40
        if event.find('.//tremolo') is not None:
            # Four hand motions per beat; several rebounds per motion model a closed concert roll.
            for pulse in range(0, length, 120):
                for offset, weight in ((0, .86), (30, .68), (54, .54), (77, .43), (97, .35)):
                    hits.append((tick+pulse+offset, round(volume*weight)))
        elif event.find('rest') is None:
            hits.append((tick, volume + (21 if event.find('.//accent') is not None else 0)))
        tick += length
    assert all(0 <= t < end for (t, _), end in zip(hits, [t for t, _ in hits[1:]]+[tick]))
    midi = mido.MidiFile(type=0, ticks_per_beat=480)
    track = midi.add_track('Snare Drum')
    track.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))
    track.append(mido.MetaMessage('time_signature', numerator=4, denominator=4))
    previous = 0
    for i, (t, v) in enumerate(hits):
        next_tick = hits[i+1][0] if i+1 < len(hits) else tick
        gate = max(1, min(128, next_tick-t-1))
        track.append(mido.Message('note_on', channel=9, note=38, velocity=v, time=t-previous))
        track.append(mido.Message('note_off', channel=9, note=38, time=gate))
        previous = t+gate
    track.append(mido.MetaMessage('end_of_track', time=tick-previous))
    buf = io.BytesIO()
    midi.save(file=buf)
    return base64.b64encode(buf.getvalue()).decode(), [v for _, v in hits]


def build():
    doc = fitz.open()
    songs = []
    with zipfile.ZipFile(OUT/'snare.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for index, lesson in enumerate(LESSONS):
            root = score(lesson)
            midi, velocities = performance(root, lesson.bpm)
            item = dict(cue=lesson.count+' '+lesson.coach, midi=midi, velocities=velocities)
            for mobile, field in ((False, 'page'), (True, 'mobilePage')):
                svg, asset = engrave(ET.tostring(root, encoding='unicode'), mobile, bars=len(root.findall('./part/measure')),
                                     bars_per_row=1 if mobile else 2)
                name = f'{index+1}-{field}.svg'
                archive.writestr(name, svg)
                item[field] = dict(src=name, **asset)
                if not mobile:
                    print_svg, print_asset = svg, asset
            songs.append(item)
            if index % 2 == 0:
                page = doc.new_page(width=612, height=792)
                pdf_text(page, 36, 39, 'Snare Studio', 23, True)
                pdf_text(page, 36, 60, 'Derby Middle School Band   /   Snare drum or practice pad', 10)
                pdf_text(page, 523, 40, f'{index//2+1} / 7', 10)
                page.draw_line((36, 74), (576, 74), width=.8)
            y = 105 + index%2*326
            pdf_text(page, 36, y, f'{index+1}.  {lesson.title}', 16, True)
            pdf_text(page, 502, y, f'{lesson.bpm} BPM', 11)
            for line in textwrap.wrap(lesson.count, 89) + textwrap.wrap(lesson.coach, 89):
                y += 16
                pdf_text(page, 36, y, line, 10.5)
            vector = fitz.open('pdf', cairosvg.svg2pdf(bytestring=print_svg.encode()))
            top = y+15
            height = min(266-(y-(105+index%2*326)), 540*print_asset['height']/print_asset['width'])
            page.show_pdf_page(fitz.Rect(36, top, 576, top+height), vector, 0)
        archive.writestr('songs.json', json.dumps(songs, separators=(',', ':')))
    file = 'Snare-Studio.pdf'
    doc.subset_fonts()
    doc.save(OUT/file, garbage=4, deflate=True, no_new_id=True)
    manifest = dict(title='Snare Studio', levels=[entry.title for entry in LESSONS],
                    parts=[dict(id='snare', name='Snare Drum', pdf='snare-course/'+file)])
    (OUT/'program.json').write_text(json.dumps(manifest)+'\n')


if __name__ == '__main__':
    build()
