"""Build the static student edition. Python dependencies: verovio==6.4.1,
mido, cairosvg and PyMuPDF. Run from any directory with python build.py.
"""
import base64
import io
import json
import math
import random
import re
import struct
import wave
from pathlib import Path
from xml.etree import ElementTree as ET

import cairosvg
import fitz
import mido
import verovio
from scores import INSTRUMENTS, RHYTHMS, SCORES, TEMPOS, TITLES

OUT = Path(__file__).resolve().parent
VALUES = {'q': (2, 'quarter'), 'h': (4, 'half'), 'e': (1, 'eighth'), 'd': (3, 'quarter')}
NATURALS = dict(zip('CDEFGAB', (0, 2, 4, 5, 7, 9, 11)))
SVG = '{http://www.w3.org/2000/svg}'


def add(parent, tag, value=None, **attrs):
    node = ET.SubElement(parent, tag, attrs)
    if value is not None:
        node.text = str(value)
    return node


def compile_exercise(pid, level):
    name, clef, fifths, shift, program = INSTRUMENTS[pid]
    drum = pid == 'snare'
    score = ET.Element('score-partwise', version='4.0')
    listed = add(add(score, 'part-list'), 'score-part', id='P1')
    add(listed, 'part-name', name, **{'print-object': 'no'})
    if drum:
        add(add(listed, 'score-instrument', id='I1'), 'instrument-name', 'Snare drum')
        drum_midi = add(listed, 'midi-instrument', id='I1')
        add(drum_midi, 'midi-channel', 10)
        add(drum_midi, 'midi-unpitched', 39)  # MusicXML uses one-based GM numbers.
    part = add(score, 'part', id='P1')
    midi = mido.MidiFile(type=0, ticks_per_beat=480)
    track = midi.add_track(name.replace('♭', 'b'))
    track.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(TEMPOS[level])))
    track.append(mido.MetaMessage('time_signature', numerator=4, denominator=4))
    channel = 9 if drum else 0
    if not drum:
        track.append(mido.Message('program_change', program=program))
    cue, melody = SCORES[pid][level]
    bars = melody.split('|')
    assert len(bars) == 4
    tick = last_event = 0
    pitches = []
    accents = []
    for number, (bar, rhythm) in enumerate(zip(bars, RHYTHMS[level].split('|'), strict=True), 1):
        tokens = bar.split()
        assert len(tokens) == len(rhythm), (pid, level, number)
        assert sum(VALUES[r][0] for r in rhythm) == 8
        measure = add(part, 'measure', number=str(number))
        if number == 1:
            att = add(measure, 'attributes')
            add(att, 'divisions', 2)
            if not drum:
                add(add(att, 'key'), 'fifths', fifths)
            time = add(att, 'time')
            add(time, 'beats', 4)
            add(time, 'beat-type', 4)
            clef_node = add(att, 'clef')
            add(clef_node, 'sign', clef)
            add(clef_node, 'line', {'G': 2, 'F': 4, 'percussion': 2}[clef])
            if drum:
                add(add(att, 'staff-details'), 'staff-lines', 1)
            if shift:
                transpose = add(att, 'transpose')
                add(transpose, 'diatonic', {-2: -1, -9: -5, -14: -1, -7: -4}[shift])
                add(transpose, 'chromatic', -2 if shift == -14 else shift)
                if shift == -14:
                    add(transpose, 'octave-change', -1)
        key = {s: (1 if fifths > 0 else -1) for s in ('FCGDAEB'[:fifths] if fifths > 0 else 'BEADGCF'[:-fifths])}
        accidentals = {}
        for i, (token, r) in enumerate(zip(tokens, rhythm)):
            note = add(measure, 'note')
            units, typ = VALUES[r]
            short, accented = token.endswith('.'), token.endswith('>')
            spelling = token.rstrip('.>')
            accidental = None
            if spelling == '-':
                add(note, 'rest')
            elif drum:
                assert spelling in ('R', 'L')
                unpitched = add(note, 'unpitched')
                add(unpitched, 'display-step', 'E')
                add(unpitched, 'display-octave', 4)
                sound = 38
            else:
                letter, modifier, octave = re.fullmatch(r'([A-G])([#b]?)([2-5])', spelling).groups()
                pitch = add(note, 'pitch')
                add(pitch, 'step', letter)
                alter = {'b': -1, '': 0, '#': 1}[modifier]
                if alter:
                    add(pitch, 'alter', alter)
                add(pitch, 'octave', octave)
                loc = (letter, octave)
                if alter != accidentals.get(loc, key.get(letter, 0)):
                    accidental = {-1: 'flat', 0: 'natural', 1: 'sharp'}[alter]
                accidentals[loc] = alter
                written = (1 + int(octave)) * 12 + NATURALS[letter] + alter
                pitches.append(written)
                sound = written + shift
            add(note, 'duration', units)
            if drum and spelling != '-':
                add(note, 'instrument', id='I1')
            add(note, 'type', typ)
            if r == 'd':
                add(note, 'dot')
            if accidental:
                add(note, 'accidental', accidental)
            if drum and spelling != '-':
                add(note, 'stem', 'up')
            if r == 'e':
                # Beam pairs on the beat. The eighth after a dotted quarter stands alone.
                if tick % 480 == 0 and i+1 < len(rhythm) and rhythm[i+1] == 'e':
                    add(note, 'beam', 'begin', number='1')
                elif tick % 480 and i and rhythm[i-1] == 'e':
                    add(note, 'beam', 'end', number='1')
            if short or accented:
                add(add(add(note, 'notations'), 'articulations'), 'staccato' if short else 'accent')
            if drum and spelling != '-':
                add(add(note, 'lyric'), 'text', spelling)
            length = units * 240
            if spelling != '-':
                gate = round(length * (.49 if short else .95))
                velocity = 103 if accented else 76
                if accented:
                    accents.append(len([msg for msg in track if msg.type == 'note_on']))
                track.append(mido.Message('note_on', channel=channel, note=sound, velocity=velocity, time=tick-last_event))
                track.append(mido.Message('note_off', channel=channel, note=sound, time=gate))
                last_event = tick + gate
            tick += length
        if number == 4:
            add(add(measure, 'barline', location='right'), 'bar-style', 'light-heavy')
    assert tick == 16 * 480
    track.append(mido.MetaMessage('end_of_track', time=tick-last_event))
    buf = io.BytesIO()
    midi.save(file=buf)
    return ET.tostring(score, encoding='unicode'), buf.getvalue(), pitches, accents, cue


def engrave(xml, mobile=False):
    if mobile:
        xml = xml.replace('<measure number="3">', '<measure number="3"><print new-system="yes"/>')
    tk = verovio.toolkit()
    tk.setOptions({'xmlIdChecksum': True, 'pageWidth': 960 if mobile else 1720, 'pageHeight': 500,
                   'pageMarginLeft': 14, 'pageMarginRight': 14, 'pageMarginTop': 10,
                   'pageMarginBottom': 10, 'adjustPageHeight': True, 'breaks': 'encoded' if mobile else 'auto',
                   'header': 'none', 'footer': 'none', 'minLastJustification': 0,
                   'svgViewBox': True, 'scale': 100})
    assert tk.loadData(xml) and tk.getPageCount() == 1
    svg = tk.renderToSVG(1)
    root = ET.fromstring(svg)
    system = root.findall(f'.//{SVG}g[@class="system"]')
    assert len(system) == (2 if mobile else 1)
    measures = [m for row in system for m in row.findall(f'{SVG}g[@class="measure"]')]
    assert len(measures) == 4
    vx, vy, w, h = map(float, root.get('viewBox').split())
    inner = root.find(f'{SVG}svg')
    iw = float(inner.get('viewBox').split()[2])
    margin = root.find(f'.//{SVG}g[@class="page-margin"]').get('transform')
    left = float(re.search(r'translate\(([\d.]+)', margin)[1])
    boxes = []
    row_split = h / 2 if mobile else h
    for n, measure in enumerate(measures, 1):
        staff = measure.find(f'{SVG}g[@class="staff"]/{SVG}path')
        x1, y1, x2, y2 = map(float, re.findall(r'-?[\d.]+', staff.get('d')))
        boxes.append(dict(n=n, x=round((x1+left)*w/iw, 2), y=row_split if mobile and n > 2 else 0, w=round((x2-x1)*w/iw, 2), h=row_split))
    # Flatten Verovio's nested viewport so image hosts see one SVG document.
    # The inner drawing uses tenths of the outer unit.
    assert abs(w/iw - .1) < .00001
    svg = re.sub(r'<svg class="definition-scale"([^>]*?) viewBox="[^"]+">',
                 r'<g class="definition-scale"\1 transform="scale(.1)">', svg, count=1)
    svg = re.sub(r'</svg>\s*</svg>\s*$', '</g>\n</svg>\n', svg)
    return svg, dict(width=w, height=h, boxes=boxes)


def pdf_text(page, x, y, text, size, bold=False):
    family = 'DejaVuSans-Bold' if bold else 'DejaVuSans'
    page.insert_text((x, y), text, fontname=family, fontsize=size,
                     fontfile=f'/usr/share/fonts/truetype/dejavu/{family}.ttf')


def build():
    manifest = {'levels': TITLES, 'parts': []}
    for pid, (name, *_) in INSTRUMENTS.items():
        directory = OUT / pid
        directory.mkdir(exist_ok=True)
        doc = fitz.open()
        page = doc.new_page(width=612, height=792)
        pdf_text(page, 36, 40, 'DERBY MIDDLE SCHOOL BAND', 9, True)
        pdf_text(page, 36, 75, 'LEVEL UP!', 30, True)
        pdf_text(page, 36, 96, name, 14)
        page.draw_line((36, 106), (576, 106), width=1)
        exercises = []
        for level, title in enumerate(TITLES):
            xml, midi, pitches, accents, cue = compile_exercise(pid, level)
            svg, asset = engrave(xml)
            path = directory / f'{level + 1}.svg'
            path.write_text(svg)
            asset['src'] = 'level-up/' + path.relative_to(OUT).as_posix()
            mobile_svg, mobile_asset = engrave(xml, mobile=True)
            mobile_path = directory / f'{level + 1}-mobile.svg'
            mobile_path.write_text(mobile_svg)
            mobile_asset['src'] = 'level-up/' + mobile_path.relative_to(OUT).as_posix()
            top = 126 + 106 * level
            pdf_text(page, 36, top, f'{level+1}   {title}', 13, True)
            pdf_text(page, 493, top, f'Start at {TEMPOS[level]} bpm', 9)
            pdf_text(page, 36, top+16, cue, 9)
            vector = fitz.open('pdf', cairosvg.svg2pdf(bytestring=svg.encode()))
            dest = fitz.Rect(36, top+20, 576, top+89)
            page.show_pdf_page(dest, vector, 0)
            exercises.append({'cue': cue, 'page': asset, 'mobilePage': mobile_asset, 'midi': base64.b64encode(midi).decode(),
                              **({'accents': accents} if accents else {})})
        pdf_name = f'LEVEL-UP-{pid}.pdf'
        doc.subset_fonts()
        doc.save(directory / pdf_name, garbage=4, deflate=True, no_new_id=True)
        manifest['parts'].append({'id': pid, 'name': name, 'pdf': f'level-up/{pid}/{pdf_name}',
                                  'exercises': exercises})
    (OUT/'program.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))+'\n')
    # Original synthetic snare, rendered once for the studio sample player.
    rng = random.Random(411)
    sample_rate = 22050
    previous = 0
    with wave.open(str(OUT/'snare.wav'), 'wb') as sample:
        sample.setparams((1, 2, sample_rate, 0, 'NONE', 'not compressed'))
        frames = bytearray()
        for i in range(round(.28 * sample_rate)):
            t = i / sample_rate
            noise = rng.uniform(-1, 1)
            wire = .24 * (noise-previous) * math.exp(-24*t)
            head = .35 * math.sin(2*math.pi*178*t) * math.exp(-42*t)
            frames.extend(struct.pack('<h', round(32767 * (wire+head) * min(1, i/12))))
            previous = noise
        sample.writeframes(frames)


if __name__ == '__main__':
    build()
