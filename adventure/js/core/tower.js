/* =====================================================================
   TURM DES WAHNSINNS – Solo ODER Koop.
   Lobby-Verwaltung + Kampf-Engine (Host-gesteuert, RTDB-synchronisiert).
   Solo: nur der Front-Held; der Boss bleibt gleich stark, trifft aber nur ihn.
   Koop: tritt der Partner einer Wartelobby bei, gilt der Spielstand des Hosts.
   ===================================================================== */
import { db, ref, get, set, update, remove, push, runTransaction, onValue, onDisconnect } from './firebase.js';
import { COMBAT, TOWER } from '../data/tuning.js';
import { bossFor } from '../data/bosses.js';
import { AFFIX_KEYS } from '../data/affixes.js';
import { CLASS_BY_ID, DEFAULT_CLASS_ID, abilityOf, ability2Of, abilitiesOf } from '../data/classes.js';
import { materialOf } from '../data/itemTypes.js';
import { applyTalents } from '../data/talents.js';
import { levelBonus, heroTier } from './character.js';
import { powerOfBundle, rollItem } from './items.js';
import { rarityByIndex } from '../data/rarities.js';
import { buildBossSVG } from './boss-art.js';
import { buildZoneBgSVG } from './zone-art.js';
import { fmtBig } from '../ui/dom.js';

const LOBBY_PATH  = id => 'tower/lobbies/' + id;
const COMBAT_PATH = id => 'tower/combat/'   + id;
const ABIL_PATH   = id => 'tower/abil/'     + id;
const HEROES_PATH = id => 'tower/heroes/'   + id;

// ---- Turm-Boss-Skalierung ------------------------------------------
// Turm-Bosse koppeln an die normale Boss-Kurve (bossFor(floor-1)) und werden per
// stockwerksabhängigem Multiplikator IMMER härter als der gleichnamige Normal-Boss;
// der Abstand wächst mit dem Stockwerk (echtes Endgame-Ziel). Im Koop teilen sich
// zwei Helden den Schaden, im Solo nimmt der eine Held alles ab.
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
  // An die normale Boss-Kurve ankoppeln: Turm ist per Konstruktion härter als der
  // gleichnamige Normal-Boss; der Abstand wächst linear mit dem Stockwerk.
  const base    = bossFor(floor - 1);             // zone 0-indexiert: Floor 1 → Boss 1
  const hpMult  = TOWER.hpMultBase  + TOWER.hpMultPer  * (floor - 1);
  const atkMult = TOWER.atkMultBase + TOWER.atkMultPer * (floor - 1);
  return {
    name:   bossNameFor(floor),
    maxHp:  Math.round(base.maxHp * hpMult),
    atk:    Math.round(base.atk   * atkMult),
    mechanic: mechs,
    sprite: buildBossSVG({ spr, area: realArea, zone: floor + 40, mechColor }),
    bg:     buildZoneBgSVG(floor % 2 === 0 ? 2 : 4), // Höhle / Eis alternierend
  };
}

// ---- Turm-Loot ------------------------------------------------------
// Belohnung pro geräumtem Stockwerk. Seltenheit & Gegenstandsstufe steigen mit
// der Stockwerk-/Bossstärke. Jeder Client würfelt eigenständig für den lokalen
// Spieler → jeder bekommt INDIVIDUELLEN Loot in den eigenen Spielstand.
export function towerLootMinRarity(floor){
  if(floor >= 15) return 5; // Mythisch
  if(floor >= 9)  return 4; // Legendär
  if(floor >= 4)  return 3; // Episch
  if(floor >= 2)  return 2; // Selten
  return 1;                 // Ungewöhnlich (Stockwerk 1)
}
export function rollTowerLoot(floor){
  floor = Math.max(1, floor | 0);
  let idx = towerLootMinRarity(floor);
  // Aufstiegs-Chance: höhere Stockwerke geben öfter eine Stufe besser (bis Mythisch).
  const up = Math.min(0.5, 0.05 * floor);
  while(idx < 5 && Math.random() < up) idx++;
  const ilvl = Math.max(1, Math.round(floor * 6));   // Itemlevel skaliert mit Stockwerk
  return rollItem(floor, 0, { forceRarityKey: rarityByIndex(idx).key, minIlvl: ilvl });
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

export async function createLobby(userKey, displayName, classId, desiredCode, startFloor){
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
    status: 'waiting', floor: Math.max(1, startFloor | 0) || 1,
    createdAt: Date.now(),
    hostReady: false, guestReady: false,
  });
  // Host-Disconnect → Lobby + Kampf-/Skill-Daten automatisch entfernen (B3, Aufräumen).
  armDisconnectCleanup(lobbyId);
  return lobbyId;
}

// Eigene Solo-/Koop-Lobby unter dem festen, host-bezogenen Pfad `tower/lobbies/<userKey>`
// sicherstellen (code-loser Einstieg, Schiffe-versenken-Stil). Existiert sie bereits und
// gehört mir, wird sie übernommen (mit ggf. neuem Startstockwerk, solange noch kein Gast
// und kein laufender Kampf); sonst frisch angelegt. Liefert die feste Lobby-ID (= userKey).
export async function ensureSoloLobby(userKey, displayName, classId, startFloor){
  const lobbyId = userKey;
  const snap = await get(ref(db, LOBBY_PATH(lobbyId)));
  const floor = Math.max(1, startFloor | 0) || 1;
  if(snap.exists() && snap.val().host === userKey){
    const cur = snap.val();
    // Verwaiste Wartelobby ohne Gast → Stockwerk aus dem Spielstand übernehmen.
    if(cur.status !== 'in_progress' && !cur.guest){
      await update(ref(db, LOBBY_PATH(lobbyId)), { floor, status: 'waiting', hostReady: false, guestReady: false, startAt: null });
    }
    armDisconnectCleanup(lobbyId);
    return lobbyId;
  }
  await set(ref(db, LOBBY_PATH(lobbyId)), {
    host: userKey, hostName: displayName, hostClass: classId || DEFAULT_CLASS_ID,
    guest: null,   guestName: null,       guestClass: null,
    status: 'waiting', floor,
    createdAt: Date.now(),
    hostReady: false, guestReady: false,
  });
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

// Cooldown-Map {id: Endzeit} → {id: Restzeit ms} (nur laufende Cooldowns).
function cdRemainMap(map, now){
  const o = {};
  if(map) for(const id in map){ const r = (map[id]||0) - now; if(r > 0) o[id] = r; }
  return o;
}

async function syncFight(fight){
  const now = Date.now();
  const data = {
    floor:       fight.floor,
    solo:        !!fight.solo,
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
    // Cooldown der ZWEITEN Fähigkeit je Slot.
    frontCd2Remain: Math.max(0, (fight.frontAbil2Until||0) - now),
    backCd2Remain:  Math.max(0, (fight.backAbil2Until ||0) - now),
    // Cooldown-Maps {abilityId: Restzeit ms} je Slot – für die dynamische Knopfleiste.
    frontCd: cdRemainMap(fight.frontCd, now),
    backCd:  cdRemainMap(fight.backCd,  now),
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
      // Neue Fähigkeiten: Cast-Trigger (Einmal-Animation), Teufelswache, Betäubung, Stealth.
      castFrontTs: fight.frontCastTs || 0, castFrontAb: fight.frontCastAb || '',
      castBackTs:  fight.backCastTs  || 0, castBackAb:  fight.backCastAb  || '',
      petFrontRemain: Math.max(0, (fight.frontPetUntil||0) - now),
      petBackRemain:  Math.max(0, (fight.backPetUntil ||0) - now),
      bossStunRemain: Math.max(0, (fight.bossStunUntil||0) - now),
      stealthFrontRemain: Math.max(0, (fight.frontStealthUntil||0) - now),
      stealthBackRemain:  Math.max(0, (fight.backStealthUntil ||0) - now),
      // Talent-Aktive: Absorb-Schild / Reflexion / Todesrettung je Slot + Boss-Verwundbarkeit.
      absorbFrontRemain: Math.max(0, (fight.fx.front.shieldUntil||0)  - now),
      absorbBackRemain:  Math.max(0, (fight.fx.back.shieldUntil||0)   - now),
      reflectFrontRemain:Math.max(0, (fight.fx.front.reflectUntil||0) - now),
      reflectBackRemain: Math.max(0, (fight.fx.back.reflectUntil||0)  - now),
      deathFrontRemain:  Math.max(0, (fight.fx.front.deathUntil||0)   - now),
      deathBackRemain:   Math.max(0, (fight.fx.back.deathUntil||0)    - now),
      bossVulnRemain:    Math.max(0, (fight.bossVulnUntil||0)         - now),
    },
    status:      fight.over ? (fight.won ? 'won' : 'lost') : 'fighting',
  };
  try { await set(ref(db, COMBAT_PATH(fight.lobbyId)), data); } catch(e){ console.warn('Sync error', e); }
  if(fight.onUpdate) fight.onUpdate(data);
}

export function startTowerFight(lobbyId, floor, frontStats, backStats, frontName, backName, onUpdate, keys){
  const boss = towerBossFor(floor);
  keys = keys || {};

  // Solo-Modus: kein zweiter Held. Der Boss bleibt EXAKT gleich stark, trifft aber
  // nur den vorhandenen Front-Helden (volle ATK statt Aufteilung 70/30). Back-Felder
  // defensiv auf 0/false, damit die Coop-Engine ohne Sonderpfade weiterläuft.
  const solo = !backStats;
  const bs = backStats || {};

  const fight = {
    lobbyId, floor, boss, solo,
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
    frontAbility2: ability2Of(frontStats.classId),
    frontAbilities: abilitiesOf({ character: frontStats.character }),
    backMaxHp:  bs.maxHp || 0,  backHp: bs.maxHp || 0,
    backAtk:    bs.atk || 0,     backArmor: bs.armor || 0,
    backCrit:   bs.critChance || 0, backCritMult: bs.critMult || 0,
    backInterval:  bs.interval || frontStats.interval, backDodge: bs.dodge || 0,
    backVers:   bs.versatility || 0, backLifesteal: bs.lifesteal || 0,
    backBlock:  bs.block || 0, backThorns: bs.thorns || 0,
    backIsHealer: bs.classId === 'heiler',
    backHealMult: bs.healMult,
    backUsesStab: bs.usesStab || false,
    backName: backName || '', backTier: bs.tier || 0,
    backKey: keys.backKey || '', backClass: bs.classId || '',
    backAbility:  solo ? null : abilityOf(bs.classId),
    backAbility2: solo ? null : ability2Of(bs.classId),
    backAbilities: solo ? [] : abilitiesOf({ character: bs.character }),
    turn:0, over:false, won:false,
    enrageMult:1, berserkMult:1, poison:0, shieldTurns:0,
    speed:1, log:{}, logCount:0,
    startedAt: Date.now(), dmgDealt:0,
    // Skill-Status (B14)
    frontCritUntil:0, backCritUntil:0, frontCritVal:0, backCritVal:0,
    groupDmgReduceUntil:0, lastHealTs:0,
    // Neue Fähigkeiten: zweiter Cooldown je Slot, Boss-Betäubung, Teufelswache, Stealth.
    frontAbil2Until:0, backAbil2Until:0, bossStunUntil:0,
    frontPetUntil:0, backPetUntil:0, frontPetBonus:0, backPetBonus:0,
    frontStealthUntil:0, backStealthUntil:0,
    frontCastTs:0, frontCastAb:'', backCastTs:0, backCastAb:'',
    // Talent-Aktive: Cooldown-Maps je Slot + per-Slot-Effekt-Container + Boss-Verwundbarkeit.
    frontCd:{}, backCd:{}, bossVulnUntil:0, bossVulnVal:0,
    fx:{ front:{ dmgBoostUntil:0,dmgBoostVal:0, dmgReduceUntil:0,dmgReduceVal:0, lifestealUntil:0,lifestealVal:0, reflectUntil:0,reflectVal:0, shield:0,shieldUntil:0, deathUntil:0,reviveHp:0 },
          back:{ dmgBoostUntil:0,dmgBoostVal:0, dmgReduceUntil:0,dmgReduceVal:0, lifestealUntil:0,lifestealVal:0, reflectUntil:0,reflectVal:0, shield:0,shieldUntil:0, deathUntil:0,reviveHp:0 } },
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

// Pet-Bonus (Teufelswache) eines Slots zum aktuellen Zeitpunkt.
function petMultOf(fight, slot, now){
  const until = slot === 'front' ? fight.frontPetUntil : fight.backPetUntil;
  const bonus = slot === 'front' ? fight.frontPetBonus : fight.backPetBonus;
  return now < (until||0) ? (1 + (bonus||0)) : 1;
}
// Schadens-Multiplikator eines Slots aus Talent-Buffs (dmgBoost/avatar) + Boss-Verwundbarkeit.
function slotDmgMult(fight, slot, now){
  const fx = fight.fx && fight.fx[slot]; let m = 1;
  if(fx && now < (fx.dmgBoostUntil||0)) m *= (1 + (fx.dmgBoostVal||0));
  if(now < (fight.bossVulnUntil||0))    m *= (1 + (fight.bossVulnVal||0));
  return m;
}
// Zusätzlicher Lebensraub eines Slots aus Talent-Buffs (Beutejagd/Blutritual).
function slotLifesteal(fight, slot, now){
  const fx = fight.fx && fight.fx[slot];
  return (fx && now < (fx.lifestealUntil||0)) ? (fx.lifestealVal||0) : 0;
}
// Eingehenden Boss-Schaden eines Slots verarbeiten: Reflexion, Absorb-Schild,
// Todesrettung. Gibt den tatsächlich an den Helden gehenden Schaden zurück.
function towerTakeHit(fight, slot, raw, events){
  const now = Date.now();
  const fx = fight.fx[slot];
  const hpKey = slot === 'front' ? 'frontHp' : 'backHp';
  const reviveCap = slot === 'front' ? fight.frontMaxHp : fight.backMaxHp;
  let dmg = raw;
  // Slot-Schadensreduktion (Verschwinden/Unbeugsam/Avatar).
  if(now < (fx.dmgReduceUntil||0)) dmg = Math.max(1, Math.round(dmg * (1 - (fx.dmgReduceVal||0))));
  // Reflexion (Vergeltung): Anteil zurück an den Boss.
  if(now < (fx.reflectUntil||0) && fx.reflectVal > 0){
    const refl = Math.max(1, Math.round(dmg * fx.reflectVal));
    fight.bossHp = Math.max(0, fight.bossHp - refl); fight.dmgDealt += refl;
    addLog(fight, '🪞 Reflexion: -' + fmtBig(refl), '#b6d0ff');
    if(fight.bossHp <= 0) fight.over = true;
  }
  // Absorb-Schild (Schutzschild).
  if(now < (fx.shieldUntil||0) && fx.shield > 0){
    const soak = Math.min(fx.shield, dmg); fx.shield -= soak; dmg -= soak;
    if(fx.shield <= 0){ fx.shield = 0; fx.shieldUntil = 0; }
  }
  fight[hpKey] = Math.max(0, fight[hpKey] - dmg);
  // Todesrettung (Engelsgeist / Letzter Wall / Seelenstein).
  if(fight[hpKey] <= 0 && now < (fx.deathUntil||0)){
    fight[hpKey] = Math.max(1, Math.min(reviveCap, fx.reviveHp||1));
    fx.deathUntil = 0;
    addLog(fight, '✨ ' + (slot==='front'?fight.frontName:fight.backName) + ' wird vor dem Tod bewahrt!', '#ffe9a8');
  }
  return dmg;
}

// Nebelschritt-Überfall (Turm-Host): nach dem Unsichtbarkeits-Fenster taucht der
// Slot aus der Rauchwolke auf und landet einen garantierten kritischen Treffer.
function scheduleTowerNebelAmbush(fight, slot, ab){
  const dur = ab.dur || 5000;
  setTimeout(()=>{
    if(fight.over || _fight !== fight) return;
    const now = Date.now();
    if(slot === 'front') fight.frontStealthUntil = 0; else fight.backStealthUntil = 0;
    const atk      = slot === 'front' ? fight.frontAtk     : fight.backAtk;
    const critMult = slot === 'front' ? fight.frontCritMult : fight.backCritMult;
    const dmg = Math.max(1, Math.round(atk * (ab.ambushMult||4) * (critMult||2) * petMultOf(fight, slot, now)));
    fight.bossHp = Math.max(0, fight.bossHp - dmg); fight.dmgDealt += dmg;
    if(slot === 'front'){ fight.frontCastTs = now; fight.frontCastAb = 'nebelschritt_ambush'; }
    else               { fight.backCastTs  = now; fight.backCastAb  = 'nebelschritt_ambush'; }
    addLog(fight, '💨 Überfall aus dem Nebel: KRIT ' + fmtBig(dmg) + ' Schaden!', '#ffd24a');
    if(fight.bossHp <= 0){
      fight.over = true; fight.won = true;
      addLog(fight, '🏆 Sieg! Stockwerk ' + fight.floor + ' gemeistert!', '#ffd24a');
      clearTimeout(_fightTimer);
    }
    syncFight(fight);
  }, dur);
}

// Host wendet eine angeforderte Klassen-Fähigkeit auf den Kampf an.
function applyAbility(fight, slot, abilityId){
  if(fight.over) return;
  // Angeforderte ID gegen die GESAMTE Fähigkeitsliste des Slots prüfen
  // (Grundfähigkeit + Zweitfähigkeit + geskillte Talent-Aktive).
  const list = slot === 'front' ? fight.frontAbilities : fight.backAbilities;
  const ab = (list||[]).find(a => a && a.id === abilityId);
  if(!ab) return;
  const now = Date.now();
  const cdMap = slot === 'front' ? fight.frontCd : fight.backCd;
  if(now < (cdMap[abilityId]||0)) return;                 // noch im Cooldown
  cdMap[abilityId] = now + (ab.cd||0);
  const name  = slot === 'front' ? fight.frontName  : fight.backName;
  const atk   = slot === 'front' ? fight.frontAtk   : fight.backAtk;
  const maxHp = slot === 'front' ? fight.frontMaxHp : fight.backMaxHp;
  const fxs   = fight.fx[slot];
  // Cast-Signal für die Client-Animation (Rauch/Säule/Dämon/Schockwelle).
  if(slot === 'front'){ fight.frontCastTs = now; fight.frontCastAb = ab.id; }
  else                { fight.backCastTs  = now; fight.backCastAb  = ab.id; }
  const slotHeal = amt => { if(slot==='front') fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp+amt); else fight.backHp = Math.min(fight.backMaxHp, fight.backHp+amt); };
  const vulnMult = now < (fight.bossVulnUntil||0) ? (1+(fight.bossVulnVal||0)) : 1;
  const dealBoss = mult => { const dmg = Math.max(1, Math.round(atk * mult * petMultOf(fight, slot, now) * vulnMult)); fight.bossHp = Math.max(0, fight.bossHp - dmg); fight.dmgDealt += dmg; if(fight.bossHp<=0) fight.over = true; return dmg; };

  if(ab.kind === 'heal'){
    if(fight.frontHp > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + Math.round(fight.frontMaxHp * ab.healPct));
    if(fight.backHp  > 0) fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + Math.round(fight.backMaxHp  * ab.healPct));
    fight.lastHealTs = now;
    addLog(fight, ab.icon+' '+ab.name+': alle Helden +'+Math.round(ab.healPct*100)+'% HP', '#37d67a');
  } else if(ab.kind === 'healBurst'){
    if(fight.frontHp > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + Math.round(fight.frontMaxHp * ab.healPct));
    if(fight.backHp  > 0) fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + Math.round(fight.backMaxHp  * ab.healPct));
    fight.lastHealTs = now;
    const dmg = dealBoss(ab.burstMult||3);
    addLog(fight, ab.icon+' '+ab.name+': alle +'+Math.round(ab.healPct*100)+'% HP, '+fmtBig(dmg)+' Schaden', '#ffe9a8');
  } else if(ab.kind === 'critBoost'){
    if(slot === 'front'){ fight.frontCritUntil = now + ab.dur; fight.frontCritVal = ab.critBonus||0; }
    else               { fight.backCritUntil  = now + ab.dur; fight.backCritVal  = ab.critBonus||0; }
    addLog(fight, ab.icon+' '+name+' – '+ab.name+'!', '#ff8a3d');
  } else if(ab.kind === 'vanish'){
    fight.bossStunUntil = now + ab.dur;
    if(slot === 'front') fight.frontStealthUntil = now + ab.dur; else fight.backStealthUntil = now + ab.dur;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': verschwindet im Nebel, Boss '+(ab.dur/1000)+'s blind!', '#b6a0ff');
    scheduleTowerNebelAmbush(fight, slot, ab);
  } else if(ab.kind === 'stun'){
    const dmg = dealBoss(ab.burstMult||1.2);
    fight.bossStunUntil = now + (ab.stunDur||4000);
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': '+fmtBig(dmg)+' Schaden, Boss '+((ab.stunDur||4000)/1000)+'s betäubt!', '#7fd0ff');
  } else if(ab.kind === 'summon'){
    if(slot === 'front'){ fight.frontPetUntil = now + (ab.petDur||10000); fight.frontPetBonus = ab.petBonus||0.25; }
    else               { fight.backPetUntil  = now + (ab.petDur||10000); fight.backPetBonus  = ab.petBonus||0.25; }
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': Teufelswache kämpft '+((ab.petDur||10000)/1000)+'s mit (+'+Math.round((ab.petBonus||0.25)*100)+'% Schaden)!', '#9b30ff');
  } else if(ab.kind === 'dmgReduce'){
    // Schildwall heilt die ganze Gruppe; Talent-Reduce (Verschwinden/Unbeugsam) nur den Slot.
    if(ab.id === 'schildwall'){ fight.groupDmgReduceUntil = now + ab.dur; fight.groupDmgReducePct = ab.dmgReduce||0; addLog(fight, ab.icon+' '+ab.name+' – Gruppe erleidet '+Math.round(ab.dmgReduce*100)+'% weniger Schaden!', '#7fd0ff'); }
    else { fxs.dmgReduceUntil = now + ab.dur; fxs.dmgReduceVal = ab.dmgReduce||0; addLog(fight, ab.icon+' '+name+' – '+ab.name+': −'+Math.round((ab.dmgReduce||0)*100)+'% erlittener Schaden!', '#7fd0ff'); }
  } else if(ab.kind === 'dmgBoost'){
    fxs.dmgBoostUntil = now + ab.dur; fxs.dmgBoostVal = ab.dmgBonus||0;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': +'+Math.round((ab.dmgBonus||0)*100)+'% Schaden!', '#ff8a3d');
  } else if(ab.kind === 'lifesteal'){
    fxs.lifestealUntil = now + ab.dur; fxs.lifestealVal = ab.lifestealBonus||0;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': +'+Math.round((ab.lifestealBonus||0)*100)+'% Lebensraub!', '#e0466e');
  } else if(ab.kind === 'avatar'){
    fxs.dmgBoostUntil = now + ab.dur; fxs.dmgBoostVal = ab.dmgBonus||0.4;
    fxs.dmgReduceUntil = now + ab.dur; fxs.dmgReduceVal = ab.dmgReduce||0.4;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': +'+Math.round((ab.dmgBonus||0.4)*100)+'% Schaden & −'+Math.round((ab.dmgReduce||0.4)*100)+'% erlitten!', '#ffd24a');
  } else if(ab.kind === 'reflect'){
    fxs.reflectUntil = now + ab.dur; fxs.reflectVal = ab.reflectPct||0.4;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': reflektiert '+Math.round((ab.reflectPct||0.4)*100)+'% Schaden!', '#b6d0ff');
  } else if(ab.kind === 'absorb'){
    fxs.shield = Math.round(maxHp * (ab.absorbPct||0.4)); fxs.shieldUntil = now + (ab.dur||10000);
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': Schild absorbiert '+fmtBig(fxs.shield)+' Schaden.', '#bfe3ff');
  } else if(ab.kind === 'deathsave'){
    fxs.deathUntil = now + (ab.dur||10000); fxs.reviveHp = Math.round(maxHp * (ab.revivePct||0.3));
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': überlebt '+(ab.dur/1000)+'s lang den Tod.', '#ffe9a8');
  } else if(ab.kind === 'vulnerability'){
    fight.bossVulnUntil = now + ab.dur; fight.bossVulnVal = ab.vulnPct||0.3;
    let dmg = 0; if(ab.burstMult) dmg = dealBoss(ab.burstMult);
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': Gegner +'+Math.round((ab.vulnPct||0.3)*100)+'% Schaden'+(dmg?(' ('+fmtBig(dmg)+')'):'')+'.', '#ff8a3d');
  } else if(ab.kind === 'cleanse'){
    const heal = Math.round(maxHp * (ab.healPct||0.25)); slotHeal(heal); fight.lastHealTs = now;
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': +'+fmtBig(heal)+' HP.', '#bfe3ff');
  } else if(ab.kind === 'dot'){
    startTowerDot(fight, slot, ab);
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': '+Math.round((ab.dotMult||0.5)*100)+'% Schaden/s für '+(ab.dur/1000)+'s.', '#9acd32');
  } else if(ab.kind === 'hot'){
    startTowerHot(fight, slot, ab);
    addLog(fight, ab.icon+' '+name+' – '+ab.name+': Heilung über '+(ab.dur/1000)+'s.', '#37d67a');
  } else if(ab.kind === 'drain' && ab.dur){
    startTowerDrain(fight, slot, ab);
    return;
  } else if(ab.kind === 'drain' || ab.kind === 'burst'){
    const dmg = dealBoss(ab.burstMult || 2);
    if(ab.kind === 'drain') slotHeal(dmg);
    addLog(fight, ab.icon+' '+ab.name+': '+fmtBig(dmg)+' Schaden'+(ab.kind==='drain'?' (+Heilung)':''), '#ffd24a');
  }
  syncFight(fight);
}

// Host-seitiger Kanal des Seelenraubs im Turm: pro Sekunde Schaden am Boss +
// Heilung des wirkenden Slots, über die volle Dauer. Tickt unabhängig von der
// regulären Kampfschleife und reicht jeden Tick per syncFight an beide Clients.
function startTowerDrain(fight, slot, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round(ab.dur / tickMs));
  syncFight(fight); // Cooldown sofort an die Clients propagieren.
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight) return;
    const atk = slot === 'front' ? fight.frontAtk : fight.backAtk;
    const dmg = Math.max(1, Math.round(atk * (ab.burstMult || 2)));
    fight.bossHp = Math.max(0, fight.bossHp - dmg);
    fight.dmgDealt += dmg;
    if(slot === 'front') fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + dmg);
    else                 fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + dmg);
    addLog(fight, ab.icon+' '+ab.name+': '+dmg+' Schaden (+Heilung)', '#ffd24a');
    if(fight.bossHp <= 0) fight.over = true;
    syncFight(fight);
    if(!fight.over && ++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
}

// DoT am Boss (Gift/Blutung): tickt dotMult·Atk Schaden über die Dauer (keine Heilung).
function startTowerDot(fight, slot, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||5000) / tickMs));
  syncFight(fight);
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight) return;
    const now = Date.now();
    const atk = slot === 'front' ? fight.frontAtk : fight.backAtk;
    const vulnMult = now < (fight.bossVulnUntil||0) ? (1+(fight.bossVulnVal||0)) : 1;
    const dmg = Math.max(1, Math.round(atk * (ab.dotMult||0.5) * vulnMult));
    fight.bossHp = Math.max(0, fight.bossHp - dmg); fight.dmgDealt += dmg;
    // Tick-Animation auf den Clients (Cast-Trigger neu setzen).
    if(slot === 'front'){ fight.frontCastTs = now; fight.frontCastAb = ab.id; }
    else                { fight.backCastTs  = now; fight.backCastAb  = ab.id; }
    addLog(fight, ab.icon+' '+ab.name+': '+fmtBig(dmg)+' Schaden', '#9acd32');
    if(fight.bossHp <= 0) fight.over = true;
    syncFight(fight);
    if(!fight.over && ++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
}
// HoT am Slot (Verjüngung): tickt hotPct·maxHp Heilung über die Dauer.
function startTowerHot(fight, slot, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||8000) / tickMs));
  syncFight(fight);
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight) return;
    const maxHp = slot === 'front' ? fight.frontMaxHp : fight.backMaxHp;
    const heal = Math.round(maxHp * (ab.hotPct||0.08));
    if(slot === 'front'){ if(fight.frontHp > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + heal); }
    else               { if(fight.backHp  > 0) fight.backHp  = Math.min(fight.backMaxHp,  fight.backHp  + heal); }
    fight.lastHealTs = Date.now();
    addLog(fight, ab.icon+' '+ab.name+': +'+fmtBig(heal)+' HP', '#37d67a');
    syncFight(fight);
    if(!fight.over && ++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
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

  // Skill: Krit-Boost-Fähigkeit (z. B. Kaltblütigkeit) (B14)
  const now = Date.now();
  const fCritBonus = now < (fight.frontCritUntil||0) ? (fight.frontCritVal||0) : 0;
  const bCritBonus = now < (fight.backCritUntil ||0) ? (fight.backCritVal ||0) : 0;
  const effFrontCrit = Math.min(1, fight.frontCrit + fCritBonus);
  const effBackCrit  = Math.min(1, fight.backCrit  + bCritBonus);

  // ---- Vorne: heilt den Partner bei < 35% (Heiler) oder schlägt den Boss ---
  // (Im Nebelschritt verborgen → setzt diese Runde aus.)
  if(fight.frontHp > 0 && now >= (fight.frontStealthUntil||0)){
    const backLow = fight.backHp > 0 && fight.backHp < fight.backMaxHp * 0.35;
    if(fight.frontIsHealer && backLow){
      const healAmt = Math.round(fight.frontAtk * 2.0 * (fight.frontHealMult || 1));
      fight.backHp = Math.min(fight.backMaxHp, fight.backHp + healAmt);
      addLog(fight, '💚 ' + fight.frontName + ' heilt ' + fight.backName + ': +' + fmtBig(healAmt) + ' HP', '#37d67a');
      events.push({ s:'front', t:'back', d:healAmt, h:1 });
    } else {
      let { dmg: fd, crit: fc } = rollDmg(fight.frontAtk, effFrontCrit, fight.frontCritMult);
      fd = Math.max(1, Math.round(fd * petMultOf(fight, 'front', now) * slotDmgMult(fight, 'front', now)));   // Teufelswache/Buffs/Verwundbarkeit
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
      // Lifesteal (Affix + Talent-Buff)
      const fls = fight.frontLifesteal + slotLifesteal(fight, 'front', now);
      if(fls > 0){
        const h = Math.round(fd * fls);
        if(h > 0) fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + h);
      }
      // Dornen-Affix: flacher Bonusschaden an den Boss (analog Solo-Kampf).
      if(fight.frontThorns > 0){ fight.bossHp = Math.max(0, fight.bossHp - fight.frontThorns); fight.dmgDealt += fight.frontThorns; }
    }
  }

  // ---- Hinten: heilt bei < 35% oder greift an ---
  // (Im Nebelschritt verborgen → setzt diese Runde aus. Im Solo-Modus gibt es
  //  keinen zweiten Helden.)
  if(!fight.solo && fight.backHp > 0 && now >= (fight.backStealthUntil||0)){
    const frontLow = fight.frontHp > 0 && fight.frontHp < fight.frontMaxHp * 0.35;
    if(fight.backIsHealer && frontLow){
      const healAmt = Math.round(fight.backAtk * 2.0 * (fight.backHealMult || 1));
      fight.frontHp = Math.min(fight.frontMaxHp, fight.frontHp + healAmt);
      addLog(fight, '💚 ' + fight.backName + ' heilt ' + fight.frontName + ': +' + fmtBig(healAmt) + ' HP', '#37d67a');
      events.push({ s:'back', t:'front', d:healAmt, h:1 });
    } else {
      let { dmg: bd, crit: bc } = rollDmg(fight.backAtk, effBackCrit, fight.backCritMult);
      bd = Math.max(1, Math.round(bd * petMultOf(fight, 'back', now) * slotDmgMult(fight, 'back', now)));   // Teufelswache/Buffs/Verwundbarkeit
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
      const bls = fight.backLifesteal + slotLifesteal(fight, 'back', now);
      if(bls > 0){
        const h = Math.round(bd * bls);
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

    // Betäubung (Donnerknall / Nebelschritt): Boss setzt seinen Angriff aus.
    if(Date.now() < (fight.bossStunUntil||0)){
      addLog(fight, '😵 Boss ist betäubt und kann nicht angreifen!', '#7fd0ff');
      fight.events = events;
      await syncFight(fight);
      const ivStun = (frosted ? 1.4 : 1.0);
      _fightTimer = setTimeout(() => exchange(fight), (fight.frontInterval * ivStun) / fight.speed);
      return;
    }

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

    // Schadensanteil der Front: Solo nimmt den vollen Bossschlag (kein zweiter Held),
    // im Coop wie gehabt 70 %.
    const frontShare = fight.solo ? 1.0 : FRONT_SHARE;

    // Front-Treffer
    if(!frontDead){
      const effArmorFront = breathTurn ? 0 : fight.frontArmor;
      const effBlockFront = breathTurn ? 0 : fight.frontBlock;
      const effAtkFront   = fight.shieldTurns > 0 ? bossAtk * 0.4 * frontShare : bossAtk * frontShare;
      let { dmg: fd, dodged: dFront } = takeBossDmg(effAtkFront, effArmorFront, fight.frontDodge, fight.frontVers, effBlockFront);
      if(fd > 0 && wallFactor < 1) fd = Math.max(1, Math.round(fd * wallFactor));
      if(dFront){
        addLog(fight, '💨 ' + fight.frontName + ' weicht aus!', '#9ec5ff');
        events.push({ s:'boss', t:'front', o:1 });
      } else if(fd > 0){
        fd = towerTakeHit(fight, 'front', fd, events);   // Schild/Reflexion/Todesrettung/Slot-Reduktion
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

    // Hinten-Treffer (voller Schaden wenn Front tot) – im Solo-Modus entfällt er,
    // der gesamte Bossschaden ging bereits auf die Front.
    if(!fight.solo){
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
        bd = towerTakeHit(fight, 'back', bd, events);   // Schild/Reflexion/Todesrettung/Slot-Reduktion
        addLog(fight, '💥 Boss → ' + fight.backName + ': -' + fmtBig(bd) + ' HP', '#ff6b6b');
        events.push({ s:'boss', t:'back', d:bd });
      }
    }

    // Frost → nächste Runde verlangsamt (über erhöhtes Interval)
    if(frosted) addLog(fight, '❄️ Frost! Angriff verlangsamt.', '#7fd0ff');

    fight.events = events;
    await syncFight(fight);

    // Niederlage? Solo: sobald der einzige Held fällt; Coop: beide gefallen.
    if(fight.solo ? fight.frontHp <= 0 : (fight.frontHp <= 0 && fight.backHp <= 0)){
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

// Setzt die Lobby nach einem Kampf in den Warteraum zurück. advance=true → ein
// Stockwerk weiter (Sieg), advance=false → gleiches Stockwerk wiederholen (Niederlage).
// Per Transaktion: Klicken beide Spieler gleichzeitig, wird nur EINMAL weitergeschaltet
// (zweiter Aufruf bricht ab, weil status bereits 'waiting' ist).
export async function advanceFloor(lobbyId, advance = true){
  let resultFloor = 1;
  await runTransaction(ref(db, LOBBY_PATH(lobbyId)), lobby => {
    if(!lobby) return lobby;                 // Lobby weg → nichts tun
    if(lobby.status === 'waiting'){ resultFloor = lobby.floor || 1; return; }  // schon zurückgesetzt → abbrechen
    resultFloor = Math.max(1, (lobby.floor || 1) + (advance ? 1 : 0));
    lobby.floor = resultFloor;
    lobby.hostReady = false; lobby.guestReady = false;
    lobby.status = 'waiting'; lobby.startAt = null;
    return lobby;
  });
  await set(ref(db, COMBAT_PATH(lobbyId)), null);
  await set(ref(db, ABIL_PATH(lobbyId)), null);
  return resultFloor;
}
