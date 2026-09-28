(() => {
  "use strict";

  const VERSION = "2026.09.28.2";
  const TZ = "America/New_York";
  const STORAGE_KEY = "derby-band-clock-mode-v1";
  const DOOR_STORAGE_KEY = "derby-band-door-keeper-v1";
  const COUNTDOWN_SECONDS = 5 * 60;
  const BELL_HOLD_SECONDS = 12;

  // Dates already used by the Derby Countdown site.
  const EARLY_DATES = new Set([
    "2026-09-18","2026-10-07","2026-11-09","2026-11-13","2026-11-25",
    "2026-12-02","2026-12-23","2027-02-03","2027-02-11","2027-02-12",
    "2027-03-03","2027-05-05","2027-06-11","2027-06-14","2027-06-15"
  ]);

  const CLOSURES = [
    ["2026-09-07","2026-09-07"],
    ["2026-10-12","2026-10-12"],
    ["2026-11-03","2026-11-03"],
    ["2026-11-11","2026-11-11"],
    ["2026-11-26","2026-11-27"],
    ["2026-12-24","2027-01-01"],
    ["2027-01-18","2027-01-18"],
    ["2027-02-15","2027-02-15"],
    ["2027-02-16","2027-02-16"],
    ["2027-03-26","2027-03-26"],
    ["2027-04-12","2027-04-16"],
    ["2027-05-31","2027-05-31"]
  ];

  // Every green Unified Arts block from the three posted DMS master schedules.
  // The 6th-grade full-day block 4 is split by lunch, so both bells are represented.
  const SCHEDULES = {
    full: [
      { grade: "6TH", end: "09:33" },
      { grade: "7TH", end: "10:31" },
      { grade: "8TH", end: "11:29" },
      { grade: "6TH", end: "12:01", note: "LUNCH", countdownSeconds: 2 * 60 },
      { grade: "6TH", end: "13:01" },
      { grade: "8TH", end: "13:58" },
      { grade: "7TH", end: "14:55" }
    ],
    early: [
      { grade: "6TH", end: "09:09" },
      { grade: "7TH", end: "09:43" },
      { grade: "8TH", end: "10:17" },
      { grade: "6TH", end: "10:47" },
      { grade: "8TH", end: "11:17" },
      { grade: "7TH", end: "12:25" }
    ],
    delay: [
      { grade: "6TH", end: "11:19" },
      { grade: "7TH", end: "11:58" },
      { grade: "8TH", end: "12:28" },
      { grade: "6TH", end: "13:31" },
      { grade: "8TH", end: "14:13" },
      { grade: "7TH", end: "14:55" }
    ]
  };

  // Approx. ten minutes into each band class. The full-day 6th-grade split block
  // prompts once before lunch rather than prompting a second time after lunch.
  const DOOR_KEEPER_PROMPTS = {
    full: [
      { grade: "6TH", at: "08:45", end: "09:33" },
      { grade: "7TH", at: "09:46", end: "10:31" },
      { grade: "8TH", at: "10:44", end: "11:29" },
      { grade: "6TH", at: "11:42", end: "12:01" },
      { grade: "8TH", at: "13:14", end: "13:58" },
      { grade: "7TH", at: "14:11", end: "14:55" }
    ],
    early: [
      { grade: "6TH", at: "08:45", end: "09:09" },
      { grade: "7TH", at: "09:22", end: "09:43" },
      { grade: "8TH", at: "09:56", end: "10:17" },
      { grade: "6TH", at: "10:30", end: "10:47" },
      { grade: "8TH", at: "11:00", end: "11:17" },
      { grade: "7TH", at: "11:30", end: "12:25" }
    ],
    delay: [
      { grade: "6TH", at: "10:31", end: "11:19" },
      { grade: "7TH", at: "11:32", end: "11:58" },
      { grade: "8TH", at: "12:11", end: "12:28" },
      { grade: "6TH", at: "12:41", end: "13:31" },
      { grade: "8TH", at: "13:44", end: "14:13" },
      { grade: "7TH", at: "14:26", end: "14:55" }
    ]
  };

  const MODES = {
    auto: "AUTO",
    full: "FULL DAY",
    early: "EARLY",
    delay: "2-HR DELAY",
    off: "OFF"
  };

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  function nyNow() {
    const parts = {};
    formatter.formatToParts(new Date()).forEach(part => {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      weekday: parts.weekday,
      seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) + (Date.now() % 1000) / 1000
    };
  }

  function toSeconds(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 3600 + m * 60;
  }

  function prettyTime(hhmm) {
    let [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function isClosed(date) {
    return CLOSURES.some(([a, b]) => date >= a && date <= b);
  }

  function isWeekend(weekday) {
    return weekday === "Sat" || weekday === "Sun";
  }

  function readOverride(today) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return "auto";
      const saved = JSON.parse(raw);
      if (!saved || saved.date !== today || !MODES[saved.mode]) {
        localStorage.removeItem(STORAGE_KEY);
        return "auto";
      }
      return saved.mode;
    } catch {
      return "auto";
    }
  }

  function saveOverride(today, mode) {
    try {
      if (mode === "auto") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, mode }));
    } catch {}
  }

  function resolvedMode(today, requestedMode) {
    if (requestedMode === "off") return "off";
    if (requestedMode === "full" || requestedMode === "early" || requestedMode === "delay") return requestedMode;
    return EARLY_DATES.has(today) ? "early" : "full";
  }

  function modeCaption(today, requestedMode) {
    if (requestedMode !== "auto") return MODES[requestedMode];
    return EARLY_DATES.has(today) ? "AUTO • EARLY" : "AUTO";
  }

  function scheduleFor(today, weekday, requestedMode) {
    if (isWeekend(weekday) || isClosed(today)) return [];
    const mode = resolvedMode(today, requestedMode);
    if (mode === "off") return [];
    return SCHEDULES[mode] || [];
  }

  function currentSlot(schedule, secondsNow) {
    return schedule.find(slot => {
      const diff = toSeconds(slot.end) - secondsNow;
      const windowSeconds = slot.countdownSeconds || COUNTDOWN_SECONDS;
      return diff <= windowSeconds && diff >= -BELL_HOLD_SECONDS;
    }) || null;
  }

  function nextSlot(schedule, secondsNow) {
    return schedule.find(slot => toSeconds(slot.end) > secondsNow) || null;
  }

  function injectStyles() {
    if (document.getElementById("dbclock-style")) return;
    const style = document.createElement("style");
    style.id = "dbclock-style";
    style.textContent = `
      #dbclock-box, #dbclock-chip, #dbclock-menu { box-sizing:border-box; }
      #dbclock-box {
        position:fixed; z-index:2147483600; top:max(14px, env(safe-area-inset-top)); right:14px;
        width:min(360px, calc(100vw - 28px)); padding:14px 16px 12px;
        border:4px solid #111; background:#fff2a8; color:#111;
        box-shadow:8px 8px 0 rgba(0,0,0,.72);
        font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        transform:translateY(-18px) scale(.97); opacity:0; pointer-events:none;
        transition:opacity .18s ease, transform .18s ease, background .18s ease;
      }
      #dbclock-box.dbclock-show { opacity:1; transform:none; pointer-events:auto; }
      #dbclock-box.dbclock-last-minute { background:#ff9b8f; }
      #dbclock-box.dbclock-bell { background:#a9f6bc; }
      #dbclock-topline { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      #dbclock-kicker {
        font-size:12px; line-height:1.2; font-weight:900; letter-spacing:.12em; text-transform:uppercase;
      }
      #dbclock-close {
        appearance:none; border:0; background:transparent; color:#111; cursor:pointer;
        font:900 20px/1 ui-monospace, monospace; padding:0 2px;
      }
      #dbclock-time {
        margin:5px 0 2px; font:900 clamp(48px, 8vw, 68px)/.95 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing:-.07em; font-variant-numeric:tabular-nums;
      }
      #dbclock-meta {
        display:flex; justify-content:space-between; gap:12px; align-items:center;
        font-size:12px; font-weight:900; letter-spacing:.06em; text-transform:uppercase;
      }
      #dbclock-track { height:7px; margin-top:10px; background:rgba(17,17,17,.16); overflow:hidden; }
      #dbclock-bar { width:100%; height:100%; background:#111; transform-origin:left center; }
      #dbclock-chip {
        position:fixed; z-index:2147483598; right:10px; bottom:max(10px, env(safe-area-inset-bottom));
        appearance:none; border:1px solid rgba(0,0,0,.42); border-radius:999px;
        background:rgba(255,255,255,.88); color:#111; padding:6px 9px;
        font:800 10px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing:.04em; cursor:pointer; opacity:.58; box-shadow:0 2px 8px rgba(0,0,0,.14);
        backdrop-filter:blur(5px);
      }
      #dbclock-chip:hover, #dbclock-chip:focus-visible { opacity:1; outline:2px solid #111; outline-offset:2px; }
      #dbclock-menu {
        position:fixed; z-index:2147483599; right:10px; bottom:48px; width:min(285px, calc(100vw - 20px));
        border:2px solid #111; background:#fff; color:#111; padding:12px;
        box-shadow:5px 5px 0 rgba(0,0,0,.65);
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      #dbclock-menu[hidden] { display:none !important; }
      #dbclock-menu-title { margin:0 0 9px; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      #dbclock-options { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      #dbclock-options button, #dbclock-preview {
        appearance:none; border:2px solid #111; background:#fff; color:#111; cursor:pointer;
        padding:8px 7px; font:800 10px/1.1 ui-monospace, monospace; text-transform:uppercase;
      }
      #dbclock-options button[aria-pressed="true"] { background:#111; color:#fff; }
      #dbclock-preview { width:100%; margin-top:7px; background:#fff2a8; }
      #dbclock-menu-note { margin:8px 0 0; font-size:9px; line-height:1.35; opacity:.72; }
      #dbdoor-chip, #dbdoor-modal, #dbdoor-modal *, #dbdoor-fireworks, #dbdoor-fireworks * { box-sizing:border-box; }
      #dbdoor-chip[hidden], #dbdoor-modal[hidden], #dbdoor-fireworks[hidden] { display:none !important; }
      #dbdoor-chip {
        position:fixed; z-index:2147483602; right:10px; bottom:max(46px, calc(env(safe-area-inset-bottom) + 46px));
        display:flex; align-items:stretch; border:2px solid #111; background:#f3df68; color:#111;
        box-shadow:4px 4px 0 #111; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        animation:dbdoor-pulse .72s steps(2,end) 7;
      }
      #dbdoor-open, #dbdoor-dismiss {
        appearance:none; border:0; background:transparent; color:#111; cursor:pointer; font:900 10px/1 ui-monospace, monospace;
      }
      #dbdoor-open { padding:9px 10px; letter-spacing:.07em; text-transform:uppercase; }
      #dbdoor-dismiss { width:29px; border-left:2px solid #111; font-size:16px; }
      #dbdoor-open:focus-visible, #dbdoor-dismiss:focus-visible { outline:3px solid #6f4aa8; outline-offset:2px; }
      #dbdoor-modal {
        position:fixed; z-index:2147483638; inset:0; display:grid; place-items:center; padding:20px;
        background:rgba(17,17,17,.38); backdrop-filter:blur(2px);
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      #dbdoor-card {
        position:relative; width:min(620px, calc(100vw - 28px)); padding:24px;
        border:4px solid #111; background:#fffdf7; color:#111; box-shadow:12px 12px 0 #6f4aa8;
      }
      #dbdoor-card.dbdoor-celebrate { background:#fff2a8; text-align:center; }
      #dbdoor-close {
        position:absolute; right:10px; top:8px; appearance:none; border:0; background:transparent; color:#111;
        cursor:pointer; font:900 27px/1 ui-monospace, monospace; padding:3px 6px;
      }
      #dbdoor-eyebrow { margin:0 42px 9px 0; font-size:11px; font-weight:900; letter-spacing:.15em; color:#6f4aa8; text-transform:uppercase; }
      #dbdoor-title { margin:0; font:950 clamp(36px,8vw,70px)/.9 ui-monospace, monospace; letter-spacing:-.06em; text-transform:uppercase; overflow-wrap:anywhere; }
      #dbdoor-prompt { margin:12px 0 18px; font:900 12px/1.3 ui-monospace, monospace; letter-spacing:.08em; text-transform:uppercase; }
      #dbdoor-form { display:flex; gap:9px; align-items:stretch; }
      #dbdoor-name {
        min-width:0; flex:1; border:3px solid #111; background:#fff; color:#111; padding:12px 13px;
        font:900 clamp(20px,4vw,30px)/1 ui-monospace, monospace; outline:none;
      }
      #dbdoor-name:focus { box-shadow:4px 4px 0 #6f4aa8; }
      #dbdoor-submit {
        appearance:none; border:3px solid #111; background:#111; color:#fff; cursor:pointer; padding:10px 16px;
        font:900 11px/1 ui-monospace, monospace; letter-spacing:.08em; text-transform:uppercase;
      }
      #dbdoor-fireworks { position:fixed; z-index:2147483640; inset:0; pointer-events:none; overflow:hidden; }
      .dbdoor-spark {
        position:absolute; width:9px; height:9px; border-radius:50%;
        animation:dbdoor-fly 1050ms cubic-bezier(.17,.84,.44,1) forwards;
        transform:translate(-50%,-50%);
      }
      @keyframes dbdoor-pulse { 50% { transform:translateY(-2px); box-shadow:6px 6px 0 #6f4aa8; } }
      @keyframes dbdoor-fly {
        0% { opacity:1; transform:translate(-50%,-50%) scale(.2); }
        78% { opacity:1; }
        100% { opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); }
      }
      @media (max-width:600px) {
        #dbclock-box { left:10px; right:10px; top:10px; width:auto; }
        #dbclock-time { font-size:52px; }
      }
      @media (prefers-reduced-motion:reduce) {
        #dbclock-box { transition:none; }
        #dbdoor-chip, .dbdoor-spark { animation:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    if (document.getElementById("dbclock-box")) return;

    const box = document.createElement("aside");
    box.id = "dbclock-box";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.innerHTML = `
      <div id="dbclock-topline">
        <div id="dbclock-kicker">CLOSE OUT • 6TH GRADE</div>
        <button id="dbclock-close" type="button" aria-label="Dismiss this countdown">×</button>
      </div>
      <div id="dbclock-time">5:00</div>
      <div id="dbclock-meta"><span id="dbclock-end">BELL 9:33 AM</span><span id="dbclock-mode">FULL DAY</span></div>
      <div id="dbclock-track" aria-hidden="true"><div id="dbclock-bar"></div></div>
    `;

    const chip = document.createElement("button");
    chip.id = "dbclock-chip";
    chip.type = "button";
    chip.setAttribute("aria-haspopup", "true");
    chip.setAttribute("aria-expanded", "false");
    chip.textContent = "CLOCK • AUTO";

    const menu = document.createElement("div");
    menu.id = "dbclock-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <p id="dbclock-menu-title">TODAY'S BELL SCHEDULE</p>
      <div id="dbclock-options">
        <button type="button" data-dbclock-mode="auto">AUTO</button>
        <button type="button" data-dbclock-mode="full">FULL DAY</button>
        <button type="button" data-dbclock-mode="early">EARLY</button>
        <button type="button" data-dbclock-mode="delay">2-HR DELAY</button>
        <button type="button" data-dbclock-mode="off">OFF TODAY</button>
        <button id="dbdoor-preview" type="button">TEST DOOR KEEPER</button>
      </div>
      <button id="dbclock-preview" type="button">PREVIEW COUNTDOWN</button>
      <p id="dbclock-menu-note">Early-dismissal dates switch automatically. Use 2-HR DELAY on weather-delay days; the override resets tomorrow.</p>
    `;

    const doorChip = document.createElement("div");
    doorChip.id = "dbdoor-chip";
    doorChip.hidden = true;
    doorChip.innerHTML = `
      <button id="dbdoor-open" type="button">STAND DOOR KEEPER</button>
      <button id="dbdoor-dismiss" type="button" aria-label="Dismiss Stand Door Keeper reminder">×</button>
    `;

    const doorModal = document.createElement("div");
    doorModal.id = "dbdoor-modal";
    doorModal.hidden = true;
    doorModal.innerHTML = `
      <section id="dbdoor-card" role="dialog" aria-modal="true" aria-labelledby="dbdoor-title">
        <button id="dbdoor-close" type="button" aria-label="Close Stand Door Keeper">×</button>
        <p id="dbdoor-eyebrow">DERBY BAND • CLASS JOB</p>
        <h2 id="dbdoor-title">STAND DOOR KEEPER</h2>
        <p id="dbdoor-prompt">TYPE THE STUDENT'S NAME</p>
        <form id="dbdoor-form">
          <input id="dbdoor-name" type="text" autocomplete="off" maxlength="40" placeholder="STUDENT NAME" aria-label="Student name" />
          <button id="dbdoor-submit" type="submit">ENTER</button>
        </form>
      </section>
    `;

    const doorFireworks = document.createElement("div");
    doorFireworks.id = "dbdoor-fireworks";
    doorFireworks.hidden = true;
    doorFireworks.setAttribute("aria-hidden", "true");

    document.body.append(box, chip, menu, doorChip, doorModal, doorFireworks);
  }

  let dismissedSlotKey = "";
  let previewStartedAt = 0;
  let previewActive = false;
  let activeDoorPrompt = null;
  let activeDoorPromptKey = "";
  let doorPreviewMode = false;

  function refs() {
    return {
      box: document.getElementById("dbclock-box"),
      kicker: document.getElementById("dbclock-kicker"),
      time: document.getElementById("dbclock-time"),
      end: document.getElementById("dbclock-end"),
      mode: document.getElementById("dbclock-mode"),
      bar: document.getElementById("dbclock-bar"),
      close: document.getElementById("dbclock-close"),
      chip: document.getElementById("dbclock-chip"),
      menu: document.getElementById("dbclock-menu"),
      preview: document.getElementById("dbclock-preview"),
      doorPreview: document.getElementById("dbdoor-preview"),
      doorChip: document.getElementById("dbdoor-chip"),
      doorOpen: document.getElementById("dbdoor-open"),
      doorDismiss: document.getElementById("dbdoor-dismiss"),
      doorModal: document.getElementById("dbdoor-modal"),
      doorCard: document.getElementById("dbdoor-card"),
      doorClose: document.getElementById("dbdoor-close"),
      doorEyebrow: document.getElementById("dbdoor-eyebrow"),
      doorTitle: document.getElementById("dbdoor-title"),
      doorPrompt: document.getElementById("dbdoor-prompt"),
      doorForm: document.getElementById("dbdoor-form"),
      doorName: document.getElementById("dbdoor-name"),
      doorFireworks: document.getElementById("dbdoor-fireworks")
    };
  }

  function formatRemaining(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function slotKey(today, mode, slot) {
    return slot ? `${today}|${mode}|${slot.grade}|${slot.end}` : "";
  }

  function doorKey(today, mode, prompt) {
    return prompt ? `${today}|${mode}|${prompt.grade}|${prompt.end}` : "";
  }

  function readDoorState(today) {
    try {
      const saved = JSON.parse(localStorage.getItem(DOOR_STORAGE_KEY) || "null");
      if (!saved || saved.date !== today || !Array.isArray(saved.keys)) return { date: today, keys: [] };
      return saved;
    } catch {
      return { date: today, keys: [] };
    }
  }

  function markDoorHandled(today, key) {
    if (!key) return;
    try {
      const state = readDoorState(today);
      if (!state.keys.includes(key)) state.keys.push(key);
      localStorage.setItem(DOOR_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function doorPromptFor(today, weekday, requestedMode, actualMode, secondsNow) {
    if (isWeekend(weekday) || isClosed(today) || actualMode === "off") return null;
    const prompts = DOOR_KEEPER_PROMPTS[actualMode] || [];
    return prompts.find(prompt => {
      const start = toSeconds(prompt.at);
      const stop = Math.max(start + 60, toSeconds(prompt.end) - COUNTDOWN_SECONDS);
      return secondsNow >= start && secondsNow < stop;
    }) || null;
  }

  function renderDoorReminder(today, weekday, requestedMode, actualMode, secondsNow) {
    const r = refs();
    const prompt = doorPromptFor(today, weekday, requestedMode, actualMode, secondsNow);
    const key = doorKey(today, actualMode, prompt);
    const handled = key && readDoorState(today).keys.includes(key);

    if (!prompt || handled) {
      r.doorChip.hidden = true;
      if (!doorPreviewMode) {
        activeDoorPrompt = null;
        activeDoorPromptKey = "";
      }
      return;
    }

    activeDoorPrompt = prompt;
    activeDoorPromptKey = key;
    r.doorOpen.textContent = `STAND DOOR KEEPER • ${prompt.grade}`;
    r.doorChip.hidden = false;
  }

  function resetDoorModal(preview = false) {
    const r = refs();
    r.doorCard.classList.remove("dbdoor-celebrate");
    r.doorEyebrow.textContent = preview ? "TEST MODE • CLASS JOB" : "DERBY BAND • CLASS JOB";
    r.doorTitle.textContent = "STAND DOOR KEEPER";
    r.doorPrompt.textContent = preview ? "TYPE ANY NAME TO TEST IT" : "TYPE THE STUDENT'S NAME";
    r.doorForm.hidden = false;
    r.doorName.value = "";
    r.doorFireworks.replaceChildren();
    r.doorFireworks.hidden = true;
  }

  function openDoorKeeper(preview = false) {
    const r = refs();
    doorPreviewMode = preview;
    resetDoorModal(preview);
    r.doorModal.hidden = false;
    window.setTimeout(() => r.doorName.focus(), 40);
  }

  function closeDoorKeeper(handlePrompt = true) {
    const r = refs();
    const now = nyNow();
    if (handlePrompt && !doorPreviewMode && activeDoorPromptKey) markDoorHandled(now.date, activeDoorPromptKey);
    r.doorModal.hidden = true;
    r.doorFireworks.replaceChildren();
    r.doorFireworks.hidden = true;
    doorPreviewMode = false;
    tick();
  }

  function launchDoorFireworks() {
    const r = refs();
    r.doorFireworks.replaceChildren();
    r.doorFireworks.hidden = false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = ["#6f4aa8", "#f3df68", "#ff6b6b", "#63d6c5", "#ffffff", "#111111"];
    for (let burst = 0; burst < 8; burst++) {
      const x = 14 + Math.random() * 72;
      const y = 12 + Math.random() * 55;
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14 + Math.random() * .16;
        const distance = 65 + Math.random() * 120;
        const spark = document.createElement("span");
        spark.className = "dbdoor-spark";
        spark.style.left = x + "vw";
        spark.style.top = y + "vh";
        spark.style.background = colors[(burst + i) % colors.length];
        spark.style.setProperty("--dx", Math.cos(angle) * distance + "px");
        spark.style.setProperty("--dy", Math.sin(angle) * distance + "px");
        spark.style.animationDelay = (burst * 70 + Math.random() * 90) + "ms";
        r.doorFireworks.appendChild(spark);
      }
    }
    window.setTimeout(() => {
      r.doorFireworks.replaceChildren();
      r.doorFireworks.hidden = true;
    }, 1800);
  }

  function celebrateDoorKeeper(name) {
    const r = refs();
    const clean = name.trim();
    if (!clean) return;
    const now = nyNow();
    if (!doorPreviewMode && activeDoorPromptKey) markDoorHandled(now.date, activeDoorPromptKey);
    r.doorChip.hidden = true;
    r.doorCard.classList.add("dbdoor-celebrate");
    r.doorEyebrow.textContent = "TODAY'S STAND DOOR KEEPER";
    r.doorTitle.textContent = clean.toUpperCase();
    r.doorPrompt.textContent = "STAND DOOR KEEPER!";
    r.doorForm.hidden = true;
    launchDoorFireworks();
  }

  function renderMenuState(today, requested) {
    document.querySelectorAll("[data-dbclock-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.dbclockMode === requested));
    });
    const r = refs();
    r.chip.textContent = `CLOCK • ${modeCaption(today, requested)}`;
  }

  function showCountdown(slot, remaining, requestedMode, actualMode, isPreview = false) {
    const r = refs();
    const bell = remaining <= 0;
    const lastMinute = remaining > 0 && remaining <= 60;

    r.box.classList.add("dbclock-show");
    r.box.classList.toggle("dbclock-last-minute", lastMinute);
    r.box.classList.toggle("dbclock-bell", bell);

    const suffix = slot.note ? ` • ${slot.note}` : "";
    r.kicker.textContent = bell
      ? `BELL • ${slot.grade} GRADE${suffix}`
      : `CLOSE OUT • ${slot.grade} GRADE${suffix}`;
    r.time.textContent = bell ? "0:00" : formatRemaining(remaining);
    r.end.textContent = isPreview ? "PREVIEW" : `BELL ${prettyTime(slot.end)}`;
    r.mode.textContent = isPreview ? "TEST" : MODES[actualMode];
    const windowSeconds = slot.countdownSeconds || COUNTDOWN_SECONDS;
    const progress = bell ? 0 : Math.max(0, Math.min(1, remaining / windowSeconds));
    r.bar.style.transform = `scaleX(${progress})`;
  }

  function hideCountdown() {
    const r = refs();
    r.box.classList.remove("dbclock-show", "dbclock-last-minute", "dbclock-bell");
  }

  function tick() {
    const now = nyNow();
    const requested = readOverride(now.date);
    const actual = resolvedMode(now.date, requested);
    const schedule = scheduleFor(now.date, now.weekday, requested);
    renderMenuState(now.date, requested);
    renderDoorReminder(now.date, now.weekday, requested, actual, now.seconds);

    if (previewActive) {
      const elapsed = (Date.now() - previewStartedAt) / 1000;
      if (elapsed <= 15) {
        const previewRemaining = 300 - elapsed;
        showCountdown({ grade: "BAND", end: "00:00" }, previewRemaining, requested, actual, true);
        return;
      }
      previewActive = false;
      hideCountdown();
    }

    const slot = currentSlot(schedule, now.seconds);
    const key = slotKey(now.date, actual, slot);
    if (slot && key !== dismissedSlotKey) {
      const remaining = toSeconds(slot.end) - now.seconds;
      showCountdown(slot, remaining, requested, actual, false);
    } else {
      hideCountdown();
    }

    const next = nextSlot(schedule, now.seconds);
    const r = refs();
    if (!schedule.length) {
      if (requested === "off") r.chip.textContent = "CLOCK • OFF";
      else if (isWeekend(now.weekday) || isClosed(now.date)) r.chip.textContent = "CLOCK • NO SCHOOL";
    } else if (next && !slot) {
      r.chip.title = `Next Unified Arts bell: ${next.grade} at ${prettyTime(next.end)}`;
    } else if (!next) {
      r.chip.title = "Unified Arts bells complete for today";
    }
  }

  function bind() {
    const r = refs();

    r.chip.addEventListener("click", () => {
      r.menu.hidden = !r.menu.hidden;
      r.chip.setAttribute("aria-expanded", String(!r.menu.hidden));
    });

    r.close.addEventListener("click", () => {
      const now = nyNow();
      const requested = readOverride(now.date);
      const actual = resolvedMode(now.date, requested);
      const slot = currentSlot(scheduleFor(now.date, now.weekday, requested), now.seconds);
      dismissedSlotKey = slotKey(now.date, actual, slot);
      previewActive = false;
      hideCountdown();
    });

    document.querySelectorAll("[data-dbclock-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const now = nyNow();
        const mode = button.dataset.dbclockMode;
        saveOverride(now.date, mode);
        dismissedSlotKey = "";
        r.menu.hidden = true;
        r.chip.setAttribute("aria-expanded", "false");
        tick();
      });
    });

    r.preview.addEventListener("click", () => {
      previewActive = true;
      previewStartedAt = Date.now();
      r.menu.hidden = true;
      r.chip.setAttribute("aria-expanded", "false");
      tick();
    });

    r.doorPreview.addEventListener("click", () => {
      r.menu.hidden = true;
      r.chip.setAttribute("aria-expanded", "false");
      openDoorKeeper(true);
    });

    r.doorOpen.addEventListener("click", () => openDoorKeeper(false));
    r.doorDismiss.addEventListener("click", () => {
      const now = nyNow();
      if (activeDoorPromptKey) markDoorHandled(now.date, activeDoorPromptKey);
      r.doorChip.hidden = true;
      tick();
    });
    r.doorClose.addEventListener("click", () => closeDoorKeeper(true));
    r.doorModal.addEventListener("click", event => {
      if (event.target === r.doorModal) closeDoorKeeper(true);
    });
    r.doorForm.addEventListener("submit", event => {
      event.preventDefault();
      celebrateDoorKeeper(r.doorName.value);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !r.doorModal.hidden) closeDoorKeeper(true);
    });

    document.addEventListener("click", event => {
      if (r.menu.hidden) return;
      if (r.menu.contains(event.target) || r.chip.contains(event.target)) return;
      r.menu.hidden = true;
      r.chip.setAttribute("aria-expanded", "false");
    });

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY || event.key === DOOR_STORAGE_KEY || event.key === null) {
        dismissedSlotKey = "";
        tick();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tick();
    });
    window.addEventListener("focus", tick);
  }

  function init() {
    injectStyles();
    buildUI();
    bind();
    tick();
    window.setInterval(tick, 250);
    window.DerbyBandClock = {
      version: VERSION,
      preview() {
        previewActive = true;
        previewStartedAt = Date.now();
        tick();
      },
      setMode(mode) {
        if (!MODES[mode]) return false;
        const now = nyNow();
        saveOverride(now.date, mode);
        dismissedSlotKey = "";
        tick();
        return true;
      },
      previewDoorKeeper() {
        openDoorKeeper(true);
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();