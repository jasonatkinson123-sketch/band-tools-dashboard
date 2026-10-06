(() => {
  "use strict";

  const VERSION = "2026.10.06.2";
  const TZ = "America/New_York";
  const STORAGE_KEY = "derby-band-clock-mode-v1";
  const DOOR_STORAGE_KEY = "derby-band-door-keeper-v1";
  const FANCY_STORAGE_KEY = "derby-band-fancy-stands-v1";
  const CASH_STORAGE_KEY = "derby-character-cash-v1";
  const CASH_MAP_STORAGE_KEY = "derby-character-cash-quick-map-v1";
  const REQUEST_SEEN_STORAGE_KEY = "derby-reward-requests-seen-v1";
  const REQUEST_POLL_MS = 60 * 1000;
  const COUNTDOWN_SECONDS = 5 * 60;
  const BELL_HOLD_SECONDS = 12;
  const CASH_MAX_BONUS = 9;

  const CASH_INSTRUMENTS = [
    { id:"flute", label:"Flute", aliases:["flute","flutes"] },
    { id:"oboe", label:"Oboe", aliases:["oboe","oboes"] },
    { id:"bassoon", label:"Bassoon", aliases:["bassoon","bassoons"] },
    { id:"clarinet", label:"Clarinet", aliases:["clarinet","clarinets"] },
    { id:"bass-clarinet", label:"Bass Clarinet", aliases:["bass clarinet","bass clarinets"] },
    { id:"alto-sax", label:"Alto Sax", aliases:["alto","altos","alto sax","alto saxes","alto saxophone","alto saxophones"] },
    { id:"tenor-sax", label:"Tenor Sax", aliases:["tenor","tenors","tenor sax","tenor saxes","tenor saxophone","tenor saxophones"] },
    { id:"baritone-sax", label:"Bari Sax", aliases:["bari","baris","bari sax","bari saxes","baritone sax","baritone saxes","baritone saxophone","baritone saxophones"] },
    { id:"trumpet", label:"Trumpet", aliases:["trumpet","trumpets"] },
    { id:"french-horn", label:"French Horn", aliases:["horn","horns","french horn","french horns"] },
    { id:"trombone", label:"Trombone", aliases:["trombone","trombones"] },
    { id:"euphonium", label:"Baritone / Euphonium", aliases:["baritone","baritones","euphonium","euphoniums","baritone euphonium","baritone / euphonium"] },
    { id:"tuba", label:"Tuba", aliases:["tuba","tubas"] },
    { id:"electric-bass", label:"Electric Bass", aliases:["bass","basses","bass guitar","bass guitars","electric bass","electric basses"] },
    { id:"percussion", label:"Percussion", aliases:["percussion","drum","drums","drummer","drummers","drumsticks"] },
    { id:"mallets-bells", label:"Mallets / Bells", aliases:["mallet","mallets","bell","bells","mallets bells","mallets / bells","glockenspiel"] }
  ];

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

  const CLASS_PERIODS = {
    full: [
      { grade:"6TH", start:"08:35", end:"09:33" },
      { grade:"7TH", start:"09:36", end:"10:31" },
      { grade:"8TH", start:"10:34", end:"11:29" },
      { grade:"6TH", start:"11:32", end:"13:01" },
      { grade:"8TH", start:"13:04", end:"13:58" },
      { grade:"7TH", start:"14:01", end:"14:55" }
    ],
    early: [
      { grade:"6TH", start:"08:35", end:"09:09" },
      { grade:"7TH", start:"09:12", end:"09:43" },
      { grade:"8TH", start:"09:46", end:"10:17" },
      { grade:"6TH", start:"10:20", end:"10:47" },
      { grade:"8TH", start:"10:50", end:"11:17" },
      { grade:"7TH", start:"11:20", end:"12:25" }
    ],
    delay: [
      { grade:"6TH", start:"10:21", end:"11:19" },
      { grade:"7TH", start:"11:22", end:"11:58" },
      { grade:"8TH", start:"12:01", end:"12:28" },
      { grade:"6TH", start:"12:31", end:"13:31" },
      { grade:"8TH", start:"13:34", end:"14:13" },
      { grade:"7TH", start:"14:16", end:"14:55" }
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
      body.dbclock-three-minute-pulse::after {
        content:"";
        position:fixed;
        inset:0;
        z-index:90;
        pointer-events:none;
        background:rgba(255,235,165,.018);
        box-shadow:inset 0 0 0 0 rgba(255,218,92,0);
        animation:dbclock-attention-pulse 3.2s ease-in-out infinite;
      }
      @keyframes dbclock-attention-pulse {
        0%,100% {
          background:rgba(255,235,165,.012);
          box-shadow:inset 0 0 36px rgba(255,218,92,.03);
        }
        50% {
          background:rgba(255,235,165,.055);
          box-shadow:inset 0 0 105px rgba(255,218,92,.16);
        }
      }
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
        position:fixed; z-index:2147483602; right:10px; bottom:max(100px, calc(env(safe-area-inset-bottom) + 100px));
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
      #dbfancy-chip, #dbfancy-panel, #dbfancy-panel * { box-sizing:border-box; }
      #dbfancy-chip {
        position:fixed; z-index:2147483603; right:10px; bottom:max(145px, calc(env(safe-area-inset-bottom) + 145px));
        width:82px; min-height:62px; padding:7px; appearance:none; border:3px solid #111;
        background:#d9c6ff; color:#111; cursor:pointer; box-shadow:5px 5px 0 #111;
        font:950 10px/1.08 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing:.04em; text-transform:uppercase;
      }
      #dbfancy-chip:hover, #dbfancy-chip:focus-visible { outline:3px solid #f3df68; outline-offset:2px; }
      #dbfancy-panel {
        position:fixed; z-index:2147483637; inset:0; display:grid; place-items:center; padding:20px;
        background:rgba(17,17,17,.38); backdrop-filter:blur(2px);
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      #dbfancy-panel[hidden] { display:none !important; }
      #dbfancy-card { position:relative; width:min(620px,calc(100vw - 28px)); padding:22px; border:4px solid #111; background:#fffdf7; color:#111; box-shadow:12px 12px 0 #6f4aa8; }
      #dbfancy-close { position:absolute; right:10px; top:8px; border:0; background:transparent; cursor:pointer; font:900 27px/1 ui-monospace,monospace; }
      #dbfancy-kicker { margin:0 42px 7px 0; font-size:10px; font-weight:900; letter-spacing:.13em; color:#6f4aa8; }
      #dbfancy-title { margin:0; font:950 clamp(30px,7vw,54px)/.95 ui-monospace,monospace; letter-spacing:-.05em; }
      #dbfancy-grades { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:15px 0 10px; }
      #dbfancy-grades button, #dbfancy-pick, #dbfancy-reset { appearance:none; border:3px solid #111; background:#fff; color:#111; cursor:pointer; padding:9px; font:900 10px/1 ui-monospace,monospace; }
      #dbfancy-grades button[aria-pressed="true"] { background:#111; color:#fff; }
      #dbfancy-pick { width:100%; background:#f3df68; font-size:12px; }
      #dbfancy-list { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:12px 0; }
      .dbfancy-slot { min-height:58px; display:flex; align-items:center; gap:8px; border:3px solid #111; background:#efe7ff; padding:9px; font:950 16px/1.05 ui-monospace,monospace; }
      .dbfancy-slot span { opacity:.55; font-size:11px; }
      #dbfancy-note { min-height:28px; margin:8px 0; font:850 10px/1.35 ui-monospace,monospace; }
      #dbfancy-reset { width:100%; border-width:2px; font-size:9px; }
      #dbcash-chip, #dbcash-panel, #dbcash-panel * { box-sizing:border-box; }
      #dbcash-chip {
        position:fixed; z-index:2147483603; left:10px; bottom:max(10px, env(safe-area-inset-bottom));
        width:68px; height:68px; padding:6px; appearance:none; border:3px solid #111;
        background:#bdebd2; color:#111; cursor:pointer; box-shadow:5px 5px 0 #111;
        font:950 11px/1.05 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing:.04em; text-transform:uppercase;
      }
      #dbcash-chip:hover, #dbcash-chip:focus-visible { outline:3px solid #6f4aa8; outline-offset:2px; }
      #dbcash-panel {
        position:fixed; z-index:2147483604; left:10px; bottom:max(92px, calc(env(safe-area-inset-bottom) + 92px));
        width:min(330px, calc(100vw - 20px)); border:3px solid #111; background:#f6fff9; color:#111;
        box-shadow:7px 7px 0 #111; padding:14px;
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      #dbcash-panel[hidden] { display:none !important; }
      #dbcash-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
      #dbcash-kicker { margin:0; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:#277652; }
      #dbcash-title { margin:3px 0 0; font:950 22px/.95 ui-monospace, monospace; letter-spacing:-.04em; text-transform:uppercase; }
      #dbcash-close { appearance:none; border:0; background:transparent; color:#111; cursor:pointer; font:900 22px/1 ui-monospace, monospace; padding:0 2px; }
      #dbcash-grades { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin:12px 0 8px; }
      #dbcash-grades button {
        appearance:none; border:2px solid #111; background:#fff; color:#111; cursor:pointer; padding:7px 4px;
        font:900 10px/1 ui-monospace, monospace;
      }
      #dbcash-grades button[aria-pressed="true"] { background:#111; color:#fff; }
      #dbcash-class {
        width:100%; border:2px solid #111; background:#fff; color:#111; padding:8px; margin:0 0 8px;
        font:800 10px/1.2 ui-monospace, monospace;
      }
      #dbcash-form { display:flex; gap:6px; }
      #dbcash-command {
        min-width:0; flex:1; border:3px solid #111; background:#fff; color:#111; padding:10px;
        font:900 15px/1 ui-monospace, monospace; outline:none;
      }
      #dbcash-command:focus { box-shadow:3px 3px 0 #6f4aa8; }
      #dbcash-award {
        appearance:none; border:3px solid #111; background:#111; color:#fff; cursor:pointer; padding:8px 10px;
        font:900 10px/1 ui-monospace, monospace; letter-spacing:.04em;
      }
      #dbcash-help { margin:8px 0 0; font-size:9px; line-height:1.35; opacity:.7; }
      #dbcash-feedback {
        min-height:30px; margin:9px 0 0; padding:8px; border:2px solid rgba(17,17,17,.22);
        background:#fff; font:850 10px/1.35 ui-monospace, monospace;
      }
      #dbcash-feedback.dbcash-error { background:#ffd9d4; border-color:#111; }
      #dbcash-feedback.dbcash-success { background:#c9f4d9; border-color:#111; }
      #dbcash-undo {
        width:100%; margin-top:7px; appearance:none; border:2px solid #111; background:#fff; color:#111; cursor:pointer;
        padding:7px; font:900 9px/1 ui-monospace, monospace; text-transform:uppercase;
      }
      #dbcash-undo[hidden] { display:none !important; }
      #dbrequest-chip {
        position:fixed; z-index:2147483604; left:10px; bottom:max(82px, calc(env(safe-area-inset-bottom) + 82px));
        max-width:min(250px,calc(100vw - 20px)); appearance:none; border:3px solid #111; background:#fff; color:#111;
        box-shadow:5px 5px 0 #111; padding:9px 11px; cursor:pointer;
        font:950 10px/1.1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing:.04em; text-transform:uppercase;
      }
      #dbrequest-chip[hidden] { display:none !important; }
      #dbrequest-chip.dbrequest-new { background:#ffcf5a; animation:dbdoor-pulse .72s steps(2,end) 5; }
      #dbrequest-chip:focus-visible, #dbrequest-chip:hover { outline:3px solid #6f4aa8; outline-offset:2px; }
      @media (max-width:600px) {
        #dbclock-box { left:10px; right:10px; top:10px; width:auto; }
        #dbclock-time { font-size:52px; }
      }
      @media (prefers-reduced-motion:reduce) {
        #dbclock-box { transition:none; }
        #dbdoor-chip, .dbdoor-spark, body.dbclock-three-minute-pulse::after { animation:none !important; }
        body.dbclock-three-minute-pulse::after { background:rgba(255,235,165,.035); box-shadow:inset 0 0 80px rgba(255,218,92,.10); }
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

    const fancyChip = document.createElement("button");
    fancyChip.id = "dbfancy-chip";
    fancyChip.type = "button";
    fancyChip.setAttribute("aria-haspopup", "true");
    fancyChip.textContent = "FANCY STANDS";

    const fancyPanel = document.createElement("div");
    fancyPanel.id = "dbfancy-panel";
    fancyPanel.hidden = true;
    fancyPanel.innerHTML = `
      <section id="dbfancy-card" role="dialog" aria-modal="true" aria-labelledby="dbfancy-title">
        <button id="dbfancy-close" type="button" aria-label="Close Fancy Stands">×</button>
        <p id="dbfancy-kicker">DERBY BAND • DAILY PERK</p>
        <h2 id="dbfancy-title">FANCY STANDS</h2>
        <div id="dbfancy-grades" aria-label="Band grade">
          <button type="button" data-dbfancy-grade="6TH">6TH</button>
          <button type="button" data-dbfancy-grade="7TH">7TH</button>
          <button type="button" data-dbfancy-grade="8TH">8TH</button>
        </div>
        <button id="dbfancy-pick" type="button">🎲 PICK 4</button>
        <div id="dbfancy-list" aria-live="polite">
          <div class="dbfancy-slot"><span>1</span><b>—</b></div>
          <div class="dbfancy-slot"><span>2</span><b>—</b></div>
          <div class="dbfancy-slot"><span>3</span><b>—</b></div>
          <div class="dbfancy-slot"><span>4</span><b>—</b></div>
        </div>
        <p id="dbfancy-note">PICK FOUR STUDENTS FROM THE CURRENT BAND.</p>
        <button id="dbfancy-reset" type="button">RESET ROTATION FOR THIS GRADE</button>
      </section>
    `;

    const cashChip = document.createElement("button");
    cashChip.id = "dbcash-chip";
    cashChip.type = "button";
    cashChip.setAttribute("aria-haspopup", "true");
    cashChip.setAttribute("aria-expanded", "false");
    cashChip.innerHTML = "CHARACTER<br>CASH";

    const requestChip = document.createElement("button");
    requestChip.id = "dbrequest-chip";
    requestChip.type = "button";
    requestChip.hidden = true;
    requestChip.textContent = "REWARD REQUESTS";

    const cashPanel = document.createElement("aside");
    cashPanel.id = "dbcash-panel";
    cashPanel.hidden = true;
    cashPanel.innerHTML = `
      <div id="dbcash-top">
        <div>
          <p id="dbcash-kicker">DERBY BAND • QUICK AWARD</p>
          <h2 id="dbcash-title">CHARACTER CASH</h2>
        </div>
        <button id="dbcash-close" type="button" aria-label="Close Character Cash quick award">×</button>
      </div>
      <div id="dbcash-grades" aria-label="Band grade">
        <button type="button" data-dbcash-grade="6TH">6TH</button>
        <button type="button" data-dbcash-grade="7TH">7TH</button>
        <button type="button" data-dbcash-grade="8TH">8TH</button>
      </div>
      <select id="dbcash-class" aria-label="Character Cash class"></select>
      <form id="dbcash-form">
        <input id="dbcash-command" type="text" autocomplete="off" maxlength="40" placeholder="flute +2" aria-label="Section and Character Cash amount" />
        <button id="dbcash-award" type="submit">AWARD</button>
      </form>
      <p id="dbcash-help">TYPE A SECTION. “FLUTE” = +1. TRY “CLARINET +3”, “ALTO +2”, OR “PERCUSSION +4”.</p>
      <div id="dbcash-feedback" aria-live="polite">READY.</div>
      <button id="dbcash-undo" type="button" hidden>UNDO LAST AWARD</button>
    `;

    document.body.append(box, chip, menu, doorChip, doorModal, doorFireworks, fancyChip, fancyPanel, cashChip, cashPanel, requestChip);
  }

  let dismissedSlotKey = "";
  let previewStartedAt = 0;
  let previewActive = false;
  let activeDoorPrompt = null;
  let activeDoorPromptKey = "";
  let doorPreviewMode = false;
  let cashManualGrade = null;
  let fancyManualGrade = null;
  let lastCashAward = null;

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
      doorFireworks: document.getElementById("dbdoor-fireworks"),
      fancyChip: document.getElementById("dbfancy-chip"),
      fancyPanel: document.getElementById("dbfancy-panel"),
      fancyClose: document.getElementById("dbfancy-close"),
      fancyPick: document.getElementById("dbfancy-pick"),
      fancyList: document.getElementById("dbfancy-list"),
      fancyNote: document.getElementById("dbfancy-note"),
      fancyReset: document.getElementById("dbfancy-reset"),
      cashChip: document.getElementById("dbcash-chip"),
      cashPanel: document.getElementById("dbcash-panel"),
      cashTitle: document.getElementById("dbcash-title"),
      cashClose: document.getElementById("dbcash-close"),
      cashClass: document.getElementById("dbcash-class"),
      cashForm: document.getElementById("dbcash-form"),
      cashCommand: document.getElementById("dbcash-command"),
      cashFeedback: document.getElementById("dbcash-feedback"),
      cashUndo: document.getElementById("dbcash-undo"),
      requestChip: document.getElementById("dbrequest-chip")
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

  function currentBandGrade(today, weekday, requestedMode, secondsNow) {
    if (isWeekend(weekday) || isClosed(today)) return null;
    const actualMode = resolvedMode(today, requestedMode);
    if (actualMode === "off") return null;
    const period = (CLASS_PERIODS[actualMode] || []).find(item =>
      secondsNow >= toSeconds(item.start) && secondsNow < toSeconds(item.end)
    );
    return period?.grade || null;
  }

  function readCashState() {
    try {
      const raw = localStorage.getItem(CASH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.classes) || !Array.isArray(parsed.students) || !Array.isArray(parsed.events)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function readCashMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CASH_MAP_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCashMap(map) {
    try { localStorage.setItem(CASH_MAP_STORAGE_KEY, JSON.stringify(map)); } catch {}
  }

  function gradeFromClassName(name = "") {
    const value = String(name).toLowerCase();
    if (/\b6(?:th)?\b/.test(value) || /\bsixth\b/.test(value)) return "6TH";
    if (/\b7(?:th)?\b/.test(value) || /\bseventh\b/.test(value)) return "7TH";
    if (/\b8(?:th)?\b/.test(value) || /\beighth\b/.test(value)) return "8TH";
    return null;
  }

  function activeCashClasses(state) {
    return state?.classes?.filter(item => !item.archived) || [];
  }

  function cashClassForGrade(state, grade) {
    if (!state || !grade) return null;
    const classes = activeCashClasses(state);
    const map = readCashMap();
    const mapped = classes.find(item => item.id === map[grade]);
    if (mapped) return mapped;
    const matches = classes.filter(item => gradeFromClassName(item.name) === grade);
    if (matches.length === 1) {
      map[grade] = matches[0].id;
      saveCashMap(map);
      return matches[0];
    }
    return null;
  }

  function cleanInstrumentText(value) {
    return String(value || "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  }

  function cashInstrumentFromText(value) {
    const cleaned = cleanInstrumentText(value);
    if (!cleaned || cleaned === "sax" || cleaned === "saxes") return null;
    return CASH_INSTRUMENTS.find(item => item.aliases.includes(cleaned)) || null;
  }

  function parseCashCommand(raw) {
    let text = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!text) return { error:"TYPE A SECTION FIRST." };
    const wordNumbers = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9 };
    let amount = 1;
    let section = text;
    let match = text.match(/^(.*?)(?:\s*\+\s*(\d+))$/);
    if (!match) match = text.match(/^(.*?)(?:\s+plus\s+(\d+|one|two|three|four|five|six|seven|eight|nine))$/);
    if (match) {
      section = match[1].trim();
      amount = /^\d+$/.test(match[2]) ? Number(match[2]) : wordNumbers[match[2]];
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > CASH_MAX_BONUS) {
      return { error:`USE +1 THROUGH +${CASH_MAX_BONUS}.` };
    }
    const instrument = cashInstrumentFromText(section);
    if (!instrument) {
      return { error: section === "sax" || section === "saxes"
        ? "USE ALTO SAX, TENOR SAX, OR BARI SAX."
        : "SECTION NOT RECOGNIZED." };
    }
    return { instrument, amount };
  }

  function quickEventId() {
    return "band-bonus-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function notifyCashUpdated() {
    try { window.dispatchEvent(new CustomEvent("derby-character-cash-updated")); } catch {}
  }

  function setCashFeedback(message, type = "") {
    const r = refs();
    r.cashFeedback.textContent = message;
    r.cashFeedback.classList.remove("dbcash-error", "dbcash-success");
    if (type) r.cashFeedback.classList.add(`dbcash-${type}`);
  }

  function effectiveCashGrade() {
    const now = nyNow();
    const requested = readOverride(now.date);
    return cashManualGrade || currentBandGrade(now.date, now.weekday, requested, now.seconds);
  }

  function readFancyState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FANCY_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }

  function saveFancyState(state) {
    try { localStorage.setItem(FANCY_STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function effectiveFancyGrade() {
    const now = nyNow();
    const requested = readOverride(now.date);
    return fancyManualGrade || currentBandGrade(now.date, now.weekday, requested, now.seconds);
  }

  function fancyRoster(grade) {
    const state = readCashState();
    const cls = cashClassForGrade(state, grade);
    if (!state || !cls) return [];
    return state.students.filter(student => student.classId === cls.id && !student.archived)
      .map(student => ({ id:String(student.id), name:String(student.name || student.displayName || student.firstName || "STUDENT") }));
  }

  function renderFancy() {
    const r = refs();
    const grade = effectiveFancyGrade();
    document.querySelectorAll("[data-dbfancy-grade]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dbfancyGrade === grade)));
    const state = readFancyState();
    const picks = grade && state[grade]?.current || [];
    const slots = [0,1,2,3].map(i => `<div class="dbfancy-slot"><span>${i+1}</span><b>${picks[i]?.name ? picks[i].name.replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch])) : "—"}</b></div>`).join("");
    r.fancyList.innerHTML = slots;
    const roster = fancyRoster(grade);
    if (!grade) r.fancyNote.textContent = "NO BAND DETECTED. CHOOSE 6TH, 7TH, OR 8TH.";
    else if (!roster.length) r.fancyNote.textContent = "OPEN CHARACTER POINTS ONCE ON THIS DEVICE SO I CAN SEE THE ROSTER.";
    else r.fancyNote.textContent = `${grade} GRADE • ${roster.length} STUDENTS • STUDENTS WHO HAVE NOT HAD A FANCY STAND ARE PRIORITIZED.`;
    r.fancyPick.disabled = !grade || roster.length < 4;
  }

  function pickFancyFour() {
    const r = refs();
    const grade = effectiveFancyGrade();
    const roster = fancyRoster(grade);
    if (!grade || roster.length < 4) return renderFancy();
    const state = readFancyState();
    const gradeState = state[grade] || { used:[], current:[] };
    let unused = roster.filter(student => !gradeState.used.includes(student.id));
    if (unused.length < 4) {
      gradeState.used = [];
      unused = roster.slice();
    }
    for (let i=unused.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [unused[i],unused[j]]=[unused[j],unused[i]];
    }
    const picks = unused.slice(0,4);
    gradeState.current = picks;
    gradeState.used = [...new Set([...gradeState.used, ...picks.map(item=>item.id)])];
    state[grade] = gradeState;
    saveFancyState(state);
    renderFancy();
    launchDoorFireworks();
  }

  function resetFancyRotation() {
    const grade = effectiveFancyGrade();
    if (!grade) return;
    const state = readFancyState();
    state[grade] = { used:[], current:[] };
    saveFancyState(state);
    renderFancy();
  }

  function renderCashContext() {
    const r = refs();
    if (!r.cashChip || !r.cashPanel) return;
    const state = readCashState();
    const grade = effectiveCashGrade();
    r.cashChip.innerHTML = grade ? `CASH<br>${grade.replace("TH","")}` : "CHARACTER<br>CASH";
    document.querySelectorAll("[data-dbcash-grade]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.dbcashGrade === grade));
    });
    r.cashTitle.textContent = grade ? `${grade} GRADE • CASH` : "CHARACTER CASH";

    const classes = activeCashClasses(state);
    const preferred = cashClassForGrade(state, grade);
    const currentValue = r.cashClass.value;
    r.cashClass.innerHTML = `<option value="">${state ? "CHOOSE CHARACTER CASH CLASS" : "OPEN CHARACTER CASH FIRST"}</option>` +
      classes.map(item => `<option value="${String(item.id).replace(/"/g,"&quot;")}">${String(item.name).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}</option>`).join("");
    const desired = preferred?.id || (classes.some(item => item.id === currentValue) ? currentValue : "");
    r.cashClass.value = desired;
    r.cashClass.disabled = !state || !grade || !classes.length;
    r.cashCommand.disabled = !state || !grade || !classes.length;
    r.cashUndo.hidden = !lastCashAward;
    if (!state) setCashFeedback("OPEN CHARACTER CASH ONCE ON THIS DEVICE, THEN COME BACK.", "error");
    else if (!grade) setCashFeedback("NO BAND CLASS DETECTED. TAP 6TH, 7TH, OR 8TH.", "error");
    else if (!classes.length) setCashFeedback("NO ACTIVE CHARACTER CASH CLASSES FOUND.", "error");
    else if (!r.cashClass.value) setCashFeedback(`${grade} DETECTED. CHOOSE ITS CHARACTER CASH CLASS ONCE.`, "error");
  }

  function saveCashClassMapping() {
    const r = refs();
    const grade = effectiveCashGrade();
    if (!grade || !r.cashClass.value) return;
    const map = readCashMap();
    map[grade] = r.cashClass.value;
    saveCashMap(map);
    setCashFeedback(`${grade} CLASS LINKED. TYPE A SECTION TO AWARD.`, "success");
  }

  function awardCashCommand() {
    const r = refs();
    const state = readCashState();
    const grade = effectiveCashGrade();
    if (!state) return setCashFeedback("OPEN CHARACTER CASH ONCE ON THIS DEVICE, THEN COME BACK.", "error");
    if (!grade) return setCashFeedback("CHOOSE 6TH, 7TH, OR 8TH FIRST.", "error");
    const classId = r.cashClass.value || cashClassForGrade(state, grade)?.id;
    if (!classId) return setCashFeedback("CHOOSE THE CHARACTER CASH CLASS FIRST.", "error");
    const parsed = parseCashCommand(r.cashCommand.value);
    if (parsed.error) return setCashFeedback(parsed.error, "error");

    const students = state.students.filter(student =>
      student.classId === classId && !student.archived && student.instrumentId === parsed.instrument.id
    );
    if (!students.length) {
      return setCashFeedback(`NO ${parsed.instrument.label.toUpperCase()} PLAYERS FOUND IN THIS CLASS.`, "error");
    }

    students.forEach(student => { student.balance = Number(student.balance || 0) + parsed.amount; });
    const event = {
      id: quickEventId(),
      type: "band-bonus",
      source: "band-tools-quick",
      label: parsed.instrument.label,
      instrumentId: parsed.instrument.id,
      amount: parsed.amount,
      studentIds: students.map(student => student.id),
      classId,
      createdAt: new Date().toISOString()
    };
    state.events.unshift(event);
    try {
      localStorage.setItem(CASH_STORAGE_KEY, JSON.stringify(state));
    } catch {
      students.forEach(student => { student.balance -= parsed.amount; });
      state.events = state.events.filter(item => item.id !== event.id);
      return setCashFeedback("CHARACTER CASH COULD NOT BE SAVED.", "error");
    }

    lastCashAward = { eventId:event.id, amount:parsed.amount, studentIds:event.studentIds, label:parsed.instrument.label };
    r.cashUndo.hidden = false;
    r.cashCommand.value = "";
    setCashFeedback(`✓ ${parsed.instrument.label.toUpperCase()} • ${students.length} ${students.length === 1 ? "STUDENT" : "STUDENTS"} • +${parsed.amount} EACH`, "success");
    notifyCashUpdated();
    window.setTimeout(() => r.cashCommand.focus(), 20);
  }

  function undoCashAward() {
    const r = refs();
    if (!lastCashAward) return;
    const state = readCashState();
    if (!state) return setCashFeedback("CHARACTER CASH DATA IS NOT AVAILABLE.", "error");
    const event = state.events.find(item => item.id === lastCashAward.eventId);
    if (!event) {
      lastCashAward = null;
      r.cashUndo.hidden = true;
      return setCashFeedback("THAT AWARD WAS ALREADY CHANGED ELSEWHERE.", "error");
    }
    state.students.forEach(student => {
      if (lastCashAward.studentIds.includes(student.id)) {
        student.balance = Number(student.balance || 0) - lastCashAward.amount;
      }
    });
    state.events = state.events.filter(item => item.id !== lastCashAward.eventId);
    try {
      localStorage.setItem(CASH_STORAGE_KEY, JSON.stringify(state));
    } catch {
      return setCashFeedback("UNDO COULD NOT BE SAVED.", "error");
    }
    const label = lastCashAward.label;
    lastCashAward = null;
    r.cashUndo.hidden = true;
    setCashFeedback(`UNDONE • ${label.toUpperCase()} AWARD REMOVED.`, "success");
    notifyCashUpdated();
  }

  function rewardRequestConfig() {
    return window.DERBY_REWARDS_CONFIG || {};
  }

  let latestRewardRequestFeed = null;

  function normalizeRewardRequestFeed(text) {
    try {
      const data = JSON.parse(String(text || "").trim());
      const grades = data && typeof data.grades === "object" ? data.grades : {};
      return {
        targetDate: String(data?.targetDate || ""),
        grades: {
          "6TH": Math.max(0, Math.floor(Number(grades["6TH"] || 0))),
          "7TH": Math.max(0, Math.floor(Number(grades["7TH"] || 0))),
          "8TH": Math.max(0, Math.floor(Number(grades["8TH"] || 0)))
        }
      };
    } catch {
      return null;
    }
  }

  function renderRewardRequestChip() {
    const r = refs();
    if (!r.requestChip || !latestRewardRequestFeed) {
      if (r.requestChip) r.requestChip.hidden = true;
      return;
    }
    const now = nyNow();
    if (latestRewardRequestFeed.targetDate !== now.date) {
      r.requestChip.hidden = true;
      return;
    }
    const requested = readOverride(now.date);
    const grade = currentBandGrade(now.date, now.weekday, requested, now.seconds);
    const count = grade ? Number(latestRewardRequestFeed.grades?.[grade] || 0) : 0;
    if (!grade || count < 1) {
      r.requestChip.hidden = true;
      return;
    }
    r.requestChip.hidden = false;
    r.requestChip.classList.add("dbrequest-new");
    r.requestChip.textContent = `${grade} • ${count} REWARD REQUEST${count === 1 ? "" : "S"} • REVIEW / REDEEM`;
  }

  async function pollRewardRequests() {
    const r = refs();
    if (!r.requestChip) return;
    const cfg = rewardRequestConfig();
    const url = String(cfg.requestFeedUrl || cfg.requestCountUrl || "").trim();
    if (!url) {
      latestRewardRequestFeed = null;
      r.requestChip.hidden = true;
      return;
    }
    try {
      const response = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), { cache:"no-store" });
      if (!response.ok) throw new Error("request feed unavailable");
      const feed = normalizeRewardRequestFeed(await response.text());
      if (!feed) throw new Error("request feed invalid");
      latestRewardRequestFeed = feed;
      renderRewardRequestChip();
    } catch {
      latestRewardRequestFeed = null;
      r.requestChip.hidden = true;
    }
  }

  function openRewardRequests() {
    const cfg = rewardRequestConfig();
    const target = String(cfg.requestManageUrl || "").trim();
    if (target) window.open(target, "_blank", "noopener");
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
    document.body.classList.toggle("dbclock-three-minute-pulse", remaining > 0 && remaining <= 3 * 60);

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
    document.body.classList.remove("dbclock-three-minute-pulse");
  }

  function tick() {
    const now = nyNow();
    const requested = readOverride(now.date);
    const actual = resolvedMode(now.date, requested);
    const schedule = scheduleFor(now.date, now.weekday, requested);
    renderMenuState(now.date, requested);
    renderDoorReminder(now.date, now.weekday, requested, actual, now.seconds);
    renderRewardRequestChip();
    if (!refs().cashPanel.hidden) renderCashContext();

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

    r.fancyChip.addEventListener("click", () => {
      r.fancyPanel.hidden = false;
      renderFancy();
    });
    r.fancyClose.addEventListener("click", () => {
      r.fancyPanel.hidden = true;
      fancyManualGrade = null;
    });
    r.fancyPanel.addEventListener("click", event => {
      if (event.target === r.fancyPanel) {
        r.fancyPanel.hidden = true;
        fancyManualGrade = null;
      }
    });
    document.querySelectorAll("[data-dbfancy-grade]").forEach(button => {
      button.addEventListener("click", () => {
        fancyManualGrade = button.dataset.dbfancyGrade;
        renderFancy();
      });
    });
    r.fancyPick.addEventListener("click", pickFancyFour);
    r.fancyReset.addEventListener("click", resetFancyRotation);

    r.cashChip.addEventListener("click", () => {
      r.cashPanel.hidden = !r.cashPanel.hidden;
      r.cashChip.setAttribute("aria-expanded", String(!r.cashPanel.hidden));
      if (!r.cashPanel.hidden) {
        renderCashContext();
        window.setTimeout(() => r.cashCommand.focus(), 30);
      } else {
        cashManualGrade = null;
      }
    });
    r.cashClose.addEventListener("click", () => {
      r.cashPanel.hidden = true;
      r.cashChip.setAttribute("aria-expanded", "false");
      cashManualGrade = null;
      renderCashContext();
    });
    document.querySelectorAll("[data-dbcash-grade]").forEach(button => {
      button.addEventListener("click", () => {
        cashManualGrade = button.dataset.dbcashGrade;
        renderCashContext();
        window.setTimeout(() => r.cashCommand.focus(), 20);
      });
    });
    r.cashClass.addEventListener("change", saveCashClassMapping);
    r.cashForm.addEventListener("submit", event => {
      event.preventDefault();
      awardCashCommand();
    });
    r.cashUndo.addEventListener("click", undoCashAward);
    r.requestChip?.addEventListener("click", openRewardRequests);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !r.doorModal.hidden) closeDoorKeeper(true);
      else if (event.key === "Escape" && !r.fancyPanel.hidden) {
        r.fancyPanel.hidden = true;
        fancyManualGrade = null;
      }
      else if (event.key === "Escape" && !r.cashPanel.hidden) {
        r.cashPanel.hidden = true;
        r.cashChip.setAttribute("aria-expanded", "false");
        cashManualGrade = null;
      }
    });

    document.addEventListener("click", event => {
      if (r.menu.hidden) return;
      if (r.menu.contains(event.target) || r.chip.contains(event.target)) return;
      r.menu.hidden = true;
      r.chip.setAttribute("aria-expanded", "false");
    });

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY || event.key === DOOR_STORAGE_KEY || event.key === FANCY_STORAGE_KEY || event.key === CASH_STORAGE_KEY || event.key === CASH_MAP_STORAGE_KEY || event.key === null) {
        dismissedSlotKey = "";
        tick();
        if (!r.cashPanel.hidden) renderCashContext();
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
    renderCashContext();
    renderFancy();
    pollRewardRequests();
    window.setInterval(tick, 250);
    window.setInterval(pollRewardRequests, REQUEST_POLL_MS);
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