"""Generate the student archives and paired Letter-size parts with the LEVEL UP! toolchain."""
import base64
import json
import runpy
import zipfile
from pathlib import Path

import cairosvg
import fitz
import verovio

from arrangements import DUETS

OUT = Path(__file__).resolve().parent
# The pack's pitch table and both existing engraving/MIDI helpers are authoritative.
pack = runpy.run_path(str(OUT.parent / 'beginner-pack' / 'build.py'))
compile_part, engrave, pdf_text = (pack[k] for k in ('compile_part', 'engrave', 'pdf_text'))


def render_part(archive, pid, instrument, duet, number, role, bars, page, y):
    name, clef, key, shift, gm = instrument
    if pid == 'mallets':
        key = -2
    if pid != 'snare' and duet.extra_flat:
        key -= 1
    scale = pack['SCALES'].get(pid, '').split()
    phrases, lengths, pitch_classes = [], [], []
    strokes = 0
    for bar in bars:
        pitches, rhythm = [], []
        for token in bar.split():
            degree = int(token[0])
            if degree:
                assert 1 <= degree <= 6
                pitch = 'RL'[strokes % 2] if pid == 'snare' else scale[degree-1]
                pitch_classes.append(38 % 12 if pid == 'snare' else (10, 0, 2, 3, 5, 7)[degree-1])
                strokes += 1
            else:
                pitch = '-'
            pitches.append(pitch)
            rhythm.append(token[1:] or 'q')
        phrases.append(' '.join(pitches))
        lengths.append(''.join(rhythm))
    xml, midi, *_ = compile_part(pid, (name, clef, key, shift, gm), '|'.join(phrases),
                                 '|'.join(lengths), duet.tempo, duet.cue)
    tk = verovio.toolkit()
    assert tk.loadData(xml)
    notes = pack['attacks'](midi)
    assert notes == pack['attacks'](base64.b64decode(tk.renderToMIDI()))
    assert [pitch % 12 for _, pitch in notes] == pitch_classes
    lesson = dict(midi=base64.b64encode(midi).decode())
    for mobile, field in ((False, 'page'), (True, 'mobilePage')):
        svg, asset = engrave(xml, mobile, bars=len(bars))
        file = f'{number}-{role}-{field}.svg'
        archive.writestr(file, svg)
        lesson[field] = dict(src=file, **asset)
        if not mobile:
            pdf_text(page, 32, y, 'Part ' + role.upper(), 14, True)
            vector = fitz.open('pdf', cairosvg.svg2pdf(bytestring=svg.encode()))
            page.show_pdf_page(fitz.Rect(30, y+6, 582, y+304), vector, 0, keep_proportion=True)
    return lesson


def build():
    manifest = dict(levels=[d.title for d in DUETS], parts=[])
    for pid, instrument in pack['INSTRUMENTS'].items():
        pdf = fitz.open()
        songs = []
        with zipfile.ZipFile(OUT / f'{pid}.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for number, duet in enumerate(DUETS, 1):
                assert len(duet.a) == len(duet.b) == 16
                page = pdf.new_page(width=612, height=792)
                pdf_text(page, 32, 33, 'HOLIDAY DUET LAB', 11, True)
                pdf_text(page, 32, 60, duet.title, 20, True)
                pdf_text(page, 32, 81, instrument[0], 12)
                pdf_text(page, 415, 81, f'Quarter note = {duet.tempo}', 11)
                page.draw_line((32, 92), (580, 92), width=.8)
                lesson = dict(cue=duet.cue)
                for role, bars, y in [('a', duet.a, 115), ('b', duet.b, 444)]:
                    lesson[role] = render_part(archive, pid, instrument, duet, number, role, bars, page, y)
                songs.append(lesson)
            archive.writestr('songs.json', json.dumps(songs, separators=(',', ':')))
        file = f'Holiday-Duet-Lab-{pid}.pdf'
        pdf.subset_fonts()
        pdf.save(OUT / file, garbage=4, deflate=True, no_new_id=True)
        with fitz.open(OUT / file) as printed:
            assert len(printed) == len(DUETS)
            assert all('Part A' in p.get_text() and 'Part B' in p.get_text() for p in printed)
        manifest['parts'].append(dict(id=pid, name=instrument[0], pdf='holiday-duet-lab/'+file))
        print(pid, flush=True)
    (OUT / 'program.json').write_text(json.dumps(manifest, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    build()
