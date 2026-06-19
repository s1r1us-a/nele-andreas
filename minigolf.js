// ============================================================
//  MINIGOLF · HAUPT-MODUL  ⛳
//  Firebase (Auth + Realtime DB), Modus-Auswahl, Lobby/Coins,
//  Turn-Sync (abwechselnd) und Statistiken. Verdrahtet die
//  3D-MinigolfEngine + die HOLES-Daten mit dem DOM.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { contributeToTopf } from './savings-helper.js';
import { HOLES } from './minigolf-course.js';
import { MinigolfEngine } from './minigolf-engine.js';

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

const GAME_REF = 'minigolf/andreas_vs_nele';
const BALL_R = 0.35;
const NUM_HOLES = HOLES.length;
const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

let currentUser = null;      // 'Andreas' | 'Nele'
let currentCoins = 0;
let engine = null;
let mode = null;             // 'mp' | 'solo'
let mpState = null;
let gameListener = null;

// Render-Tracking (Multiplayer)
let renderedHole = -1;
let shownShotTime = 0;
let controlKey = null;
let myShotFrom = null;
let awaitingWrite = false;
let finishedPaidOut = false;

// Solo-State
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

// ── Datenhelfer ────────────────────────────────────────────
function emptyStrokes() { return Array(NUM_HOLES).fill(0); }
function toArr(v) {
  const a = emptyStrokes();
  if (Array.isArray(v)) v.forEach((x, i) => { if (i < NUM_HOLES) a[i] = x || 0; });
  else if (v && typeof v === 'object') Object.keys(v).forEach(k => { const i = +k; if (i >= 0 && i < NUM_HOLES) a[i] = v[k] || 0; });
  return a;
}
function sum(a) { return a.reduce((s, x) => s + (x || 0), 0); }

function teeBalls(holeIdx) {
  const t = HOLES[holeIdx].tee;
  return {
    Andreas: { x: t.x - 0.45, y: BALL_R, z: t.z, holed: false },
    Nele: { x: t.x + 0.45, y: BALL_R, z: t.z, holed: false },
  };
}

// ── Engine-Aufbau (einmalig) ───────────────────────────────
function ensureEngine() {
  if (engine) return;
  engine = new MinigolfEngine($('arenaMount'), {
    onShotStart: handleShotStart,
    onShotComplete: handleShotComplete,
    onAim: handleAim,
  });
  engine.start();
}

function handleAim(ratio, aiming) {
  const wrap = $('powerWrap');
  wrap.classList.toggle('show', aiming && ratio > 0);
  $('powerFill').style.width = Math.round(ratio * 100) + '%';
}

function handleShotStart(key) {
  if (engine.balls[key]) {
    const p = engine.balls[key].mesh.position;
    myShotFrom = { x: p.x, y: p.y, z: p.z };
  }
}

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
  $('lobbySection').style.display = name === 'lobby' ? 'block' : 'none';
  $('gameSection').style.display = name === 'game' ? 'block' : 'none';
  if (name === 'game') setTimeout(() => engine && engine._resize(), 0);
}

function chooseMultiplayer() {
  mode = 'mp';
  if (gameListener) gameListener();
  gameListener = onValue(ref(db, GAME_REF), snap => handleMpState(snap.val()));
}

function chooseSolo() {
  mode = 'solo';
  if (gameListener) { gameListener(); gameListener = null; }
  startSolo();
}

// ============================================================
//  SOLO-MODUS
// ============================================================
function startSolo() {
  solo = { hole: 0, strokes: emptyStrokes(), strokesThisHole: 0, done: false };
  showSection('game');
  setupSoloHud();
  ensureEngine();
  loadSoloHole(0);
}

function loadSoloHole(idx) {
  solo.hole = idx;
  solo.strokesThisHole = 0;
  const t = HOLES[idx].tee;
  engine.loadHole(HOLES[idx], { solo: { x: t.x, y: BALL_R, z: t.z, holed: false } });
  engine.setActive('solo');
  updateSoloHud();
  setHint('Loch ' + (idx + 1) + ' · Par ' + HOLES[idx].par + ' — zieh zurück & lass los ⛳');
}

function soloShotDone(res) {
  solo.strokes[solo.hole] += 1 + (res.penalty ? 1 : 0);
  if (res.penalty) showToast('💦 Wasser! +1 Strafschlag');
  updateSoloHud();
  if (res.holed) {
    const s = solo.strokes[solo.hole];
    showToast(holeResultText(s, HOLES[solo.hole].par));
    engine.setInputEnabled(false);
    if (solo.hole + 1 >= NUM_HOLES) {
      solo.done = true;
      setTimeout(finishSolo, 900);
    } else {
      setTimeout(() => loadSoloHole(solo.hole + 1), 1100);
    }
  } else {
    engine.setActive('solo'); // weiterspielen
  }
}

async function finishSolo() {
  const total = sum(solo.strokes);
  const hio = solo.strokes.filter(s => s === 1).length;
  await saveStats(currentUser, { strokes: solo.strokes, total, holesInOne: hio, played: false });
  showResult({
    emoji: total <= TOTAL_PAR ? '🏆' : '⛳',
    title: 'Runde geschafft!',
    sub: `Gesamt: ${total} Schläge · Par ${TOTAL_PAR}`,
    coins: scoreVsPar(total - TOTAL_PAR),
    konfetti: total <= TOTAL_PAR,
  });
}

// ============================================================
//  MULTIPLAYER
// ============================================================
function handleMpState(state) {
  mpState = state;
  if (!state) { renderedHole = -1; controlKey = null; finishedPaidOut = false; showLobby('create'); return; }

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
    return;
  }
}

function syncMultiplayer(state) {
  ensureEngine();
  const me = currentUser, opp = otherPlayer(me);
  const meKey = lc(me), oppKey = lc(opp);
  const balls = state.balls || teeBalls(state.currentHole || 0);

  // Neues Loch laden
  if (state.currentHole !== renderedHole) {
    renderedHole = state.currentHole;
    const bs = {};
    bs[meKey] = balls[me]; bs[oppKey] = balls[opp];
    engine.loadHole(HOLES[state.currentHole], bs);
    shownShotTime = state.lastShot ? state.lastShot.time : 0;
    controlKey = null;
    const p = balls[me];
    myShotFrom = { x: p.x, y: p.y ?? BALL_R, z: p.z };
  }

  // Eingehende Schüsse / Ghost-Positionen
  for (const player of ['Andreas', 'Nele']) {
    const pKey = lc(player);
    if (pKey === controlKey) continue; // aktiven Ball besitzt die Engine
    if (state.lastShot && state.lastShot.player === player && state.lastShot.time > shownShotTime) {
      shownShotTime = state.lastShot.time;
      engine.replayShot(pKey, state.lastShot.from, state.lastShot.to);
    } else {
      engine.updateBallGhost(pKey, balls[player]);
    }
  }

  // Steuerung
  const myBall = balls[me];
  const myTurn = state.status === 'running' && state.currentTurn === me && !myBall.holed;
  const desired = myTurn ? meKey : null;
  if (desired !== controlKey) {
    controlKey = desired;
    engine.setActive(desired);
    awaitingWrite = false;
  }
  if (myTurn && awaitingWrite) engine.setInputEnabled(false);

  updateMpHud(state);
  if (state.status === 'running') {
    setHint(myTurn
      ? '🎯 Du bist dran — zieh zurück & lass los'
      : `⏳ ${state.currentTurn} ist am Zug…`);
  }
}

async function mpShotDone(res) {
  const state = mpState;
  if (!state) return;
  const me = currentUser, opp = otherPlayer(me);
  awaitingWrite = true;
  engine.setInputEnabled(false);

  const hole = state.currentHole;
  const strokes = { Andreas: toArr((state.strokesHole || {}).Andreas), Nele: toArr((state.strokesHole || {}).Nele) };
  strokes[me][hole] += 1 + (res.penalty ? 1 : 0);
  if (res.penalty) showToast('💦 Wasser! +1 Strafschlag');

  const balls = JSON.parse(JSON.stringify(state.balls || teeBalls(hole)));
  balls[me] = { x: res.position.x, y: res.position.y, z: res.position.z, holed: !!res.holed };

  const from = myShotFrom || balls[me];
  myShotFrom = { x: res.position.x, y: res.position.y, z: res.position.z };

  const newState = {
    ...state,
    balls,
    strokesHole: strokes,
    totalStrokes: { Andreas: sum(strokes.Andreas), Nele: sum(strokes.Nele) },
    lastShot: { player: me, from, to: { ...res.position }, holed: !!res.holed, time: Date.now() },
  };

  const oppHoled = balls[opp].holed;
  const meHoled = balls[me].holed;

  if (res.holed) showToast(holeResultText(strokes[me][hole], HOLES[hole].par));

  if (meHoled && oppHoled) {
    // Loch fertig
    if (hole + 1 >= NUM_HOLES) {
      newState.status = 'finished';
      newState.winner = decideWinner(newState.totalStrokes);
      await set(ref(db, GAME_REF), newState);
      await finishGameMP(newState);
      return;
    }
    newState.currentHole = hole + 1;
    newState.balls = teeBalls(hole + 1);
    newState.currentTurn = honorsPlayer(newState.totalStrokes, state.createdBy);
    newState.lastShot = null;
  } else {
    newState.currentTurn = oppHoled ? me : opp;
  }
  await set(ref(db, GAME_REF), newState);
}

function decideWinner(totals) {
  if (totals.Andreas < totals.Nele) return 'Andreas';
  if (totals.Nele < totals.Andreas) return 'Nele';
  return 'draw';
}
// "Ehre": niedrigere Gesamtschläge schlägt zuerst ab
function honorsPlayer(totals, fallback) {
  if (totals.Andreas < totals.Nele) return 'Andreas';
  if (totals.Nele < totals.Andreas) return 'Nele';
  return fallback;
}

// ── Coins & Stats (Multiplayer) ────────────────────────────
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

  const totals = state.totalStrokes || { Andreas: 0, Nele: 0 };
  const strokes = { Andreas: toArr((state.strokesHole || {}).Andreas), Nele: toArr((state.strokesHole || {}).Nele) };
  for (const p of ['Andreas', 'Nele']) {
    const won = winner !== 'draw' && winner === p;
    const lost = winner !== 'draw' && winner !== p;
    await saveStats(p, {
      strokes: strokes[p], total: totals[p],
      holesInOne: strokes[p].filter(s => s === 1).length,
      played: true, won, lost,
    });
  }
}

async function safeStat(path, fn) {
  try { await runTransaction(ref(db, path), fn); }
  catch (e) { console.warn('Stat-Update fehlgeschlagen', path, e); }
}

// Gemeinsames Statistik-Schreiben (Solo & Multiplayer)
async function saveStats(player, { strokes, total, holesInOne, played, won, lost }) {
  const base = `stats/${lc(player)}/minigolf`;
  if (played) {
    await safeStat(`${base}/gamesPlayed`, c => (c || 0) + 1);
    if (won) await safeStat(`${base}/gamesWon`, c => (c || 0) + 1);
    if (lost) await safeStat(`${base}/gamesLost`, c => (c || 0) + 1);
  }
  await safeStat(`${base}/roundsPlayed`, c => (c || 0) + 1);
  await safeStat(`${base}/totalStrokes`, c => (c || 0) + total);
  await safeStat(`${base}/totalHoles`, c => (c || 0) + NUM_HOLES);
  if (holesInOne) await safeStat(`${base}/holesInOne`, c => (c || 0) + holesInOne);
  await safeStat(`${base}/bestRound`, c => (!c || total < c) ? total : c);
  for (let i = 0; i < NUM_HOLES; i++) {
    const s = strokes[i];
    if (s > 0) await safeStat(`${base}/bestPerHole/${i}`, c => (!c || s < c) ? s : c);
  }
}

// ============================================================
//  LOBBY-AKTIONEN (Coins) — Muster aus game.html
// ============================================================
async function createGame() {
  const betVal = parseInt($('betInput').value);
  if (!betVal || betVal < 50) { showToast('Mindestens 50 🪙!'); return; }
  if (betVal > currentCoins) { showToast('Nicht genug Coins! 😅'); return; }

  const existing = await get(ref(db, GAME_REF));
  if (existing.val()) { showToast('Es läuft bereits ein Spiel! ⛳'); return; }

  await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) - betVal);
  contributeToTopf(db, lc(currentUser), betVal, 'minigolf').catch(() => {});

  finishedPaidOut = false;
  await set(ref(db, GAME_REF), {
    status: 'waiting',
    createdBy: currentUser,
    bet: betVal,
    currentTurn: currentUser,
    currentHole: 0,
    balls: teeBalls(0),
    strokesHole: { Andreas: emptyStrokes(), Nele: emptyStrokes() },
    totalStrokes: { Andreas: 0, Nele: 0 },
    lastShot: null,
    winner: null,
    createdAt: Date.now(),
  });
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
  contributeToTopf(db, lc(currentUser), bet, 'minigolf').catch(() => {});
  finishedPaidOut = false;
  await set(ref(db, GAME_REF), {
    ...mpState,
    status: 'running',
    currentTurn: mpState.createdBy,
  });
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
  // Zurück zur Modus-Auswahl (Solo) bzw. Spiel verlassen
  if (mode === 'mp' && mpState && (mpState.status === 'finished')) {
    await remove(ref(db, GAME_REF)).catch(() => {});
  }
  resetToMode();
}

function resetToMode() {
  if (engine) { engine.dispose(); engine = null; }
  if (gameListener) { gameListener(); gameListener = null; }
  mode = null; mpState = null; solo = null;
  renderedHole = -1; controlKey = null;
  $('resultOverlay').classList.remove('open');
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
  $('scorecard').style.display = 'none';
}

function updateSoloHud() {
  $('strokesMe').textContent = sum(solo.strokes);
  $('turnLabelMe').textContent = '🎯 Am Zug';
  $('holeNum').textContent = (solo.hole + 1) + ' / ' + NUM_HOLES;
  $('holePar').textContent = 'Par ' + HOLES[solo.hole].par;
}

function setupMpHud() {
  $('infoOpp').style.display = 'block';
  $('nameMe').textContent = currentUser;
  $('nameOpp').textContent = otherPlayer(currentUser);
  $('surrenderBtn').style.display = 'block';
  $('scorecard').style.display = 'block';
}

function updateMpHud(state) {
  const me = currentUser, opp = otherPlayer(me);
  const totals = state.totalStrokes || { Andreas: 0, Nele: 0 };
  $('strokesMe').textContent = totals[me] || 0;
  $('strokesOpp').textContent = totals[opp] || 0;
  $('holeNum').textContent = ((state.currentHole || 0) + 1) + ' / ' + NUM_HOLES;
  $('holePar').textContent = 'Par ' + HOLES[state.currentHole || 0].par;

  const infoMe = $('infoMe'), infoOpp = $('infoOpp');
  const myTurn = state.currentTurn === me;
  infoMe.className = 'player-info' + (myTurn ? ' active' + (me === 'Nele' ? ' nele-active' : '') : '');
  infoOpp.className = 'player-info' + (!myTurn ? ' active' + (opp === 'Nele' ? ' nele-active' : '') : '');
  $('turnLabelMe').textContent = myTurn ? '🎯 Am Zug' : '';
  $('turnLabelOpp').textContent = !myTurn ? '🎯 Am Zug' : '';

  renderScorecard(state);
}

function renderScorecard(state) {
  const strokes = { Andreas: toArr((state.strokesHole || {}).Andreas), Nele: toArr((state.strokesHole || {}).Nele) };
  const totals = state.totalStrokes || { Andreas: 0, Nele: 0 };
  let head = '<tr><th>Loch</th>';
  for (let i = 0; i < NUM_HOLES; i++) head += `<th>${i + 1}</th>`;
  head += '<th>Σ</th></tr>';
  let rPar = '<tr><td class="name">Par</td>';
  for (let i = 0; i < NUM_HOLES; i++) rPar += `<td>${HOLES[i].par}</td>`;
  rPar += `<td class="total">${TOTAL_PAR}</td></tr>`;
  const row = (p) => {
    let r = `<tr><td class="name">${p}</td>`;
    for (let i = 0; i < NUM_HOLES; i++) r += `<td>${strokes[p][i] || '–'}</td>`;
    r += `<td class="total">${totals[p] || 0}</td></tr>`;
    return r;
  };
  $('scoreTable').innerHTML = head + rPar + row('Andreas') + row('Nele');
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
      : isWinner ? `Weniger Schläge als ${otherPlayer(me)} — stark!`
        : `${winner} hatte weniger Schläge.`,
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

function holeResultText(strokes, par) {
  if (strokes === 1) return '⭐ Hole-in-One!';
  const d = strokes - par;
  if (d <= -2) return '🦅 Eagle!';
  if (d === -1) return '🐦 Birdie!';
  if (d === 0) return '✅ Par!';
  if (d === 1) return '🙂 Bogey';
  return `${strokes} Schläge`;
}
function scoreVsPar(diff) {
  if (diff < 0) return `${diff} unter Par 🌟`;
  if (diff === 0) return 'Genau Par ✅';
  return `+${diff} über Par`;
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
  showSection('mode');

  onValue(ref(db, `coins/${lc(currentUser)}`), snap => {
    currentCoins = Number(snap.val()) || 0;
    $('coinCount').textContent = currentCoins.toLocaleString('de-DE');
    if ($('createCard').style.display !== 'none') {
      $('betHint').textContent = `Mindestens 50 🪙 · Du hast ${currentCoins.toLocaleString('de-DE')} 🪙`;
    }
  });
});
