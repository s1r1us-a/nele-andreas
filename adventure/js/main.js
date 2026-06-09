/* =====================================================================
   MAIN – Einstiegspunkt: Init, Game-Loop, Tabs, Events, Tastenkürzel.
   ===================================================================== */
import { state, loadSave, saveState, flushSave, watchSave, setBusyCheck, flushPendingRemote } from './core/state.js';
import { initAuth } from './core/firebase.js';
import { expeditionReady, expeditionActive, setFindProgress, cancelExpedition, collectExpedition } from './core/expedition.js';
import { startBossFight, closeArena, usePotion, useAbility, currentFight } from './core/combat.js';
import { watchCoins } from './core/coins.js';
import { $, fmtRemain, fmtBig, confirmDialog, toast } from './ui/dom.js';
import { renderAll, renderAdventure, renderTopStats, renderShop, resetInvSellMode } from './ui/render.js';
import { openBossList, openStats, openCharacterCreator,
         openRosterModal, maybeOnboarding, isCreatorForced, openDuelLobby,
         openOtherProfile } from './ui/modals.js';
import { checkAdventureBadges } from './core/badges.js';
import { otherKey } from './core/duel.js';
import { initTradeTab, renderTrade } from './ui/trade.js';
import { renderForge } from './ui/forge.js';
import { renderDyes } from './ui/dyes.js';

// ---- Tabs -----------------------------------------------------------
function switchTab(view){
  // Verlässt man das Inventar (z. B. zum Händler), den Verkaufsmodus beenden,
  // damit der „Verkaufen"-Button nicht versehentlich aktiv bleibt.
  if(view !== 'inventory') resetInvSellMode();
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el = $('#view-'+view); if(el) el.classList.add('active');
  if(view==='trade') renderTrade();
  if(view==='forge') renderForge();
  if(view==='dyes') renderDyes();
}
document.querySelectorAll('.tab').forEach(tab =>
  tab.addEventListener('click', ()=> switchTab(tab.dataset.view)));

// ---- Buttons / Overlays ---------------------------------------------
$('#challengeBtn').addEventListener('click', ()=> startBossFight());
$('#bossListBtn').addEventListener('click', openBossList);
$('#statsBtn').addEventListener('click', openStats);
$('#rosterTopBtn').addEventListener('click', openRosterModal);
$('#duelBtn').addEventListener('click', openDuelLobby);
// Turm: während eines laufenden Abenteuers gesperrt (Held ist unterwegs).
const towerLink = document.querySelector('.tower-btn');
if(towerLink) towerLink.addEventListener('click', e => {
  if(expeditionActive()){ e.preventDefault(); toast('🧭 Dein Held ist gerade auf Abenteuer – erst zurückkehren.'); }
});
// „Aussehen ändern" und „Helm" liegen jetzt im dynamischen Charakter-Header
// (in render.js verdrahtet, da bei jedem Render neu aufgebaut).
$('#potionBtn').addEventListener('click', usePotion);
// Mehrere Fähigkeits-Knöpfe (dynamisch gerendert) per Delegation verdrahten.
$('#abilityBar').addEventListener('click', e => {
  const btn = e.target.closest('[data-ability-id]');
  if(btn && !btn.disabled) useAbility(btn.dataset.abilityId);
});
$('#arenaCloseBtn').addEventListener('click', closeArena);
$('#expCancelBtn').addEventListener('click', ()=>{
  confirmDialog({
    title:'Abenteuer abbrechen?',
    body:'Die mitgebrachten Items gehen verloren.',
    emoji:'🧭', confirmText:'Abbrechen', cancelText:'Weiterlaufen', danger:true,
  }).then(ok => { if(ok) cancelExpedition(); });
});
$('#expCollectBtn').addEventListener('click', collectExpedition);

$('#overlay').addEventListener('click', e=>{ if(e.target===$('#overlay')) $('#overlay').classList.remove('show'); });
$('#creatorOverlay').addEventListener('click', e=>{ if(e.target===$('#creatorOverlay') && !isCreatorForced()) $('#creatorOverlay').classList.remove('show'); });
// ESC schließt offene Modale (Content-Modal bzw. Creator, sofern nicht erzwungen).
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return;
  if($('#overlay').classList.contains('show')){ $('#overlay').classList.remove('show'); return; }
  if($('#creatorOverlay').classList.contains('show') && !isCreatorForced()) $('#creatorOverlay').classList.remove('show');
});

// ---- Tastenkürzel (#31) --------------------------------------------
document.addEventListener('keydown', e=>{
  const tag = (e.target && e.target.tagName) || '';
  if(tag==='INPUT' || tag==='SELECT' || tag==='TEXTAREA') return;
  if($('#arenaOverlay').classList.contains('show')) return;
  const map = { '1':'adventure', '2':'character', '3':'talents', '4':'inventory', '5':'shop', '6':'forge', '7':'dyes', '8':'trade' };
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
    // Aufgeschobenes Remote-Update nachziehen, sobald keine Arena/Modal mehr offen ist.
    flushPendingRemote(renderAll);
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
  // Geräte-Sync: Spielstand-Änderungen vom anderen Gerät (Handy/PC) live übernehmen.
  // Während eines Bosskampfs oder offenen Modals wird ein Update aufgeschoben
  // (flushPendingRemote im Game-Loop zieht es danach nach).
  setBusyCheck(() =>
    $('#arenaOverlay').classList.contains('show') ||
    $('#overlay').classList.contains('show') ||
    $('#creatorOverlay').classList.contains('show') ||
    (currentFight && !currentFight.over)
  );
  watchSave(() => { renderAll(); checkAdventureBadges(false); });
  // Bereits verdiente Dämmerpfad-Badges einmalig still nachtragen (kein Modal).
  checkAdventureBadges(false);
  // Profil-Ansicht des anderen Spielers: Button-Beschriftung personalisieren.
  const otherName = otherKey()[0].toUpperCase() + otherKey().slice(1);
  const opBtn = $('#otherProfileBtn');
  if(opBtn){ opBtn.title = otherName + 's Profil ansehen'; opBtn.addEventListener('click', openOtherProfile); }
  // Globalen Coinstand live in die Topbar spiegeln (geteiltes Wallet mit Farm/Slot).
  // Beim ersten Snapshot wird der Cache (anfangs 0) erstmals gefüllt – deshalb auch
  // Händler und Schmiede neu zeichnen, deren Anzeige/Kaufknöpfe getCoins() lesen und
  // sonst auf dem veralteten Startwert „0" hängen blieben.
  watchCoins(c => {
    const el = $('#miniGold'); if(el) el.textContent = fmtBig(c);
    renderShop(); renderForge();
  });
  initTradeTab();   // Live-Handel: Presence + Trade-Knoten abonnieren.
  startLoop();
  if(!state.character) openCharacterCreator(true);
  else maybeOnboarding();
  saveState();
})();
