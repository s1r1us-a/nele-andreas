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
import { computePlayerStats, loadGuestSave, resolveActiveSlot } from './tower.js';
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
// Heiltränke sind im Duell bewusst NICHT erlaubt (sie heilen 50 % der Max-HP und
// würden den HP-starken Tank überproportional begünstigen).
const DUEL_TICK_MS     = 90;      // feiner Host-Takt; jede Seite schlägt nach EIGENEM Intervall
const DUEL_ENRAGE_MS   = 35000;   // ab hier eskalieren BEIDE Kämpfer → erzwingt ein Ende
const DUEL_ENRAGE_RAMP = 1.06;    // Schadensfaktor PRO SEKUNDE nach dem Enrage

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
    host: userKey, hostName: displayName, hostClass: classId || 'schurke',
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
    guest: userKey, guestName: displayName, guestClass: classId || 'schurke',
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

// Aussehens-/Stat-Bündel eines Spielstands (für Sprite + Stats des Gegners).
export function lookOf(save, stats){
  return {
    character: (save && save.character) || null,
    equipped:  (save && save.equipped)  || {},
    hideHelmet: !!(save && save.settings && save.settings.hideHelmet),
    tier: stats.tier,
  };
}
export { loadGuestSave, resolveActiveSlot };

// =====================================================================
//  HOST-ENGINE (läuft nur beim Host)
// =====================================================================
let _timer = null, _fight = null, _abilUnsub = null;

function rnd(v){ return 1 + (Math.random()*2 - 1)*v; }

function freshBuffs(){
  return { crit:{until:0,val:0}, dmgBoost:{until:0,val:0},
           dmgReduce:{until:0,val:0}, lifesteal:{until:0,val:0}, reflect:{until:0,val:0},
           haste:{until:0,val:0} };
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
    nextSwingAt: 0,
    abilCd: {}, buffs: freshBuffs(),
    burstTs: 0, healTs: 0, drainTs: 0, burstMagic: 0,
    // Neue Fähigkeiten: Betäubung, Stealth-Fenster, beschworene Wache.
    stunUntil: 0, stealthUntil: 0, petEndUntil: 0, petBonus: 0,
    // Talent-Aktive: Absorb-Schild, Todesrettung, Verwundbarkeit, Cast-Trigger.
    shield: 0, shieldUntil: 0, deathSaveUntil: 0, reviveHp: 0, vulnUntil: 0, vulnVal: 0, castTs: 0, castAb: '',
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
    turn: 0, seq: 0, over: false, winner: null, enrageMult: 1, enrageAnnounced: false,
    startedAt: Date.now(), dmgDealt: 0, log: {}, logCount: 0,
    lastHealTs: 0, healSide: '', lastAbilTs: 0,
    events: [],
  };
  _fight = fight;
  // Eigene Schlag-Timer je Seite (Angriffstempo zählt wieder).
  const t0 = Date.now();
  fight.host.nextSwingAt  = t0 + fight.host.interval;
  fight.guest.nextSwingAt = t0 + fight.guest.interval;
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
  if(typeof kind === 'string' && kind.indexOf('ability') === 0){
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
    side.healTs = now; side.healAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': +' + fmtBig(heal) + ' HP', '#37d67a');
  } else if(ab.kind === 'burst' || ab.kind === 'drain'){
    // Kanalisierter Seelenraub: Lebensentzug pro Sekunde über die volle Dauer.
    // Jeder Tick setzt drainTs neu → der Strahl wird auf den Clients erneut gespielt.
    if(ab.kind === 'drain' && ab.dur){ startDuelDrain(fight, role, side, opp, name, ab); return; }
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    if(ab.kind === 'drain'){ side.hp = Math.min(side.maxHp, side.hp + dmg); side.drainTs = now; side.drainAb = ab.id; }
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden' +
      (ab.kind === 'drain' ? ' (+Heilung)' : ''), '#ffd24a');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      const wname = role === 'host' ? fight.hostName : fight.guestName;
      logLine(fight, '🏆 ' + wname + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer);
    }
  } else if(ab.kind === 'echo'){
    // Arkanschlag: im Duell als ein kombinierter Treffer (Sofort + Echo); die
    // Clients spielen die Doppel-Detonation per ABILITY_VFX[ab.id].
    const dmg = Math.max(1, Math.round(side.atk * ((ab.burstMult||1.6) + (ab.echoMult||ab.burstMult||1))));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden', '#9be7ff');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      const wname = role === 'host' ? fight.hostName : fight.guestName;
      logLine(fight, '🏆 ' + wname + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer);
    }
  } else if(ab.kind === 'critBoost'){
    side.buffs.crit = { until: now + ab.dur, val: ab.critBonus, src: ab.id };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.critBonus*100) + '% Krit!', '#ffd24a');
  } else if(ab.kind === 'haste'){
    // Klingenrausch: temporärer Angriffstempo-Schub (schnellere Eigen-Schläge).
    side.buffs.haste = { until: now + ab.dur, val: ab.hasteBonus, src: ab.id };
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.hasteBonus*100) + '% Angriffstempo!', '#9be7ff');
  } else if(ab.kind === 'execute'){
    // Hinrichtung (Meuchelstoß/Seelenfresser): unter der HP-Schwelle massiv verstärkt.
    const low = opp.hp <= opp.maxHp * (ab.threshold||0.3);
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult * (low ? (ab.execMult||2.5) : 1)));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    if(ab.heals){ side.hp = Math.min(side.maxHp, side.hp + dmg); }
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + (low?'HINRICHTUNG ':'') + fmtBig(dmg) + ' Schaden' + (ab.heals?' (+Heilung)':''), low?'#ff3030':'#ffd24a');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer);
    }
  } else if(ab.kind === 'dmgBoost'){
    side.buffs.dmgBoost = { until: now + ab.dur, val: ab.dmgBonus, src: ab.id };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.dmgBonus*100) + '% Schaden!', '#ff8a3d');
  } else if(ab.kind === 'dmgReduce'){
    side.buffs.dmgReduce = { until: now + ab.dur, val: ab.dmgReduce, src: ab.id };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – ' + Math.round(ab.dmgReduce*100) + '% weniger Schaden!', '#7fd0ff');
  } else if(ab.kind === 'lifesteal'){
    side.buffs.lifesteal = { until: now + ab.dur, val: ab.lifestealBonus, src: ab.id };
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round(ab.lifestealBonus*100) + '% Lebensraub!', '#e0466e');
  } else if(ab.kind === 'healBurst'){
    // Lichtsäule: heilt den Wirker und verbrennt den Gegner.
    const heal = Math.round(side.maxHp * ab.healPct);
    side.hp = Math.min(side.maxHp, side.hp + heal);
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult * (side.petEndUntil>now ? (1+side.petBonus) : 1)));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': +' + fmtBig(heal) + ' HP, ' + fmtBig(dmg) + ' Schaden', '#ffe9a8');
    if(opp.hp <= 0){ opp.hp = 0; fight.over = true; fight.winner = role;
      logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a'); clearTimeout(_timer); }
  } else if(ab.kind === 'stun'){
    // Donnerknall: Schaden + Betäubung des Gegners.
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult * (side.petEndUntil>now ? (1+side.petBonus) : 1)));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    opp.stunUntil = now + (ab.stunDur || 4000);
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden – Gegner ' + ((ab.stunDur||4000)/1000) + 's betäubt!', '#7fd0ff');
    if(opp.hp <= 0){ opp.hp = 0; fight.over = true; fight.winner = role;
      logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a'); clearTimeout(_timer); }
  } else if(ab.kind === 'vanish'){
    // Nebelschritt: vollständig unsichtbar – Gegner kann nicht angreifen, der Wirker
    // greift selbst nicht an; beim Wiederauftauchen ein garantierter Krit-Überfall.
    opp.stunUntil = now + ab.dur;
    side.stealthUntil = now + ab.dur;
    side.burstTs = now; side.burstMagic = 0; side.burstAb = ab.id;   // Rauchwolke / Verschwinden
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – verschwindet im Nebel! Gegner ' + (ab.dur/1000) + 's geblendet.', '#b6a0ff');
    scheduleDuelNebelAmbush(fight, role, side, opp, name, ab);
  } else if(ab.kind === 'summon'){
    // Teufelswache: beschworener Dämon verstärkt den Schaden über die Dauer.
    side.petEndUntil = now + (ab.petDur || 10000);
    side.petBonus = ab.petBonus || 0.25;
    side.burstTs = now; side.burstMagic = 0; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – eine Teufelswache kämpft mit (+' + Math.round((ab.petBonus||0.25)*100) + '% Schaden)!', '#9b30ff');
  } else if(ab.kind === 'dot'){
    startDuelDot(fight, role, side, opp, name, ab);
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – ' + Math.round(ab.dotMult*100) + '% Schaden/s für ' + (ab.dur/1000) + 's.', '#9acd32');
  } else if(ab.kind === 'hot'){
    startDuelHot(fight, role, side, name, ab);
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – Heilung über ' + (ab.dur/1000) + 's.', '#37d67a');
  } else if(ab.kind === 'absorb'){
    side.shield = Math.round(side.maxHp * (ab.absorbPct||0.4));
    side.shieldUntil = now + (ab.dur||10000);
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – Schild absorbiert ' + fmtBig(side.shield) + ' Schaden.', '#bfe3ff');
  } else if(ab.kind === 'cleanse'){
    side.buffs.dmgReduce.until = Math.max(side.buffs.dmgReduce.until, 0);   // (Duell hat keine Boss-Debuffs)
    const heal = Math.round(side.maxHp * (ab.healPct||0.25));
    side.hp = Math.min(side.maxHp, side.hp + heal); side.healTs = now; side.healAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': +' + fmtBig(heal) + ' HP', '#bfe3ff');
  } else if(ab.kind === 'deathsave'){
    side.deathSaveUntil = now + (ab.dur||10000);
    side.reviveHp = Math.round(side.maxHp * (ab.revivePct||0.3));
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – überlebt ' + (ab.dur/1000) + 's lang den Tod.', '#ffe9a8');
  } else if(ab.kind === 'reflect'){
    side.buffs.reflect = { until: now + ab.dur, val: ab.reflectPct||0.4, src: ab.id };
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – reflektiert ' + Math.round((ab.reflectPct||0.4)*100) + '% Schaden!', '#b6d0ff');
  } else if(ab.kind === 'vulnerability'){
    opp.vulnUntil = now + ab.dur; opp.vulnVal = ab.vulnPct||0.3;
    if(ab.burstMult){ const dmg = Math.max(1, Math.round(side.atk * ab.burstMult)); opp.hp -= dmg; fight.dmgDealt += dmg; side.burstTs = now; side.burstMagic = side.magic?1:0; side.burstAb = ab.id; }
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – Gegner +' + Math.round((ab.vulnPct||0.3)*100) + '% Schaden für ' + (ab.dur/1000) + 's.', '#ff8a3d');
    if(opp.hp <= 0){ opp.hp = 0; fight.over = true; fight.winner = role; logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a'); clearTimeout(_timer); }
  } else if(ab.kind === 'avatar'){
    side.buffs.dmgBoost  = { until: now + ab.dur, val: ab.dmgBonus||0.4, src: ab.id };
    side.buffs.dmgReduce = { until: now + ab.dur, val: ab.dmgReduce||0.4, src: ab.id };
    side.castTs = now; side.castAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ' – +' + Math.round((ab.dmgBonus||0.4)*100) + '% Schaden & −' + Math.round((ab.dmgReduce||0.4)*100) + '% erlitten!', '#ffd24a');
  }
}

// Host-seitiger Kanal des Seelenraubs: pro Sekunde Schaden am Gegner + Heilung
// in gleicher Höhe, über die gesamte Dauer. Reicht jeden Tick per syncDuel weiter.
function startDuelDrain(fight, role, side, opp, name, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round(ab.dur / tickMs));
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight || side.hp <= 0) return;
    const now = Date.now();
    const dmg = Math.max(1, Math.round(side.atk * ab.burstMult));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.hp = Math.min(side.maxHp, side.hp + dmg);
    side.drainTs = now; side.burstTs = now; side.burstMagic = side.magic ? 1 : 0;
    side.drainAb = ab.id; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden (+Heilung)', '#ffd24a');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      const wname = role === 'host' ? fight.hostName : fight.guestName;
      logLine(fight, '🏆 ' + wname + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer);
      fight.events = []; syncDuel(fight, true);
      return;
    }
    fight.events = []; syncDuel(fight, false);
    if(++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
}

// DoT am Gegner (Gift/Blutung): tickt dotMult·Atk Schaden über die Dauer (keine Heilung).
function startDuelDot(fight, role, side, opp, name, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||5000) / tickMs));
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight || side.hp <= 0) return;
    const now = Date.now();
    const dmg = Math.max(1, Math.round(side.atk * (ab.dotMult||0.5)));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': ' + fmtBig(dmg) + ' Schaden', '#9acd32');
    if(opp.hp <= 0){ opp.hp = 0; fight.over = true; fight.winner = role;
      logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer); fight.events = []; syncDuel(fight, true); return; }
    fight.events = []; syncDuel(fight, false);
    if(++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
}
// HoT am Wirker (Verjüngung): tickt hotPct·maxHp Heilung über die Dauer.
function startDuelHot(fight, role, side, name, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||8000) / tickMs));
  let i = 0;
  const tick = () => {
    if(fight.over || _fight !== fight || side.hp <= 0) return;
    const now = Date.now();
    const heal = Math.round(side.maxHp * (ab.hotPct||0.08));
    side.hp = Math.min(side.maxHp, side.hp + heal); side.healTs = now; side.healAb = ab.id;
    logLine(fight, ab.icon + ' ' + name + ' ' + ab.name + ': +' + fmtBig(heal) + ' HP', '#37d67a');
    fight.events = []; syncDuel(fight, false);
    if(++i < ticks) setTimeout(tick, tickMs);
  };
  setTimeout(tick, tickMs);
}

// Nebelschritt-Überfall (Host): nach dem Unsichtbarkeits-Fenster taucht der Wirker
// aus der Rauchwolke auf und landet einen garantierten kritischen Treffer.
function scheduleDuelNebelAmbush(fight, role, side, opp, name, ab){
  const dur = ab.dur || 5000;
  setTimeout(()=>{
    if(fight.over || _fight !== fight || side.hp <= 0) return;
    const now = Date.now();
    side.stealthUntil = 0;
    const petMult = now < (side.petEndUntil||0) ? (1 + (side.petBonus||0)) : 1;
    const dmg = Math.max(1, Math.round(side.atk * (ab.ambushMult||4) * side.critMult * petMult));
    opp.hp -= dmg; fight.dmgDealt += dmg;
    side.burstTs = now; side.burstMagic = side.magic ? 1 : 0; side.burstAb = 'nebelschritt_ambush';
    logLine(fight, '💨 ' + name + ' – Überfall aus dem Nebel: KRIT ' + fmtBig(dmg) + ' Schaden!', '#ffd24a');
    if(opp.hp <= 0){
      opp.hp = 0; fight.over = true; fight.winner = role;
      logLine(fight, '🏆 ' + (role==='host'?fight.hostName:fight.guestName) + ' gewinnt das Duell!', '#ffd24a');
      clearTimeout(_timer); fight.events = []; syncDuel(fight, true); return;
    }
    fight.events = []; syncDuel(fight, false);
  }, dur);
}

// Feiner Host-Takt: jede Seite schlägt nach ihrem EIGENEN Intervall (Tempo zählt).
function schedule(fight){ _timer = setTimeout(() => tick(fight), DUEL_TICK_MS); }

// Ein Schlag eines Angreifers gegen den Verteidiger (gibt Schaden + Crit zurück).
function strike(att, def, enr){
  const now = Date.now();
  let critChance = att.crit;
  if(now < att.buffs.crit.until) critChance += att.buffs.crit.val;
  const isCrit = Math.random() < Math.min(1, critChance);
  let dmg = Math.max(1, Math.round(att.atk * enr * rnd(0.15) * (isCrit ? att.critMult : 1)));
  if(now < att.buffs.dmgBoost.until) dmg = Math.max(1, Math.round(dmg * (1 + att.buffs.dmgBoost.val)));
  if(now < (att.petEndUntil||0)) dmg = Math.max(1, Math.round(dmg * (1 + (att.petBonus||0))));   // Teufelswache
  if(now < (def.vulnUntil||0)) dmg = Math.max(1, Math.round(dmg * (1 + (def.vulnVal||0))));   // Schildwurf: Verwundbarkeit
  if(Math.random() < def.dodge) return { dodged: true };
  const armorRed = def.armor * COMBAT.armorReduction + (def.block || 0);
  dmg = Math.max(1, Math.round(dmg - armorRed));
  dmg = Math.max(1, Math.round(dmg * (1 - def.vers)));
  if(now < def.buffs.dmgReduce.until){
    dmg = Math.max(1, Math.round(dmg * (1 - def.buffs.dmgReduce.val)));
  }
  return { dmg, crit: isCrit };
}

function tick(fight){
  if(fight.over) return;
  const now = Date.now();
  const events = [];

  // Soft-Enrage zeitbasiert: ab DUEL_ENRAGE_MS eskalieren beide Kämpfer pro Sekunde.
  const overEnrage = now - fight.startedAt - DUEL_ENRAGE_MS;
  if(overEnrage > 0){
    fight.enrageMult = Math.pow(DUEL_ENRAGE_RAMP, overEnrage / 1000);
    if(!fight.enrageAnnounced){
      fight.enrageAnnounced = true;
      logLine(fight, '⏱️ ENRAGE! Beide Kämpfer werden mit jeder Sekunde tödlicher.', '#ff3b3b');
    }
  }
  const enr = fight.enrageMult;

  // Jede Seite schlägt, sobald ihr eigenes Intervall verstrichen ist. Beide Seiten
  // dürfen im selben Tick zuschlagen (gegen die HP zu Beginn ihres Schlags), damit
  // ein gleichzeitiges Fallen weiterhin als Unentschieden gewertet werden kann.
  let swung = false;
  for(const [aKey, dKey] of [['host', 'guest'], ['guest', 'host']]){
    const att = fight[aKey];
    let guard = 0;
    while(now >= att.nextSwingAt && guard < 2){
      // Betäubt (Donnerknall des Gegners) ODER selbst im Nebel verborgen (Nebelschritt):
      // Schlag aussetzen, Takt weiterlaufen lassen.
      // Klingenrausch (haste): kürzeres Eigen-Intervall, solange das Fenster läuft.
      const swingInt = now < att.buffs.haste.until ? att.interval / (1 + att.buffs.haste.val) : att.interval;
      if(now < (att.stunUntil||0) || now < (att.stealthUntil||0)){ att.nextSwingAt += swingInt; guard++; continue; }
      applyStrike(fight, aKey, dKey, strike(att, fight[dKey], enr), events);
      att.nextSwingAt += swingInt;
      // Nach langer Pause (z. B. gedrosselter Tab) nicht nachfeuern.
      if(att.nextSwingAt < now - swingInt) att.nextSwingAt = now + swingInt;
      swung = true; guard++;
      if(fight[dKey].hp <= 0) break;   // keinen bereits Gefallenen mehrfach treffen
    }
  }
  if(swung) fight.turn++;

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
  if(events.length) syncDuel(fight, false);   // leere Ticks nicht synchronisieren
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
  const now = Date.now();
  let dmg = res.dmg;
  // Reflexion (Vergeltung): Anteil zurück an den Angreifer.
  if(now < def.buffs.reflect.until && def.buffs.reflect.val > 0){
    const refl = Math.max(1, Math.round(dmg * def.buffs.reflect.val));
    att.hp -= refl; fight.dmgDealt += refl;
    events.push({ s: defKey, t: attKey, d: refl });
  }
  // Absorb-Schild (Schutzschild): zuerst den Schild abtragen.
  if(now < (def.shieldUntil||0) && def.shield > 0){
    const soak = Math.min(def.shield, dmg); def.shield -= soak; dmg -= soak;
    if(def.shield <= 0){ def.shield = 0; def.shieldUntil = 0; }
  }
  def.hp -= dmg;
  // Todesrettung (Engelsgeist / Letzter Wall / Seelenstein).
  if(def.hp <= 0 && now < (def.deathSaveUntil||0)){ def.hp = Math.max(1, def.reviveHp||1); def.deathSaveUntil = 0; }
  fight.dmgDealt += dmg;
  events.push({ s: attKey, t: defKey, d: dmg, ...(res.crit ? { c: 1 } : {}), ...(att.usesStab ? { p: 1 } : {}) });
  logLine(fight, '⚔️ ' + attName + (res.crit ? ' ✨KRIT' : '') + ': -' + fmtBig(dmg) + ' HP', res.crit ? '#ffd24a' : '#cfc6dd');
  let ls = att.lifesteal;
  if(Date.now() < att.buffs.lifesteal.until) ls += att.buffs.lifesteal.val;
  if(ls > 0){
    // Heilung pro Treffer hart deckeln (Anteil der maxHP) – gegen Runaway-Healing.
    const heal = Math.min(Math.round(att.maxHp * COMBAT.lifestealHealCapPct), Math.round(dmg * ls));
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
    haste:  Math.max(0, side.buffs.haste.until - now),
    critSrc: side.buffs.crit.src || '', fireSrc: side.buffs.dmgBoost.src || '',
    shieldSrc: side.buffs.dmgReduce.src || '', bloodSrc: side.buffs.lifesteal.src || '',
    hasteSrc: side.buffs.haste.src || '',
    burstTs: side.burstTs || 0, burstMagic: side.burstMagic || 0, burstAb: side.burstAb || '',
    healTs: side.healTs || 0, healAb: side.healAb || '',
    drainTs: side.drainTs || 0, drainAb: side.drainAb || '',
    // Neue Fähigkeiten: Betäubung / Stealth / Teufelswache (Restzeiten in ms).
    stun:    Math.max(0, (side.stunUntil||0)    - now),
    stealth: Math.max(0, (side.stealthUntil||0) - now),
    pet:     Math.max(0, (side.petEndUntil||0)  - now),
    // Talent-Aktive: Absorb-Schild / Reflexion / Verwundbarkeit / Todesrettung + Cast-Trigger.
    absorb:    Math.max(0, (side.shieldUntil||0)   - now),
    reflect:   Math.max(0, (side.buffs.reflect.until||0) - now),
    vuln:      Math.max(0, (side.vulnUntil||0)     - now),
    deathsave: Math.max(0, (side.deathSaveUntil||0)- now),
    castTs: side.castTs || 0, castAb: side.castAb || '',
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
