// Globales Live-Modal für neue Postkasten-Nachrichten.
// Wird auf jeder Seite eingebunden (analog zu presence.js) und zeigt – sobald
// eine neue ungelesene Nachricht im Postkasten ankommt – ein Modal, das der
// Empfänger manuell wegklicken muss.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
};

const app  = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getDatabase(app);

// E-Mail -> playerKey (identisch zur displayName-Logik im Rest der App)
function keyForEmail(email) {
  const e = (email || '').toLowerCase();
  if (e === 'raederich@outlook.com') return 'andreas';
  if (e === 'nele.busse@web.de')     return 'nele';
  return null;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Modal-DOM + Stil einmalig injizieren ----------
let overlayEl = null, titleEl = null, subEl = null;

function ensureModal() {
  if (overlayEl) return;

  const style = document.createElement('style');
  style.textContent = `
    .mn-overlay {
      position: fixed; inset: 0; z-index: 1000000;
      display: none; align-items: center; justify-content: center;
      background: rgba(253,232,237,0.92);
      -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      padding: 20px;
    }
    .mn-overlay.open { display: flex; }
    .mn-card {
      background: #fff;
      border: 1.5px solid rgba(232,115,138,0.3);
      border-radius: 28px;
      padding: 36px 32px 30px;
      max-width: 340px; width: 100%;
      text-align: center;
      box-shadow: 0 16px 60px rgba(232,115,138,0.25);
      animation: mnPop 0.42s cubic-bezier(0.22,1,0.36,1) both;
    }
    @keyframes mnPop {
      0%   { transform: scale(0.6) rotate(-4deg); opacity: 0; }
      70%  { transform: scale(1.04) rotate(1deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .mn-emoji { font-size: 44px; display: block; margin-bottom: 12px; }
    .mn-title {
      font-family: 'Dancing Script', cursive;
      font-size: 30px; font-weight: 700;
      color: var(--rose, #e8738a);
      margin-bottom: 8px; line-height: 1.15;
    }
    .mn-sub {
      font-size: 15px; color: var(--text-dark, #5a2d3a);
      margin-bottom: 22px; word-break: break-word;
    }
    .mn-btn {
      display: inline-block;
      background: linear-gradient(135deg, var(--rose, #e8738a) 0%, #c85070 100%);
      color: #fff; border: none; cursor: pointer;
      font-size: 15px; font-weight: 700;
      padding: 12px 32px; border-radius: 50px;
      box-shadow: 0 6px 18px rgba(232,115,138,0.4);
      transition: transform 0.15s;
    }
    .mn-btn:active { transform: scale(0.96); }
  `;
  document.head.appendChild(style);

  overlayEl = document.createElement('div');
  overlayEl.className = 'mn-overlay';
  overlayEl.setAttribute('role', 'alertdialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.innerHTML = `
    <div class="mn-card" role="document">
      <span class="mn-emoji">💌</span>
      <div class="mn-title" id="mnTitle">Neue Nachricht!</div>
      <div class="mn-sub" id="mnSub"></div>
      <button class="mn-btn" id="mnClose" type="button">Schließen</button>
    </div>
  `;
  document.body.appendChild(overlayEl);

  titleEl = overlayEl.querySelector('#mnTitle');
  subEl   = overlayEl.querySelector('#mnSub');
  overlayEl.querySelector('#mnClose').addEventListener('click', dismissModal);
}

function renderModalContent() {
  // shownIds: aktuell im Modal angezeigte, noch unbestätigte neue IDs
  const count = shownIds.length;
  if (count <= 0) return;
  if (count === 1) {
    const m = lastMsgs[shownIds[0]] || {};
    const from = m.isAdmin ? 'Admin' : (m.fromName || 'jemandem');
    titleEl.textContent = `💌 Neue Nachricht von ${from}`;
    subEl.innerHTML = m.subject ? esc(m.subject) : 'Du hast eine neue Nachricht im Postkasten.';
  } else {
    titleEl.textContent = `💌 Du hast ${count} neue Nachrichten`;
    subEl.textContent = 'Schau in deinen Postkasten.';
  }
}

function showModal() {
  ensureModal();
  renderModalContent();
  overlayEl.classList.add('open');
}

function dismissModal() {
  if (!overlayEl) return;
  overlayEl.classList.remove('open');
  // Angezeigte IDs als gemeldet markieren + persistieren.
  shownIds.forEach(id => notified.add(id));
  shownIds = [];
  persistNotified();
}

// ---------- Postkasten-Listener ----------
let storeKey   = null;            // localStorage-Schlüssel je Nutzer
let notified   = new Set();       // bereits gemeldete Nachrichten-IDs
let shownIds   = [];              // aktuell im Modal angezeigte neue IDs
let lastMsgs   = {};              // letzter Postkasten-Snapshot

function loadNotified() {
  try {
    const raw = localStorage.getItem(storeKey);
    notified = new Set(raw ? JSON.parse(raw) : []);
  } catch (e) { notified = new Set(); }
}

function persistNotified() {
  // Pruning: nur IDs behalten, die es noch im Postkasten gibt.
  const existing = new Set(Object.keys(lastMsgs));
  notified = new Set([...notified].filter(id => existing.has(id)));
  try { localStorage.setItem(storeKey, JSON.stringify([...notified])); } catch (e) {}
}

let unsub = null;

function startMailbox(key) {
  storeKey = 'mailNotifiedIds_' + key;
  loadNotified();
  if (unsub) { unsub(); unsub = null; }
  unsub = onValue(ref(db, 'mailbox/' + key), snap => {
    lastMsgs = snap.exists() ? (snap.val() || {}) : {};

    const unreadIds = Object.keys(lastMsgs)
      .filter(id => lastMsgs[id] && !lastMsgs[id].read);

    const neu = unreadIds.filter(id => !notified.has(id) && !shownIds.includes(id));

    if (neu.length > 0) {
      shownIds = shownIds.concat(neu);
      showModal();
    } else if (overlayEl && overlayEl.classList.contains('open')) {
      // Modal offen: ggf. gelesene/gelöschte aus der Anzeige entfernen.
      shownIds = shownIds.filter(id => unreadIds.includes(id));
      if (shownIds.length === 0) overlayEl.classList.remove('open');
      else renderModalContent();
    }
  });
}

function stopMailbox() {
  if (unsub) { unsub(); unsub = null; }
  if (overlayEl) overlayEl.classList.remove('open');
  shownIds = [];
  lastMsgs = {};
}

// ---------- Auth ----------
let currentKey = null;
onAuthStateChanged(auth, user => {
  const key = user ? keyForEmail(user.email) : null;
  if (key) {
    if (currentKey !== key) {
      currentKey = key;
      startMailbox(key);
    }
  } else {
    currentKey = null;
    stopMailbox();
  }
});
