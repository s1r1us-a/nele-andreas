/* =====================================================================
   STATE & PERSISTENZ. Live-Bindings: `state`/`nextId` werden hier
   (re)zugewiesen, Importeure sehen die aktuelle Referenz automatisch.
   Persistenz: Firebase Realtime DB (/adventure/<userKey>) als Quelle,
   localStorage als Offline-Cache/Fallback. Save-Versionierung & Migration.
   ===================================================================== */
import { SAVE_KEY, SAVE_VERSION } from '../data/tuning.js';
import { SLOTS } from '../data/slots.js';
import { defaultTypeKey } from '../data/itemTypes.js';
import { db, ref, get, set, remove } from './firebase.js';

export let state = null;
export let nextId = 1;
export function nextItemId(){ return nextId++; }

// Eingeloggter Spieler-Schlüssel ('andreas'/'nele') – beim Laden gesetzt.
let userKey = null;
const dbPath = () => 'adventure/' + userKey;

function blankStats(){
  return { createdAt: Date.now(), goldEarned: 0, bossKills: 0, farmKills: 0,
           bestItemValue: 0, drops: { gewoehnlich:0, ungewoehnlich:0, selten:0,
           episch:0, legendaer:0, mythisch:0 }, expeditionsDone: 0 };
}

export function freshState(){
  const eq = {}; Object.keys(SLOTS).forEach(s => eq[s] = null);
  return {
    version: SAVE_VERSION, zone:0, zoneFinds:0, equipped:eq, inventory:[],
    lastTick:Date.now(), log:[], totalFinds:0, gold:0, bossesBeaten:0,
    xp:0, level:1, potions:0, character:null, expedition:null,
    // ---- NEU ----
    firstClears:{},        // bossIndex -> true (#16)
    killCounts:{},         // bossIndex -> Anzahl Siege
    lockedIds:[],          // gesperrte Item-Ids (#24)
    stats: blankStats(),   // Statistiken (#28)
    settings:{ seenOnboarding:false }, // (#29)
  };
}

// Defensive Migration: ergänzt fehlende Felder, ohne Daten zu verlieren.
// Härtet zugleich gegen RTDB-Serialisierung (null-Werte & leere Container
// gehen beim Schreiben verloren und müssen beim Laden rekonstruiert werden).
function migrate(s){
  if(typeof s.zone !== 'number') s.zone = 0;
  if(typeof s.gold !== 'number') s.gold = 0;
  if(typeof s.bossesBeaten !== 'number') s.bossesBeaten = 0;
  if(typeof s.xp !== 'number') s.xp = 0;
  if(typeof s.level !== 'number') s.level = 1;
  if(typeof s.potions !== 'number') s.potions = 0;
  if(!('character' in s)) s.character = null;
  if(!('expedition' in s)) s.expedition = null;
  // equipped mit ALLEN Slot-Keys rekonstruieren (RTDB verwirft null-Slots).
  const eq = {}; const prev = (s.equipped && typeof s.equipped==='object') ? s.equipped : {};
  Object.keys(SLOTS).forEach(k => eq[k] = prev[k] || null);
  s.equipped = eq;
  if(!Array.isArray(s.inventory)) s.inventory = [];
  if(!Array.isArray(s.log)) s.log = [];
  if(!s.firstClears || typeof s.firstClears !== 'object') s.firstClears = {};
  if(!s.killCounts || typeof s.killCounts !== 'object') s.killCounts = {};
  if(!Array.isArray(s.lockedIds)) s.lockedIds = [];
  if(!s.stats || typeof s.stats !== 'object') s.stats = blankStats();
  else { const b = blankStats(); s.stats = Object.assign(b, s.stats);
         s.stats.drops = Object.assign(b.drops, s.stats.drops||{}); }
  if(!s.settings || typeof s.settings !== 'object') s.settings = { seenOnboarding:false };
  // Bereits besiegte Bosse (Index < zone) als First-Clear markieren (Altstände)
  for(let i=0;i<s.zone;i++){ if(!s.firstClears[i]) s.firstClears[i] = true; }
  s.version = SAVE_VERSION;
  return s;
}

// Items nach dem Laden defaulten + nextId ableiten.
function hydrateItems(){
  const all = [...state.inventory, ...Object.values(state.equipped).filter(Boolean)];
  nextId = all.reduce((m,it)=>Math.max(m, it.id||0), 0) + 1;
  for(const it of all){
    if(!it.affixes) it.affixes = {};
    if(!it.itemType) it.itemType = defaultTypeKey(it.slotKey);
  }
}

function parseLocal(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || typeof s.version !== 'number') return null;
    return s;
  } catch(e){ return null; }
}

// ---- Laden: Firebase zuerst, sonst localStorage, sonst frisch ----------
export async function loadSave(uk){
  userKey = uk || userKey;
  let loaded = null;
  if(userKey){
    try {
      const snap = await get(ref(db, dbPath()));
      if(snap.exists()) loaded = snap.val();
    } catch(e){ console.warn('Firebase-Laden fehlgeschlagen, nutze lokalen Cache', e); }
  }
  if(!loaded) loaded = parseLocal();
  state = loaded ? migrate(loaded) : freshState();
  hydrateItems();
  // Lokalen Cache aktualisieren (Offline-Fallback).
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){}
  return state;
}

// ---- Speichern: sofort lokal, debounced nach Firebase ------------------
let _saveTimer = null, _saveInFlight = false, _savePending = false;

async function _flushRemote(){
  if(!userKey) return;
  if(_saveInFlight){ _savePending = true; return; }
  _saveInFlight = true;
  try {
    await set(ref(db, dbPath()), state);
    while(_savePending){ _savePending = false; await set(ref(db, dbPath()), state); }
  } catch(e){ console.warn('Firebase-Speichern fehlgeschlagen', e); }
  finally { _saveInFlight = false; }
}

export function saveState(){
  state.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){}
  if(!userKey) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{ _saveTimer = null; _flushRemote(); }, 1500);
}

// Sofortiges Schreiben (Seitenwechsel/Schließen) – kein Debounce.
export function flushSave(){
  state.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){}
  clearTimeout(_saveTimer); _saveTimer = null;
  _flushRemote();
}

// ---- Reset: löscht NUR den Eintrag des eingeloggten Accounts -----------
export function resetState(){
  clearTimeout(_saveTimer); _saveTimer = null;
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
  if(userKey){ remove(ref(db, dbPath())).catch(e=>console.warn('Firebase-Reset fehlgeschlagen', e)); }
  state = freshState();
  nextId = 1;
  return state;
}
