"""Generate the student archives and paired Letter-size parts with the LEVEL UP! toolchain."""
import base64
import json
import runpy
import zipfile
from pathlib import Path

import cairosvg
import fitz
import verovio

from arrangements import DUETS, REGISTERS, TONIC, OFFSETS, lines_for

OUT = Path(__file__).resolve().parent
# Reuse the studio's percussion notation, transposition and engraving helpers.
pack = runpy.run_path(str(OUT.parent / 'beginner-pack' / 'build.py'))
compile_part, engrave, pdf_text = (pack[k] for k in ('compile_part', 'engrave', 'pdf_text'))


def render_part(archive, pid, instrument, duet, number, role, bars, page, y):
    name, clef, key, shift, gm = instrument
    if pid == 'mallets':
        key = -2
    drum = pid == 'snare'
    if not drum:
        degrees, spellings, low, high = REGISTERS[pid]
        scale = dict(zip(degrees, spellings.split(), strict=True))
    phrases, lengths, expected_midi = [], [], []
    used = set()
    strokes = 0
    for bar in bars:
        pitches, rhythm = [], []
        for token in bar.split():
            degree = token[0]
            if degree != '0':
                pitch = 'RL'[strokes % 2] if drum else scale[degree]
                expected_midi.append(38 if drum else TONIC[pid] + OFFSETS[degree])
                used.add(degree)
                strokes += 1
            else:
                pitch = '-'
            pitches.append(pitch)
            rhythm.append(token[1:] or 'q')
        phrases.append(' '.join(pitches))
        lengths.append(''.join(rhythm))
    xml, midi, written, *_ = compile_part(pid, (name, clef, key, shift, gm), '|'.join(phrases),
                                 '|'.join(lengths), duet.tempo, duet.cue)
    tk = verovio.toolkit()
    assert tk.loadData(xml)
    notes = pack['attacks'](midi)
    assert notes == pack['attacks'](base64.b64decode(tk.renderToMIDI()))
    assert [pitch for _, pitch in notes] == expected_midi
    if not drum:
        assert low <= min(written) <= max(written) <= high
        assert all(abs(x-y) <= 7 for x, y in zip(written, written[1:]))
        assert [pitch + shift for pitch in written] == expected_midi
    lesson = dict(midi=base64.b64encode(midi).decode())
    if not drum:
        used_notes = [spelling.replace('b', '♭') for degree, spelling in scale.items() if degree in used]
        lesson['writtenRange'] = '–'.join(dict.fromkeys((used_notes[0], used_notes[-1])))
    for mobile, field in ((False, 'page'), (True, 'mobilePage')):
        svg, asset = engrave(xml, mobile, bars=len(bars))
        file = f'{number}-{role}-{field}.svg'
        archive.writestr(file, svg)
        lesson[field] = dict(src=file, **asset)
        if not mobile:
            pdf_text(page, 32, y, 'Part ' + role.upper(), 14, True)
            if not drum:
                pdf_text(page, 412, y, 'Written ' + lesson['writtenRange'], 10)
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
                a, b = lines_for(pid, number-1)
                assert len(a) == len(b) == 16
                page = pdf.new_page(width=612, height=792)
                pdf_text(page, 32, 33, 'HOLIDAY DUET LAB', 11, True)
                pdf_text(page, 32, 60, duet.title, 20, True)
                pdf_text(page, 32, 81, instrument[0], 12)
                pdf_text(page, 415, 81, f'Quarter note = {duet.tempo}', 11)
                page.draw_line((32, 92), (580, 92), width=.8)
                lesson = dict(cue=duet.cue)
                for role, bars, y in [('a', a, 115), ('b', b, 444)]:
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
