// ============================================================
//  BILLIARD · HAUPT-MODUL  🎱  (8-Ball)
//  Firebase (Auth + Realtime DB), Modus-Auswahl, Lobby/Coins,
//  8-Ball-Regellogik, Turn-Sync und Statistiken. Verdrahtet die
//  realistische BilliardEngine + die TABLE-Daten mit dem DOM.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { contributeToTopf } from './savings-helper.js';
import { TABLE, initialBalls, groupOf } from './billiard-table.js';
import { BilliardEngine } from './billiard-engine.js';

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

const GAME_REF = 'billiard/andreas_vs_nele';
const LIVE_REF = 'billiard/andreas_vs_nele_live'; // Echtzeit-Kugelpositionen (außerhalb GAME_REF)
const SOLID_IDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPE_IDS = [9, 10, 11, 12, 13, 14, 15];
const OBJECT_IDS = [...SOLID_IDS, 8, ...STRIPE_IDS];

let currentUser = null, currentCoins = 0;
let engine = null, mode = null, mpState = null, gameListener = null;
let engineRacked = false, shownShotTime = 0, controlActive = null, finishedPaidOut = false;
let liveListener = null, liveActive = false, lastLiveWrite = 0, liveWatchdog = null;
let solo = null;
let statsListener = null;     // Live-Abo der eigenen Statistik

const $ = (id) => document.getElementById(id);
const lc = (n) => (n || '').toLowerCase();

function displayName(email) {
  if (email.toLowerCase() === 'raederich@outlook.com') return 'Andreas';
  if (email.toLowerCase() === 'nele.busse@web.de') return 'Nele';
  return email.split('@')[0];
}
function otherPlayer(n) { return n === 'Andreas' ? 'Nele' : 'Andreas'; }
function showToast(msg, dur = 3000) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Ball-Helfer ────────────────────────────────────────────
function groupIds(group) { return group === 'solids' ? SOLID_IDS : STRIPE_IDS; }
function isPocketed(balls, id) { const b = balls.find(x => x.id === id); return !b || b.pocketed; }
function groupRemaining(group, balls) { return groupIds(group).filter(id => !isPocketed(balls, id)).length; }
function setBall(balls, id, x, z, pocketed) {
  const b = balls.find(x2 => x2.id === id);
  if (b) { b.x = x; b.z = z; b.pocketed = pocketed; }
}

// ── Engine ─────────────────────────────────────────────────
function ensureEngine() {
  if (engine) return;
  engine = new BilliardEngine($('arenaMount'), {
    onShotStart: () => {},
    onShotComplete: handleShotComplete,
    onAim: handleAim,
    onShotTick: handleShotTick,
  });
  engine.start();
}
function handleAim(ratio, aiming) {
  $('powerWrap').classList.toggle('show', aiming && ratio > 0);
  $('powerFill').style.width = Math.round(ratio * 100) + '%';
}
// Eigene Kugelpositionen während des Stoßes live an den Gegner streamen (gedrosselt)
function handleShotTick() {
  if (mode !== 'mp' || !engine) return;
  const now = Date.now();
  if (now - lastLiveWrite < 70) return;
  lastLiveWrite = now;
  const r = (v) => Math.round(v * 1000) / 1000;
  const balls = engine.currentBallsState().map(b => ({ id: b.id, x: r(b.x), z: r(b.z), p: b.pocketed ? 1 : 0 }));
  set(ref(db, LIVE_REF), { player: currentUser, balls, t: now }).catch(() => {});
}
// Eingehende Echtzeit-Positionen des Gegnerstoßes
function handleLive(v) {
  if (!v || !engine) return;
  if (v.player === currentUser || !Array.isArray(v.balls)) return;
  liveActive = true;
  engine.updateBallsLive(v.balls);
  // Watchdog: bricht der Gegnerstoß mitten im Stream ab (Disconnect), bleiben die
  // Kugeln sonst auf Interim-Positionen hängen → nach Stille auf den letzten
  // autoritativen Zustand zurückfallen.
  if (liveWatchdog) clearTimeout(liveWatchdog);
  liveWatchdog = setTimeout(() => {
    if (!liveActive) return;
    liveActive = false;
    if (engine) {
      engine.clearLive();
      if (mpState && mpState.balls) engine.setBallsState(mpState.balls);
    }
  }, 2800);
}
function handleShotComplete(result, balls) {
  if (mode === 'solo') return soloShotDone(result, balls);
  return mpShotDone(result, balls);
}

// ── Modus-Auswahl ──────────────────────────────────────────
function showSection(name) {
  const isMob = window.matchMedia('(max-width:600px)').matches;
  document.body.classList.toggle('mobile-game', name === 'game' && isMob);
  $('modeSection').style.display = name === 'mode' ? 'flex' : 'none';
  const statsPanel = $('statsPanel');
  if (statsPanel) statsPanel.style.display = name === 'mode' ? 'block' : 'none';
  $('lobbySection').style.display = name === 'lobby' ? 'block' : 'none';
  $('gameSection').style.display = name === 'game' ? 'block' : 'none';
  // Doppeltes rAF: Resize erst nach dem Layout-Reflow (Fullscreen-Umschaltung)
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
//  SOLO-ÜBUNG (Tisch leerräumen, Schläge zählen)
// ============================================================
function startSolo() {
  solo = { strokes: 0, balls: initialBalls() };
  showSection('game');
  setupSoloHud();
  ensureEngine();
  engine.rack(solo.balls);
  engine.setActive(true);
  updateSoloHud();
  setHint('🎱 Break! Zieh zurück & lass los — räum den Tisch leer.');
}
function soloShotDone(result, balls) {
  solo.strokes++;
  solo.balls = balls;
  if (result.cueScratched) { engine.resetCue(); showToast('⚪ Weiße versenkt – neu am Kopfpunkt'); }
  const remaining = OBJECT_IDS.filter(id => !isPocketed(solo.balls, id)).length;
  updateSoloHud();
  if (remaining === 0) { setTimeout(finishSolo, 700); return; }
  engine.setActive(true);
}
async function finishSolo() {
  await saveStats(currentUser, { strokes: solo.strokes, ballsPocketed: 15, played: false });
  showResult({ emoji: '🎉', title: 'Tisch leer!', sub: `Geschafft in ${solo.strokes} Schlägen.`, coins: '', konfetti: true });
}

// ============================================================
//  MULTIPLAYER (8-Ball)
// ============================================================
function handleMpState(state) {
  mpState = state;
  if (!state) { engineRacked = false; controlActive = null; finishedPaidOut = false; showLobby('create'); return; }
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
  const me = currentUser;
  if (!engineRacked) {
    engine.rack(state.balls);
    engineRacked = true;
    shownShotTime = state.lastShot ? state.lastShot.time : 0;
    controlActive = null;
    liveActive = false;
  } else if (state.lastShot && state.lastShot.time > shownShotTime && state.lastShot.player !== me) {
    shownShotTime = state.lastShot.time;
    if (liveActive) { liveActive = false; engine.clearLive(); } // Live-Stream → autoritativer Endzustand
    engine.setBallsState(state.balls);
  } else if (state.currentTurn !== me || state.status === 'finished') {
    if (liveActive) { liveActive = false; engine.clearLive(); }
    engine.setBallsState(state.balls);
  }

  const myTurn = state.status === 'running' && state.currentTurn === me;
  engine.setActive(myTurn);   // bei eigenem Zug Eingabe (wieder) freischalten
  controlActive = myTurn;

  updateMpHud(state);
  if (state.status === 'running') {
    setHint(myTurn ? '🎯 Du bist dran — zieh zurück & lass los' : `⏳ ${state.currentTurn} ist am Zug…`);
  }
  flashFoul(state.lastShot && state.lastShot.foul && state.lastShot.player !== me);
}

async function mpShotDone(result, balls) {
  const state = mpState; if (!state) return;
  const me = currentUser, opp = otherPlayer(me);
  engine.setInputEnabled(false);
  set(ref(db, LIVE_REF), null).catch(() => {}); // Live-Stream beenden, Endzustand folgt

  let groups = { Andreas: state.groups?.Andreas || null, Nele: state.groups?.Nele || null };
  const wasOpen = !groups[me];
  const wasBreak = !state.broke;
  const pocketed = result.pocketed.filter(id => id !== 0); // ohne Cue
  const pocketedObjects = pocketed.filter(id => id !== 8);

  // 8 beim Break → zurück auf den Fußpunkt spotten, kein Verlust
  let eightPocketed = pocketed.includes(8);
  if (wasBreak && eightPocketed) {
    setBall(balls, 8, TABLE.footSpot.x, TABLE.footSpot.z, false);
    eightPocketed = false;
  }

  // Fouls bestimmen
  let foul = false;
  if (result.cueScratched) foul = true;
  else if (result.firstContact === null) foul = true;
  else if (!wasOpen) {
    const fcGroup = groupOf(result.firstContact);
    const myCleared = groupRemaining(groups[me], balls) === 0;
    if (result.firstContact === 8 && !myCleared) foul = true;
    else if (fcGroup && fcGroup !== groups[me]) foul = true;
  }
  if (!result.cueScratched && pocketed.length === 0 && !result.railHit) foul = true;

  // Cue bei Scratch neu setzen
  if (result.cueScratched) setBall(balls, 0, TABLE.headSpot.x, TABLE.headSpot.z, false);

  const newState = { ...state, balls, broke: true, lastShot: { player: me, time: Date.now(), foul } };

  // 8 versenkt → Spielende entscheiden
  if (eightPocketed) {
    const myGroup = groups[me];
    const cleanWin = myGroup && groupRemaining(myGroup, balls) === 0 && !foul;
    newState.status = 'finished';
    newState.winner = cleanWin ? me : opp;
    newState.groups = groups;
    await set(ref(db, GAME_REF), newState);
    await finishGameMP(newState);
    return;
  }

  // Gruppen-Zuweisung bei offenem Tisch (genau ein Typ versenkt, kein Foul)
  if (wasOpen && !foul && pocketedObjects.length) {
    const sawSolid = pocketedObjects.some(id => SOLID_IDS.includes(id));
    const sawStripe = pocketedObjects.some(id => STRIPE_IDS.includes(id));
    if (sawSolid && !sawStripe) { groups[me] = 'solids'; groups[opp] = 'stripes'; }
    else if (sawStripe && !sawSolid) { groups[me] = 'stripes'; groups[opp] = 'solids'; }
  }
  newState.groups = groups;

  // Weiter am Zug?
  let pocketedOwn;
  if (groups[me]) pocketedOwn = pocketedObjects.some(id => groupIds(groups[me]).includes(id));
  else pocketedOwn = pocketedObjects.length > 0; // offener Tisch
  const continues = !foul && pocketedOwn;
  newState.currentTurn = continues ? me : opp;

  shownShotTime = newState.lastShot.time;
  await set(ref(db, GAME_REF), newState);

  if (foul) showToast('⚠️ Foul – Gegner ist dran');
  else if (continues) showToast('✅ Versenkt – du bist weiter dran');
}

// ── Coins & Stats ──────────────────────────────────────────
async function finishGameMP(state) {
  if (finishedPaidOut) return;
  finishedPaidOut = true;
  const winner = state.winner, bet = state.bet || 0;
  if (bet > 0 && winner) {
    await runTransaction(ref(db, `coins/${lc(winner)}`), c => (c || 0) + bet * 2);
    await safeStat(`stats/${lc(winner)}/coinsEarned`, c => (c || 0) + bet * 2);
    await safeStat(`stats/${lc(winner)}/coinsSpent`, c => (c || 0) + bet);
    await safeStat(`stats/${lc(otherPlayer(winner))}/coinsSpent`, c => (c || 0) + bet);
  }
  for (const p of ['Andreas', 'Nele']) {
    await saveStats(p, { played: true, won: winner === p, lost: winner !== p });
  }
}
async function safeStat(path, fn) {
  try { await runTransaction(ref(db, path), fn); }
  catch (e) { console.warn('Stat-Update fehlgeschlagen', path, e); }
}
async function saveStats(player, { strokes, ballsPocketed, played, won, lost }) {
  const base = `stats/${lc(player)}/billiard`;
  if (played) {
    await safeStat(`${base}/gamesPlayed`, c => (c || 0) + 1);
    if (won) await safeStat(`${base}/gamesWon`, c => (c || 0) + 1);
    if (lost) await safeStat(`${base}/gamesLost`, c => (c || 0) + 1);
  }
  if (ballsPocketed) await safeStat(`${base}/ballsPocketed`, c => (c || 0) + ballsPocketed);
  if (strokes != null) {
    await safeStat(`${base}/soloRounds`, c => (c || 0) + 1);
    await safeStat(`${base}/bestClear`, c => (!c || strokes < c) ? strokes : c);
  }
}

// ── Spieler-Statistik (Live aus Firebase) ──────────────────
function subscribeMyStats() {
  if (!currentUser) return;
  if (statsListener) statsListener();
  statsListener = onValue(ref(db, `stats/${lc(currentUser)}/billiard`), snap => {
    renderStats(snap.val() || {});
  });
}
function renderStats(s) {
  const grid = $('statsGrid');
  if (!grid) return;
  const tiles = [
    { v: s.gamesWon || 0, l: 'Siege' },
    { v: s.gamesLost || 0, l: 'Niederlagen' },
    { v: s.bestClear != null ? s.bestClear : '–', l: 'Solo-Bestmarke' },
    { v: s.ballsPocketed || 0, l: 'Kugeln' },
    { v: s.soloRounds || 0, l: 'Solo-Runden' },
  ];
  grid.innerHTML = tiles.map(t =>
    `<div class="stat-tile"><div class="stat-value">${t.v}</div><div class="stat-label">${t.l}</div></div>`
  ).join('');
}

// ============================================================
//  LOBBY-AKTIONEN (Coins) — Muster aus minigolf.js
// ============================================================
async function createGame() {
  const betVal = parseInt($('betInput').value);
  if (!betVal || betVal < 50) { showToast('Mindestens 50 🪙!'); return; }
  if (betVal > currentCoins) { showToast('Nicht genug Coins! 😅'); return; }
  const existing = await get(ref(db, GAME_REF));
  if (existing.val()) { showToast('Es läuft bereits ein Spiel! 🎱'); return; }
  await runTransaction(ref(db, `coins/${lc(currentUser)}`), c => (c || 0) - betVal);
  contributeToTopf(db, lc(currentUser), betVal, 'billiard').catch(() => {});
  finishedPaidOut = false; engineRacked = false;
  await set(ref(db, GAME_REF), {
    status: 'waiting', createdBy: currentUser, bet: betVal,
    currentTurn: currentUser, broke: false,
    balls: initialBalls(), groups: { Andreas: null, Nele: null },
    lastShot: null, winner: null, createdAt: Date.now(),
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
  contributeToTopf(db, lc(currentUser), bet, 'billiard').catch(() => {});
  finishedPaidOut = false; engineRacked = false;
  await set(ref(db, GAME_REF), { ...mpState, status: 'running', currentTurn: mpState.createdBy });
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
  if (mode === 'mp' && mpState && mpState.status === 'finished') await remove(ref(db, GAME_REF)).catch(() => {});
  resetToMode();
}
function resetToMode() {
  if (engine) { engine.dispose(); engine = null; }
  if (gameListener) { gameListener(); gameListener = null; }
  if (liveListener) { liveListener(); liveListener = null; }
  liveActive = false;
  mode = null; mpState = null; solo = null; engineRacked = false; controlActive = null;
  $('resultOverlay').classList.remove('open');
  showSection('mode');
}

// ============================================================
//  UI
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
  if (modeName === 'create') $('betHint').textContent = `Mindestens 50 🪙 · Du hast ${currentCoins.toLocaleString('de-DE')} 🪙`;
}
function setHint(t) { $('arenaHint').textContent = t; }
function flashFoul(on) { $('arenaFoul').classList.toggle('show', !!on); if (on) setTimeout(() => $('arenaFoul').classList.remove('show'), 2200); }

function setupSoloHud() {
  $('infoOpp').style.display = 'none';
  $('nameMe').textContent = 'Du';
  $('groupMe').textContent = '';
  $('surrenderBtn').style.display = 'none';
  $('centerLabel').textContent = 'Schläge';
}
function updateSoloHud() {
  $('centerMain').textContent = solo.strokes;
  const remaining = OBJECT_IDS.filter(id => !isPocketed(solo.balls, id)).length;
  $('centerSub').textContent = 'Kugeln übrig: ' + remaining;
  $('turnLabelMe').textContent = '🎯 Am Zug';
}
function setupMpHud() {
  $('infoOpp').style.display = 'block';
  $('nameMe').textContent = currentUser;
  $('nameOpp').textContent = otherPlayer(currentUser);
  $('surrenderBtn').style.display = 'block';
  $('centerLabel').textContent = '8-Ball';
}
function groupLabel(g) { return g === 'solids' ? 'Volle ●' : g === 'stripes' ? 'Halbe ◐' : '—'; }
function updateMpHud(state) {
  const me = currentUser, opp = otherPlayer(me);
  const groups = state.groups || {};
  $('groupMe').textContent = groupLabel(groups[me]);
  $('groupOpp').textContent = groupLabel(groups[opp]);
  $('centerMain').textContent = '🎱';
  const rem = groups[me] ? groupRemaining(groups[me], state.balls) : null;
  $('centerSub').textContent = groups[me] ? (rem === 0 ? 'Jetzt die 8!' : `Noch ${rem}`) : 'Offener Tisch';
  const myTurn = state.currentTurn === me;
  $('infoMe').className = 'player-info' + (myTurn ? ' active' + (me === 'Nele' ? ' nele-active' : '') : '');
  $('infoOpp').className = 'player-info' + (!myTurn ? ' active' + (opp === 'Nele' ? ' nele-active' : '') : '');
  $('turnLabelMe').textContent = myTurn ? '🎯 Am Zug' : '';
  $('turnLabelOpp').textContent = !myTurn ? '🎯 Am Zug' : '';
}

function showMpResult(state) {
  const me = currentUser, winner = state.winner;
  const isWinner = winner === me, bet = state.bet || 0;
  showResult({
    emoji: isWinner ? '🏆' : '💔',
    title: isWinner ? 'Gewonnen! 🎉' : 'Verloren…',
    sub: isWinner ? `Du hast die 8 versenkt — stark gegen ${otherPlayer(me)}!` : `${winner} hat das Spiel geholt.`,
    coins: bet > 0 ? (isWinner ? `+${(bet * 2).toLocaleString('de-DE')} 🪙` : `-${bet.toLocaleString('de-DE')} 🪙`) : '',
    konfetti: isWinner,
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

// ── Event-Listener ─────────────────────────────────────────
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
  $('betHint').style.color = (parseInt(this.value) || 0) > currentCoins ? '#dc2626' : 'var(--text-mid)';
});

// ── AUTH ───────────────────────────────────────────────────
const loginBtn = $('loginBtn'), logoutBtn = $('logoutBtn');
loginBtn.addEventListener('click', async () => {
  const email = $('loginEmail').value.trim(), pw = $('loginPassword').value;
  $('loginError').textContent = ''; loginBtn.textContent = '…';
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
    if ($('createCard').style.display !== 'none') $('betHint').textContent = `Mindestens 50 🪙 · Du hast ${currentCoins.toLocaleString('de-DE')} 🪙`;
  });
});
