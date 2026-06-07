/* =====================================================================
   STATE & PERSISTENZ. Live-Bindings: `state`/`nextId` werden hier
   (re)zugewiesen, Importeure sehen die aktuelle Referenz automatisch.

   Mehr-Charakter-System: Pro Spieler ein ROSTER aus mehreren Slots –
   jeder Slot ist ein vollständiger, eigenständiger Spielstand. `state`
   zeigt stets auf den aktiven Slot, sodass die gesamte Spiel-Logik
   unverändert mit einem flachen State arbeitet.
     Speicherform unter /adventure/<userKey>:
       { version, activeId, slots: { id: <Spielstand> } }
   Persistenz: Firebase Realtime DB als Quelle, localStorage als Cache.
   ===================================================================== */
import { SAVE_KEY, SAVE_VERSION, MAX_CHARACTERS } from '../data/tuning.js';
import { SLOTS } from '../data/slots.js';
import { defaultTypeKey, typeOf, itemDisplayName, materialOf } from '../data/itemTypes.js';
import { buildItemSVG, elementOf } from './item-art.js';
import { isValidChoice } from '../data/talents.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { blankMaterials } from '../data/materials.js';
import { db, ref, get, set, remove } from './firebase.js';

export let state = null;        // aktiver Slot (flacher Spielstand)
export let nextId = 1;
export function nextItemId(){ return nextId++; }

let roster = null;              // { version, activeId, slots:{id:state} }

// Eingeloggter Spieler-Schlüssel ('andreas'/'nele') – beim Laden gesetzt.
let userKey = null;
const dbPath = () => 'adventure/' + userKey;

function genId(){ return 'c_' + Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-3); }

function blankStats(){
  return { createdAt: Date.now(), goldEarned: 0, bossKills: 0, farmKills: 0,
           bestItemValue: 0, drops: { gewoehnlich:0, ungewoehnlich:0, selten:0,
           episch:0, legendaer:0, mythisch:0 }, expeditionsDone: 0,
           duelWins: 0, duelLosses: 0 };
}

export function freshState(){
  const eq = {}; Object.keys(SLOTS).forEach(s => eq[s] = null);
  return {
    version: SAVE_VERSION, zone:0, zoneFinds:0, equipped:eq, inventory:[],
    lastTick:Date.now(), log:[], totalFinds:0, gold:0, bossesBeaten:0,
    xp:0, level:1, potions:0, character:null, expedition:null,
    towerFloor:1,          // aktuelles Turm-Stockwerk (Fortsetzen über Sessions)
    firstClears:{},        // bossIndex -> true (#16)
    killCounts:{},         // bossIndex -> Anzahl Siege
    lockedIds:[],          // gesperrte Item-Ids (#24)
    extraSlots:0,          // beim Händler gekaufte Zusatz-Inventarplätze (Vielfaches von 5)
    stats: blankStats(),   // Statistiken (#28)
    materials: blankMaterials(), // Crafting-Materialien (Schmiede)
    pendingLoot: [],       // bei vollem Inventar gewonnene Items (warten auf Platz)
    settings:{ seenOnboarding:false }, // (#29)
  };
}

// Frisches Roster mit genau einem leeren Slot (erzwingt Charaktererstellung).
function freshRoster(){
  const id = genId();
  return { version: SAVE_VERSION, activeId: id, slots: { [id]: freshState() } };
}

// Defensive Feld-Ergänzung eines einzelnen Slots (ohne Versions-Reset – der
// passiert auf Roster-Ebene). Härtet gegen RTDB-Serialisierung (null/leere
// Container gehen beim Schreiben verloren und werden hier rekonstruiert).
// Tragbarkeits-Check für die Migration (entspricht canEquip in items.js,
// arbeitet aber direkt mit dem Klassen-Objekt statt dem globalen State).
function unwearableForClass(item, cls){
  if(!item || !cls) return false;
  // Nebenhand: Orb → Heiler/Hexer, Zweitklinge → Schurke, Schild → Verteidiger.
  if(item.slotKey === 'schild'){
    const art = typeOf(item).art || 'schild';
    if(art === 'orb')   return cls.damageSchool !== 'magisch';
    if(art === 'waffe') return cls.id !== 'schurke';
    return cls.id !== 'verteidiger';
  }
  if(item.slotKey === 'waffe'){
    const isStaff = materialOf(item) === 'zauberstab';
    return cls.damageSchool === 'magisch' ? !isStaff : isStaff;
  }
  const mat = materialOf(item);
  if(!mat) return false;
  return !(cls.allowedMaterials || []).includes(mat);
}
function migrateSlot(s){
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
  // Item-Namen neu berechnen → korrigiert deutsche Adjektiv-Deklination auch
  // in bestehenden Spielständen (Namen werden gespeichert, nicht live gebaut).
  const fixName = it => { if(it && it.slotKey) it.name = itemDisplayName(it.rarity, typeOf(it)); };
  s.inventory.forEach(fixName);
  Object.values(s.equipped).forEach(fixName);
  if(!Array.isArray(s.log)) s.log = [];
  if(!s.firstClears || typeof s.firstClears !== 'object') s.firstClears = {};
  if(!s.killCounts || typeof s.killCounts !== 'object') s.killCounts = {};
  if(!Array.isArray(s.lockedIds)) s.lockedIds = [];
  if(typeof s.extraSlots !== 'number') s.extraSlots = 0;
  // Turm-Stockwerk defensiv ergänzen – ohne diese Migration ist towerFloor kein
  // bekanntes Save-Feld und geht über Sessions/Seiten verloren (Bug: Turm startet
  // wieder bei Stockwerk 1, obwohl ein Boss besiegt wurde).
  if(typeof s.towerFloor !== 'number' || s.towerFloor < 1) s.towerFloor = 1;
  // Crafting-Materialien (Schmiede) defensiv ergänzen (RTDB verwirft 0-Felder
  // nicht, aber Altstände haben das Feld gar nicht). Kein Versions-Bump nötig –
  // migrateSlot läuft bei jedem Laden, sodass bestehende Stände unangetastet
  // weiterlaufen und das Feld einfach hinzubekommen.
  if(!s.materials || typeof s.materials !== 'object') s.materials = blankMaterials();
  else { const b = blankMaterials(); s.materials = Object.assign(b, s.materials); }
  // Ausstehende Beute (bei vollem Inventar gewonnene Items) defensiv ergänzen.
  if(!Array.isArray(s.pendingLoot)) s.pendingLoot = [];
  s.pendingLoot.forEach(fixName);
  if(!s.stats || typeof s.stats !== 'object') s.stats = blankStats();
  else { const b = blankStats(); s.stats = Object.assign(b, s.stats);
         s.stats.drops = Object.assign(b.drops, s.stats.drops||{}); }
  if(!s.settings || typeof s.settings !== 'object') s.settings = { seenOnboarding:false };
  // Talentbaum-/Charakterfelder defensiv ergänzen.
  if(s.character && typeof s.character === 'object'){
    // Klassen-Umbenennung: der frühere "Kämpfer" ist jetzt der "Schurke".
    // Altstände auf die neue Klassen-Id heben (vor der Talent-Validierung,
    // damit alte Kämpfer-Talente sauber als ungültig erkannt und zurück-
    // erstattet werden).
    if(s.character.classId === 'kaempfer') s.character.classId = 'schurke';
    if(typeof s.character.name !== 'string') s.character.name = '';
    // Bart-Felder defensiv ergänzen (Altstände → bartlos).
    if(typeof s.character.beardId !== 'string') s.character.beardId = 'kein';
    if(typeof s.character.beardColor !== 'string') s.character.beardColor = '#6b3f1d';
    if(!s.character.talents || typeof s.character.talents !== 'object') s.character.talents = {};
    if(typeof s.character.talentPoints !== 'number'){
      s.character.talentPoints = Math.floor((s.level||1) / 5);
    }
    // Talent-Migration: nach Baum-Umbau ungültige Wahlen entfernen und die
    // dafür ausgegebenen Punkte zurückerstatten (kein manueller Respec nötig).
    const cid = s.character.classId;
    if(cid){
      let refunded = 0;
      for(const k of Object.keys(s.character.talents)){
        const idx = parseInt(k, 10);
        if(!isValidChoice(cid, idx, s.character.talents[k])){
          delete s.character.talents[k];
          refunded++;
        }
      }
      if(refunded > 0) s.character.talentPoints = (s.character.talentPoints||0) + refunded;
    }
  }
  for(let i=0;i<s.zone;i++){ if(!s.firstClears[i]) s.firstClears[i] = true; }
  // Klassen-Regel-Migration: nach der Tragbarkeits-Verschärfung (nur Verteidiger
  // → Schild, magische Klassen → nur Zauberstäbe, physische → nur phys. Waffen)
  // jetzt unzulässige, angelegte Items sicher zurück ins Inventar legen.
  const cls = s.character && CLASS_BY_ID[s.character.classId];
  if(cls){
    for(const k of Object.keys(s.equipped)){
      const it = s.equipped[k];
      if(it && unwearableForClass(it, cls)){ s.inventory.push(it); s.equipped[k] = null; }
    }
  }
  s.version = SAVE_VERSION;
  return s;
}

// Baut aus dem geladenen Rohwert ein gültiges Roster. Altformat (flacher
// Spielstand) oder veraltete Version ⇒ kompletter Neustart (bewusst, v7).
function buildRoster(loaded){
  if(!loaded || typeof loaded !== 'object') return freshRoster();
  if(typeof loaded.version !== 'number' || loaded.version < SAVE_VERSION
     || !loaded.slots || typeof loaded.slots !== 'object'){
    return freshRoster();
  }
  const slots = {};
  for(const id of Object.keys(loaded.slots)){
    const sl = loaded.slots[id];
    if(sl && typeof sl === 'object') slots[id] = migrateSlot(sl);
  }
  const ids = Object.keys(slots);
  if(!ids.length) return freshRoster();
  const activeId = (loaded.activeId && slots[loaded.activeId]) ? loaded.activeId : ids[0];
  return { version: SAVE_VERSION, activeId, slots };
}

// Items des AKTIVEN Slots defaulten + nextId ableiten + Sprite neu berechnen.
function hydrateItems(){
  const exp = (state.expedition && Array.isArray(state.expedition.items)) ? state.expedition.items : [];
  const pend = Array.isArray(state.pendingLoot) ? state.pendingLoot : [];
  const all = [...state.inventory, ...Object.values(state.equipped).filter(Boolean), ...exp, ...pend];
  nextId = all.reduce((m,it)=>Math.max(m, it.id||0), 0) + 1;
  for(const it of all){
    if(!it.affixes) it.affixes = {};
    if(!it.itemType) it.itemType = defaultTypeKey(it.slotKey);
    const t = typeOf(it);
    // Variante folgt dem Typ → Typ-Updates wirken rückwirkend auf alte Stände.
    it.variant = t.variant;
    // art aus dem Item-Typ (Nebenhand: schild/waffe/orb), Fallback = Slot-art.
    // (Vorher fälschlich nur die Slot-art → Nebenhand-Waffen/Kugeln wurden beim
    //  Laden als Schild neu gerendert.)
    const art = t.art || (SLOTS[it.slotKey] && SLOTS[it.slotKey].art) || it.slotKey;
    it.sprite = buildItemSVG(art, it.variant, it.rarity, elementOf(it.id), t.orb, t.material);
  }
}

// Speicher-Snapshot ohne (ableitbare) Item-Sprites → kein Save-Bloat.
function stripItem(it){ if(!it) return it; const { sprite, ...rest } = it; return rest; }
function stripState(s){
  const eq = {}; Object.keys(s.equipped||{}).forEach(k => eq[k] = stripItem(s.equipped[k]));
  const data = { ...s, inventory: (s.inventory||[]).map(stripItem), equipped: eq };
  if(Array.isArray(s.pendingLoot)) data.pendingLoot = s.pendingLoot.map(stripItem);
  if(s.expedition && Array.isArray(s.expedition.items)){
    data.expedition = { ...s.expedition, items: s.expedition.items.map(stripItem) };
  }
  return data;
}
function saveData(){
  roster.slots[roster.activeId] = state;     // aktiven Slot synchronisieren
  const slots = {};
  for(const id of Object.keys(roster.slots)) slots[id] = stripState(roster.slots[id]);
  return { version: roster.version, activeId: roster.activeId, slots };
}

function parseLocal(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
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
  roster = buildRoster(loaded);
  state = roster.slots[roster.activeId];
  hydrateItems();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch(e){}
  return state;
}

// ---- Speichern: sofort lokal, debounced nach Firebase ------------------
let _saveTimer = null, _saveInFlight = false, _savePending = false;

async function _flushRemote(){
  if(!userKey) return;
  if(_saveInFlight){ _savePending = true; return; }
  _saveInFlight = true;
  try {
    await set(ref(db, dbPath()), saveData());
    while(_savePending){ _savePending = false; await set(ref(db, dbPath()), saveData()); }
  } catch(e){ console.warn('Firebase-Speichern fehlgeschlagen', e); }
  finally { _saveInFlight = false; }
}

export function saveState(){
  state.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch(e){}
  if(!userKey) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{ _saveTimer = null; _flushRemote(); }, 1500);
}

// Sofortiges Schreiben (Seitenwechsel/Schließen) – kein Debounce.
export function flushSave(){
  state.lastTick = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch(e){}
  clearTimeout(_saveTimer); _saveTimer = null;
  _flushRemote();
}

// ---- Reset: löscht NUR den Eintrag des eingeloggten Accounts -----------
export function resetState(){
  clearTimeout(_saveTimer); _saveTimer = null;
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
  if(userKey){ remove(ref(db, dbPath())).catch(e=>console.warn('Firebase-Reset fehlgeschlagen', e)); }
  roster = freshRoster();
  state = roster.slots[roster.activeId];
  nextId = 1;
  return state;
}

// ---- Mehr-Charakter-API --------------------------------------------
// Übersicht aller Charaktere (für die Roster-UI).
export function listCharacters(){
  return Object.keys(roster.slots).map(id => {
    const s = roster.slots[id];
    const ch = s.character;
    return {
      id,
      name: (ch && ch.name) ? ch.name : '',
      classId: ch ? ch.classId : null,
      gender: ch ? ch.gender : null,
      level: s.level || 1,
      hasChar: !!ch,
      isActive: id === roster.activeId,
    };
  });
}
export function characterCount(){ return Object.keys(roster.slots).length; }
export function canAddCharacter(){ return characterCount() < MAX_CHARACTERS; }
export function activeCharId(){ return roster.activeId; }

// Neuen, leeren Charakter-Slot anlegen und aktiv schalten (startet bei 0).
export function createCharacter(){
  if(!canAddCharacter()) return null;
  const id = genId();
  roster.slots[id] = freshState();
  roster.activeId = id;
  state = roster.slots[id];
  nextId = 1;
  saveState();
  return id;
}

// Zwischen Charakteren wechseln.
export function switchCharacter(id){
  if(!roster.slots[id] || id === roster.activeId) return false;
  roster.slots[roster.activeId] = state;   // aktuellen Stand sichern
  roster.activeId = id;
  state = roster.slots[id];
  hydrateItems();
  saveState();
  return true;
}

// Charakter löschen (nie der letzte verbleibende).
export function deleteCharacter(id){
  const ids = Object.keys(roster.slots);
  if(ids.length <= 1 || !roster.slots[id]) return false;
  delete roster.slots[id];
  if(roster.activeId === id){
    roster.activeId = Object.keys(roster.slots)[0];
    state = roster.slots[roster.activeId];
    hydrateItems();
  }
  saveState();
  return true;
}
