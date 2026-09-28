(() => {
  "use strict";

  const VERSION = "2026.09.28.1";
  const TZ = "America/New_York";
  const STORAGE_KEY = "derby-band-clock-mode-v1";
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
      @media (max-width:600px) {
        #dbclock-box { left:10px; right:10px; top:10px; width:auto; }
        #dbclock-time { font-size:52px; }
      }
      @media (prefers-reduced-motion:reduce) {
        #dbclock-box { transition:none; }
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
      </div>
      <button id="dbclock-preview" type="button">PREVIEW COUNTDOWN</button>
      <p id="dbclock-menu-note">Early-dismissal dates switch automatically. Use 2-HR DELAY on weather-delay days; the override resets tomorrow.</p>
    `;

    document.body.append(box, chip, menu);
  }

  let dismissedSlotKey = "";
  let previewStartedAt = 0;
  let previewActive = false;

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
      preview: document.getElementById("dbclock-preview")
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

    document.addEventListener("click", event => {
      if (r.menu.hidden) return;
      if (r.menu.contains(event.target) || r.chip.contains(event.target)) return;
      r.menu.hidden = true;
      r.chip.setAttribute("aria-expanded", "false");
    });

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY || event.key === null) {
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
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();