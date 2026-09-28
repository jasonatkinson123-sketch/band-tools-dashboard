(() => {
  'use strict';
  if (document.getElementById('derby-band-bell-host')) return;

  const TZ = 'America/New_York';
  const OVERRIDE_KEY = 'derbyBandBellOverrideV1';
  const FIVE = 300;
  const HOLD = 15;

  const schedules = {
    full: [
      ['09:33','6TH','UA 1'], ['10:31','7TH','UA 2'], ['11:29','8TH','UA 3'],
      ['12:01','6TH','LUNCH BREAK'], ['13:01','6TH','UA 4'], ['13:58','8TH','UA 5'], ['14:55','7TH','UA 6']
    ],
    early: [
      ['09:09','6TH','UA 1'], ['09:43','7TH','UA 2'], ['10:17','8TH','UA 3'],
      ['10:47','6TH','UA 4'], ['11:17','8TH','UA 5'], ['12:25','7TH','UA 6']
    ],
    delay: [
      ['11:19','6TH','UA 1'], ['11:58','7TH','UA 2'], ['12:28','8TH','UA 3'],
      ['13:31','6TH','UA 4'], ['14:13','8TH','UA 5'], ['14:55','7TH','UA 6']
    ]
  };

  const earlyDates = new Set([
    '2026-09-18','2026-10-07','2026-11-09','2026-11-13','2026-11-25','2026-12-02','2026-12-23',
    '2027-02-03','2027-02-11','2027-02-12','2027-03-03','2027-04-07','2027-05-05','2027-06-11','2027-06-14','2027-06-15'
  ]);

  const noSchool = new Set([
    '2026-09-07','2026-10-12','2026-11-03','2026-11-11','2026-11-26','2026-11-27',
    '2026-12-24','2026-12-25','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01',
    '2027-01-18','2027-02-15','2027-02-16','2027-03-26','2027-04-12','2027-04-13','2027-04-14','2027-04-15','2027-04-16','2027-05-31'
  ]);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  });

  let testUntil = 0;

  const host = document.createElement('div');
  host.id = 'derby-band-bell-host';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `
<style>
:host{position:fixed;right:14px;bottom:14px;z-index:2147483000;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#111}*{box-sizing:border-box}button{font:inherit}.box{width:238px;border:3px solid #111;background:#fffdf7;box-shadow:7px 7px 0 #111;position:relative}.compact{padding:10px 12px}.eyebrow{font-size:9px;font-weight:900;letter-spacing:.12em;color:#6f4aa8;text-transform:uppercase}.line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:4px}.time{font-size:24px;font-weight:950;letter-spacing:-.05em}.grade{font-size:11px;font-weight:900;letter-spacing:.08em}.detail{font-size:8px;font-weight:800;letter-spacing:.05em;color:#6f6b63;text-transform:uppercase;margin-top:4px}.mode{position:absolute;right:6px;top:5px;border:0;background:transparent;color:#777;font-size:8px;font-weight:900;cursor:pointer;padding:4px}.counting{width:min(350px,calc(100vw - 28px));background:#111;color:#fff;box-shadow:8px 8px 0 #6f4aa8}.counting .compact{display:none}.countpane{display:none;padding:13px 15px 14px}.counting .countpane{display:block}.head{display:flex;justify-content:space-between;gap:10px}.pack{font-size:12px;font-weight:950;letter-spacing:.13em;color:#f3df68}.cgrade{font-size:10px;font-weight:900;color:#d8d3ca}.count{font-size:48px;line-height:.95;font-weight:950;letter-spacing:-.07em;margin-top:5px;font-variant-numeric:tabular-nums}.sub{font-size:9px;font-weight:800;color:#c8c3b9;text-transform:uppercase;margin-top:6px}.bar{height:7px;margin-top:10px;background:#383838;border:1px solid #666;overflow:hidden}.bar i{display:block;height:100%;background:#f3df68;transform-origin:left}.urgent{box-shadow:8px 8px 0 #e54b4b}.urgent .pack,.urgent .count{color:#ff6b6b}.urgent .bar i{background:#ff6b6b}.ring{animation:ring .5s steps(2) infinite}.menu{display:none;position:absolute;right:0;bottom:calc(100% + 10px);width:238px;border:3px solid #111;background:#fffdf7;box-shadow:6px 6px 0 #111;padding:9px;color:#111}.menu.open{display:block}.menu h3{font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.grid button{border:2px solid #111;background:#fff;min-height:32px;font-size:8px;font-weight:900;text-transform:uppercase;cursor:pointer}.note{font-size:7px;line-height:1.35;color:#666;margin-top:7px}@keyframes ring{50%{transform:translateY(-2px)}}@media(max-width:600px){:host{right:10px;bottom:10px}.box{width:205px}.counting{width:min(320px,calc(100vw - 20px))}.count{font-size:42px}.menu{width:225px}}@media(prefers-reduced-motion:reduce){.ring{animation:none}}
</style>
<div class="box" id="box" role="status" aria-live="polite">
  <div class="compact"><div class="eyebrow" id="label">NEXT BAND BELL</div><div class="line"><span class="time" id="time">--:--</span><span class="grade" id="grade"></span></div><div class="detail" id="detail">LOADING</div></div>
  <div class="countpane"><div class="head"><span class="pack" id="pack">PACK UP</span><span class="cgrade" id="cgrade"></span></div><div class="count" id="count">05:00</div><div class="sub" id="sub"></div><div class="bar"><i id="fill"></i></div></div>
  <button class="mode" id="mode" type="button">AUTO</button>
  <div class="menu" id="menu"><h3>Today's bell schedule</h3><div class="grid"><button data-mode="auto">Auto</button><button data-mode="full">Full day</button><button data-mode="early">Early</button><button data-mode="delay">2-hour delay</button><button data-test="1">Test 5:00</button><button data-close="1">Close</button></div><div class="note">Manual choices apply to today only and carry across the Band Tools pages on this device.</div></div>
</div>`;

  const q = s => root.querySelector(s);
  const box=q('#box'), label=q('#label'), time=q('#time'), grade=q('#grade'), detail=q('#detail');
  const mode=q('#mode'), menu=q('#menu'), pack=q('#pack'), cgrade=q('#cgrade'), count=q('#count'), sub=q('#sub'), fill=q('#fill');

  function nowParts(){
    const o={};
    fmt.formatToParts(new Date()).forEach(p=>{if(p.type!=='literal')o[p.type]=p.value;});
    return {y:+o.year,m:+o.month,d:+o.day,w:o.weekday,h:+o.hour,min:+o.minute,s:+o.second};
  }
  function key(p){return String(p.y)+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0');}
  function sec(p){return p.h*3600+p.min*60+p.s;}
  function target(t){const a=t.split(':').map(Number);return a[0]*3600+a[1]*60;}
  function showTime(t){let a=t.split(':').map(Number),h=a[0],ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+String(a[1]).padStart(2,'0')+' '+ap;}
  function override(today){try{const x=JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'null');return x&&x.date===today?x.mode:null;}catch(e){return null;}}
  function setOverride(today,m){if(m==='auto')localStorage.removeItem(OVERRIDE_KEY);else localStorage.setItem(OVERRIDE_KEY,JSON.stringify({date:today,mode:m}));}
  function scheduleMode(p){const today=key(p),manual=override(today);if(manual)return {m:manual,manual:true};if(p.w==='Sat'||p.w==='Sun'||noSchool.has(today)||today<'2026-09-01'||today>'2027-06-15')return {m:'none'};if(earlyDates.has(today))return {m:'early'};return {m:'full'};}
  function nextEvent(list,n){for(const e of list){const t=target(e[0]);if(t-n>-HOLD)return {time:e[0],grade:e[1],label:e[2],t};}return null;}
  function remainText(r){r=Math.max(0,Math.ceil(r));return String(Math.floor(r/60)).padStart(2,'0')+':'+String(r%60).padStart(2,'0');}

  function compact(l,t,g,d){box.className='box';label.textContent=l;time.textContent=t;grade.textContent=g;detail.textContent=d;}
  function countdown(e,r,isTest){box.className='box counting'+(r<=60?' urgent':'');pack.textContent=isTest?'BELL TEST':(e.label==='LUNCH BREAK'?'WRAP FOR LUNCH':'PACK UP');cgrade.textContent=isTest?'PREVIEW':e.grade+' GRADE';count.textContent=remainText(r);sub.textContent=isTest?'PREVIEWING THE FIVE-MINUTE COUNTDOWN':e.label+' ENDS AT '+showTime(e.time);fill.style.transform='scaleX('+Math.max(0,Math.min(1,r/FIVE))+')';}
  function ringing(e){box.className='box counting urgent ring';pack.textContent=e.label==='LUNCH BREAK'?'LUNCH':'TIME';cgrade.textContent=e.grade+' GRADE';count.textContent=e.label==='LUNCH BREAK'?'LUNCH':'PACK UP';sub.textContent=e.label+' · '+showTime(e.time);fill.style.transform='scaleX(0)';}

  function render(){
    if(testUntil>Date.now()){countdown({time:'00:00',grade:'TEST',label:'TEST'},(testUntil-Date.now())/1000,true);mode.textContent='TEST';return;}
    const p=nowParts(), today=key(p), resolved=scheduleMode(p), list=schedules[resolved.m];
    mode.textContent=resolved.manual?(resolved.m==='delay'?'DELAY*':resolved.m==='early'?'EARLY*':'FULL*'):(resolved.m==='early'?'EARLY':resolved.m==='none'?'OFF':'AUTO');
    if(!list){compact('NO BAND BELLS','—','','NO DMS BELL SCHEDULE TODAY');return;}
    const e=nextEvent(list,sec(p));
    if(!e){compact('BAND DAY COMPLETE','DONE','',resolved.m==='early'?'EARLY DISMISSAL':resolved.m==='delay'?'2-HOUR DELAY':'FULL DAY');return;}
    const r=e.t-sec(p);
    if(r<=0&&r>-HOLD)ringing(e);else if(r>0&&r<=FIVE)countdown(e,r,false);else compact('NEXT BAND BELL',showTime(e.time),e.grade,(resolved.m==='early'?'EARLY DISMISSAL':resolved.m==='delay'?'2-HOUR DELAY':'FULL DAY')+' · '+e.label);
  }

  mode.addEventListener('click',e=>{e.stopPropagation();menu.classList.toggle('open');});
  menu.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const today=key(nowParts());if(b.dataset.mode){setOverride(today,b.dataset.mode);testUntil=0;menu.classList.remove('open');render();}else if(b.dataset.test){testUntil=Date.now()+FIVE*1000;menu.classList.remove('open');render();}else if(b.dataset.close){menu.classList.remove('open');}});
  document.addEventListener('click',()=>menu.classList.remove('open'));

  render();
  setInterval(render,250);
})();
