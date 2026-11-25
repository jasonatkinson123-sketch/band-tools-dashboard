// Carol of the Bells / Shchedryk, Mykola Leontovych (public-domain melody).
// New compact unison adaptation, concert B-flat minor; no English lyrics.
// Every measure is 3/4; durations are sixteenth-note units.
import {engrave, parts} from './bumblebee.js?v=3';
export const carolId='carol-of-the-bells';
const q=(...p)=>p.map(n=>[n,4]);
const motif=(a,b,c,d)=>[[a,4],[b,2],[c,2],[d,4]];
const eighth=(...p)=>p.map(n=>[n,2]);
const sustain=p=>[[p,12]];
const rest=p=>[[p,4],[null,4],[null,4]];
const A=motif(61,60,61,58); // Db C Db Bb
const B=motif(65,63,65,61); // F Eb F Db
const C=q(58,58,58),D=q(68-12,66,65),E=q(65,65,63),F=q(61,63,63),G=q(63,65,63);
const H=eighth(65,67,57,58,60,61),I=[[63,2],[65,2],[63,2],[61,2],[58,4]];
// D is the descending high answer octave-compressed for young winds;
// H and I preserve the ascending/descending scale pitch classes.
const levels=[
 {title:'Find the Bells',bpm:72,cue:'Count 1–2–3. Learn the three pitches of the opening figure with steady quarter notes.',bars:[q(58,60,61),q(61,60,58),q(61,60,61),q(58,58,58),q(61,60,61),q(58,60,61),q(61,60,58),sustain(58)]},
 {title:'First Ring',bpm:80,cue:'Quarter, two eighths, quarter. Say 1, 2-and, 3 before playing the four-note bell motif.',bars:[A,rest(58),A,rest(58),A,A,A,sustain(58)]},
 {title:'Echoing Bells',bpm:88,cue:'Learn the higher answering figure using F and E-flat (concert). Keep each group of eighth notes even.',bars:[q(61,63,65),q(65,63,61),B,rest(61),B,B,A,A,sustain(58)]},
 {title:'The Bell Tower',bpm:96,cue:'Connect the two bell motifs and the repeated-note response. Breathe between four-bar phrases.',bars:[A,A,B,B,C,D,E,F,G,C,A,sustain(58)]},
 {title:'The Bells in Motion',bpm:88,cue:'Practice the rising and falling eighth-note run. Keep the pulse steady as the octave-adjusted notes change direction.',bars:[q(65,67,57),q(58,60,61),q(63,65,63),H,I,rest(58),H,I,A,A,sustain(58)]},
 {title:'Carol of the Bells',bpm:104,cue:'Perform the complete classroom adaptation: opening bells, higher answer, descending response, scale runs and return. Build toward 132 BPM.',bars:[A,A,A,A,B,B,B,B,C,D,E,F,G,C,H,I,H,I,A,A,A,A,B,sustain(58)]}
].map(l=>({...l,beats:3}));
const instruments=parts.map(p=>({...p}));
export function loadCarol(partId,levelNumber){
 const part=instruments.find(p=>p.id===partId)||instruments.find(p=>p.id==='clarinet');
 const i=Math.max(0,Math.min(5,(Number.isInteger(+levelNumber)&&+levelNumber>0?+levelNumber:1)-1));
 const level=levels[i],unit=60/level.bpm/4,measures=[],events=[];
 level.bars.forEach((bar,j)=>{
  let tick=j*12;
  measures.push({n:j+1,t:tick*unit,end:(tick+12)*unit});
  for(const [m,d] of bar){
   if(m!==null)events.push({part:part.id,midi:part.drum?38:m+part.oct,t:tick*unit,d:d*unit*.94,...(part.drum?{sample:0,velocity:tick%12===0?103:76}:{})});
   tick+=d;
  }
  if(tick!==(j+1)*12)throw Error('Invalid Carol measure '+(j+1));
 });
 const sections=[];for(let n=1;n<=measures.length;n+=4)sections.push({name:'Measures '+n+'–'+Math.min(n+3,measures.length),from:n,to:Math.min(n+3,measures.length)});
 return {id:carolId,title:'CAROL OF THE BELLS',kind:'Unison band technique',credit:'Mykola Leontovych · Shchedryk · adapted for DMS',level:i+1,levelTitles:levels.map(l=>l.title),cue:level.cue,selectedPart:part.id,parts:instruments.map(({id,name})=>({id,name})),page:engrave(part,level),mobilePage:engrave(part,level,2),pdf:'./carol-print.html?part='+encodeURIComponent(part.id),notes:events,bpm:level.bpm,duration:measures.at(-1).end,measures,sections,countBeats:3,...(part.drum?{sampleZones:[[0,.28]],bankResource:'./level-up/snare.wav'}:{})};
}
export function printCarol(id){const part=instruments.find(p=>p.id===id)||instruments[1];return {name:part.name,levels:levels.map(l=>({title:l.title,bpm:l.bpm,cue:l.cue,src:engrave(part,l,4).src}))};}
for(const l of levels)for(const b of l.bars){
 if(b.reduce((s,e)=>s+e[1],0)!==12)throw Error('Invalid Carol rhythm');
 for(const [m] of b)if(m!==null&&(m<56||m>67||m+2<58||m+2>69))throw Error('Carol range violation');
}
