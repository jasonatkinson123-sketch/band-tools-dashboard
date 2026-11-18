"""Compile the handwritten, part-relative transcription against a measured 2/2 grid."""
import copy, functools, hashlib, json, re, struct, zipfile
from pathlib import Path
BASE=Path(__file__).resolve().parent
SOURCE=BASE.parent/'studio/dist/sleigh'
OUT=BASE/'release';OUT.mkdir(exist_ok=True)
PPQ=480
PARTS={p['id']:p for p in json.loads((SOURCE/'sleigh.json').read_text())['parts']}
# flats, transposition from printed to concert semitones, General MIDI program, MIDI channel
CONFIG={'flute':(3,0,73,0),'clarinet-1':(1,-2,71,1),'clarinet-2':(1,-2,71,2),'alto-sax':(0,-9,65,3),
 'trumpet-1':(1,-2,56,4),'trumpet-2':(1,-2,56,5),'horn':(2,-7,60,6),'trombone':(3,0,57,7),
 'baritone-bc':(3,0,58,8),'baritone-tc':(1,-14,58,10),'mallets':(3,24,9,11),
 'percussion-1':(0,0,0,9),'percussion-2':(0,0,0,9),'percussion-3':(0,0,0,9)}
REHEARSALS=[1,13,21,29,37,45,53,63,71,79,87,95,103,111]
def inclusive(a,b):return range(int(a),int(b)+1)
@functools.cache
def bars(part):
    result=[]
    for line in (BASE/'parts'/(part+'.txt')).read_text().splitlines():
        number,expr=line.strip().split(' ',1)
        assert int(number)==len(result)+1,(part,number,len(result)+1)
        for bar in map(str.strip,expr.split('|')):
            if bar.startswith('R'):result.extend(['r:4']*int(bar[1:]))
            elif bar.startswith(('C','@')):
                source=result
                if bar.startswith('@'):
                    other,bar=bar[1:].split('/');source=bars(other)
                else:bar=bar[1:]
                m=re.fullmatch(r'(\d+)(?:-(\d+))?(?:\*(\d+))?',bar);a,b,n=m.groups()
                result.extend([source[i-1] for i in inclusive(a,b or a)]*int(n or 1))
            else:result.append('83 83 83 83' if bar=='Q' else bar)
    assert len(result)==120,(part,len(result))
    return result
def sound(part,step,alter,changes,measure):
    flats,shift,_,_=CONFIG[part]
    # Diatonic integer relative to C0. E4 for treble, G2 for bass.
    idx=(18 if part in ('trombone','baritone-bc') else 30)+step
    octv,i=divmod(idx,7);letter='CDEFGAB'[i]
    if alter:changes[step]={'#':1,'n':0,'b':-1}[alter]
    acc=changes.get(step,-1 if letter in 'BEADGCF'[:flats] else 0)
    written=12*(octv+1)+(0,2,4,5,7,9,11)[i]+acc
    musical=written+shift-(12 if part=='mallets' and 41<=measure<=44 else 0)
    return musical,letter+{0:'',1:'#',-1:'b'}[acc]+str(octv)
def velocity(part,m,beat):
    wind=part not in ('mallets','percussion-1','percussion-2','percussion-3')
    markings={1:92,13:78,45:93,63:63,65:95,67:63,69:95,71:78,79:63,81:95,83:63,85:95,87:78,95:94,108:78,120:108}
    if part=='percussion-2': markings.update({28:76,118:94})
    if part=='percussion-3':markings.update({77:78,78:95,118:78})
    if part=='mallets':markings.update({41:78,74:78,91:78})
    if wind:markings.update({44:94,77:77,78:92,91:78,111:78,119:78})
    v=markings[max(k for k in markings if k<=m)]
    for start,end in [(63,65),(67,69),(79,81),(83,85),(93,94)]:
        if start<=m<end:v+=int(27*(m-start+beat/4)/(end-start))
    return v
def events(part):
    batch=[];written=[];last=None
    for measure,line in enumerate(bars(part),1):
        at=0;changes={};notation=[]
        for token in line.split():
            item,_,duration=token.partition(':');duration=.5 if duration=='h' else float(duration or 1)
            start=4*(measure-1)+at;v=velocity(part,measure,at);at+=duration
            is_tied=item.startswith('~');stacc='.' in item;accent='>' in item
            item=item.strip('~.>');rec={'offset':at-duration,'beats':duration}
            if item in ('FX','r'):
                rec['type']='horse-whinny' if item=='FX' else 'rest';last=None
            elif part.startswith('percussion'):
                rec.update(type='percussion',voice=item)
                instruments={'b':[36],'s':[38],'sb':[36,38]}
                def hit(key,when,length=.13,vel=v):batch.append(dict(part=part,midi=key,q=when,length=length,v=min(127,vel)))
                if item.startswith('roll'):
                    for j in range(8):hit(38,start+j/8,.105,v-13+(j%2)*4)
                    if '+b' in item:hit(36,start)
                elif item=='grace+sb':
                    for delta in [.16,.08]:hit(38,start-delta,.06,v-22)
                    for key in [36,38]:hit(key,start,.19,v+9)
                else:
                    keys=instruments[item] if item in instruments else [int(item)]
                    for key in keys:hit(key,start,min(.28,duration*.80),v+accent*8)
            else:
                m=re.fullmatch(r'(-?\d+)([#bn]?)',item);assert m,(part,measure,item)
                key,name=sound(part,int(m[1]),m[2],changes,measure)
                rec.update(type='note',written=name,sounding=key,tieIn=is_tied,staccato=stacc,accent=accent)
                gate=.63 if stacc else .97
                if is_tied:
                    assert last and key==last['midi'] and abs(last['end']-start)<.001,(part,measure,key,last)
                    last.update(length=start-last['q']+duration*gate,end=start+duration)
                else:
                    last=dict(part=part,midi=key,q=start,length=duration*gate,end=start+duration,v=min(127,v+8*accent));batch.append(last)
            notation.append(rec)
        assert at==4,(part,measure,line,at)
        written.append(notation)
    return batch,written
def varlen(x):
    out=[x&127]
    while x>127:x>>=7;out.insert(0,128+(x&127))
    return bytes(out)
def meta(t,p):return bytes([255,t])+varlen(len(p))+p
def track(seq):
    raw=bytearray();prev=0
    for tick,priority,cmd in sorted(seq,key=lambda e:e[:2]):
        assert tick>=prev
        raw.extend(varlen(tick-prev)+cmd);prev=tick
    raw.extend(varlen(120*4*PPQ-prev)+meta(47,b''))
    return b'MTrk'+struct.pack('>I',len(raw))+raw
def midfile(partids,data):
    conductor=[(0,0,meta(81,bytes.fromhex('07a120'))),(0,0,meta(88,bytes([2,1,48,8]))),
      (0,0,meta(89,bytes([253,0]))),(0,0,meta(1,b'Moderato - chosen practice tempo: half note = 60'))]
    for m in REHEARSALS:conductor.append(((m-1)*4*PPQ,0,meta(6,('Opening' if m==1 else f'Rehearsal {m}').encode())))
    result=[track(conductor)]
    for p in partids:
        _,_,pg,ch=CONFIG[p];seq=[(0,0,meta(3,PARTS[p]['name'].replace('♭','b').encode('utf-8')))]
        if ch!=9:seq.append((0,1,bytes([192+ch,pg])))
        if p=='mallets':
            for m,prog in [(41,13),(74,9)]:seq.append(((m-1)*1920,1,bytes([192+ch,prog])))
        if p=='trumpet-1':seq.append((115*1920,1,meta(7,b'Horse whinny: valves halfway, fall. Live player cue.')))
        # Alternative treble-clef part is selectable in the file; avoid doubling the euphonium chair.
        if p=='baritone-tc' and 'baritone-bc' in partids:seq.append((0,1,bytes([176+ch,7,0])))
        for n in data[p]:
            t=round(n['q']*PPQ);end=round((n['q']+n['length'])*PPQ)
            seq.extend([(t,3,bytes([144+ch,n['midi'],n['v']])),(end,2,bytes([128+ch,n['midi'],0]))])
        result.append(track(seq))
    return b'MThd'+struct.pack('>IHHH',6,1,len(result),PPQ)+b''.join(result)
if __name__=='__main__':
    data={};written={}
    for p in CONFIG:
        data[p],written[p]=events(p);print(p,len(data[p]))
    assert [(n['q'],n['length'],n['midi']) for n in data['baritone-bc']]==[(n['q'],n['length'],n['midi']) for n in data['baritone-tc']]
    (OUT/'MIDI').mkdir(exist_ok=True)
    for p in CONFIG:(OUT/'MIDI'/(p+'.mid')).write_bytes(midfile([p],data))
    (OUT/'Sleigh-Ride-ensemble.mid').write_bytes(midfile(CONFIG,data))
    (OUT/'written-events.json').write_text(json.dumps(written,separators=(',',':')))
