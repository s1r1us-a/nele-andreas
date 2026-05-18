// Globale Live-Präsenz für Nele & Andreas.
// Schreibt auf jeder Seite den eigenen Status (online/afk + aktuelle Seite)
// nach Firebase und zeigt – falls vorhanden – den Status des anderen Spielers
// in den Elementen #otherPresenceDot / #otherPresenceText an.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, remove, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const AFK_MS       = 2 * 60 * 1000;  // 2 Min Inaktivität -> AFK
const HEARTBEAT_MS = 20 * 1000;      // ts alle 20 s erneuern
const STALE_MS     = 60 * 1000;      // älter als 60 s -> offline

// E-Mail -> playerKey (identisch zur displayName-Logik im Rest der App)
function keyForEmail(email) {
  const e = (email || '').toLowerCase();
  if (e === 'raederich@outlook.com') return 'andreas';
  if (e === 'nele.busse@web.de')     return 'nele';
  return null;
}

// Dateiname -> lesbares Label
const PAGE_LABELS = {
  'index.html':          'Hauptseite',
  '':                    'Hauptseite',
  'slot.html':           'Slotmaschine',
  'farm.html':           'Farm',
  'zombiedefense.html':  'Zombie-Abwehr',
  'aquarium.html':       'Aquarium',
  'battleship.html':     'Schiffe versenken',
  'game.html':           'Vier Gewinnt',
  'quiz.html':           'Quiz',
  'shop.html':           'Shop',
  'profil.html':         'Profil',
  'stats.html':          'Statistiken',
  'ourhome.html':        'Unser Zuhause',
  'momente-archiv.html': 'Momente-Archiv',
  'marienkaefer.html':   'Marienkäfer'
};

function currentPageLabel() {
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  return PAGE_LABELS[file] || 'Unterwegs';
}

// ---------- Eigene Präsenz schreiben ----------
let myKey       = null;
let myRef       = null;
let myState     = 'online';
let afkTimer    = null;
let heartbeat   = null;
const pageLabel = currentPageLabel();

function writeSelf(state) {
  if (!myRef) return;
  myState = state;
  set(myRef, { state, ts: Date.now(), page: pageLabel }).catch(() => {});
}

function touchHeartbeat() {
  if (myRef) update(myRef, { ts: Date.now() }).catch(() => {});
}

function goActive() {
  if (myState !== 'online') writeSelf('online');
  if (afkTimer) clearTimeout(afkTimer);
  afkTimer = setTimeout(() => writeSelf('afk'), AFK_MS);
}

function startSelfTracking() {
  writeSelf('online');
  onDisconnect(myRef).remove().catch(() => {});

  ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'].forEach(ev =>
    window.addEventListener(ev, goActive, { passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeSelf('afk');
    } else {
      goActive();
    }
  });

  window.addEventListener('pagehide', () => { if (myRef) remove(myRef).catch(() => {}); });

  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(touchHeartbeat, HEARTBEAT_MS);

  goActive();
}

function stopSelfTracking() {
  if (afkTimer)   { clearTimeout(afkTimer); afkTimer = null; }
  if (heartbeat)  { clearInterval(heartbeat); heartbeat = null; }
  if (myRef)      { remove(myRef).catch(() => {}); }
  myRef = null;
  myKey = null;
}

// ---------- Status des anderen Spielers anzeigen ----------
const dotEl  = document.getElementById('otherPresenceDot');
const textEl = document.getElementById('otherPresenceText');
let otherData = null;
let otherName = '';

function classify(data) {
  if (!data || typeof data.ts !== 'number' || (Date.now() - data.ts) > STALE_MS) return 'offline';
  return data.state === 'afk' ? 'afk' : 'online';
}

function renderOther() {
  if (!dotEl) return;
  const status = classify(otherData);
  dotEl.classList.remove('is-online', 'is-afk', 'is-offline');
  dotEl.classList.add('is-' + status);

  const labels = { online: 'online', afk: 'AFK', offline: 'offline' };
  const where  = (status !== 'offline' && otherData && otherData.page) ? otherData.page : '';
  dotEl.title  = otherName
    ? otherName + ': ' + labels[status] + (where ? ' – ' + where : '')
    : labels[status];

  if (textEl) {
    if (status === 'offline') {
      textEl.textContent = '';
      textEl.style.display = 'none';
    } else {
      textEl.textContent = where ? otherName + ': ' + where : otherName + ' ' + labels[status];
      textEl.style.display = '';
    }
  }
}

function startWatchingOther(meKey) {
  if (!dotEl) return;
  const otherKey = meKey === 'andreas' ? 'nele' : 'andreas';
  otherName = otherKey.charAt(0).toUpperCase() + otherKey.slice(1);
  onValue(ref(db, 'presence/' + otherKey), snap => {
    otherData = snap.val();
    renderOther();
  });
  // Lokaler Tick, damit "still -> stale -> offline" auch ohne neues
  // Firebase-Event korrekt umschaltet.
  setInterval(renderOther, 30 * 1000);
  renderOther();
}

// ---------- Detaillierte Statusanzeige auf Profilseiten ----------
function startProfilePresence() {
  const el = document.getElementById('profilePresence');
  if (!el) return;
  let subscribedKey = null;
  let data = null;

  function render() {
    const key = el.dataset.player;
    if (!key) { el.style.display = 'none'; return; }
    const status = classify(data);
    el.classList.remove('is-online', 'is-afk', 'is-offline');
    el.classList.add('is-' + status);
    const nice  = key.charAt(0).toUpperCase() + key.slice(1);
    const where = (status !== 'offline' && data && data.page) ? data.page : '';
    const word  = status === 'online' ? 'Online' : status === 'afk' ? 'AFK' : 'Offline';
    const txt   = status === 'offline'
      ? nice + ' ist offline'
      : nice + ' ist ' + word + (where ? ' – ' + where : '');
    el.innerHTML = '<span class="pp-dot"></span><span>' + txt + '</span>';
    el.style.display = 'inline-flex';
  }

  function sync() {
    const key = el.dataset.player;
    if (key && key !== subscribedKey) {
      subscribedKey = key;
      onValue(ref(db, 'presence/' + key), snap => { data = snap.val(); render(); });
    }
    render();
  }

  new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['data-player'] });
  setInterval(render, 30 * 1000);
  sync();
}
startProfilePresence();

// ---------- Auth ----------
let watchingStarted = false;
onAuthStateChanged(auth, user => {
  const key = user ? keyForEmail(user.email) : null;
  if (key) {
    if (myKey !== key) {
      myKey = key;
      myRef = ref(db, 'presence/' + key);
      startSelfTracking();
    }
    if (!watchingStarted) { watchingStarted = true; startWatchingOther(key); }
  } else {
    stopSelfTracking();
  }
});
