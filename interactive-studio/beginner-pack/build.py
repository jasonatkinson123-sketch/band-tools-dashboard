"""Build ten concert B-flat classroom tunes from scale-degree notation.
Bare digits are quarters; e, h, w and d mean eighth, half, whole and dotted quarter.
Zero is a rest. Each bar has four beats. Use the LEVEL UP! build dependencies.
"""
import base64
import io
import json
import sys
import zipfile
from pathlib import Path

import cairosvg
import fitz
import mido
import verovio

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parent/'level-up'))
from build import INSTRUMENTS, compile_part, engrave, pdf_text

# Short beginner arrangements. Shared concert degrees Bb C D Eb F G.
TUNES = [
    ('Hot Cross Buns', 72, 'Give the half note two full beats.',
     '3 2 1h|3 2 1h|1e 1e 1e 1e 2e 2e 2e 2e|3 2 1h'),
    ('Rain, Rain, Go Away', 72, 'Echo the calling tune with an easy sound.',
     '5 3 5e 5e 3|5 3 5e 5e 3|5 3 5e 5e 6|5 3 5e 5e 3'),
    ('Pease Porridge Hot', 76, 'Clap the rhyme before you play this two-note setting.',
     '5 5e 3e 5 0|5 5e 3e 5 0|5 5e 3e 5e 5e 3|5 3 3 0'),
    ('Mary Had a Little Lamb', 76, 'Keep the repeated notes clear and even.',
     '3 2 1 2|3 3 3h|2 2 2h|3 5 5h|3 2 1 2|3 3 3 3|2 2 3 2|1w'),
    ('Lightly Row', 72, 'Listen for the skips in the opening phrase.',
     '5 3 3h|4 2 2h|1 2 3 4|5 5 5h|5 3 3h|4 2 2h|1 3 5 5|1w|2 2 2 2|2 3 4h|3 3 3 3|3 4 5h|5 3 3h|4 2 2h|1 3 5 5|1w'),
    ('London Bridge', 72, 'Sing “falling down” as you follow the steps.',
     '5d 6e 5 4|3 4 5h|2 3 4h|3 4 5h|5d 6e 5 4|3 4 5h|2h 5h|3 1h 0'),
    ('Frère Jacques', 76, 'Echo each phrase. The final bell uses the upper fifth.',
     '1 2 3 1|1 2 3 1|3 4 5h|3 4 5h|5e 6e 5e 4e 3 1|5e 6e 5e 4e 3 1|1 5 1h|1 5 1h'),
    ('Baa, Baa, Black Sheep', 76, 'Fit the pairs of eighth notes inside one beat.',
     '1 1 5 5|6e 6e 6e 6e 5h|4 4 3 3|2 2 1h|5 5 4 4|3 3 2h|5 5e 5e 4 4e 4e|3 3 2h|1 1 5 5|6e 6e 6e 6e 5h|4 4 3 3|2 2 1h'),
    ('Jingle Bells', 80, 'Play the chorus with a light, bouncy tongue.',
     '3 3 3h|3 3 3h|3 5 1 2|3w|4 4 4 4|4 3 3 3e 3e|3 2 2 3|2h 5h|3 3 3h|3 3 3h|3 5 1 2|3w|4 4 4 4|4 3 3 3e 3e|5 5 4 2|1w'),
    ('Twinkle, Twinkle, Little Star', 76, 'Save a little air for the end of each phrase.',
     '1 1 5 5|6 6 5h|4 4 3 3|2 2 1h|5 5 4 4|3 3 2h|5 5 4 4|3 3 2h|1 1 5 5|6 6 5h|4 4 3 3|2 2 1h')
]
SCALES = {'flute':'Bb4 C5 D5 Eb5 F5 G5', 'clarinet':'C4 D4 E4 F4 G4 A4',
          'alto':'G4 A4 B4 C5 D5 E5', 'tenor':'C4 D4 E4 F4 G4 A4',
          'trumpet':'C4 D4 E4 F4 G4 A4', 'horn':'F3 G3 A3 Bb3 C4 D4',
          'trombone':'Bb2 C3 D3 Eb3 F3 G3', 'euphonium':'Bb2 C3 D3 Eb3 F3 G3',
          'mallets':'Bb4 C5 D5 Eb5 F5 G5'}

def attacks(blob):
    midi = mido.MidiFile(file=io.BytesIO(blob))
    result = []
    for track in midi.tracks:
        tick = 0
        for msg in track:
            tick += msg.time
            if msg.type == 'note_on' and msg.velocity:
                result.append((tick / midi.ticks_per_beat, msg.note))
    return result

def build():
    manifest = dict(levels=[t[0] for t in TUNES], parts=[])
    for pid, instrument in INSTRUMENTS.items():
        name, clef, key, shift, gm = instrument
        if pid == 'mallets':
            key = -2
        pdf = fitz.open()
        lessons = []
        with zipfile.ZipFile(OUT/f'{pid}.zip','w',zipfile.ZIP_DEFLATED) as archive:
            for i,(title,tempo,cue,source) in enumerate(TUNES):
                pitches, rhythms = [], []
                stroke = 0
                for bar in source.split('|'):
                    notes, lengths = [], []
                    for token in bar.split():
                        degree = int(token[0])
                        assert 0 <= degree <= 6
                        pitch = '-' if not degree else ('RL'[stroke%2] if pid=='snare' else SCALES[pid].split()[degree-1])
                        stroke += bool(degree)
                        notes.append(pitch)
                        lengths.append(token[1:] or 'q')
                    pitches.append(' '.join(notes))
                    rhythms.append(''.join(lengths))
                xml,midi,_,_,_ = compile_part(pid,(name,clef,key,shift,gm),'|'.join(pitches),'|'.join(rhythms),tempo,cue)
                tk = verovio.toolkit()
                assert tk.loadData(xml)
                seq = attacks(midi)
                assert seq == attacks(base64.b64decode(tk.renderToMIDI()))
                expected = [(10,0,2,3,5,7)[int(token[0])-1] for token in source.replace('|',' ').split() if token[0]!='0']
                assert all(n==38 for _,n in seq) if pid=='snare' else [n%12 for _,n in seq]==expected
                lesson = dict(cue=cue if pid!='snare' else 'Tap the melody rhythm. Follow the right- and left-hand sticking.',midi=base64.b64encode(midi).decode())
                for mobile,field in [(False,'page'),(True,'mobilePage')]:
                    svg,asset = engrave(xml,mobile,bars=len(pitches))
                    file = f'{i+1}-{field}.svg'
                    archive.writestr(file,svg)
                    lesson[field] = dict(**asset,src=file)
                    if not mobile:
                        vector = fitz.open('pdf',cairosvg.svg2pdf(bytestring=svg.encode()))
                        if i%2==0:
                            page = pdf.new_page(width=612,height=792)
                            pdf_text(page,32,44,'Beginner Pack',24,True)
                            pdf_text(page,32,68,name+'   ·   Concert B-flat',12)
                            pdf_text(page,530,44,f'{i//2+1} / 5',10)
                        top=108+(i%2)*340
                        pdf_text(page,32,top,f'{i+1}.  {title}',15,True)
                        pdf_text(page,480,top,f'{tempo} bpm',10)
                        height=min(285,548*asset['height']/asset['width'])
                        page.show_pdf_page(fitz.Rect(32,top+14,580,top+14+height),vector,0)
                lessons.append(lesson)
            archive.writestr('songs.json',json.dumps(lessons,separators=(',',':')))
        pdf.subset_fonts()
        pdf_name=f'Beginner-Pack-{pid}.pdf'
        pdf.save(OUT/pdf_name,garbage=4,deflate=True,no_new_id=True)
        assert len(fitz.open(OUT/pdf_name))==5
        manifest['parts'].append(dict(id=pid,name=name,pdf=f'beginner-pack/{pdf_name}'))
        print(pid,flush=True)
    (OUT/'program.json').write_text(json.dumps(manifest,ensure_ascii=False)+'\n')
if __name__=='__main__':
    build()
