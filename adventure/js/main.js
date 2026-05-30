/* =====================================================================
   MAIN – Einstiegspunkt: Init, Game-Loop, Tabs, Events, Tastenkürzel.
   ===================================================================== */
import { state, loadSave, saveState, flushSave } from './core/state.js';
import { initAuth } from './core/firebase.js';
import { expeditionReady, setFindProgress, cancelExpedition, collectExpedition } from './core/expedition.js';
import { startBossFight, toggleSpeed, closeArena, usePotion, useAbility } from './core/combat.js';
import { watchCoins } from './core/coins.js';
import { $, fmtRemain, fmtBig } from './ui/dom.js';
import { renderAll, renderAdventure, renderTopStats } from './ui/render.js';
import { openBossList, openStats, openCharacterCreator,
         openRosterModal, maybeOnboarding, isCreatorForced, openDuelLobby } from './ui/modals.js';

// ---- Tabs -----------------------------------------------------------
function switchTab(view){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = $('#view-'+view); if(el) el.classList.add('active');
}
document.querySelectorAll('.tab').forEach(tab =>
  tab.addEventListener('click', ()=> switchTab(tab.dataset.view)));

// ---- Buttons / Overlays ---------------------------------------------
$('#challengeBtn').addEventListener('click', ()=> startBossFight());
$('#bossListBtn').addEventListener('click', openBossList);
$('#statsBtn').addEventListener('click', openStats);
$('#rosterTopBtn').addEventListener('click', openRosterModal);
$('#duelBtn').addEventListener('click', openDuelLobby);
// „Aussehen ändern" und „Helm" liegen jetzt im dynamischen Charakter-Header
// (in render.js verdrahtet, da bei jedem Render neu aufgebaut).
$('#speedBtn').addEventListener('click', toggleSpeed);
$('#potionBtn').addEventListener('click', usePotion);
$('#abilityBtn').addEventListener('click', useAbility);
$('#arenaCloseBtn').addEventListener('click', closeArena);
$('#expCancelBtn').addEventListener('click', ()=>{
  if(confirm('Abenteuer abbrechen? Die mitgebrachten Items gehen verloren.')) cancelExpedition();
});
$('#expCollectBtn').addEventListener('click', collectExpedition);

$('#overlay').addEventListener('click', e=>{ if(e.target===$('#overlay')) $('#overlay').classList.remove('show'); });
$('#creatorOverlay').addEventListener('click', e=>{ if(e.target===$('#creatorOverlay') && !isCreatorForced()) $('#creatorOverlay').classList.remove('show'); });

// ---- Tastenkürzel (#31) --------------------------------------------
document.addEventListener('keydown', e=>{
  const tag = (e.target && e.target.tagName) || '';
  if(tag==='INPUT' || tag==='SELECT' || tag==='TEXTAREA') return;
  if($('#arenaOverlay').classList.contains('show')) return;
  const map = { '1':'adventure', '2':'character', '3':'inventory', '4':'shop' };
  if(map[e.key]) { switchTab(map[e.key]); return; }
  if(e.key==='b' || e.key==='B') openBossList();
  else if(e.key==='c' || e.key==='C') $('#challengeBtn').click();
});

// ---- Game-Loop (Expeditions-Countdown) ------------------------------
function startLoop(){
  let wasReady = expeditionReady();
  setInterval(()=>{
    if(state.expedition){
      const nowReady = expeditionReady();
      if(nowReady && !wasReady){ saveState(); renderAdventure(); renderTopStats(); }
      else if(!nowReady){
        const r = $('#expRemain');
        if(r) r.textContent = 'Zurück in ' + fmtRemain(state.expedition.endsAt - Date.now());
      }
      wasReady = nowReady;
    } else { wasReady = false; }
  }, 1000);

  function frame(){
    let p;
    if(state.expedition && !expeditionReady()){
      const e = state.expedition;
      p = Math.min(1, (Date.now()-e.startedAt) / (e.endsAt - e.startedAt));
    } else {
      p = state.expedition ? 1 : 0;
    }
    setFindProgress(p);
    const bar = $('#findBar');
    if(bar) bar.style.width = Math.round(p*100)+'%';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushSave(); });
window.addEventListener('beforeunload', flushSave);

// ---- Init (async: erst Auth/Spieler, dann Spielstand laden) ---------
(async ()=>{
  const userKey = await initAuth();      // ermittelt Andreas/Nele (sonst Redirect auf index.html)

  // Eingeloggten Account anzeigen (Topbar-Chip) und Intro-Begrüßung personalisieren.
  const name = userKey ? userKey[0].toUpperCase() + userKey.slice(1) : 'Gast';
  const un = document.getElementById('userName'); if(un) un.textContent = name;
  const chip = document.getElementById('userChip'); if(chip) chip.dataset.user = userKey || '';
  if(window.__advIntroSetName) window.__advIntroSetName(name);

  await loadSave(userKey);               // lädt /adventure/<userKey> (sonst lokaler Cache / frisch)
  renderAll();
  // Globalen Münzstand live in die Topbar spiegeln (geteiltes Wallet mit Farm/Slot).
  watchCoins(c => { const el = $('#miniGold'); if(el) el.textContent = fmtBig(c); });
  startLoop();
  if(!state.character) openCharacterCreator(true);
  else maybeOnboarding();
  saveState();
})();
