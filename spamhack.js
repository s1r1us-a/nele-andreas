// Gemeinsames, seitenuebergreifendes Popup-Hack-Modul.
// Eingebunden auf allen Spiel-Seiten AUSSER marienkaefer/aquarium/zombiedefense.
// Hoert auf boosters/{userKey}/active_spam und spammt das Opfer waehrend der
// Hack-Dauer mit nervigen "gehacktes Terminal"-Popups zu – egal auf welcher
// Seite es sich gerade befindet. Immer nur EIN Popup gleichzeitig.

import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
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
const SPAWN_MIN     = 4000;   // min. Abstand bis zum naechsten Popup
const SPAWN_MAX     = 7000;   // max. Abstand bis zum naechsten Popup
const FIRST_DELAY   = 800;    // Verzoegerung bis zum ersten Popup
const CLOSE_LOCK    = 1500;   // "Schliessen"-Knopf erst danach aktiv
const DODGE         = true;   // Schliessen-Knopf weicht beim 1. Klick aus
const DEFAULT_DUR   = 90000;

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

function displayName(email) {
  if (email.toLowerCase() === 'raederich@outlook.com') return 'Andreas';
  if (email.toLowerCase() === 'nele.busse@web.de')     return 'Nele';
  return email.split('@')[0];
}

function isActive(d) {
  if (!d || !d.activatedAt) return false;
  return Date.now() < d.activatedAt + (d.durationMs || DEFAULT_DUR);
}

function fillMsg(tpl, from) {
  return tpl
    .replace(/\{from\}/g, from || 'Hacker')
    .replace(/\{zeit\}/g, new Date().toLocaleTimeString('de-DE'));
}

// ---- CSS einmalig injizieren ----
function injectStyle() {
  if (document.getElementById('spamhack-style')) return;
  const s = document.createElement('style');
  s.id = 'spamhack-style';
  s.textContent = `
  .spamhack-backdrop{position:fixed;inset:0;background:rgba(0,8,4,.55);
    z-index:2147483600;display:flex;align-items:center;justify-content:center;}
  .spamhack-win{position:absolute;width:min(360px,90vw);
    background:#0a0e12;border:2px solid #1f7a3a;border-radius:8px;
    box-shadow:0 0 0 2px #000,0 0 26px rgba(34,255,120,.45);
    font-family:'Courier New',monospace;color:#7CFC9A;overflow:hidden;
    animation:spamhack-pop .18s ease-out, spamhack-glitch 1.6s steps(2) infinite;}
  .spamhack-bar{display:flex;align-items:center;gap:7px;padding:7px 10px;
    background:#11151b;border-bottom:1px solid #1f7a3a;font-size:12px;color:#9aa;}
  .spamhack-dot{width:10px;height:10px;border-radius:50%;background:#ff3b3b;
    box-shadow:0 0 6px #ff3b3b;}
  .spamhack-body{padding:18px 16px 16px;font-size:14px;line-height:1.55;
    text-shadow:0 0 4px rgba(124,252,154,.6);}
  .spamhack-body::after{content:'_';animation:spamhack-blink 1s steps(1) infinite;}
  .spamhack-scan{position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px);}
  .spamhack-close{display:block;width:100%;margin-top:14px;padding:9px;
    background:#161b22;color:#ff6b6b;border:1px solid #7a1f1f;border-radius:5px;
    font-family:'Courier New',monospace;font-size:13px;cursor:not-allowed;
    opacity:.55;transition:left .1s,top .1s;}
  .spamhack-close.ready{cursor:pointer;opacity:1;color:#7CFC9A;
    border-color:#1f7a3a;}
  .spamhack-shake{animation:spamhack-shake .3s linear;}
  @keyframes spamhack-pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes spamhack-blink{50%{opacity:0}}
  @keyframes spamhack-glitch{0%,92%,100%{filter:none}94%{filter:hue-rotate(60deg) contrast(1.4)}96%{filter:invert(.15)}}
  @keyframes spamhack-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
  `;
  document.head.appendChild(s);
}

// ---- Popup-Logik (max. 1 gleichzeitig) ----
let userKey      = null;
let spamData     = null;
let running      = false;
let currentEl    = null;
let nextTimeout  = null;
let endTimeout   = null;

function clearTimers() {
  if (nextTimeout) { clearTimeout(nextTimeout); nextTimeout = null; }
  if (endTimeout)  { clearTimeout(endTimeout);  endTimeout  = null; }
}

function removeCurrent() {
  if (currentEl) { currentEl.remove(); currentEl = null; }
}

function scheduleNext() {
  if (!running || currentEl) return;
  const delay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
  nextTimeout = setTimeout(() => {
    if (!running || !isActive(spamData)) return;
    spawn(fillMsg(MESSAGES[Math.floor(Math.random() * MESSAGES.length)], spamData && spamData.from));
  }, delay);
}

function placeWin(win) {
  const w = win.offsetWidth, h = win.offsetHeight;
  const maxX = Math.max(8, window.innerWidth  - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  win.style.left = (8 + Math.random() * maxX) + 'px';
  win.style.top  = (8 + Math.random() * maxY) + 'px';
}

function spawn(text) {
  if (currentEl) return; // nie mehr als eins
  injectStyle();

  const backdrop = document.createElement('div');
  backdrop.className = 'spamhack-backdrop';

  const win = document.createElement('div');
  win.className = 'spamhack-win';
  win.innerHTML = `
    <div class="spamhack-bar">
      <span class="spamhack-dot"></span>
      <span>root@nele-und-andreas: ~/exploit</span>
    </div>
    <div class="spamhack-body"></div>
    <div class="spamhack-scan"></div>`;
  win.querySelector('.spamhack-body').textContent = text;

  const close = document.createElement('button');
  close.className = 'spamhack-close';
  win.querySelector('.spamhack-body').after(close);

  backdrop.appendChild(win);
  document.body.appendChild(backdrop);
  currentEl = backdrop;
  placeWin(win);

  if (navigator.vibrate) { try { navigator.vibrate(200); } catch (_) {} }

  // Fake-Countdown, dann erst schliessbar
  let left = Math.ceil(CLOSE_LOCK / 1000);
  close.textContent = `[ Schließen in ${left} ]`;
  const cd = setInterval(() => {
    left--;
    if (left > 0) { close.textContent = `[ Schließen in ${left} ]`; }
  }, 1000);
  setTimeout(() => {
    clearInterval(cd);
    close.classList.add('ready');
    close.textContent = '[ ✕ Verbindung trennen ]';
  }, CLOSE_LOCK);

  let dodged = false;
  close.addEventListener('click', () => {
    if (!close.classList.contains('ready')) return;
    if (DODGE && !dodged) { dodged = true; placeWin(win); return; }
    clearInterval(cd);
    removeCurrent();
    if (running && isActive(spamData)) scheduleNext();
  });

  // Klick irgendwo ins Fenster (nicht der Knopf) -> nur nerviges Wackeln
  win.addEventListener('click', e => {
    if (e.target === close) return;
    win.classList.remove('spamhack-shake');
    void win.offsetWidth;
    win.classList.add('spamhack-shake');
  });
}

function startRun() {
  running = true;
  clearTimers();
  removeCurrent();
  const from = spamData && spamData.from;
  const dur  = (spamData && spamData.durationMs) || DEFAULT_DUR;
  const secs = Math.round(dur / 1000);
  setTimeout(() => {
    if (running && isActive(spamData)) {
      spawn(`💻 ${from || 'Jemand'} hat dich gehackt. Verbindung getrennt erst in ${secs}s 😈`);
    }
  }, FIRST_DELAY);
  const remaining = (spamData.activatedAt + dur) - Date.now();
  endTimeout = setTimeout(stopRun, Math.max(0, remaining));
}

function stopRun() {
  running = false;
  clearTimers();
  removeCurrent();
}

function sync() {
  if (isActive(spamData)) {
    if (!running) startRun();
  } else if (running || currentEl) {
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
});
