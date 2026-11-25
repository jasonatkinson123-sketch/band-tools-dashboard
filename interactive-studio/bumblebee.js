// DMS Bumblebee Challenge — shared concert-pitch source, independent of other packs.
// Rimsky-Korsakov (1900 vocal score, public domain); opening and main figure,
// octave-compressed and connected for developing band. All durations in sixteenths.
export const beeId = 'bumblebee-challenge';
const A=[65,64,63,62,63,62,61,60]; // original opening, transposed +1 semitone
const B=[65,64,63,62,61,66,65,64]; // original m.7
const C=[65,64,63,62,61,62,63,64]; // original m.8
const D=[61,62,63,64,65,66,65,64]; // original m.12
const notes=(p,d=1)=>p.map(n=>[n,d]);
const bar=(...events)=>events;
const held=p=>[[p,4],[null,4]];
const bursts=p=>[...notes(p.slice(0,4)),[null,4]];
const eighths=p=>notes(p,2);
const six=p=>notes(p);
const levels=[
 {title:'Meet the Bee',bpm:72,cue:'Quarter notes: learn each new chromatic fingering. Keep the air moving.',bars:[
  notes([65,64],4),notes([63,62],4),notes([63,62],4),notes([61,60],4),notes([61,62],4),notes([63,64],4),notes([65,66],4),held(65)]},
 {title:'Baby Buzz',bpm:80,cue:'Four eighth notes per bar. Finger the notes close to the keys; use light articulation.',bars:[
  eighths(A.slice(0,4)),eighths(A.slice(4)),eighths(A.slice(0,4)),eighths(A.slice(4)),
  eighths([61,62,63,64]),eighths([65,66,65,64]),eighths([63,62,61,60]),held(58)]},
 {title:'The Swarm',bpm:100,cue:'Play the original opening figure as eighth notes, then practice the rising and falling main figure.',bars:[
  ...[A,B,C,D].flatMap(p=>[eighths(p.slice(0,4)),eighths(p.slice(4))]),held(58)]},
 {title:'Takeoff',bpm:64,cue:'Four sixteenths in one beat, then one beat of rest. Think ONE-e-and-a; breathe during the rests.',bars:[
  ...[A,B,C,D].flatMap(p=>[bursts(p),bursts(p.slice(4))]),held(58)]},
 {title:'First Flight',bpm:80,cue:'Connect both four-note groups. Breathe in the resting bars; keep the sixteenths even.',bars:[
  six(A),six(A),held(60),six(B),six(C),held(65),six(A),six(D),held(58)]},
 {title:'Flight of the Bumblebee',bpm:96,cue:'Concert B-flat minor adaptation: original opening and main-figure cells with breathing points. Start slowly; build toward 144 BPM.',bars:[
  six(A),six(A),six(A),held(60),
  six(B),six(C),six(B),six(C),held(65),
  six(A),six(D),six(A),held(60),
  six(B),six(C),six(D),six(A),held(58)]}
];
// Sounding pitch = source + octave; written pitch = sounding + transposition.
// Clarinet C4–Ab4, always below the break. Flute is an octave above the source.
const parts=[
 {id:'concert',name:'Concert pitch / director',oct:0,trans:0},
 {id:'flute',name:'Flute',oct:12,trans:0},
 {id:'clarinet',name:'B♭ Clarinet',oct:0,trans:2},
 {id:'alto',name:'E♭ Alto Saxophone',oct:0,trans:9},
 {id:'tenor',name:'B♭ Tenor Saxophone',oct:-12,trans:14},
 {id:'trumpet',name:'B♭ Trumpet',oct:0,trans:2},
 {id:'horn',name:'F Horn',oct:-12,trans:7},
 {id:'trombone',name:'Trombone',oct:-12,trans:0,bass:true},
 {id:'euphonium',name:'Baritone / Euphonium B.C.',oct:-12,trans:0,bass:true},
 {id:'baritone-tc',name:'Baritone T.C.',oct:-12,trans:14},
 {id:'mallets',name:'Mallets / Xylophone',oct:0,trans:0},
 {id:'bass-guitar',name:'Bass Guitar',oct:-24,trans:12,bass:true},
 {id:'snare',name:'Snare Drum',oct:0,trans:0,drum:true}
];
const spelling=[['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];
const steps='CDEFGAB';
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function pitch(m){const [letter,acc]=spelling[m%12];return {letter,acc,step:Math.floor(m/12)*7+steps.indexOf(letter)}}
const line=(x1,y1,x2,y2,w=1)=>'<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" stroke="#111" stroke-width="'+w+'" fill="none"/>';
const label=(x,y,s,size=15,extra='')=>'<text x="'+x+'" y="'+y+'" font-family="Arial,sans-serif" font-size="'+size+'" fill="#111" '+extra+'>'+escape(s)+'</text>';
// Draw standard staff notation with beat-grouped beams, ledger lines,
// accidentals reset by measure, and actual quarter/eighth/sixteenth durations.
export function engrave(part,level,cols=4){
 const cell=360, rowH=142, left=64, width=left+cell*cols+12;
 const rows=Math.ceil(level.bars.length/cols),height=rows*rowH+12;
 const bits=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="white"/>'];
 const boxes=[];
 const staffY=part.bass?pitch(43).step:pitch(64).step; // G2 or E4 bottom line
 for(let row=0;row<rows;row++){
   const top=row*rowH,base=top+88, count=Math.min(cols,level.bars.length-row*cols);
   const right=left+count*cell;
   for(let l=0;l<5;l++)bits.push(line(12,base-l*10,right,base-l*10));
   if(part.drum){bits.push(line(24,base-30,24,base-10,4),line(31,base-30,31,base-10,4))}
   else if(part.bass){bits.push('<path d="M18 '+(base-29)+' C13 '+(base-42)+' 35 '+(base-45)+' 36 '+(base-29)+' C37 '+(base-15)+' 21 '+(base-5)+' 14 '+(base-5)+' C32 '+(base-18)+' 35 '+(base-34)+' 23 '+(base-36)+' C18 '+(base-37)+' 16 '+(base-31)+' 18 '+(base-29)+' Z" fill="#111"/><circle cx="44" cy="'+(base-35)+'" r="2.4"/><circle cx="44" cy="'+(base-25)+'" r="2.4"/>')}
   else {bits.push('<text x="12" y="'+(base+3)+'" font-family="Noto Music,Segoe UI Symbol,Bravura,serif" font-size="57" fill="#111">𝄞</text>')}
   if(row===0){bits.push(label(48,base-25,'2',18,'font-weight="bold"'),label(48,base-8,'4',18,'font-weight="bold"'))}
   for(let col=0;col<count;col++){
    const idx=row*cols+col,x0=left+cell*col,events=level.bars[idx];
    boxes.push({n:idx+1,x:x0,y:top,w:cell,h:rowH});
    bits.push(label(x0+5,top+17,String(idx+1),12));
    const memo=new Map(),drawn=[]; let tick=0;
    for(const [m,d] of events){
      const x=x0+32+tick*40;
      if(m===null){
       // Quarter rest: conventional zigzag with lower hook.
       bits.push('<path d="M'+(x-3)+' '+(base-35)+' l8 11 -6 8 7 8 q-12 -5 -9 4 l4 5 q-12 -6 -6 -12 l-2 -5 6 -9 z" fill="#111"/>');
       drawn.push({tick,d,rest:true});tick+=d;continue;
      }
      const written=m+part.oct+part.trans,p=pitch(written);
      const offset=part.drum?4:p.step-staffY,y=base-5*offset;
      for(let k=-2;k>=offset;k-=2)bits.push(line(x-10,base-5*k,x+10,base-5*k));
      for(let k=10;k<=offset;k+=2)bits.push(line(x-10,base-5*k,x+10,base-5*k));
      if(!part.drum && (memo.get(p.step)??0)!==p.acc){
       bits.push(label(x-19,y+5,p.acc===-1?'♭':'♮',19));memo.set(p.step,p.acc)
      }
      bits.push('<ellipse cx="'+x+'" cy="'+y+'" rx="6.6" ry="4.7" transform="rotate(-18 '+x+' '+y+')" fill="#111"/>');
      drawn.push({x,y,d,tick});tick+=d;
    }
    for(let beat=0;beat<2;beat++){
     const group=drawn.filter(n=>!n.rest&&Math.floor(n.tick/4)===beat);
     if(!group.length)continue;
     const beam=group.length>1&&group.every(n=>n.d<=2);
     if(beam){
       const down=group.reduce((s,n)=>s+n.y,0)/group.length<base-20;
       const sy=down?Math.max(...group.map(n=>n.y))+30:Math.min(...group.map(n=>n.y))-30;
       const dx=down?-6:6;
       group.forEach(n=>bits.push(line(n.x+dx,n.y,n.x+dx,sy,1.5)));
       const a=group[0].x+dx,b=group.at(-1).x+dx;
       bits.push(line(a,sy,b,sy,4.5));
       if(group.every(n=>n.d===1))bits.push(line(a,sy+(down?-7:7),b,sy+(down?-7:7),4.5));
     }else group.forEach(n=>{
       const down=n.y<base-20,dx=down?-6:6,sy=n.y+(down?30:-30);
       bits.push(line(n.x+dx,n.y,n.x+dx,sy,1.5))
     });
    }
    const bx=x0+cell;
    bits.push(line(bx,base-40,bx,base,idx===level.bars.length-1?3:1.2));
    if(idx===level.bars.length-1)bits.push(line(bx-6,base-40,bx-6,base,1.1));
   }
 }
 bits.push('</svg>');
 const svg=bits.join('');
 return {width,height,boxes,svg,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)};
}
export function loadBee(partId,levelNumber){
 const part=parts.find(p=>p.id===partId)||parts.find(p=>p.id==='clarinet');
 const i=Math.max(0,Math.min(levels.length-1,(Number.isInteger(+levelNumber)&&+levelNumber>0?+levelNumber:1)-1));
 const level=levels[i],unit=60/level.bpm/4,measures=[],events=[];
 level.bars.forEach((bar,j)=>{
  let tick=j*8;
  measures.push({n:j+1,t:tick*unit,end:(tick+8)*unit});
  for(const [m,d] of bar){
   if(m!==null)events.push({part:part.id,midi:part.drum?38:m+part.oct,t:tick*unit,d:d*unit*.94,...(part.drum?{sample:0,velocity:tick%4===0?103:76}:{})});
   tick+=d
  }
  if(tick!==(j+1)*8)throw Error('Invalid Bumblebee measure '+(j+1));
 });
 const sections=[];for(let n=1;n<=measures.length;n+=2)sections.push({name:'Measures '+n+'–'+Math.min(n+1,measures.length),from:n,to:Math.min(n+1,measures.length)});
 return {id:beeId,title:'BUMBLEBEE CHALLENGE',kind:'Unison band technique',credit:'N. Rimsky-Korsakov · adapted for DMS',level:i+1,levelTitles:levels.map(l=>l.title),cue:level.cue,selectedPart:part.id,parts:parts.map(({id,name})=>({id,name})),page:engrave(part,level),mobilePage:engrave(part,level,2),pdf:'./bumblebee-print.html?part='+encodeURIComponent(part.id),notes:events,bpm:level.bpm,duration:measures.at(-1).end,measures,sections,countBeats:4,...(part.drum?{sampleZones:[[0,.28]],bankResource:'./level-up/snare.wav'}:{})};
}
export function printBee(id){
 const part=parts.find(p=>p.id===id)||parts[1];
 return {name:part.name,levels:levels.map(l=>({title:l.title,bpm:l.bpm,cue:l.cue,src:engrave(part,l,4).src}))};
}
// Check every event, all bar lengths, written ranges, and octave-equivalent pitch classes.
for(const l of levels)for(const b of l.bars){
 if(b.reduce((s,e)=>s+e[1],0)!==8)throw Error('Invalid Bumblebee rhythm');
 for(const [m] of b)if(m!==null&&(m<58||m>66||m+2<60||m+2>68))throw Error('Bumblebee range violation');
}
