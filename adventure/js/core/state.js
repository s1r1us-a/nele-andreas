/* =====================================================================
   STATE & PERSISTENZ. Live-Bindings: `state`/`nextId` werden hier
   (re)zugewiesen, Importeure sehen die aktuelle Referenz automatisch.
   Phase 0 (#3): Save-Versionierung & Migration.
   ===================================================================== */
import { SAVE_KEY, SAVE_VERSION } from '../data/tuning.js';
import { SLOTS } from '../data/slots.js';

export let state = null;
export let nextId = 1;
export function nextItemId(){ return nextId++; }

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
function migrate(s){
  if(typeof s.gold !== 'number') s.gold = 0;
  if(typeof s.bossesBeaten !== 'number') s.bossesBeaten = 0;
  if(typeof s.xp !== 'number') s.xp = 0;
  if(typeof s.level !== 'number') s.level = 1;
  if(typeof s.potions !== 'number') s.potions = 0;
  if(!('character' in s)) s.character = null;
  if(!('expedition' in s)) s.expedition = null;
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

export function loadSave(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw){ state = freshState(); return state; }
    const s = JSON.parse(raw);
    if(!s || typeof s.version !== 'number'){ state = freshState(); return state; }
    state = migrate(s);
    // höchste vorhandene id ermitteln, damit neue ids kollisionsfrei sind
    const all = [...state.inventory, ...Object.values(state.equipped).filter(Boolean)];
    nextId = all.reduce((m,it)=>Math.max(m, it.id||0), 0) + 1;
    for(const it of all){ if(!it.affixes) it.affixes = {}; }
    return state;
  } catch(e){ console.warn('Save defekt, neu gestartet', e); state = freshState(); return state; }
}

export function saveState(){
  state.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){}
}

export function resetState(){
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
  state = freshState();
  nextId = 1;
  return state;
}
