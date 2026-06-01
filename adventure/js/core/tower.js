/* =====================================================================
   TURM DES WAHNSINNS – Multiplayer-Koop-Modus.
   Lobby-Verwaltung + Kampf-Engine (Host-gesteuert, RTDB-synchronisiert).
   ===================================================================== */
import { db, ref, get, set, update, remove, push, onValue, onDisconnect } from './firebase.js';
import { COMBAT } from '../data/tuning.js';
import { AFFIX_KEYS } from '../data/affixes.js';
import { CLASS_BY_ID, DEFAULT_CLASS_ID, abilityOf } from '../data/classes.js';
import { materialOf } from '../data/itemTypes.js';
import { applyTalents } from '../data/talents.js';
import { levelBonus, heroTier } from './character.js';
import { powerOfBundle } from './items.js';
import { buildBossSVG } from './boss-art.js';
import { buildZoneBgSVG } from './zone-art.js';
import { fmtBig } from '../ui/dom.js';

const LOBBY_PATH  = id => 'tower/lobbies/' + id;
const COMBAT_PATH = id => 'tower/combat/'   + id;
const ABIL_PATH   = id => 'tower/abil/'     + id;
const HEROES_PATH = id => 'tower/heroes/'   + id;

// ---- Turm-Boss-Skalierung ------------------------------------------
const TOWER_BASE_HP  = 700;
const TOWER_BASE_ATK = 14;
const TOWER_HP_SCALE = 1.75;
const TOWER_ATK_SCALE = 1.55;
const TOWER_ENRAGE_TURN = 40;
const FRONT_SHARE = 0.70;
const BACK_SHARE  = 0.30;

function getFloorMechanics(floor){
  const prog = [
    { at:3,  m:'wut' },
    { at:6,  m:'dornen' },
    { at:9,  m:'gift' },
    { at:12, m:'berserk' },
    { at:15, m:'regen' },
    { at:18, m:'frost' },
    { at:21, m:'feueratem' },
    { at:25, m:'eispanzer' },
    { at:30, m:'lebensentzug' },
    { at:35, m:'enrage' },
  ];
  return prog.filter(p => floor >= p.at).slice(-2).map(p => p.m);
}

const FLOOR_BOSS_NAMES = [
  'Turmwächter','Tormentor','Schattenjäger','Seelenverschlinger',
  'Blutfürst','Aschendämon','Kristallgolem','Nachtreaper',
  'Leere-Titan','Wahnsinns-Dämon',
];
function bossNameFor(floor){
  return FLOOR_BOSS_NAMES[(floor-1) % FLOOR_BOSS_NAMES.length] + ' ✦' + floor;
}

export function towerBossFor(floor){
  const mechs = getFloorMechanics(floor);
  const sprVariants = [3, 4, 0, 4, 3]; // dragon/elemental rotation
  const spr  = sprVariants[(floor-1) % sprVariants.length];
  const area  = 6 + ((floor-1) % 2); // Schattenreich (6) / Die Leere (9→ wraps at 9)
  const realArea = area > 9 ? 9 : area;
  const mechColor = mechs.length ? '#c93eff' : '#ff5a3c';
  return {
    name:   bossNameFor(floor),
    maxHp:  Math.round(TOWER_BASE_HP  * Math.pow(TOWER_HP_SCALE,  floor - 1)),
    atk:    Math.round(TOWER_BASE_ATK * Math.pow(TOWER_ATK_SCALE, floor - 1)),
    mechanic: mechs,
    sprite: buildBossSVG({ spr, area: realArea, zone: floor + 40, mechColor }),
    bg:     buildZoneBgSVG(floor % 2 === 0 ? 2 : 4), // Höhle / Eis alternierend
  };
}

// ---- Spieler-Stats aus Spielstand berechnen (ohne globalen State) -----
const SUM_KEYS = ['armor','damage','critPhys','critMagic','critDamage','maxHp',
                  'attackSpeed','lifesteal','dodge','block','versatility','thorns'];
export function computePlayerStats(s){
  const b = {}; SUM_KEYS.forEach(k => b[k] = 0);
  for(const it of Object.values(s.equipped || {})){
    if(!it) continue;
    if(it.statType === 'armor') b.armor += (it.stat || 0); else b.damage += (it.stat || 0);
    const a = it.affixes || {};
    for(const k of AFFIX_KEYS) b[k] += a[k] || 0;
  }
  b.critPhys    = Math.min(0.60, b.critPhys);
  b.critMagic   = Math.min(0.60, b.critMagic);
  b.attackSpeed = Math.min(0.60, b.attackSpeed);
  b.lifesteal   = Math.min(0.40, b.lifesteal);
  b.dodge       = Math.min(0.35, b.dodge);
  b.versatility = Math.min(0.30, b.versatility);
  const lb = levelBonus(s.level || 1);
  b.armor  += lb.armor;
  b.damage += lb.dmg;
  b.maxHp  += lb.hp;
  applyTalents(s, b);   // Talentbaum-Effekte (no-op solange leer)
  b.power   = powerOfBundle(b);

  const cls = CLASS_BY_ID[s && s.character && s.character.classId] || CLASS_BY_ID[DEFAULT_CLASS_ID];
  const school = cls.damageSchool;
  const activeCrit = school === 'magisch' ? (b.critMagic || 0) : (b.critPhys || 0);
  const maxHp   = COMBAT.heroBaseHp + b.armor * COMBAT.heroHpPerArmor + b.maxHp;
  const atk     = Math.round((COMBAT.heroBaseAtk + b.damage) * (1 + (b.versatility || 0)) * cls.dmgMult);
  const critChance = COMBAT.heroBaseCrit + activeCrit;
  const critMult   = COMBAT.heroBaseCritMult + (b.critDamage || 0);
  const interval   = Math.max(COMBAT.swingMinMs, COMBAT.swingBaseMs * (1 - b.attackSpeed));
  const lifesteal  = (b.lifesteal || 0) * cls.healMult;
  const usesStab   = !!(s.equipped && s.equipped.waffe && materialOf(s.equipped.waffe) === 'zauberstab');

  return {
    maxHp, atk, critChance, critMult, interval,
    armor: b.armor, dodge: b.dodge || 0, block: b.block || 0,
    versatility: b.versatility || 0, lifesteal,
    thorns: b.thorns || 0, power: b.power,
    classId: cls.id, healMult: cls.healMult,
    tier: heroTier(b.power), level: s.level || 1,
    character: s.character, usesStab,
  };
}

// ---- Lobby-Verwaltung -----------------------------------------------
// Wunsch-Code säubern: Firebase-Keys dürfen . $ # [ ] / nicht enthalten.
export function sanitizeLobbyCode(code){
  return String(code || '').trim().replace(/[.$#\[\]\/\s]+/g, '-').slice(0, 40);
}

export async function createLobby(userKey, displayName, classId, desiredCode){
  let lobbyId;
  const code = sanitizeLobbyCode(desiredCode);
  if(code){
    // Selbst gewählter Code – darf nicht bereits vergeben sein.
    const exists = await get(ref(db, LOBBY_PATH(code)));
    if(exists.exists()) throw new Error('Code „' + code + '" ist bereits vergeben – wähle einen anderen.');
    lobbyId = code;
  } else {
    // Kein Code angegeben → zufälligen erzeugen.
    lobbyId = push(ref(db, 'tower/lobbies')).key;
  }
  await set(ref(db, LOBBY_PATH(lobbyId)), {
    host: userKey, hostName: displayName, hostClass: classId || DEFAULT_CLASS_ID,
    guest: null,   guestName: null,       guestClass: null,
    status: 'waiting', floor: 1,
    createdAt: Date.now(),
    hostReady: false, guestReady: false,
  });
  // Host-Disconnect → Lobby + Kampf-/Skill-Daten automatisch entfernen (B3, Aufräumen).
  armDisconnectCleanup(lobbyId);
  return lobbyId;
}

// Räumt Lobby, Kampf- und Skill-Knoten beim plötzlichen Verbindungsabbruch
// (Tab schließen, wegnavigieren, Absturz) automatisch auf, damit die DB
// nicht mit verwaisten Lobbies zugemüllt wird.
function armDisconnectCleanup(lobbyId){
  try {
    onDisconnect(ref(db, LOBBY_PATH(lobbyId))).remove();
    onDisconnect(ref(db, COMBAT_PATH(lobbyId))).remove();
    onDisconnect(ref(db, ABIL_PATH(lobbyId))).remove();
    onDisconnect(ref(db, HEROES_PATH(lobbyId))).remove();
  } catch(e){}
}

// Lobby vollständig entfernen (Lobby + Kampf + Skill-Knoten).
async function purgeLobby(lobbyId){
  try { await remove(ref(db, LOBBY_PATH(lobbyId)));  } catch(e){}
  try { await remove(ref(db, COMBAT_PATH(lobbyId))); } catch(e){}
  try { await remove(ref(db, ABIL_PATH(lobbyId)));   } catch(e){}
  try { await remove(ref(db, HEROES_PATH(lobbyId))); } catch(e){}
}

// ---- Helden-Aussehen (einmalig, damit der Partner korrekt gerendert wird) --
// Wird vom Host beim Kampfstart geschrieben; beide Clients bauen daraus die
// Sprites mit buildHeroSVG. Nur statische Aussehensdaten (character + equipped),
// kein Pro-Frame-Sync → kein Payload-Bloat im Kampf-Knoten.
export async function setTowerHeroes(lobbyId, front, back){
  try { await set(ref(db, HEROES_PATH(lobbyId)), { front: front || null, back: back || null }); } catch(e){}
}
export function listenHeroes(lobbyId, cb){
  return onValue(ref(db, HEROES_PATH(lobbyId)), snap => cb(snap.exists() ? snap.val() : null));
}

export async function joinLobby(lobbyId, userKey, displayName, classId){
  const snap = await get(ref(db, LOBBY_PATH(lobbyId)));
  if(!snap.exists()) throw new Error('Lobby nicht gefunden.');
  const lobby = snap.val();
  if(lobby.status === 'ended') throw new Error('Diese Lobby ist beendet.');
  if(lobby.guest && lobby.guest !== userKey) throw new Error('Lobby ist bereits voll.');
  if(lobby.host === userKey) throw new Error('Du bist bereits der Host.');
  await update(ref(db, LOBBY_PATH(lobbyId)), {
    guest: userKey, guestName: displayName, guestClass: classId || DEFAULT_CLASS_ID,
  });
  // Gast-Disconnect → Lobby ebenfalls aufräumen (B3, Aufräumen).
  armDisconnectCleanup(lobbyId);
  return lobby;
}

export function listenLobby(lobbyId, cb){
  return onValue(ref(db, LOBBY_PATH(lobbyId)), snap => cb(snap.exists() ? snap.val() : null));
}

export function listenCombat(lobbyId, cb){
  return onValue(ref(db, COMBAT_PATH(lobbyId)), snap => cb(snap.exists() ? snap.val() : null));
}

// ---- Skill-Aktivierung (jeder Spieler, host-validiert) -------------
// Ein Spieler fordert seine Klassen-Fähigkeit an. Der Host wendet sie an.
export async function requestAbility(lobbyId, slot, abilityId){
  try { await set(ref(db, ABIL_PATH(lobbyId)), { slot, ability: abilityId, ts: Date.now() }); } catch(e){}
}

export async function setReady(lobbyId, isHost, val = true){
  const field = isHost ? 'hostReady' : 'guestReady';
  await update(ref(db, LOBBY_PATH(lobbyId)), { [field]: val });
}

export async function leaveLobby(lobbyId){
  // Erst auf 'ended' setzen (der Partner erhält das Signal sofort), dann
  // den gesamten Lobby-Zweig löschen, damit keine Leichen zurückbleiben.
  try { await update(ref(db, LOBBY_PATH(lobbyId)), { status: 'ended' }); } catch(e){}
  await purgeLobby(lobbyId);
}

// Lädt den Spielstand des Gastes aus RTDB.
export async function loadGuestSave(guestKey){
  const snap = await get(ref(db, 'adventure/' + guestKey));
  if(!snap.exists()) throw new Error('Spielstand von ' + guestKey + ' nicht gefunden.');
  return snap.val();
}

// ---- Kampf-Engine (läuft nur beim Host) ----------------------------
let _fightTimer = null;
let _fight = null;
let _abilUnsub = null;

export function getCurrentFight(){ return _fight; }

function rnd(v){ return 1 + (Math.random()*2-1)*v; }

function rollDmg(atk, crit, mult){
  const isCrit = Math.random() < crit;
  return { dmg: Math.max(1, Math.round(atk * rnd(0.15) * (isCrit ? mult : 1))), crit: isCrit };
}

function takeBossDmg(atk, armor, dodge, versatility, block){
  if(Math.random() < (dodge || 0)) return { dmg:0, dodged:true };
  const armorRed = (armor || 0) * COMBAT.armorReduction + (block || 0);
  let dmg = Math.max(1, Math.round(atk * rnd(0.15) - armorRed));
  dmg = Math.round(dmg * (1 - (versatility || 0)));
  return { dmg };
}

function addLog(fight, text, color){
  const idx = fight.logCount++;
  fight.log[idx] = { t: text, c: color || '#cfc6dd' };
  if(idx > 50) delete fight.log[idx - 50];
}

async function syncFight(fight){
  const now = Date.now();
  const data = {
    floor:       fight.floor,
    bossHp:      Math.ceil(fight.bossHp),
    bossMaxHp:   fight.bossMaxHp,
    frontHp:     Math.ceil(fight.frontHp),
    frontMaxHp:  fight.frontMaxHp,
    frontName:   fight.frontName,
    frontTier:   fight.frontTier,
    frontStab:   fight.frontUsesStab || false,
    frontKey:    fight.frontKey || '',
    frontClass:  fight.frontClass || '',
    backHp:      Math.ceil(fight.backHp),
    backMaxHp:   fight.backMaxHp,
    backName:    fight.backName,
    backTier:    fight.backTier,
    backStab:    fight.backUsesStab  || false,
    backKey:     fight.backKey || '',
    backClass:   fight.backClass || '',
    turn:        fight.turn,
    dmgDealt:    fight.dmgDealt,
    startedAt:   fight.startedAt,
    log:         fight.log,
    // Pro-Runde-Angriffsereignisse für die Singleplayer-artigen Animationen (Lunge,
    // Treffer, Schadenszahlen) auf BEIDEN Clients. Kompakte Schlüssel halten die Payload klein.
    events:      fight.events || [],
    // Fähigkeits-Cooldown beider Slots als Restzeit (ms) zum Sync-Zeitpunkt –
    // drift-frei, da Host- und Gast-Uhr nicht identisch sind. Clients zählen lokal runter.
    frontCdRemain: Math.max(0, (fight.frontAbilUntil||0) - now),
    backCdRemain:  Math.max(0, (fight.backAbilUntil ||0) - now),
    // Aktive Skill-Effekte für die Animationen beider Spieler (B15).
    // Als RESTZEIT (ms) zum Sync-Zeitpunkt – driftfrei trotz abweichender
    // Geräteuhren (gleiches Muster wie die Cooldown-Badges). Jeder Client
    // rechnet beim Empfang eine lokale Endzeit aus und hält den Effekt so
    // flackerfrei und synchron sichtbar, unabhängig von der Sync-Frequenz.
    // Die alten Booleans bleiben für Rückwärtskompatibilität erhalten.
    fx: {
      ablazeFront: now < (fight.frontCritUntil||0),
      ablazeBack:  now < (fight.backCritUntil||0),
      shield:      now < (fight.groupDmgReduceUntil||0),
      ablazeFrontRemain: Math.max(0, (fight.frontCritUntil||0) - now),
      ablazeBackRemain:  Math.max(0, (fight.backCritUntil ||0) - now),
      shieldRemain:      Math.max(0, (fight.groupDmgReduceUntil||0) - now),
      healTs:      fight.lastHealTs || 0,
    },
    status:      fight.over ? (fight.won ? 'won' : 'lost') : 'fighting',
  };
  try { await set(ref(db, COMBAT_PATH(fight.lobbyId)), data); } catch(e){ console.warn('Sync error', e); }
  if(fight.onUpdate) fight.onUpdate(data);
}

export function startTowerFight(lobbyId, floor, frontStats, backStats, frontName, backName, onUpdate, keys){
  const boss = towerBossFor(floor);
  keys = keys || {};

  const fight = {
    lobbyId, floor, boss,
    bossMaxHp:  boss.maxHp,  bossHp:  boss.maxHp,
    bossAtkBase: boss.atk,   bossMech: boss.mechanic,
    frontMaxHp: frontStats.maxHp, frontHp: frontStats.maxHp,
    frontAtk:   frontStats.atk,  frontArmor: frontStats.armor,
    frontCrit:  frontStats.critChance, frontCritMult: frontStats.critMult,
    frontInterval: frontStats.interval, frontDodge: frontStats.dodge,
    frontVers:  frontStats.versatility, frontLifesteal: frontStats.lifesteal,
    frontBlock: frontStats.block || 0, frontThorns: frontStats.thorns || 0,
    frontHealMult: frontStats.healMult,
    frontIsHealer: frontStats.classId === 'heiler',
    frontUsesStab: frontStats.usesStab || false,
    frontName, frontTier: frontStats.tier,
    frontKey: keys.frontKey || '', frontClass: frontStats.classId || '',
    frontAbility: abilityOf(frontStats.classId),
    backMaxHp:  backStats.maxHp,  backHp: backStats.maxHp,
    backAtk:    backStats.atk,    backArmor: backStats.armor,
    backCrit:   backStats.critChance, backCritMult: backStats.critMult,
    backInterval:  backStats.interval, backDodge: backStats.dodge,
    backVers:   backStats.versatility, backLifesteal: backStats.lifesteal,
    backBlock:  backStats.block || 0, backThorns: backStats.thorns || 0,
    backIsHealer: backStats.classId === 'heiler',
    backHealMult: backStats.healMult,
    backUsesStab: backStats.usesStab || false,
    backName, backTier: backStats.tier,
    backKey: keys.backKey || '', backClass: backStats.classId || '',
    backAbility: abilityOf(backStats.classId),
    turn:0, over:false, won:false,
    enrageMult:1, berserkMult:1, poison:0, shieldTurns:0,
    speed:1, log:{}, logCount:0,
    startedAt: Date.now(), dmgDealt:0,
    // Skill-Status (B14)
    frontCritUntil:0, backCritUntil:0, groupDmgReduceUntil:0, lastHealTs:0,
    _lastAbilTs:0,
    onUpdate,
  };
  _fight = fight;
  // Host lauscht auf Skill-Anfragen beider Spieler.
  _abilUnsub = onValue(ref(db, ABIL_PATH(lobbyId)), snap => {
    if(!snap.exists()) return;
    const req = snap.val();
    if(!req || !req.ts || req.ts <= fight._lastAbilTs) return;
    fight._lastAbilTs = req.ts;
    applyAbility(fight, req.slot, req.ability);
  });
  syncFight(fight);
  scheduleExchange(fight);
}

// Host wendet eine angeforderte Klassen-Fähigkeit auf den Kampf an.
function applyAbility(fight, slot, abilityId){
  if(fight.over) return;
  const ab = (slot === 'front' ? fight.frontAbility : fight.backAbility);
  if(!ab || ab.id !== abilityId) return;
  const now = Date.now();
  // Cooldown pro Slot merken → wird in syncFight als Restzeit an beide Clients gesendet.
  if(slot === 'front') fight.frontAbilUntil = now + (ab.cd || 0);
  else                 fight.backAbilUntil  = now + (ab.cd || 0);
  if(ab.id === 'heilkreis'){
    if(fight.frontHp > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + Math.round(fight.frontMaxHp * ab.healPct));
    if(fight.backHp  > 0) fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + Math.round(fight.backMaxHp  * ab.healPct));
    fight.lastHealTs = now;
    addLog(fight, '➕ Heilkreis: alle Helden +'+Math.round(ab.healPct*100)+'% HP', '#37d67a');
  } else if(ab.id === 'raserei'){
    if(slot === 'front') fight.frontCritUntil = now + ab.dur; else fight.backCritUntil = now + ab.dur;
    addLog(fight, '🔥 '+(slot==='front'?fight.frontName:fight.backName)+' entfacht Raserei!', '#ff8a3d');
  } else if(ab.id === 'schildwall'){
    fight.groupDmgReduceUntil = now + ab.dur;
    fight.groupDmgReducePct   = ab.dmgReduce || 0;
    addLog(fight, '🛡️ Schildwall – Gruppe erleidet '+Math.round(ab.dmgReduce*100)+'% weniger Schaden!', '#7fd0ff');
  } else if(ab.kind === 'drain' || ab.kind === 'burst'){
    // Hexer-Grundfähigkeit (Seelenraub) & burst-Aktive: Sofortschaden am Boss.
    const atk = slot === 'front' ? fight.frontAtk : fight.backAtk;
    const dmg = Math.max(1, Math.round(atk * (ab.burstMult || 2)));
    fight.bossHp = Math.max(0, fight.bossHp - dmg);
    fight.dmgDealt += dmg;
    if(ab.kind === 'drain'){
      if(slot === 'front') fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + dmg);
      else                 fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + dmg);
    }
    addLog(fight, ab.icon+' '+ab.name+': '+dmg+' Schaden'+(ab.kind==='drain'?' (+Heilung)':''), '#ffd24a');
    if(fight.bossHp <= 0) fight.over = true;
  }
  syncFight(fight);
}

function scheduleExchange(fight){
  const iv = Math.min(fight.frontInterval, fight.backInterval || fight.frontInterval);
  _fightTimer = setTimeout(() => exchange(fight), iv / fight.speed);
}

function exchange(fight){
  if(fight.over) return;
  fight.turn++;

  // Angriffsereignisse dieser Runde – werden über syncFight an beide Clients gesendet,
  // die sie als Singleplayer-artige Animationen abspielen. Pro Runde frisch.
  const events = [];

  const mechs = fight.bossMech || [];

  // Regeneration
  if(mechs.includes('regen') && fight.turn % 3 === 0){
    const heal = Math.round(fight.bossMaxHp * 0.04);
    fight.bossHp = Math.min(fight.bossMaxHp, fight.bossHp + heal);
    addLog(fight, '➕ Boss regeneriert ' + fmtBig(heal) + ' HP', '#37d67a');
  }
  // Berserk
  if(mechs.includes('berserk')) fight.berserkMult *= 1.03;
  // Frost → slow (handled via longer interval this turn)
  const frosted = mechs.includes('frost') && fight.turn % 3 === 0;

  // Skill: Raserei-Krit-Boost (B14)
  const now = Date.now();
  const fCritBonus = (now < (fight.frontCritUntil||0) && fight.frontAbility) ? (fight.frontAbility.critBonus||0) : 0;
  const bCritBonus = (now < (fight.backCritUntil ||0) && fight.backAbility)  ? (fight.backAbility.critBonus ||0) : 0;
  const effFrontCrit = Math.min(1, fight.frontCrit + fCritBonus);
  const effBackCrit  = Math.min(1, fight.backCrit  + bCritBonus);

  // ---- Vorne: heilt den Partner bei < 35% (Heiler) oder schlägt den Boss ---
  if(fight.frontHp > 0){
    const backLow = fight.backHp > 0 && fight.backHp < fight.backMaxHp * 0.35;
    if(fight.frontIsHealer && backLow){
      const healAmt = Math.round(fight.frontAtk * 2.0 * (fight.frontHealMult || 1));
      fight.backHp = Math.min(fight.backMaxHp, fight.backHp + healAmt);
      addLog(fight, '💚 ' + fight.frontName + ' heilt ' + fight.backName + ': +' + fmtBig(healAmt) + ' HP', '#37d67a');
      events.push({ s:'front', t:'back', d:healAmt, h:1 });
    } else {
      const { dmg: fd, crit: fc } = rollDmg(fight.frontAtk, effFrontCrit, fight.frontCritMult);
      fight.bossHp = Math.max(0, fight.bossHp - fd);
      fight.dmgDealt += fd;
      addLog(fight, '⚔️ ' + fight.frontName + (fc?' ✨KRIT':'') + ': -' + fmtBig(fd) + ' HP', fc ? '#ffd24a' : '#cfc6dd');
      events.push({ s:'front', t:'boss', d:fd, ...(fc?{c:1}:{}), ...(fight.frontUsesStab?{p:1}:{}) });
      // Dornen reflektiert
      if(mechs.includes('dornen')){
        const refl = Math.max(1, Math.round(fd * 0.15));
        fight.frontHp = Math.max(0, fight.frontHp - refl);
        addLog(fight, '🌵 Dornen: -' + refl, '#9acd32');
      }
      // Lifesteal
      if(fight.frontLifesteal > 0){
        const h = Math.round(fd * fight.frontLifesteal);
        if(h > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + h);
      }
      // Dornen-Affix: flacher Bonusschaden an den Boss (analog Solo-Kampf).
      if(fight.frontThorns > 0){ fight.bossHp = Math.max(0, fight.bossHp - fight.frontThorns); fight.dmgDealt += fight.frontThorns; }
    }
  }

  // ---- Hinten: heilt bei < 35% oder greift an ---
  if(fight.backHp > 0){
    const frontLow = fight.frontHp > 0 && fight.frontHp < fight.frontMaxHp * 0.35;
    if(fight.backIsHealer && frontLow){
      const healAmt = Math.round(fight.backAtk * 2.0 * (fight.backHealMult || 1));
      fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + healAmt);
      addLog(fight, '💚 ' + fight.backName + ' heilt ' + fight.frontName + ': +' + fmtBig(healAmt) + ' HP', '#37d67a');
      events.push({ s:'back', t:'front', d:healAmt, h:1 });
    } else {
      const { dmg: bd, crit: bc } = rollDmg(fight.backAtk, effBackCrit, fight.backCritMult);
      fight.bossHp = Math.max(0, fight.bossHp - bd);
      fight.dmgDealt += bd;
      const icon = fight.backIsHealer ? '✨' : '⚔️';
      addLog(fight, icon + ' ' + fight.backName + (bc?' ✨KRIT':'') + ': -' + fmtBig(bd) + ' HP', bc ? '#ffd24a' : '#cfc6dd');
      events.push({ s:'back', t:'boss', d:bd, ...(bc?{c:1}:{}), ...(fight.backUsesStab?{p:1}:{}) });
      if(mechs.includes('dornen')){
        const refl = Math.max(1, Math.round(bd * 0.15));
        fight.backHp = Math.max(0, fight.backHp - refl);
        addLog(fight, '🌵 Dornen: -' + refl, '#9acd32');
      }
      if(fight.backLifesteal > 0){
        const h = Math.round(bd * fight.backLifesteal);
        if(h > 0) fight.backHp = Math.min(fight.backMaxHp, fight.backHp + h);
      }
      // Dornen-Affix: flacher Bonusschaden an den Boss (analog Solo-Kampf).
      if(fight.backThorns > 0){ fight.bossHp = Math.max(0, fight.bossHp - fight.backThorns); fight.dmgDealt += fight.backThorns; }
    }
  }

  // Sieg?
  if(fight.bossHp <= 0){
    fight.over = true; fight.won = true;
    addLog(fight, '🏆 Sieg! Stockwerk ' + fight.floor + ' gemeistert!', '#ffd24a');
    clearTimeout(_fightTimer);
    fight.events = events;
    syncFight(fight);
    return;
  }

  // ---- Boss schlägt zurück (nach Delay) ---
  setTimeout(async () => {
    if(fight.over) return;

    // Eispanzer
    if(mechs.includes('eispanzer') && fight.turn % 5 === 0){ fight.shieldTurns = 2; addLog(fight, '🛡️ Eispanzer aktiv!', '#7fd0ff'); }
    if(fight.shieldTurns > 0){ fight.shieldTurns--; }

    // Boss-ATK
    let bossAtk = fight.bossAtkBase * fight.berserkMult;
    if(mechs.includes('wut') && fight.bossHp < fight.bossMaxHp * 0.3) bossAtk *= 1.5;
    if(fight.turn > TOWER_ENRAGE_TURN){
      fight.enrageMult *= 1.07;
      if(fight.turn === TOWER_ENRAGE_TURN + 1) addLog(fight, '⏱️ ENRAGE! Boss wird tödlicher!', '#ff3b3b');
    }
    bossAtk *= fight.enrageMult;

    // Feueratem (ignoriert Rüstung alle 4 Runden)
    const breathTurn = mechs.includes('feueratem') && fight.turn % 4 === 0;
    if(breathTurn) addLog(fight, '🔥 Feueratem!', '#ff8a3d');

    const frontDead = fight.frontHp <= 0;

    // Skill: Schildwall reduziert Gruppen-Schaden (B14)
    const wallFactor = Date.now() < (fight.groupDmgReduceUntil||0) ? (1 - (fight.groupDmgReducePct||0)) : 1;

    // Front-Treffer
    if(!frontDead){
      const effArmorFront = breathTurn ? 0 : fight.frontArmor;
      const effBlockFront = breathTurn ? 0 : fight.frontBlock;
      const effAtkFront   = fight.shieldTurns > 0 ? bossAtk * 0.4 * FRONT_SHARE : bossAtk * FRONT_SHARE;
      let { dmg: fd, dodged: dFront } = takeBossDmg(effAtkFront, effArmorFront, fight.frontDodge, fight.frontVers, effBlockFront);
      if(fd > 0 && wallFactor < 1) fd = Math.max(1, Math.round(fd * wallFactor));
      if(dFront){
        addLog(fight, '💨 ' + fight.frontName + ' weicht aus!', '#9ec5ff');
        events.push({ s:'boss', t:'front', o:1 });
      } else if(fd > 0){
        fight.frontHp = Math.max(0, fight.frontHp - fd);
        addLog(fight, '💥 Boss → ' + fight.frontName + ': -' + fmtBig(fd) + ' HP', '#ff6b6b');
        events.push({ s:'boss', t:'front', d:fd });
        // Gift
        if(mechs.includes('gift')){
          fight.poison++;
          const dot = 2 * fight.poison;
          fight.frontHp = Math.max(0, fight.frontHp - dot);
          addLog(fight, '☠️ Gift: -' + dot, '#9b59b6');
        }
        // Lebensentzug
        if(mechs.includes('lebensentzug')){
          const lheal = Math.round(fd * 0.4);
          fight.bossHp = Math.min(fight.bossMaxHp, fight.bossHp + lheal);
          addLog(fight, '🩸 Lebensentzug: +' + fmtBig(lheal), '#37d67a');
        }
      }
    }

    // Hinten-Treffer (voller Schaden wenn Front tot)
    const backShare = frontDead ? 1.0 : BACK_SHARE;
    const effAtkBack = fight.shieldTurns > 0 ? bossAtk * 0.4 * backShare : bossAtk * backShare;
    const effArmorBack = breathTurn ? 0 : fight.backArmor;
    const effBlockBack = breathTurn ? 0 : fight.backBlock;
    let { dmg: bd, dodged: dBack } = takeBossDmg(effAtkBack, effArmorBack, fight.backDodge, fight.backVers, effBlockBack);
    if(bd > 0 && wallFactor < 1) bd = Math.max(1, Math.round(bd * wallFactor));
    if(dBack){
      addLog(fight, '💨 ' + fight.backName + ' weicht aus!', '#9ec5ff');
      events.push({ s:'boss', t:'back', o:1 });
    } else if(bd > 0){
      fight.backHp = Math.max(0, fight.backHp - bd);
      addLog(fight, '💥 Boss → ' + fight.backName + ': -' + fmtBig(bd) + ' HP', '#ff6b6b');
      events.push({ s:'boss', t:'back', d:bd });
    }

    // Frost → nächste Runde verlangsamt (über erhöhtes Interval)
    if(frosted) addLog(fight, '❄️ Frost! Angriff verlangsamt.', '#7fd0ff');

    fight.events = events;
    await syncFight(fight);

    // Niederlage?
    if(fight.frontHp <= 0 && fight.backHp <= 0){
      fight.over = true; fight.won = false;
      addLog(fight, '💀 Beide Helden gefallen. Der Turm wird euch ewig heimsuchen…', '#ff6b6b');
      clearTimeout(_fightTimer);
      syncFight(fight);
      return;
    }

    const ivFactor = frosted ? 1.4 : 1.0;
    _fightTimer = setTimeout(() => exchange(fight), (fight.frontInterval * ivFactor) / fight.speed);
  }, COMBAT.bossReplyMs / fight.speed);
}

export function setFightSpeed(v){
  if(_fight) _fight.speed = v;
}

export function stopFight(){
  clearTimeout(_fightTimer);
  if(_abilUnsub){ _abilUnsub(); _abilUnsub = null; }
  if(_fight) _fight.over = true;
  _fight = null;
}

export async function advanceFloor(lobbyId){
  const snap = await get(ref(db, LOBBY_PATH(lobbyId)));
  if(!snap.exists()) return 1;
  const lobby = snap.val();
  const next = (lobby.floor || 1) + 1;
  await update(ref(db, LOBBY_PATH(lobbyId)), { floor: next, hostReady: false, guestReady: false, status: 'waiting' });
  await set(ref(db, COMBAT_PATH(lobbyId)), null);
  await set(ref(db, ABIL_PATH(lobbyId)), null);
  return next;
}
