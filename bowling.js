// ============================================================
//  BOWLING · HAUPT-MODUL  🎳
//  Firebase (Auth + Realtime DB), Modus-Auswahl, Lobby/Coins,
//  frameweise Turn-Sync, Live-Streaming des Wurfs und Statistik.
//  Verdrahtet die 3D-BowlingEngine + die Score-Logik mit dem DOM.
//  Struktur angelehnt an minigolf.js.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { contributeToTopf } from './savings-helper.js';
import { BowlingEngine } from './bowling-engine.js';
import {
  NUM_FRAMES, fullRack, frameComplete, isGameComplete, scoreFrames, rollSymbol,
} from './bowling-lane.js';

const app = initializeApp({
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
});
const db = getDatabase(app);
const auth = getAuth(app);

const GAME_REF = 'bowling/andreas_vs_nele';
const LIVE_REF = 'bowling/andreas_vs_nele_live';
const STRIKE_REWARD = 150;
const SPARE_REWARD = 75;
const SOLO_COIN_PER_PIN = 5;

let currentUser = null;       // 'Andreas' | 'Nele'
let currentCoins = 0;
let engine = null;
let mode = null;              // 'mp' | 'solo'
let mpState = null;
let gameListener = null;
let liveListener = null;
let liveActive = false;
let statsListener = null;

let renderedRackSig = '';
let shownShotTime = 0;
let awaitingWrite = false;
let finishedPaidOut = false;
let solo = null;

const $ = (id) => document.getElementById(id);
const lc = (n) => (n || '').toLowerCase();

function displayName(email) {
  if (email.toLowerCase() === 'raederich@outlook.com') return 'Andreas';
  if (email.toLowerCase() === 'nele.busse@web.de') return 'Nele';
  return email.split('@')[0];
}
function otherPlayer(name) { return name === 'Andreas' ? 'Nele' : 'Andreas'; }

function showToast(msg, dur = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Daten-/Score-Helfer ────────────────────────────────────
function framesArr(v) {
  if (!Array.isArray(v)) {
    if (v && typeof v === 'object') v = Object.keys(v).sort((a, b) => +a - +b).map(k => v[k]);
    else return [];
  }
  return v.map(f => Array.isArray(f) ? f.map(x => x || 0) : []);
}
function maskArr(v) {
  const a = fullRack();
  if (Array.isArray(v)) for (let i = 0; i < 10; i++) a[i] = !!v[i];
  return a;
}
function allDown(mask) { return mask.every(s => !s); }
function knockedCount(prev, now) {
  let n = 0;
  for (let i = 0; i < 10; i++) if (prev[i] && !now[i]) n++;
  return n;
}
function totalOf(frames) { return scoreFrames(frames).total; }

// Strikes/Spares für Statistik (frische Pin-Aufstellung beachtet)
function countStrikes(frames) {
  let n = 0;
  frames.forEach((rolls, f) => {
    if (!rolls) return;
    if (f < 9) { if (rolls[0] === 10) n++; }
    else {
      if (rolls[0] === 10) n++;
      if (rolls[0] === 10 && rolls[1] === 10) n++;
      if (rolls[0] === 10 && rolls[1] === 10 && rolls[2] === 10) n++;
      if (rolls[0] !== 10 && rolls[0] + rolls[1] === 10 && rolls[2] === 10) n++;
    }
  });
  return n;
}
function countSpares(frames) {
  let n = 0;
  frames.forEach((rolls, f) => {
    if (!rolls || rolls.length < 2) return;
    if (rolls[0] !== 10 && rolls[0] + rolls[1] === 10) n++;
  });
  return n;
}

// ── Engine-Aufbau ──────────────────────────────────────────
function ensureEngine() {
  if (engine) return;
  engine = new BowlingEngine($('arenaMount'), {
    onShotStart: handleShotStart,
    onShotComplete: handleShotComplete,
    onAim: handleAim,
    onShotTick: handleShotTick,
    onAimModeChange: reflectAimMode,
  });
  engine.start();
}

const IS_TOUCH = window.matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);

function setAimToggleVisible(show) {
  const btn = $('aimToggleBtn');
  if (!btn) return;
  const on = show && IS_TOUCH;
  btn.style.display = on ? 'block' : 'none';
  if (!on) { btn.classList.remove('active'); btn.textContent = '🎯 Zielen'; }
}
function reflectAimMode(aimOn) {
  const btn = $('aimToggleBtn');
  if (!btn) return;
  btn.classList.toggle('active', aimOn);
  btn.textContent = aimOn ? '🎮 Kamera' : '🎯 Zielen';
  if (IS_TOUCH && btn.style.display !== 'none') {
    setHint(aimOn ? 'Ziehen & loslassen zum Werfen 🎳' : 'Finger ziehen = Kamera · 🎯 zum Zielen');
  }
}

function handleShotTick(snap) {
  if (mode !== 'mp') return;
  set(ref(db, LIVE_REF), { player: currentUser, ...snap, t: Date.now() }).catch(() => {});
}
function handleLive(v) {
  if (!v || !engine) return;
  if (v.player === currentUser) return;
  liveActive = true;
  engine.applyLiveSnapshot(v);
}
function handleAim(ratio, aiming) {
  const wrap = $('powerWrap');
  wrap.classList.toggle('show', aiming && ratio > 0);
  $('powerFill').style.width = Math.round(ratio * 100) + '%';
}
function handleShotStart() { /* Wurf gestartet – Eingabe ist in der Engine schon gesperrt */ }
function handleShotComplete(res) {
  if (mode === 'solo') return soloShotDone(res);
  return mpShotDone(res);
}

// ============================================================
//  MODUS-AUSWAHL
// ============================================================
function showSection(name) {
  const isMob = window.matchMedia('(max-width:600px)').matches;
  document.body.classList.toggle('mobile-game', name === 'game' && isMob);
  $('modeSection').style.display = name === 'mode' ? 'flex' : 'none';
  const statsPanel = $('statsPanel');
  if (statsPanel) statsPanel.style.display = name === 'mode' ? 'block' : 'none';
  $('lobbySection').style.display = name === 'lobby' ? 'block' : 'none';
  $('gameSection').style.display = name === 'game' ? 'block' : 'none';
  if (name === 'game') requestAnimationFrame(() => requestAnimationFrame(() => engine && engine._resize()));
}

function chooseMultiplayer() {
  mode = 'mp';
  if (gameListener) gameListener();
  gameListener = onValue(ref(db, GAME_REF), snap => handleMpState(snap.val()));
  if (liveListener) liveListener();
  liveListener = onValue(ref(db, LIVE_REF), snap => handleLive(snap.val()));
}
function chooseSolo() {
  mode = 'solo';
  if (gameListener) { gameListener(); gameListener = null; }
  startSolo();
}

// ============================================================
//  SOLO
// ============================================================
function startSolo() {
  solo = { frames: [[]], frameIdx: 0, standing: fullRack() };
  showSection('game');
  setupSoloHud();
  ensureEngine();
  engine.setBallColor('solo');
  engine.newRack(fullRack());
  engine.armBall();
  setAimToggleVisible(true);
  updateSoloHud();
  setHint('Frame 1 — zieh zurück & lass los 🎳');
}

function soloShotDone(res) {
  const prev = solo.standing;
  const knocked = knockedCount(prev, res.standing);
  if (!solo.frames[solo.frameIdx]) solo.frames[solo.frameIdx] = [];
  const rolls = solo.frames[solo.frameIdx];
  const wasFreshRack = prev.every(s => s);
  rolls.push(knocked);

  rewardRoll(currentUser, knocked, wasFreshRack, rolls);
  updateSoloHud();

  if (frameComplete(solo.frameIdx, rolls)) {
    if (solo.frameIdx + 1 >= NUM_FRAMES) {
      engine.setInputEnabled(false);
      setAimToggleVisible(false);
      setTimeout(finishSolo, 1100);
      return;
    }
    solo.frameIdx++;
    solo.frames[solo.frameIdx] = [];
    solo.standing = fullRack();
    setTimeout(() => { engine.newRack(fullRack()); engine.armBall(); setAimToggleVisible(true); setHint('Frame ' + (solo.frameIdx + 1) + ' 🎳'); }, 1100);
  } else {
    solo.standing = allDown(res.standing) ? fullRack() : res.standing;
    setTimeout(() => { engine.newRack(solo.standing); engine.armBall(); setAimToggleVisible(true); }, 1100);
  }
}

async function finishSolo() {
  const score = totalOf(solo.frames);
  const strikes = countStrikes(solo.frames);
  const spares = countSpares(solo.frames);
  const earned = score * SOLO_COIN_PER_PIN;
  if (earned > 0) {
    await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) + earned).catch(() => {});
    await safeStat(`stats/${lc(currentUser)}/bowling/coinsEarned`, c => (c || 0) + earned);
  }
  await saveStats(currentUser, { score, strikes, spares, played: false });
  showResult({
    emoji: score === 300 ? '👑' : score >= 150 ? '🏆' : '🎳',
    title: score === 300 ? 'Perfektes Spiel!' : 'Spiel beendet!',
    sub: `Endstand: ${score} Punkte · ${strikes}× Strike`,
    coins: earned > 0 ? `+${earned.toLocaleString('de-DE')} 🪙` : '',
    konfetti: score >= 150,
  });
}

// ============================================================
//  MULTIPLAYER
// ============================================================
function handleMpState(state) {
  mpState = state;
  if (!state) { renderedRackSig = ''; finishedPaidOut = false; shownShotTime = 0; showLobby('create'); return; }
  if (state.status === 'waiting') {
    if (state.createdBy === currentUser) showLobby('waiting', state);
    else showLobby('invite', state);
    return;
  }
  if (state.status === 'running' || state.status === 'finished') {
    showSection('game');
    setupMpHud();
    syncMultiplayer(state);
    if (state.status === 'finished') showMpResult(state);
  }
}

function syncMultiplayer(state) {
  ensureEngine();
  const me = currentUser;
  const cur = state.current || { player: state.createdBy, frameIdx: 0, standing: fullRack() };
  const standing = maskArr(cur.standing);
  const myTurn = state.status === 'running' && cur.player === me;

  // Abgeschlossenen Gegnerwurf erkennen → Live-Stream auf autoritativen Zustand setzen
  if (state.lastShot && state.lastShot.time > shownShotTime) {
    shownShotTime = state.lastShot.time;
    if (liveActive) { liveActive = false; engine.clearLive(); }
  }

  const sig = cur.player + '|' + cur.frameIdx + '|' + standing.map(s => s ? 1 : 0).join('');
  if (sig !== renderedRackSig) {
    renderedRackSig = sig;
    engine.newRack(standing);
    if (myTurn) { engine.setBallColor(lc(me)); engine.armBall(); awaitingWrite = false; }
    else { engine.setBallColor(lc(cur.player)); engine.disarm(); }
  }
  if (myTurn && awaitingWrite) engine.setInputEnabled(false);
  setAimToggleVisible(myTurn && !awaitingWrite);

  updateMpHud(state);
  if (state.status === 'running') {
    setHint(myTurn ? '🎯 Du bist dran — zieh zurück & lass los' : `⏳ ${cur.player} ist am Zug…`);
  }
}

async function mpShotDone(res) {
  const state = mpState;
  if (!state) return;
  const me = currentUser;
  const createdBy = state.createdBy;
  awaitingWrite = true;
  engine.setInputEnabled(false);
  setAimToggleVisible(false);
  set(ref(db, LIVE_REF), null).catch(() => {});

  const cur = state.current;
  const frameIdx = cur.frameIdx;
  const prev = maskArr(cur.standing);
  const knocked = knockedCount(prev, res.standing);
  const wasFreshRack = prev.every(s => s);

  const frames = { Andreas: framesArr((state.frames || {}).Andreas), Nele: framesArr((state.frames || {}).Nele) };
  if (!frames[me][frameIdx]) frames[me][frameIdx] = [];
  const rolls = frames[me][frameIdx];
  rolls.push(knocked);

  rewardRoll(me, knocked, wasFreshRack, rolls);

  // Nächster Zustand bestimmen
  let next, finished = false;
  if (frameComplete(frameIdx, rolls)) {
    if (me === createdBy) {
      next = { player: otherPlayer(createdBy), frameIdx, standing: fullRack() };
    } else {
      const nf = frameIdx + 1;
      if (nf >= NUM_FRAMES) finished = true;
      else next = { player: createdBy, frameIdx: nf, standing: fullRack() };
    }
  } else {
    next = { player: me, frameIdx, standing: allDown(res.standing) ? fullRack() : res.standing };
  }

  const totals = { Andreas: totalOf(frames.Andreas), Nele: totalOf(frames.Nele) };
  const newState = {
    ...state, frames, totals,
    lastShot: { player: me, time: Date.now() },
  };

  if (finished) {
    newState.status = 'finished';
    newState.winner = totals.Andreas === totals.Nele ? 'draw' : (totals.Andreas > totals.Nele ? 'Andreas' : 'Nele');
    newState.current = { player: createdBy, frameIdx: NUM_FRAMES - 1, standing: fullRack() };
    await set(ref(db, GAME_REF), newState);
    await finishGameMP(newState);
    return;
  }
  newState.current = next;
  newState.turn = next.player;
  await set(ref(db, GAME_REF), newState);
}

// ── Coins & Stats ──────────────────────────────────────────
async function rewardRoll(player, knocked, wasFreshRack, rolls) {
  // Strike (frischer Satz, alle 10) bzw. Spare (Frame voll, kein Strike)
  if (wasFreshRack && knocked === 10) {
    showToast('🎳 Strike! +' + STRIKE_REWARD + ' 🪙');
    await awardCoins(player, STRIKE_REWARD, 'strike');
  } else if (!wasFreshRack && rolls.length >= 2 && rolls[rolls.length - 2] !== 10 &&
             rolls[rolls.length - 2] + knocked === 10) {
    showToast('✨ Spare! +' + SPARE_REWARD + ' 🪙');
    await awardCoins(player, SPARE_REWARD, 'spare');
  } else if (knocked === 0) {
    showToast('💨 Daneben…', 1500);
  }
}
async function awardCoins(player, amount, label) {
  try {
    await runTransaction(ref(db, `coins/${lc(player)}`), c => (c || 0) + amount);
    await safeStat(`stats/${lc(player)}/bowling/coinsEarned`, c => (c || 0) + amount);
  } catch (e) { console.warn('Coin-Belohnung fehlgeschlagen', label, e); }
}

async function finishGameMP(state) {
  if (finishedPaidOut) return;
  finishedPaidOut = true;
  const winner = state.winner;
  const bet = state.bet || 0;
  if (bet > 0) {
    if (winner === 'draw') {
      await runTransaction(ref(db, 'coins/andreas'), c => (c || 0) + bet);
      await runTransaction(ref(db, 'coins/nele'), c => (c || 0) + bet);
    } else {
      await runTransaction(ref(db, `coins/${lc(winner)}`), c => (c || 0) + bet * 2);
      await safeStat(`stats/${lc(winner)}/coinsEarned`, c => (c || 0) + bet * 2);
      await safeStat(`stats/${lc(winner)}/coinsSpent`, c => (c || 0) + bet);
      await safeStat(`stats/${lc(otherPlayer(winner))}/coinsSpent`, c => (c || 0) + bet);
    }
  }
  const frames = { Andreas: framesArr((state.frames || {}).Andreas), Nele: framesArr((state.frames || {}).Nele) };
  for (const p of ['Andreas', 'Nele']) {
    const won = winner !== 'draw' && winner === p;
    const lost = winner !== 'draw' && winner !== p;
    await saveStats(p, {
      score: totalOf(frames[p]), strikes: countStrikes(frames[p]), spares: countSpares(frames[p]),
      played: true, won, lost,
    });
  }
}

async function safeStat(path, fn) {
  try { await runTransaction(ref(db, path), fn); }
  catch (e) { console.warn('Stat-Update fehlgeschlagen', path, e); }
}

async function saveStats(player, { score, strikes, spares, played, won, lost }) {
  const base = `stats/${lc(player)}/bowling`;
  if (played) {
    await safeStat(`${base}/gamesPlayed`, c => (c || 0) + 1);
    if (won) await safeStat(`${base}/gamesWon`, c => (c || 0) + 1);
    if (lost) await safeStat(`${base}/gamesLost`, c => (c || 0) + 1);
  }
  await safeStat(`${base}/roundsPlayed`, c => (c || 0) + 1);
  await safeStat(`${base}/totalScore`, c => (c || 0) + score);
  await safeStat(`${base}/totalPins`, c => (c || 0) + score);
  if (strikes) await safeStat(`${base}/strikes`, c => (c || 0) + strikes);
  if (spares) await safeStat(`${base}/spares`, c => (c || 0) + spares);
  await safeStat(`${base}/bestScore`, c => (!c || score > c) ? score : c);
  if (score === 300) await safeStat(`${base}/perfectGames`, c => (c || 0) + 1);
}

function subscribeMyStats() {
  if (!currentUser) return;
  if (statsListener) statsListener();
  statsListener = onValue(ref(db, `stats/${lc(currentUser)}/bowling`), snap => renderStats(snap.val() || {}));
}
function renderStats(s) {
  const grid = $('statsGrid');
  if (!grid) return;
  const rounds = s.roundsPlayed || 0;
  const avg = rounds > 0 ? Math.round((s.totalScore || 0) / rounds) : '–';
  const tiles = [
    { v: s.gamesWon || 0, l: 'Siege' },
    { v: s.gamesLost || 0, l: 'Niederlagen' },
    { v: s.bestScore != null ? s.bestScore : '–', l: 'Bestscore' },
    { v: s.strikes || 0, l: 'Strikes' },
    { v: avg, l: 'Ø Score' },
  ];
  grid.innerHTML = tiles.map(t =>
    `<div class="stat-tile"><div class="stat-value">${t.v}</div><div class="stat-label">${t.l}</div></div>`
  ).join('');
}

// ============================================================
//  LOBBY-AKTIONEN
// ============================================================
function freshGameState(betVal) {
  return {
    status: 'waiting',
    createdBy: currentUser,
    bet: betVal,
    turn: currentUser,
    current: { player: currentUser, frameIdx: 0, standing: fullRack() },
    frames: { Andreas: [], Nele: [] },
    totals: { Andreas: 0, Nele: 0 },
    lastShot: null,
    winner: null,
    createdAt: Date.now(),
  };
}
async function createGame() {
  const betVal = parseInt($('betInput').value);
  if (!betVal || betVal < 50) { showToast('Mindestens 50 🪙!'); return; }
  if (betVal > currentCoins) { showToast('Nicht genug Coins! 😅'); return; }
  const existing = await get(ref(db, GAME_REF));
  if (existing.val()) { showToast('Es läuft bereits ein Spiel! 🎳'); return; }
  await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) - betVal);
  contributeToTopf(db, lc(currentUser), betVal, 'bowling').catch(() => {});
  finishedPaidOut = false;
  await set(ref(db, GAME_REF), freshGameState(betVal));
}
async function cancelGame() {
  if (!mpState) return;
  await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) + (mpState.bet || 0));
  await remove(ref(db, GAME_REF));
}
async function acceptGame() {
  if (!mpState) return;
  const bet = mpState.bet || 0;
  if (bet > currentCoins) { showToast('Nicht genug Coins! 😅'); return; }
  await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) - bet);
  contributeToTopf(db, lc(currentUser), bet, 'bowling').catch(() => {});
  finishedPaidOut = false;
  await set(ref(db, GAME_REF), { ...mpState, status: 'running' });
}
async function declineGame() {
  if (!mpState) return;
  await runTransaction(ref(db, `coins/${lc(mpState.createdBy)}`), c => (c || 0) + (mpState.bet || 0));
  await remove(ref(db, GAME_REF));
  showToast('Herausforderung abgelehnt.');
}
async function surrenderGame() {
  if (!mpState || mpState.status !== 'running') return;
  const winner = otherPlayer(currentUser);
  const newState = { ...mpState, status: 'finished', winner };
  await set(ref(db, GAME_REF), newState);
  await finishGameMP(newState);
  showToast('Du hast aufgegeben.');
}
async function leaveGame() {
  if (mode === 'mp' && mpState && mpState.status === 'finished') {
    await remove(ref(db, GAME_REF)).catch(() => {});
  }
  resetToMode();
}
function resetToMode() {
  if (engine) { engine.dispose(); engine = null; }
  if (gameListener) { gameListener(); gameListener = null; }
  if (liveListener) { liveListener(); liveListener = null; }
  liveActive = false;
  mode = null; mpState = null; solo = null;
  renderedRackSig = ''; shownShotTime = 0;
  $('resultOverlay').classList.remove('open');
  document.body.classList.remove('mp-game');
  showSection('mode');
}

// ============================================================
//  UI: HUD / LOBBY / RESULT
// ============================================================
function showLobby(modeName, state = null) {
  showSection('lobby');
  $('createCard').style.display = modeName === 'create' ? 'block' : 'none';
  $('waitingCard').style.display = modeName === 'waiting' ? 'block' : 'none';
  $('inviteCard').style.display = modeName === 'invite' ? 'block' : 'none';
  if (modeName === 'waiting' && state) {
    $('waitingForName').textContent = otherPlayer(currentUser);
    $('waitingBetDisplay').textContent = (state.bet || 0).toLocaleString('de-DE');
  }
  if (modeName === 'invite' && state) {
    $('inviterName').textContent = state.createdBy;
    $('inviteBetDisplay').textContent = (state.bet || 0).toLocaleString('de-DE') + ' 🪙 Einsatz';
  }
  if (modeName === 'create') {
    $('betHint').textContent = `Mindestens 50 🪙 · Du hast ${currentCoins.toLocaleString('de-DE')} 🪙`;
  }
}
function setHint(txt) { $('arenaHint').textContent = txt; }

function setupSoloHud() {
  $('infoOpp').style.display = 'none';
  $('nameMe').textContent = 'Du';
  $('surrenderBtn').style.display = 'none';
  $('scorecard').style.display = 'block';
  $('scorecard').classList.remove('show');
  document.body.classList.remove('mp-game');
}
function updateSoloHud() {
  $('strokesMe').textContent = totalOf(solo.frames);
  $('turnLabelMe').textContent = '🎯 Am Zug';
  $('holeNum').textContent = 'Frame ' + (solo.frameIdx + 1) + ' / ' + NUM_FRAMES;
  const rolls = solo.frames[solo.frameIdx] || [];
  $('holePar').textContent = 'Wurf ' + (rolls.length + 1);
  renderScorecard({ Du: solo.frames }, ['Du']);
}

function setupMpHud() {
  $('infoOpp').style.display = 'block';
  $('nameMe').textContent = currentUser;
  $('nameOpp').textContent = otherPlayer(currentUser);
  $('surrenderBtn').style.display = 'block';
  $('scorecard').style.display = 'block';
  document.body.classList.add('mp-game');
}
function updateMpHud(state) {
  const me = currentUser, opp = otherPlayer(me);
  const totals = state.totals || { Andreas: 0, Nele: 0 };
  $('strokesMe').textContent = totals[me] || 0;
  $('strokesOpp').textContent = totals[opp] || 0;
  const cur = state.current || { frameIdx: 0 };
  $('holeNum').textContent = 'Frame ' + ((cur.frameIdx || 0) + 1) + ' / ' + NUM_FRAMES;
  $('holePar').textContent = cur.player ? cur.player + ' wirft' : '';
  const infoMe = $('infoMe'), infoOpp = $('infoOpp');
  const myTurn = cur.player === me;
  infoMe.className = 'player-info' + (myTurn ? ' active' + (me === 'Nele' ? ' nele-active' : '') : '');
  infoOpp.className = 'player-info' + (!myTurn ? ' active' + (opp === 'Nele' ? ' nele-active' : '') : '');
  $('turnLabelMe').textContent = myTurn ? '🎯 Am Zug' : '';
  $('turnLabelOpp').textContent = !myTurn ? '🎯 Am Zug' : '';
  const frames = { Andreas: framesArr((state.frames || {}).Andreas), Nele: framesArr((state.frames || {}).Nele) };
  renderScorecard(frames, ['Andreas', 'Nele']);
}

// Bowling-Scorecard: 10 Frames mit Wurf-Symbolen + kumulativer Summe
function renderScorecard(framesByPlayer, players) {
  let head = '<tr><th>Spieler</th>';
  for (let f = 0; f < NUM_FRAMES; f++) head += `<th>${f + 1}</th>`;
  head += '<th>Σ</th></tr>';
  const row = (name) => {
    const frames = framesByPlayer[name] || [];
    const { cum, total } = scoreFrames(frames);
    let r = `<tr><td class="name">${name}</td>`;
    for (let f = 0; f < NUM_FRAMES; f++) {
      const rolls = frames[f] || [];
      const syms = rolls.map((_, i) => rollSymbol(f, i, rolls)).join(' ');
      const c = cum[f] != null ? cum[f] : '';
      r += `<td><div class="fr-rolls">${syms || '&nbsp;'}</div><div class="fr-cum">${c}</div></td>`;
    }
    r += `<td class="total">${total}</td></tr>`;
    return r;
  };
  $('scoreTable').innerHTML = head + players.map(row).join('');
}

function showMpResult(state) {
  const me = currentUser;
  const winner = state.winner;
  const isWinner = winner === me;
  const isDraw = winner === 'draw';
  const bet = state.bet || 0;
  showResult({
    emoji: isDraw ? '🤝' : isWinner ? '🏆' : '💔',
    title: isDraw ? 'Unentschieden!' : isWinner ? 'Gewonnen! 🎉' : 'Verloren…',
    sub: isDraw ? 'Gleichstand – ihr bekommt euren Einsatz zurück.'
      : isWinner ? `Mehr Holz als ${otherPlayer(me)} — stark!`
        : `${winner} hatte mehr Punkte.`,
    coins: bet > 0 ? (isDraw ? `+${bet.toLocaleString('de-DE')} 🪙 zurück`
      : isWinner ? `+${(bet * 2).toLocaleString('de-DE')} 🪙`
        : `-${bet.toLocaleString('de-DE')} 🪙`) : '',
    konfetti: isWinner && !isDraw,
  });
}
function showResult({ emoji, title, sub, coins, konfetti }) {
  $('resultEmoji').textContent = emoji;
  $('resultTitle').textContent = title;
  $('resultSub').textContent = sub;
  $('resultCoins').textContent = coins || '';
  $('resultOverlay').classList.add('open');
  if (konfetti) spawnKonfetti();
}
function spawnKonfetti() {
  const colors = ['#e8738a', '#f5a3b5', '#d4a061', '#a78bfa', '#4ecdc4', '#fbbf24'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'konfetti-piece';
    const size = 6 + Math.random() * 10;
    el.style.cssText = `width:${size}px;height:${size * (0.4 + Math.random() * 0.6)}px;left:${Math.random() * 100}vw;top:${-20 - Math.random() * 40}px;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${1.5 + Math.random() * 2}s;animation-delay:${Math.random() * 0.5}s;transform:rotate(${Math.random() * 360}deg);border-radius:${Math.random() > 0.5 ? '50%' : '3px'};`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ============================================================
//  EVENT-LISTENER
// ============================================================
$('modeMpBtn').addEventListener('click', chooseMultiplayer);
$('modeSoloBtn').addEventListener('click', chooseSolo);
$('createGameBtn').addEventListener('click', createGame);
$('cancelGameBtn').addEventListener('click', cancelGame);
$('acceptBtn').addEventListener('click', acceptGame);
$('declineBtn').addEventListener('click', declineGame);
$('surrenderBtn').addEventListener('click', surrenderGame);
$('leaveBtn').addEventListener('click', leaveGame);
$('playAgainBtn').addEventListener('click', leaveGame);
$('aimToggleBtn').addEventListener('click', () => { if (engine) engine.setAimMode(!engine.aimMode); });
$('scoreToggleBtn').addEventListener('click', () => $('scorecard').classList.toggle('show'));
$('scorecard').addEventListener('click', () => $('scorecard').classList.remove('show'));
$('curveSlider').addEventListener('input', function () {
  if (engine) engine.setCurve(parseInt(this.value) / 100);
  $('curveValue').textContent = this.value > 0 ? '↪ ' + this.value : this.value < 0 ? '↩ ' + (-this.value) : '0';
});
$('betInput').addEventListener('input', function () {
  const val = parseInt(this.value) || 0;
  $('betHint').style.color = val > currentCoins ? '#dc2626' : 'var(--text-mid)';
});

// ============================================================
//  AUTH
// ============================================================
const loginBtn = $('loginBtn');
const logoutBtn = $('logoutBtn');
loginBtn.addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  const pw = $('loginPassword').value;
  $('loginError').textContent = '';
  loginBtn.textContent = '…';
  try { await signInWithEmailAndPassword(auth, email, pw); }
  catch { loginBtn.textContent = 'Einloggen 🌸'; $('loginError').textContent = 'E-Mail oder Passwort falsch 🐾'; }
});
$('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  $('authLoading').style.display = 'none';
  if (!user) {
    $('modalOverlay').style.display = 'flex';
    $('topBar').style.display = 'none';
    $('mainPage').style.display = 'none';
    return;
  }
  currentUser = displayName(user.email);
  $('modalOverlay').style.display = 'none';
  $('topBar').style.display = 'flex';
  $('mainPage').style.display = 'flex';
  logoutBtn.textContent = currentUser + ' ausloggen';
  subscribeMyStats();
  showSection('mode');

  onValue(ref(db, `coins/${lc(currentUser)}`), snap => {
    currentCoins = Number(snap.val()) || 0;
    $('coinCount').textContent = currentCoins.toLocaleString('de-DE');
    if ($('createCard').style.display !== 'none') {
      $('betHint').textContent = `Mindestens 50 🪙 · Du hast ${currentCoins.toLocaleString('de-DE')} 🪙`;
    }
  });
});
