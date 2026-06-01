/* =====================================================================
   DUELL – Live-PvP (Spieler gegen Spieler) in der gewohnten Arena.
   Lobby + host-autoritative 1-gegen-1-Engine, RTDB-synchronisiert.

   Aufbau analog zum Koop-Turm (tower.js), aber im eigenen Namensraum
   `duel/…`, damit Turm und Duell sich nicht in die Quere kommen:
     duel/lobbies/<id>  – Lobby (Host/Gast, Einsatz, Bereit, Countdown)
     duel/combat/<id>   – Kampf-Snapshot (nur der Host schreibt)
     duel/abil/<id>     – Aktions-Anfragen (jeder Spieler; Host wendet an)
     duel/heroes/<id>   – Aussehen beider Helden (für die Sprites)

   Wiederverwendet aus tower.js: computePlayerStats, loadGuestSave.
   ===================================================================== */
import { db, ref, get, set, update, remove, push, onValue, onDisconnect, userKey } from './firebase.js';
import { COMBAT } from '../data/tuning.js';
import { abilityOf, abilitiesOf, CLASS_BY_ID } from '../data/classes.js';
import { computePlayerStats, loadGuestSave } from './tower.js';
import { fmtBig } from '../ui/dom.js';

const LOBBY = id => 'duel/lobbies/' + id;
const COMBATP = id => 'duel/combat/'  + id;
const ABIL  = id => 'duel/abil/'    + id;
const HEROES = id => 'duel/heroes/'  + id;

// Es spielen genau zwei: der jeweils andere Account.
export function otherKey(){ return userKey === 'nele' ? 'andreas' : 'nele'; }

// ---- Server-Zeit (für synchronen Countdown auf beiden Clients) -------
let _serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), snap => { _serverOffset = snap.val() || 0; });
export function serverNow(){ return Date.now() + _serverOffset; }

// ---- Duell-Regeln ----------------------------------------------------
const DUEL_POTIONS     = 3;       // feste Heiltränke je Duellant (verbraucht KEINE echten)
const DUEL_HEAL_PCT    = 0.5;     // Heiltrank stellt 50 % der max. HP wieder her
const DUEL_ENRAGE_TURN = 35;      // ab hier eskalieren BEIDE Kämpfer → erzwingt ein Ende
const DUEL_ENRAGE_RAMP = 1.06;

// ---- Lobby-Verwaltung ------------------------------------------------
export function sanitizeCode(code){
  return String(code || '').trim().replace(/[.$#\[\]\/\s]+/g, '-').slice(0, 40);
}

function armCleanup(lobbyId){
  try {
    onDisconnect(ref(db, LOBBY(lobbyId))).remove();
    onDisconnect(ref(db, COMBATP(lobbyId))).remove();
    onDisconnect(ref(db, ABIL(lobbyId))).remove();
    onDisconnect(ref(db, HEROES(lobbyId))).remove();
  } catch(e){}
}

export async function createDuel(displayName, classId, stake, desiredCode){
  let lobbyId;
  const code = sanitizeCode(desiredCode);
  if(code){
    const exists = await get(ref(db, LOBBY(code)));
    if(exists.exists()) throw new Error('Code „' + code + '" ist bereits vergeben.');
    lobbyId = code;
  } else {
    lobbyId = push(ref(db, 'duel/lobbies')).key;
  }
  await set(ref(db, LOBBY(lobbyId)), {
    host: userKey, hostName: displayName, hostClass: classId || 'kaempfer',
    guest: null, guestName: null, guestClass: null,
    status: 'waiting', stake: Math.max(0, stake|0),
    createdAt: Date.now(), hostReady: false, guestReady: false, startAt: null,
  });
  armCleanup(lobbyId);
  return lobbyId;
}

export async function joinDuel(lobbyId, displayName, classId){
  const snap = await get(ref(db, LOBBY(lobbyId)));
  if(!snap.exists()) throw new Error('Duell-Lobby nicht gefunden.');
  const lobby = snap.val();
  if(lobby.status === 'ended') throw new Error('Diese Lobby ist beendet.');
  if(lobby.guest && lobby.guest !== userKey) throw new Error('Lobby ist bereits voll.');
  if(lobby.host === userKey) throw new Error('Du bist bereits der Host.');
  await update(ref(db, LOBBY(lobbyId)), {
    guest: userKey, guestName: displayName, guestClass: classId || 'kaempfer',
  });
  armCleanup(lobbyId);
  return lobby;
}

export function listenDuel(lobbyId, cb){ return onValue(ref(db, LOBBY(lobbyId)), s => cb(s.exists()?s.val():null)); }
export function listenDuelCombat(lobbyId, cb){ return onValue(ref(db, COMBATP(lobbyId)), s => cb(s.exists()?s.val():null)); }
export function listenDuelHeroes(lobbyId, cb){ return onValue(ref(db, HEROES(lobbyId)), s => cb(s.exists()?s.val():null)); }

export async function setDuelHeroes(lobbyId, host, guest){
  try { await set(ref(db, HEROES(lobbyId)), { host: host||null, guest: guest||null }); } catch(e){}
}
export async function setDuelReady(lobbyId, isHost, val = true){
  await update(ref(db, LOBBY(lobbyId)), { [isHost ? 'hostReady' : 'guestReady']: val });
}
export async function setStartAt(lobbyId, ts){ await update(ref(db, LOBBY(lobbyId)), { startAt: ts }); }
export async function setDuelStatus(lobbyId, patch){ await update(ref(db, LOBBY(lobbyId)), patch); }

export async function leaveDuel(lobbyId){
  try { await update(ref(db, LOBBY(lobbyId)), { status: 'ended' }); } catch(e){}
  try { await remove(ref(db, LOBBY(lobbyId)));  } catch(e){}
  try { await remove(ref(db, COMBATP(lobbyId))); } catch(e){}
  try { await remove(ref(db, ABIL(lobbyId)));   } catch(e){}
  try { await remove(ref(db, HEROES(lobbyId))); } catch(e){}
}

// Ein Spieler fordert eine Aktion an (Fähigkeit oder Heiltrank). Host wendet an.
export async function requestDuelAction(lobbyId, role, kind){
  try { await set(ref(db, ABIL(lobbyId)), { role, kind, ts: Date.now() }); } catch(e){}
}

// Ein Spieler gibt mitten im Duell auf (Arena verlassen). Läuft über denselben
// Aktions-Kanal: der Host beendet den Kampf autoritativ und schreibt einen
// terminalen Snapshot, sodass BEIDE Clients regulär über endDuel verrechnen.
export async function requestDuelForfeit(lobbyId, role){
  try { await set(ref(db, ABIL(lobbyId)), { role, kind: 'forfeit', ts: Date.now() }); } catch(e){}
}

// Spielstände liegen als Roster { version, activeId, slots } vor – den aktiven
// (flachen) Slot herausziehen, damit computePlayerStats/buildHeroSVG ihn lesen.
export function resolveActiveSlot(loaded){
  if(loaded && loaded.slots && loaded.activeId && loaded.slots[loaded.activeId]) return loaded.slots[loaded.activeId];
  if(loaded && loaded.equipped) return loaded;  // bereits flach
  if(loaded && loaded.slots){ const k = Object.keys(loaded.slots)[0]; if(k) return loaded.slots[k]; }
  return loaded || {};
}

// Aussehens-/Stat-Bündel eines Spielstands (für Sprite + Stats des Gegners).
export function lookOf(save, stats){
  return {
    character: (save && save.character) || null,
    equipped:  (save && save.equipped)  || {},
    hideHelmet: !!(save && save.settings && save.settings.hideHelmet),
    tier: stats.tier,
  };
}
export { loadGuestSave };

// =====================================================================
//  HOST-ENGINE (läuft nur beim Host)
// =====================================================================
let _timer = null, _fight = null, _abilUnsub = null;

function rnd(v){ return 1 + (Math.random()*2 - 1)*v; }

function freshBuffs(){
  return { crit:{until:0,val:0}, dmgBoost:{until:0,val:0},
           dmgReduce:{until:0,val:0}, lifesteal:{until:0,val:0} };
}
function makeSide(stats){
  const classId = stats.classId;
  return {
    maxHp: stats.maxHp, hp: stats.maxHp,
    atk: stats.atk, crit: stats.critChance, critMult: stats.critMult,
    interval: stats.interval, armor: stats.armor, dodge: stats.dodge || 0,
    vers: stats.versatility || 0, lifesteal: stats.lifesteal || 0,
    block: stats.block || 0, thorns: stats.thorns || 0,
    usesStab: !!stats.usesStab, tier: stats.tier, classId,
    magic: (CLASS_BY_ID[classId] || {}).damageSchool === 'magisch',
    // Grundfähigkeit + geskillte Talent-Aktive (max. 3).
    abilities: abilitiesOf({ character: stats.character }),
    potions: DUEL_POTIONS,
    abilCd: {}, buffs: freshBuffs(),
    burstTs: 0, healTs: 0, drainTs: 0, burstMagic: 0,
  };
}

// startDuelHost: beginnt die autoritative Simulation. me/opp sind die Stats
// der beiden Spielstände; names/keys ordnen Host/Gast zu.
export function startDuelHost(lobbyId, hostStats, guestStats, info){
  stopDuelHost();
  const fight = {
    lobbyId,
    host: makeSide(hostStats), guest: makeSide(guestStats),
    hostName: info.hostName, guestName: info.guestName,
    hostKey: info.hostKey, guestKey: info.guestKey,
    hostClass: hostStats.classId, guestClass: guestStats.classId,
    hostStab: !!hostStats.usesStab, guestStab: !!guestStats.usesStab,
    turn: 0, seq: 0, over: false, winner: null, enrageMult: 1,
    startedAt: Date.now(), dmgDealt: 0, log: {}, logCount: 0,
    lastHealTs: 0, healSide: '', lastAbilTs: 0,
    events: [],
  };
  _fight = fight;
  _abilUnsub = onValue(ref(db, ABIL(lobbyId)), snap => {
    if(!snap.exists() || fight.over) return;
    const req = snap.val();
    if(!req || !req.ts || req.ts <= fight.lastAbilTs) return;
    fight.lastAbilTs = req.ts;
    applyAction(fight, req.role, req.kind);
  });
  syncDuel(fight, false);
  schedule(fight);
}

function logLine(fight, text, color){
  const i = fight.logCount++;
  fight.log[i] = { t: text, c: color || '#cfc6dd' };
  if(i > 50) delete fight.log[i - 50];
}

function applyAction(fight, role, kind){
  // Forfeit zuerst behandeln (unabhängig vom HP-Stand des Verlassenden).
  if(kind === 'forfeit'){
    if(fight.over) return;
    fight.over = true;
    fight.winner = role === 'host' ? 'guest' : 'host';
    const lname = role === 'host' ? fight.hostName : fight.guestName;
    const wname = fight.winner === 'host' ? fight.hostName : fight.guestName;
    logLine(fight, '🚪 ' + lname + ' verlässt das Duell – ' + wname + ' gewinnt!', '#ffd24a');
    clearTimeout(_timer);
    fight.events = [];
    syncDuel(fight, true);
    return;
  }
  const side = role === 'host' ? fight.host : fight.guest;
  const opp  = role === 'host' ? fight.guest : fight.host;
  const name = role === 'host' ? fight.hostName : fight.guestName;
  if(!side || side.hp <= 0) return;
  const now = Date.now();
  if(kind === 'potion'){
    if(side.potions <= 0 || side.hp >= side.maxHp) return;
    const heal = Math.round(side.maxHp * DUEL_HEAL_PCT);
    side.hp = Math.min(side.maxHp, side.hp + heal);
    side.potions--;
    side.healTs = now;
    logLine(fight, '🧪 ' + name + ' trinkt einen Heiltrank: +' + fmtBig(heal) + ' HP', '#37d67a');
  } else if(typeof kind === 'string' && kind.indexOf('ability') === 0){
    const abilityId = kind.split(':')[1] || (side.abilities[0] && side.abilities[0].id);
    const ab = (side.abilities || []).find(a => a.id === abilityId);
    if(!ab || now < (side.abilCd[abilityId] || 0)) return;
    side.abilCd[abilityId] = now + (ab.cd || 0);
    applyDuelAbility(fight, role, side, opp, name, ab, now);
  }
  fight.events = [];
  syncDuel(fight, !!fight.over);
}

// Effekt einer aktiven Fähigkeit autoritativ anwenden (Host-Engine).
function applyDuelAbility(fight, role, side, opp, name, ab, now){
  if(ab.kind === 'heal'){
    const heal = Math.round(side.maxHp * ab.healPct);
    side.hp = Math.min(side.maxHp, side.hp + heal);
    side.healTs = now;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': +' + fmtBig(heal) + ' HP', '#37d67a');
  } else if(ab.kind === 'burst' || ab.kind === 'drain'){
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0;
    if(ab.kind === 'drain'){ side.hp = Math.min(side.maxHp, side.hp + dmg); side.drainTs = now; }
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden' +
      (ab.kind === 'drain' ? ' (+Heilung)' : ''), '#ffd24a');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      const wname = role === 'host' ? fight.hostName : fight.guestName;
      logLine(fight, '🏆 ' + wname + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer);
    }
  } else if(ab.kind === 'critBoost'){
    side.buffs.crit = { until: now + ab.dur, val: ab.critBonus };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.critBonus*100) + '% Krit!', '#ffd24a');
  } else if(ab.kind === 'dmgBoost'){
    side.buffs.dmgBoost = { until: now + ab.dur, val: ab.dmgBonus };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.dmgBonus*100) + '% Schaden!', '#ff8a3d');
  } else if(ab.kind === 'dmgReduce'){
    side.buffs.dmgReduce = { until: now + ab.dur, val: ab.dmgReduce };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – ' + Math.round(ab.dmgReduce*100) + '% weniger Schaden!', '#7fd0ff');
  } else if(ab.kind === 'lifesteal'){
    side.buffs.lifesteal = { until: now + ab.dur, val: ab.lifestealBonus };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.lifestealBonus*100) + '% Lebensraub!', '#e0466e');
  }
}

function schedule(fight){
  const iv = Math.min(900, Math.max(420, Math.min(fight.host.interval, fight.guest.interval)));
  _timer = setTimeout(() => exchange(fight), iv);
}

// Ein Schlag eines Angreifers gegen den Verteidiger (gibt Schaden + Crit zurück).
function strike(att, def, enr){
  const now = Date.now();
  let critChance = att.crit;
  if(now < att.buffs.crit.until) critChance += att.buffs.crit.val;
  const isCrit = Math.random() < Math.min(1, critChance);
  let dmg = Math.max(1, Math.round(att.atk * enr * rnd(0.15) * (isCrit ? att.critMult : 1)));
  if(now < att.buffs.dmgBoost.until) dmg = Math.max(1, Math.round(dmg * (1 + att.buffs.dmgBoost.val)));
  if(Math.random() < def.dodge) return { dodged: true };
  const armorRed = def.armor * COMBAT.armorReduction + (def.block || 0);
  dmg = Math.max(1, Math.round(dmg - armorRed));
  dmg = Math.max(1, Math.round(dmg * (1 - def.vers)));
  if(now < def.buffs.dmgReduce.until){
    dmg = Math.max(1, Math.round(dmg * (1 - def.buffs.dmgReduce.val)));
  }
  return { dmg, crit: isCrit };
}

function exchange(fight){
  if(fight.over) return;
  fight.turn++;
  const events = [];

  // Soft-Enrage: ab DUEL_ENRAGE_TURN werden beide Kämpfer tödlicher.
  if(fight.turn > DUEL_ENRAGE_TURN){
    fight.enrageMult *= DUEL_ENRAGE_RAMP;
    if(fight.turn === DUEL_ENRAGE_TURN + 1) logLine(fight, '⏱️ ENRAGE! Beide Kämpfer werden mit jeder Runde tödlicher.', '#ff3b3b');
  }
  const enr = fight.enrageMult;

  // Beide schlagen gleichzeitig (gegen die HP VOR diesem Schlagabtausch).
  const hRes = strike(fight.host, fight.guest, enr);
  const gRes = strike(fight.guest, fight.host, enr);

  applyStrike(fight, 'host', 'guest', hRes, events);
  applyStrike(fight, 'guest', 'host', gRes, events);

  // Sieg-/Niederlage-Bestimmung (Werte können kurz negativ werden → fairer Vergleich).
  const hDead = fight.host.hp <= 0, gDead = fight.guest.hp <= 0;
  if(hDead || gDead){
    fight.over = true;
    if(hDead && gDead) fight.winner = fight.host.hp === fight.guest.hp ? 'draw' : (fight.host.hp > fight.guest.hp ? 'host' : 'guest');
    else fight.winner = hDead ? 'guest' : 'host';
    fight.host.hp = Math.max(0, fight.host.hp);
    fight.guest.hp = Math.max(0, fight.guest.hp);
    const wname = fight.winner === 'draw' ? null : (fight.winner === 'host' ? fight.hostName : fight.guestName);
    logLine(fight, fight.winner === 'draw' ? '🤝 Unentschieden – beide fallen gleichzeitig!' : '🏆 ' + wname + ' gewinnt das Duell!', '#ffd24a');
    clearTimeout(_timer);
    fight.events = events;
    syncDuel(fight, true);
    return;
  }

  fight.events = events;
  syncDuel(fight, false);
  schedule(fight);
}

function applyStrike(fight, attKey, defKey, res, events){
  const att = fight[attKey], def = fight[defKey];
  const attName = attKey === 'host' ? fight.hostName : fight.guestName;
  const defName = defKey === 'host' ? fight.hostName : fight.guestName;
  if(res.dodged){
    events.push({ s: attKey, t: defKey, o: 1 });
    logLine(fight, '💨 ' + defName + ' weicht aus!', '#9ec5ff');
    return;
  }
  def.hp -= res.dmg;
  fight.dmgDealt += res.dmg;
  events.push({ s: attKey, t: defKey, d: res.dmg, ...(res.crit ? { c: 1 } : {}), ...(att.usesStab ? { p: 1 } : {}) });
  logLine(fight, '⚔️ ' + attName + (res.crit ? ' ✨KRIT' : '') + ': -' + fmtBig(res.dmg) + ' HP', res.crit ? '#ffd24a' : '#cfc6dd');
  let ls = att.lifesteal;
  if(Date.now() < att.buffs.lifesteal.until) ls += att.buffs.lifesteal.val;
  if(ls > 0){
    const heal = Math.round(res.dmg * ls);
    if(heal > 0) att.hp = Math.min(att.maxHp, att.hp + heal);
  }
  // Dornen-Affix: flacher Bonusschaden am Verteidiger (analog Solo-Kampf).
  if(att.thorns > 0){ def.hp -= att.thorns; fight.dmgDealt += att.thorns; }
}

// Verbleibende Cooldowns je Ability-Id (leeres Objekt, wenn alles bereit).
function cdMapOf(side, now){
  const o = {};
  for(const id in side.abilCd){ const r = side.abilCd[id] - now; if(r > 0) o[id] = r; }
  return o;
}
// Buff-/Einschlag-Visualdaten einer Seite (Restzeiten + Einmal-Timestamps).
function fxOf(side, now){
  return {
    crit:   Math.max(0, side.buffs.crit.until - now),
    fire:   Math.max(0, side.buffs.dmgBoost.until - now),
    shield: Math.max(0, side.buffs.dmgReduce.until - now),
    blood:  Math.max(0, side.buffs.lifesteal.until - now),
    burstTs: side.burstTs || 0, burstMagic: side.burstMagic || 0,
    healTs: side.healTs || 0, drainTs: side.drainTs || 0,
  };
}
async function syncDuel(fight, finalWrite){
  const now = Date.now();
  fight.seq++;
  const data = {
    seq: fight.seq, turn: fight.turn, startedAt: fight.startedAt, dmgDealt: fight.dmgDealt,
    hostName: fight.hostName, guestName: fight.guestName,
    hostKey: fight.hostKey, guestKey: fight.guestKey,
    hostClass: fight.hostClass, guestClass: fight.guestClass,
    hostStab: fight.hostStab, guestStab: fight.guestStab,
    hostTier: fight.host.tier, guestTier: fight.guest.tier,
    hostHp: Math.ceil(Math.max(0, fight.host.hp)), hostMaxHp: fight.host.maxHp,
    guestHp: Math.ceil(Math.max(0, fight.guest.hp)), guestMaxHp: fight.guest.maxHp,
    hostPotions: fight.host.potions, guestPotions: fight.guest.potions,
    hostCd: cdMapOf(fight.host, now), guestCd: cdMapOf(fight.guest, now),
    events: fight.events || [],
    log: fight.log,
    fx: { host: fxOf(fight.host, now), guest: fxOf(fight.guest, now) },
    over: fight.over, winner: fight.winner,
  };
  try { await set(ref(db, COMBATP(fight.lobbyId)), data); } catch(e){ console.warn('Duell-Sync', e); }
}

export function stopDuelHost(){
  clearTimeout(_timer); _timer = null;
  if(_abilUnsub){ _abilUnsub(); _abilUnsub = null; }
  if(_fight) _fight.over = true;
  _fight = null;
}

export const DUEL = { POTIONS: DUEL_POTIONS };
