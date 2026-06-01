// Globale Live-Präsenz für Nele & Andreas.
// Schreibt auf jeder Seite den eigenen Status (online/afk + aktuelle Seite)
// nach Firebase und zeigt – falls vorhanden – den Status des anderen Spielers
// in den Elementen #otherPresenceDot / #otherPresenceText an.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { levelFromTotal } from "./xp-helper.js";

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
  'marienkaefer.html':   'Marienkäfer',
  'abenteuer.html':      'Dämmerpfad',
  'turm.html':           'Turm'
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
  const now = Date.now();
  set(myRef, { state, ts: now, lastSeen: now, page: pageLabel }).catch(() => {});
}

function touchHeartbeat() {
  if (myRef) { const now = Date.now(); update(myRef, { ts: now, lastSeen: now }).catch(() => {}); }
}

function goActive() {
  if (myState !== 'online') writeSelf('online');
  if (afkTimer) clearTimeout(afkTimer);
  afkTimer = setTimeout(() => writeSelf('afk'), AFK_MS);
}

function startSelfTracking() {
  writeSelf('online');
  onDisconnect(myRef).update({ state: 'offline', lastSeen: serverTimestamp() }).catch(() => {});

  ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'].forEach(ev =>
    window.addEventListener(ev, goActive, { passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeSelf('afk');
    } else {
      goActive();
    }
  });

  window.addEventListener('pagehide', () => { if (myRef) update(myRef, { state: 'offline', lastSeen: Date.now() }).catch(() => {}); });

  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(touchHeartbeat, HEARTBEAT_MS);

  goActive();
}

function stopSelfTracking() {
  if (afkTimer)   { clearTimeout(afkTimer); afkTimer = null; }
  if (heartbeat)  { clearInterval(heartbeat); heartbeat = null; }
  if (myRef)      { update(myRef, { state: 'offline', lastSeen: Date.now() }).catch(() => {}); }
  myRef = null;
  myKey = null;
}

// ---------- Status des anderen Spielers anzeigen ----------
const dotEl  = document.getElementById('otherPresenceDot');
const textEl = document.getElementById('otherPresenceText');
let otherData = null;
let otherName = '';
let otherLevel = null;  // Level des anderen Spielers (für die Presence-Pill, nur PC)

function classify(data) {
  if (!data || typeof data.ts !== 'number' || (Date.now() - data.ts) > STALE_MS) return 'offline';
  return data.state === 'afk' ? 'afk' : 'online';
}

// Liefert { relative, absolute } für "zuletzt online", oder null wenn
// kein Zeitstempel vorhanden ist (alte Datensätze).
function formatLastSeen(data) {
  const t = data && (typeof data.lastSeen === 'number' ? data.lastSeen
                    : typeof data.ts === 'number' ? data.ts : null);
  if (!t) return null;
  const d   = new Date(t);
  const now = Date.now();
  const diffMin = Math.floor((now - t) / 60000);

  let relative;
  if (diffMin < 1)        relative = 'gerade eben';
  else if (diffMin < 60)  relative = 'vor ' + diffMin + ' Min.';
  else if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60);
    relative = 'vor ' + h + ' Std.';
  } else {
    const days = Math.floor(diffMin / 1440);
    if (days === 1)      relative = 'gestern';
    else if (days < 7)   relative = 'vor ' + days + ' Tagen';
    else {
      relative = d.getDate().toString().padStart(2, '0') + '.' +
                 (d.getMonth() + 1).toString().padStart(2, '0') + '.';
    }
  }

  const pad = n => n.toString().padStart(2, '0');
  const absolute = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' +
                   d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

  return { relative, absolute };
}

function renderOther() {
  if (!dotEl) return;
  const status = classify(otherData);
  dotEl.classList.remove('is-online', 'is-afk', 'is-offline');
  dotEl.classList.add('is-' + status);

  const labels = { online: 'online', afk: 'AFK', offline: 'offline' };
  const where  = (status !== 'offline' && otherData && otherData.page) ? otherData.page : '';
  const seen   = status === 'offline' ? formatLastSeen(otherData) : null;

  if (status === 'offline' && seen) {
    dotEl.title = otherName
      ? otherName + ': zuletzt online ' + seen.absolute
      : 'zuletzt online ' + seen.absolute;
  } else {
    dotEl.title = otherName
      ? otherName + ': ' + labels[status] + (where ? ' – ' + where : '')
      : labels[status];
  }

  if (textEl) {
    if (status === 'offline') {
      if (seen) {
        textEl.textContent = otherName + ' – zuletzt online ' + seen.relative;
        textEl.style.display = '';
      } else {
        textEl.textContent = '';
        textEl.style.display = 'none';
      }
    } else {
      if (where) {
        const lvlPart = (otherLevel != null) ? ' (Lvl ' + otherLevel + ')' : '';
        textEl.textContent = otherName + lvlPart + ': ' + where;
      } else {
        textEl.textContent = otherName + ' ' + labels[status];
      }
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
  onValue(ref(db, 'xp/' + otherKey + '/total'), snap => {
    otherLevel = levelFromTotal(snap.val() || 0);
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
    const seen  = status === 'offline' ? formatLastSeen(data) : null;
    const txt   = status === 'offline'
      ? (seen ? nice + ' war zuletzt online ' + seen.relative : nice + ' ist offline')
      : nice + ' ist ' + word + (where ? ' – ' + where : '');
    el.title = seen ? 'Zuletzt online: ' + seen.absolute : '';
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
