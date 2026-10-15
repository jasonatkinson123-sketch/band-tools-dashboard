(() => {
  'use strict';
  if (document.getElementById('db-attendance')) return;
  // One-minute settling time after the starting bell; each class gets its own dismissal.
  const tz='America/New_York', key='db-attendance-dismissed-v1', TRANSITION_SECONDS=60;
  const periods={
    full:[['08:42','09:37','6TH'],['09:39','10:34','7TH'],['10:36','11:31','8TH'],['11:33','13:01','6TH'],['13:03','13:58','8TH'],['14:00','14:55','7TH']],
    early:[['08:42','09:01','6TH'],['09:03','09:29','7TH'],['09:31','09:57','8TH'],['09:59','11:31','6TH'],['11:31','11:57','8TH'],['11:59','12:25','7TH']],
    delay:[['10:21','11:19','6TH'],['11:22','11:58','7TH'],['12:01','12:28','8TH'],['12:31','13:31','6TH'],['13:34','14:13','8TH'],['14:16','14:55','7TH']]
  };
  const earlyDates=new Set(['2026-09-18','2026-10-07','2026-11-09','2026-11-13','2026-11-25','2026-12-02','2026-12-23','2027-02-03','2027-02-11','2027-02-12','2027-03-03','2027-04-07','2027-05-05','2027-06-11','2027-06-14','2027-06-15']);
  const closedRanges=[
    ['2026-09-07','2026-09-07'], ['2026-10-12','2026-10-12'],
    ['2026-11-03','2026-11-03'], ['2026-11-11','2026-11-11'],
    ['2026-11-26','2026-11-27'], ['2026-12-24','2027-01-01'],
    ['2027-01-18','2027-01-18'], ['2027-02-15','2027-02-16'],
    ['2027-03-26','2027-03-26'], ['2027-04-12','2027-04-16'],
    ['2027-05-31','2027-05-31']
  ];
  const isClosed=date=>closedRanges.some(([first,last])=>date>=first&&date<=last);
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const style=document.createElement('style');
  style.textContent=`#db-attendance{position:fixed;z-index:2147483640;left:18px;top:18px;width:min(360px,calc(100vw - 36px));padding:19px 20px;background:#ffdf52;color:#111;border:4px solid #111;box-shadow:8px 8px 0 #111;font-family:ui-monospace,Menlo,Consolas,monospace;animation:db-att-bounce .3s ease-out}#db-attendance[hidden]{display:none!important}#db-attendance .att-head{font-size:12px;font-weight:900;letter-spacing:.14em}#db-attendance .att-title{font-size:clamp(25px,5vw,38px);font-weight:950;line-height:1;margin:12px 25px 9px 0}#db-attendance .att-sub{font-size:13px;font-weight:800}#db-attendance button{position:absolute;right:10px;top:8px;background:#111;color:#fff;border:2px solid #111;width:34px;height:34px;cursor:pointer;font-size:23px;font-weight:900}#db-attendance button:focus-visible{outline:3px solid #fff;outline-offset:2px}@keyframes db-att-bounce{from{transform:translateY(-20px);opacity:0}to{transform:none;opacity:1}}@media(prefers-reduced-motion:reduce){#db-attendance{animation:none}}`;
  document.head.appendChild(style);
  const box=document.createElement('aside');
  box.id='db-attendance';box.hidden=true;box.setAttribute('role','alert');
  box.innerHTML='<div class="att-head">⚠ BAND ROOM REMINDER</div><div class="att-title">TAKE ATTENDANCE!</div><div class="att-sub" id="db-att-sub"></div><button type="button" aria-label="Dismiss attendance reminder">×</button>';
  document.body.appendChild(box);
  let active=null;
  const seconds=s=>{const [h,m]=s.split(':').map(Number);return h*3600+m*60;};
  function now(){const p={};fmt.formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value;});return {date:p.year+'-'+p.month+'-'+p.day,weekday:p.weekday,seconds:Number(p.hour)*3600+Number(p.minute)*60};}
  function mode(date){for(const storage of ['derby-band-clock-mode-v1','derbyBandBellOverrideV1']){try{const v=JSON.parse(localStorage.getItem(storage)||'null');if(v&&v.date===date&&v.mode&&v.mode!=='auto')return v.mode;}catch(e){}}return earlyDates.has(date)?'early':'full';}
  function tick(){
    const n=now(), m=mode(n.date);
    if(n.weekday==='Sat'||n.weekday==='Sun'||isClosed(n.date)||n.date<'2026-09-01'||n.date>'2027-06-15'||m==='off'){box.hidden=true;active=null;return;}
    const slot=(periods[m]||[]).find(p=>n.seconds>=seconds(p[0])+TRANSITION_SECONDS&&n.seconds<seconds(p[1]));
    if(!slot){box.hidden=true;active=null;return;}
    const id=n.date+'|'+slot[0]+'|'+slot[2];
    if(active!==id){active=id;box.querySelector('#db-att-sub').textContent=slot[2]+' GRADE · START '+slot[0];}
    try{box.hidden=localStorage.getItem(key+'|'+id)==='yes';}catch(e){box.hidden=false;}
  }
  box.querySelector('button').addEventListener('click',()=>{if(active){try{localStorage.setItem(key+'|'+active,'yes');}catch(e){}box.hidden=true;}});
  tick();setInterval(tick,5000);
})();