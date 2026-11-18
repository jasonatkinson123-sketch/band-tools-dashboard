"""Engrave First Light and export the practice events from a single set of parts.

Run with Python 3, fontTools, and the Noto Music TTF installed.
"""
import json
import struct
from pathlib import Path
from xml.etree import ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = Path(__file__).resolve().parent
BPM = 96
BEAT = 60 / BPM
COLORS = '#242324'
STEPS = [0, 2, 4, 5, 7, 9, 11]
# Numbers are concert B-flat major scale degrees; suffix after slash is duration in quarter notes.
# Rests begin with r. Octave is specified individually per instrument.
lead = [
 '1 3 5/2','6/2 5 3','4 5 6 4','5/2 2/2',
 '4 6 5 4','3/2 5 8','7 6 5 2','1/4',
 '5 5 6 8','7/2 5/2','6 4 3 2','3/3 r',
 '2 4 6/2','5/2 4 3','2 3 4 7','8/4']
clarinet = [
 'r/2 3 5','4/2 3 1','1/2 4/2','2/3 r',
 '4 6 5 4','3/2 5 8','7 6 5 2','1/3 r',
 '3 3 4 6','5/2 2/2','4 2 1 4','5/3 r',
 '2 4 6/2','3/2 4 3','2/2 7/2','8/4']
alto = [
 '3/2 1/2','4 3 2/2','6/2 4/2','2/2 7/2',
 '1/2 4/2','3/2 1/2','2 4 2 7','3/4',
 '1/2 4/2','2 3 5/2','4/2 2/2','3/2 1/2',
 '4 2 4/2','3/2 1/2','4/2 2/2','3/4']
trumpet = [
 '1 3 5/2','6/2 5 3','4 5 6 4','5/2 2/2',
 'r/2 1 4','3/3 r','2/2 5/2','3/3 r',
 '5 5 6 8','7/2 5/2','6 4 3 2','3/3 r',
 '4/2 2/2','5/2 4 3','2 3 4 7','8/4']
horn = [
 '5/4','1/2 4/2','4/2 1/2','5/3 r',
 '4/2 1/2','5/4','5/2 2/2','1/3 r',
 '5/2 1/2','5/3 r','1/2 4/2','1/4',
 '4/2 2/2','5/2 3/2','2/2 5/2','1/4']
tenor = [
 '5/2 3/2','6/2 4/2','6/2 8/2','7/2 5/2',
 '6 5 4/2','5/2 3/2','4/2 2/2','3/3 r',
 '3/2 6/2','7/2 5/2','6 4 6/2','5/4',
 '6/2 4/2','5 3 1/2','4/2 2/2','3/4']
trombone = [
 '1/3 3','4/3 6','4/2 1/2','5/3 r',
 '4/2 6/2','1/3 3','5/2 2/2','1/3 r',
 '1/2 4/2','5/3 7','4/2 2/2','1/3 r',
 '2/2 4/2','1/2 3/2','5/3 2','1/4']
euph = [
 '1/2 5/2','4/2 1/2','4 6 8/2','5/3 2',
 '4/2 1/2','1/2 5/2','5 7 2/2','1/4',
 '1 3 4/2','5/2 2/2','4 6 4/2','1/3 r',
 '2 4 6/2','1/2 5/2','5/2 2/2','1/4']
mallets = [
 '1/2 r 5','6/2 5/2','4/2 r 6','5/2 2/2',
 '4/2 r 6','3/2 r 8','7/2 5/2','8/3 r',
 '5/2 6/2','7/2 r 5','6/2 4/2','3/3 r',
 '2/2 6/2','5/2 3/2','2/2 7/2','8/4']
# id, part, clef, concert tonic, written offset, written tonic letter, key in fifths, GM program.
parts = [
 ('flute','Flute','G',70,0,'B',-2,73,lead),
 ('clarinet','B♭ Clarinet','G',58,2,'C',0,71,clarinet),
 ('alto','E♭ Alto Saxophone','G',58,9,'G',1,65,alto),
 ('tenor','B♭ Tenor Saxophone','G',46,14,'C',0,66,tenor),
 ('trumpet','B♭ Trumpet','G',58,2,'C',0,56,trumpet),
 ('horn','F Horn','G',58,7,'F',-1,60,horn),
 ('trombone','Trombone','F',46,0,'B',-2,57,trombone),
 ('euphonium','Euphonium B.C.','F',46,0,'B',-2,58,euph),
 ('mallets','Mallets · Marimba','G',70,0,'B',-2,12,mallets)]
font = TTFont('/usr/share/fonts/truetype/noto/NotoMusic-Regular.ttf')
glyphs = font.getGlyphSet()
def definition(name, code):
    pen = SVGPathPen(glyphs)
    glyphs[font.getBestCmap()[code]].draw(pen)
    return f'<path id="{name}" d="{pen.getCommands()}"/>'
definitions = ''.join(definition(n,c) for n,c in [
 ('G',0x1d11e),('F',0x1d122),('flat',0x266d),('sharp',0x266f),
 ('black',0x1d158),('open',0x1d157),('whole',0x1d15d),('qr',0x1d13d)])
letters = 'CDEFGAB'
nats = [0,2,4,5,7,9,11]
def degree_midi(tonic, deg):
    octave, step = divmod(deg-1,7)
    return tonic+octave*12+STEPS[step]
def key_steps(fifths):
    return {l:(1 if fifths>0 else -1) for l in ('FCGDAEB'[:fifths] if fifths>0 else 'BEADGCF'[:-fifths])}
def data_for(part):
    pid, name, clef, tonic, trans, first, key, program, bars = part
    result = []
    for bar in bars:
        out = []
        for token in bar.split():
            p, _, d = token.partition('/')
            dur = int(d or 1)
            if p == 'r':
                out.append((None,None,None,None,dur))
            else:
                deg = int(p)
                midi = degree_midi(tonic, deg)
                step = (letters.index(first)+deg-1)%7
                written = midi+trans
                alter = key_steps(key).get(letters[step],0)
                octave = (written-nats[step]-alter)//12-1
                assert (octave+1)*12+nats[step]+alter == written, (part,p)
                out.append((midi,step,octave,alter,dur))
        assert sum(item[-1] for item in out)==4
        result.append(out)
    assert len(result)==16
    return result

def use(name,x,y,s,sx=None):
    return f'<use href="#{name}" xlink:href="#{name}" transform="translate({x:.2f} {y:.2f}) scale({sx or s:.4f} {-s:.4f})"/>'
def line(x,y,x2,y2,weight=1):
    return f'<path d="M{x:.2f},{y:.2f} L{x2:.2f},{y2:.2f}" fill="none" stroke="{COLORS}" stroke-width="{weight}"/>'
def txt(s,x,y,size,more=''):
    return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" {more}>{s}</text>'
def staff(part,bars):
    pid,name,clef,tonic,trans,first,key,program,_ = part
    w,h=1050,755
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="First Light, {name}, 16 measures"><defs>{definitions}</defs><rect width="100%" height="100%" fill="#fff"/><g fill="{COLORS}" font-family="Georgia,serif">',
         txt('First Light',w/2,68,45,'text-anchor="middle" font-weight="bold"'),
         txt('An original concert band study',w/2,96,18,'text-anchor="middle" font-style="italic"'),
         txt(name,45,137,19,'font-weight="bold"'),txt('DMS Band Studio',w-45,137,16,'text-anchor="end"')]
    boxes=[]
    for row in range(4):
        top=206+row*143
        bottom=top+44
        left=47; right=w-47
        for i in range(5):
            out.append(line(left,top+i*11,right,top+i*11,1.2))
        out.append(use(clef,left,bottom,.044))
        # Key signature positions counted up from the bottom staff line.
        key_positions=([4,7] if clef=='G' else [2,5]) if key<0 else [8]
        for j in range(abs(key)):
            ay=bottom-key_positions[j]*5.5
            if key<0: out.append(use('flat',left+35+j*12,ay+4.5,.052))
            else: out.append(use('sharp',left+36+j*13,ay+4.7,.031))
        key_end=left+36+abs(key)*12
        if row==0:
            xs=key_end+15
            out.extend(txt('4',xs,top+o,28,'text-anchor="middle" font-weight="bold"') for o in [21,43])
        start=key_end+(35 if row==0 else 10)
        width=(right-start)/4
        tag=chr(65+row)
        out.extend([f'<rect x="{start:.2f}" y="{top-40}" width="23" height="23" fill="none" stroke="{COLORS}" stroke-width="1.4"/>',
                    txt(tag,start+11.5,top-22,17,'font-weight="bold" text-anchor="middle"')])
        if row==0:
            # An upright quarter-note metronome mark uses the same notehead as the score.
            x=start+50; y=top-24
            out.extend([use('black',x-6,y+4,.029),line(x+3.5,y,x+3.5,y-18,1.1),txt('= 96',x+9,y+2,16),
                        txt('Con moto',x+61,y+2,16,'font-style="italic"')])
        for j in range(4):
            idx=4*row+j
            x=start+j*width
            boxes.append(dict(n=idx+1,x=round(x,2),y=top-14,w=round(width,2),h=76))
            out.append(txt(str(idx+1),x+1,top-5,11,'font-family="Arial,sans-serif"'))
            beat=0
            for midi,step,octave,alter,dur in bars[idx]:
                cx=x+22+beat*(width-29)/4
                if midi is None:
                    if dur==1:out.append(use('qr',cx-6,bottom,.044))
                    elif dur==2:out.append(f'<rect x="{cx-7}" y="{top+17}" width="14" height="5"/>')
                    else:raise ValueError(dur)
                else:
                    diat=octave*7+step
                    staff_bottom=(4*7+2 if clef=='G' else 2*7+4)
                    halfspaces=diat-staff_bottom
                    cy=bottom-halfspaces*5.5
                    for ledge in list(range(-2,halfspaces-1,-2)) if halfspaces<=-2 else list(range(10,halfspaces+1,2)):
                        ly=bottom-ledge*5.5
                        out.append(line(cx-11,ly,cx+11,ly,1.4))
                    glyph='whole' if dur==4 else 'open' if dur>=2 else 'black'
                    out.append(use(glyph,cx-(11.3 if dur==4 else 8.7),cy+5.45,.0406,.044))
                    if dur!=4:
                        upward=halfspaces<4
                        stemx=cx+(6.0 if upward else -6.0)
                        out.append(line(stemx,cy+(-1.7 if upward else 1.7),stemx,cy+(-37 if upward else 37),1.5))
                    if dur==3:
                        dy=cy-(5.5 if halfspaces%2==0 else 0)
                        out.append(f'<circle cx="{cx+14:.2f}" cy="{dy:.2f}" r="2"/>')
                beat+=dur
            out.append(line(x+width,top,x+width,bottom,4.4 if idx==15 else 1.4))
            if idx==15:out.append(line(x+width-7.5,top,x+width-7.5,bottom,1.3))
        out.append(txt('mf' if row in [0,2] else 'mp',start+16,bottom+40,22,'font-style="italic" font-weight="bold"'))
    out.append('</g></svg>')
    (OUT/f'{pid}.svg').write_text(''.join(out))
    return dict(src=f'demo/{pid}.svg',width=w,height=h,boxes=boxes)

def xmladd(el,tag,value=None,**attrs):
    elem=ET.SubElement(el,tag,attrs)
    if value is not None:elem.text=str(value)
    return elem
score=ET.Element('score-partwise',version='4.0')
work=xmladd(score,'work')
xmladd(work,'work-title','First Light')
identity=xmladd(score,'identification');xmladd(identity,'creator','DMS Band Studio',type='composer')
pl=xmladd(score,'part-list')
miditracks=[]
def vlq(n):
    b=[n&127];n>>=7
    while n:b.append(128|(n&127));n>>=7
    return bytes(reversed(b))
def miditrack(events):
    out=bytearray(); last=0
    for at,order,data in sorted(events):
        out.extend(vlq(at-last));out.extend(data);last=at
    out.extend(vlq(16*4*480-last));out.extend(b'\xff\x2f\x00')
    return b'MTrk'+struct.pack('>I',len(out))+out
miditracks.append(miditrack([(0,0,b'\xff\x51\x03'+(625000).to_bytes(3,'big')),(0,1,b'\xff\x58\x04\x04\x02\x18\x08')]))
sections=['Opening phrase','Answering phrase','Lift the line','Closing cadence']
demo=dict(id='first-light',title='First Light',credit='DMS Band Studio',kind='Original study',bpm=BPM,duration=16*4*BEAT,
          measures=[],parts=[],notes=[],sections=[])
for i in range(16):
    n=i+1;mark=chr(65+i//4)
    m=dict(n=n,t=i*4*BEAT,end=(i+1)*4*BEAT)
    if i%4==0:
        m['label']=mark
        demo['sections'].append(dict(name=mark+' · '+sections[i//4],**{'from':n,'to':n+3}))
    demo['measures'].append(m)
for ch,part in enumerate(parts):
    pid,name,clef,tonic,trans,first,key,program,_=part
    bars=data_for(part)
    demo['parts'].append(dict(id=pid,name=name,pages=[staff(part,bars)]))
    xmlid=f'P{ch+1}'
    sp=xmladd(pl,'score-part',id=xmlid);xmladd(sp,'part-name',name)
    mi=xmladd(sp,'score-instrument',id=xmlid+'-I1');xmladd(mi,'instrument-name',name)
    mi=xmladd(sp,'midi-instrument',id=xmlid+'-I1');xmladd(mi,'midi-channel',ch+1);xmladd(mi,'midi-program',program+1)
    xp=xmladd(score,'part',id=xmlid)
    title=name.encode()
    events=[(0,0,b'\xff\x03'+vlq(len(title))+title),(0,1,bytes([192+ch,program]))]
    for i,bar in enumerate(bars):
        measure=xmladd(xp,'measure',number=str(i+1))
        if i==0:
            attr=xmladd(measure,'attributes');xmladd(attr,'divisions',1)
            xmladd(xmladd(attr,'key'),'fifths',key)
            ts=xmladd(attr,'time');xmladd(ts,'beats',4);xmladd(ts,'beat-type',4)
            cl=xmladd(attr,'clef');xmladd(cl,'sign',clef);xmladd(cl,'line',2 if clef=='G' else 4)
            if trans:
                tr=xmladd(attr,'transpose')
                xmladd(tr,'diatonic',{2:-1,9:-5,14:-1,7:-4}[trans])
                xmladd(tr,'chromatic',-(trans%12))
                if trans>=12:xmladd(tr,'octave-change',-1)
        if i%4==0:
            dr=xmladd(measure,'direction',placement='above')
            dt=xmladd(dr,'direction-type');xmladd(dt,'rehearsal',chr(65+i//4))
            if i==0:
                xmladd(dr,'sound',tempo=str(BPM))
        beat=0
        for midi,step,octave,alt,dur in bar:
            note=xmladd(measure,'note')
            if midi is None:xmladd(note,'rest')
            else:
                pitch=xmladd(note,'pitch');xmladd(pitch,'step',letters[step])
                if alt:xmladd(pitch,'alter',alt)
                xmladd(pitch,'octave',octave)
                t=(i*4+beat)*BEAT
                demo['notes'].append(dict(part=pid,midi=midi,t=t,d=BEAT*dur))
                tick=(i*4+beat)*480
                events.extend([(tick,3,bytes([144+ch,midi,76 if (i//4)%2==0 else 65])),(tick+dur*480,2,bytes([128+ch,midi,0]))])
            xmladd(note,'duration',dur)
            xmladd(note,'type',{1:'quarter',2:'half',3:'half',4:'whole'}[dur])
            if dur==3:xmladd(note,'dot')
            beat+=dur
    miditracks.append(miditrack(events))
demo['notes'].sort(key=lambda n:(n['t'],n['part']))
(OUT/'demo.json').write_text(json.dumps(demo,ensure_ascii=False,separators=(',',':')))
ET.indent(score)
ET.ElementTree(score).write(OUT/'First-Light.musicxml',encoding='utf-8',xml_declaration=True)
(OUT/'First-Light.mid').write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(miditracks),480)+b''.join(miditracks))
