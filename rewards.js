(()=>{
  "use strict";
  const cfg=window.DERBY_REWARDS_CONFIG||{};
  const rewards=(cfg.rewards||[]).filter(r=>r.active!==false);
  const app=document.getElementById("app");
  const state={grade:null,name:"",reward:null};
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function burst(count=80){
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const layer=document.getElementById("confetti");
    const colors=["#f2b632","#67d7f0","#d94f70","#f5e6b8","#e06a2c","#2d6b3f"];
    for(let i=0;i<count;i++){
      const p=document.createElement("i");
      p.className="confetti-piece";
      p.style.left=(Math.random()*100)+"vw";
      p.style.background=colors[i%colors.length];
      p.style.setProperty("--x0",(Math.random()*80-40)+"px");
      p.style.setProperty("--x1",(Math.random()*240-120)+"px");
      p.style.animationDelay=(Math.random()*.18)+"s";
      p.style.animationDuration=(1+Math.random()*.75)+"s";
      layer.appendChild(p);
      setTimeout(()=>p.remove(),2100);
    }
  }

  function head(step,title,subtitle,back){
    return `<div class="screen"><div class="topline"><span class="step-pill">PLAYER STEP ${step}/3</span>${back?'<button class="back" id="backBtn">← BACK</button>':""}</div><h2 class="screen-title">${esc(title)}</h2><p class="screen-subtitle">${esc(subtitle)}</p>`;
  }
  function bindBack(fn){const b=document.getElementById("backBtn");if(b)b.onclick=fn}

  function renderGrade(){
    state.grade=null;state.reward=null;
    app.innerHTML=head(1,"SELECT PLAYER LEVEL","Choose your grade to enter the Reward Arcade.",false)+
      `<div class="grade-grid">${[6,7,8].map(g=>`<button class="grade-card" data-grade="${g}"><strong>${g}</strong><span>GRADE</span></button>`).join("")}</div></div>`;
    app.querySelectorAll("[data-grade]").forEach(b=>b.onclick=()=>{state.grade=Number(b.dataset.grade);burst(28);renderName()});
  }

  function renderName(){
    app.innerHTML=head(2,"ENTER PLAYER NAME","Use your first name and last initial.",true)+
      `<div class="name-wrap"><label class="label" for="studentName">PLAYER NAME</label><input class="name-input" id="studentName" maxlength="60" autocomplete="name" placeholder="First name + last initial" value="${esc(state.name)}"><div class="action-row"><button class="big-action" id="shopBtn">START GAME →</button></div></div></div>`;
    bindBack(renderGrade);
    const input=document.getElementById("studentName");
    const go=()=>{const n=input.value.trim();if(!n){input.focus();return}state.name=n;renderShop()};
    document.getElementById("shopBtn").onclick=go;
    input.onkeydown=e=>{if(e.key==="Enter")go()};
    setTimeout(()=>input.focus(),50);
  }

  function renderShop(){
    if(!rewards.length){
      app.innerHTML=`<div class="screen empty"><div class="big">▣</div><h2>ARCADE CLOSED</h2><p class="screen-subtitle">No power-ups are active right now. Check back later.</p></div>`;
      return;
    }
    app.innerHTML=`<div class="screen"><div class="topline"><span class="step-pill">PLAYER STEP 3/3</span><button class="back" id="backBtn">← BACK</button></div><div class="shop-head"><div><h2 class="screen-title">SELECT YOUR POWER-UP</h2><p class="screen-subtitle">Spend Character Cash on one of the active rewards below.</p></div><span class="student-chip">P${state.grade} · ${esc(state.name)}</span></div><div class="reward-grid">${rewards.map(r=>`<button class="reward-card" data-reward="${esc(r.id)}"><span class="price-tag">${Number(r.price)} CASH</span><span class="reward-icon" aria-hidden="true">${esc(r.icon||"★")}</span><div class="reward-name">${esc(r.name)}</div><div class="reward-desc">${esc(r.description||"")}</div><span class="redeem-word">UNLOCK →</span></button>`).join("")}</div></div>`;
    bindBack(renderName);
    app.querySelectorAll("[data-reward]").forEach(b=>b.onclick=()=>{state.reward=rewards.find(r=>r.id===b.dataset.reward);burst(72);renderConfirm()});
  }

  function configured(){
    const f=cfg.googleFormFields||{};
    return !!(cfg.googleFormUrl&&f.name&&f.grade&&f.reward&&f.cost);
  }

  function formUrl(){
    const f=cfg.googleFormFields||{};
    const u=new URL(cfg.googleFormUrl);
    u.searchParams.set("usp","pp_url");
    u.searchParams.set(f.name,state.name);
    u.searchParams.set(f.grade,String(state.grade));
    u.searchParams.set(f.reward,state.reward.name);
    u.searchParams.set(f.cost,String(state.reward.price));
    return u.toString();
  }

  function renderConfirm(){
    const ready=configured();
    app.innerHTML=`<div class="screen"><div class="topline"><span class="step-pill">FINAL SCREEN</span><button class="back" id="backBtn">← BACK</button></div><div class="confirm-card"><div class="confirm-icon">${esc(state.reward.icon||"★")}</div><span class="success-badge">POWER-UP LOCKED IN</span><h2>READY, ${esc(state.name.split(" ")[0].toUpperCase())}?</h2><div class="reward-summary"><strong>${esc(state.reward.name)}</strong><span>${Number(state.reward.price)} Character Cash · Grade ${state.grade}</span></div><p class="notice">Your points are not spent yet. Mr. Atkinson checks the request and approves the redemption manually.</p>${ready?'<button class="big-action" id="redeemBtn">LAUNCH REDEMPTION FORM →</button>':'<div class="form-missing">REDEMPTION LINK NOT CONFIGURED.</div>'}</div></div>`;
    bindBack(renderShop);
    const btn=document.getElementById("redeemBtn");
    if(btn)btn.onclick=()=>{burst(120);btn.textContent="LOADING…";btn.disabled=true;setTimeout(()=>location.assign(formUrl()),500)};
  }

  renderGrade();
})();