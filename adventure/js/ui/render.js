/* =====================================================================
   RENDERING – Top-Leiste, Abenteuer, Charakter, Inventar, Shop.
   ===================================================================== */
import { INV_SLOTS_MAX } from '../data/tuning.js';
import { RARITIES, rarityOf, rarityIndex } from '../data/rarities.js';
import { SLOTS, SLOT_ICON, LEFT_SLOTS, RIGHT_SLOTS, BOTTOM_SLOTS,
         CAT_ICON, CAT_ORDER } from '../data/slots.js';
import { EXPEDITIONS } from '../data/expeditions.js';
// statHelp als Namespace importieren: ein Namespace-Import scheitert NIE am
// fehlenden Namen (liefert undefined statt fatalem Link-Fehler). Schützt die App,
// falls nach einem Deploy kurzzeitig ein veraltetes statHelp.js gecacht ist.
import * as STATHELP from '../data/statHelp.js';
const STAT_HELP = STATHELP.STAT_HELP || {};
const STAT_INFO = STATHELP.STAT_INFO || {};
import { classOf } from '../data/classes.js';
import { RESPEC_COST } from '../data/tuning.js';
import { talentTreeFor, chosenTalentId, chosenTalentCount, stufeUnlocked } from '../data/talents.js';
// Klassen-Statkeys lokal ableiten (statt talentStatKeys zu importieren) – die
// Knoten tragen bereits node.keys, das vermeidet einen weiteren cross-file Import.
const STAT_ORDER = ['damage','maxHp','armor','critPhys','critMagic','critDamage',
  'attackSpeed','lifesteal','dodge','versatility','thorns','block'];
function classStatKeys(classId){
  const present = new Set();
  talentTreeFor(classId).flat().forEach(n => (n.keys||[]).forEach(k => present.add(k)));
  return STAT_ORDER.filter(k => present.has(k));
}
import { bossFor, zoneBg, zoneName, zoneFlavor, MECH_DEFS } from '../data/bosses.js';
import { state, saveState, listCharacters } from '../core/state.js';
import { recomputeTotals, heroCombat, heroTier, TIER_NAME,
         xpForLevel, xpInLevel } from '../core/character.js';
import { heroSrc } from '../core/avatar.js';
import { itemValue, isLocked, gearScore, canEquip, autoEquipBest, itemPower,
         invCapacity, nextExpandCost, buyInventoryExpansion } from '../core/items.js';
import { getCoins, spendCoins } from '../core/coins.js';
import { expeditionReady, expeditionActive, findProgress } from '../core/expedition.js';
import { $, timeAgo, fmtRemain, fmtBig, toast, confirmDialog } from './dom.js';
import { bindTooltip, hideTooltip, affixLinesHTML } from './tooltip.js';
import { openSlotPicker, openItemPreview, previewExpedition,
         openRosterModal, openCharacterCreator } from './modals.js';

export function renderAll(){
  hideTooltip(); renderTopStats(); renderAdventure();
  renderCharacter(); renderInventory(); renderShop();
}

const freeSlots = () => Math.max(0, invCapacity() - state.inventory.length);

// ---- Top-Leiste -----------------------------------------------------
export function renderTopStats(){
  // Header zeigt nur noch Level + Coins; Rüstung/Schaden/Kampfkraft stehen
  // (ohne Dopplung) im Charakter-Bildschirm. #miniGold pflegt der Coin-Listener.
  const lvl = state.level || 1;
  const need = xpForLevel(lvl);
  const cur = xpInLevel(state.xp || 0, lvl);
  $('#miniLevel').textContent = lvl;
  $('#xpFill').style.width = Math.max(0, Math.min(100, cur/need*100)) + '%';
  $('#levelChip').title = 'Level '+lvl+' · '+cur+' / '+need+' XP';
}

// ---- Abenteuer ------------------------------------------------------
// Schwierigkeit aus Verhältnis eigene Kampfkraft : empfohlene Boss-Kraft.
export function bossDifficulty(power, recPower){
  const r = recPower > 0 ? power / recPower : 2;
  if(r >= 1.5) return { label:'Leicht',  cls:'diff-leicht' };
  if(r >= 1.0) return { label:'Normal',  cls:'diff-normal' };
  if(r >= 0.7) return { label:'Schwer',  cls:'diff-schwer' };
  return { label:'Tödlich', cls:'diff-toedlich' };
}

export function renderAdventure(){
  const t = recomputeTotals();
  const scene = $('#scene');
  scene.style.backgroundImage = "url('"+zoneBg(state.zone)+"')";
  $('#zoneLabel').textContent = 'Zone '+(state.zone+1)+' · '+zoneName(state.zone);
  const zf = $('#zoneFlavor'); if(zf) zf.textContent = zoneFlavor(state.zone);
  $('#sceneHero').src = heroSrc(heroTier(t.power));
  $('#findBar').style.width = Math.round(findProgress*100)+'%';

  renderExpeditionBox();

  const blocked = expeditionReady() && freeSlots() < (state.expedition.items||[]).length;
  $('#fullBanner').classList.toggle('show', blocked);

  const boss = bossFor(state.zone);
  $('#bossPortrait').src = boss.sprite;
  $('#bossName').textContent = '👑 ' + boss.name;
  const weak = t.power < boss.recPower;
  const rec = $('#bossRec');
  rec.classList.toggle('weak', weak);
  const mechs = (Array.isArray(boss.mechanic)?boss.mechanic:[boss.mechanic]).filter(Boolean)
    .map(m => MECH_DEFS[m] ? MECH_DEFS[m].emoji+' '+MECH_DEFS[m].label : m).join(' · ');
  const diff = bossDifficulty(t.power, boss.recPower);
  rec.innerHTML = '<span class="diff-badge '+diff.cls+'">'+diff.label+'</span> '
    + 'Empfohlene Kampfkraft: <b>'+fmtBig(boss.recPower)+'</b> · deine: <b>'+t.power+'</b>'
    + (mechs ? '<br><span class="boss-mechs">'+mechs+'</span>' : '');

  // Während eines laufenden Abenteuers ist der Held unterwegs: Bosskampf,
  // Duell und Turm sperren (man kann nichts anderes gleichzeitig machen).
  const onAdventure = expeditionActive();
  const lockBtn = (el, locked) => {
    if(!el) return;
    el.classList.toggle('adv-locked', locked);
    if(el.tagName === 'BUTTON') el.disabled = locked;
    else el.setAttribute('aria-disabled', locked ? 'true' : 'false');
    el.title = locked ? 'Dein Held ist gerade auf Abenteuer – erst zurückkehren.' : '';
  };
  lockBtn($('#challengeBtn'), onAdventure);
  lockBtn($('#duelBtn'), onAdventure);
  lockBtn(document.querySelector('.tower-btn'), onAdventure);

  const log = $('#logEntries');
  log.innerHTML = state.log.length ? '' : '<div class="entry" style="color:var(--txt-mute)">Noch keine Funde…</div>';
  for(const e of state.log){
    const r = rarityOf(e.rarity);
    const div = document.createElement('div');
    div.className = 'entry';
    const sign = e.statType==='armor' ? '🛡️' : '⚔️';
    div.innerHTML = '<span class="when">'+timeAgo(e.t)+'</span>'+
      '<span style="color:'+r.color+'">'+e.name+'</span>'+
      '<span style="margin-left:auto; color:var(--txt-dim)">'+sign+' +'+e.stat+'</span>';
    log.appendChild(div);
  }
}

function renderExpeditionBox(){
  const pick = $('#expPick'), running = $('#expRunning'), done = $('#expDone');
  if(!pick) return;
  const exp = state.expedition;
  const ready = expeditionReady();
  pick.style.display    = (!exp) ? 'block' : 'none';
  running.style.display = (exp && !ready) ? 'block' : 'none';
  done.style.display    = (exp && ready) ? 'block' : 'none';

  if(!exp){
    const grid = $('#expGrid');
    if(grid && !grid.dataset.built){
      grid.dataset.built = '1';
      grid.innerHTML = '';
      for(const e of EXPEDITIONS){
        const card = document.createElement('div');
        card.className = 'exp-card';
        card.innerHTML = '<span class="ec-icon">'+e.icon+'</span>'+
          '<span class="ec-label">'+e.label+'</span>'+
          '<span class="ec-hint">'+e.items+' Items · bessere Chancen</span>';
        card.addEventListener('click', ()=> previewExpedition(e.key));
        grid.appendChild(card);
      }
    }
  } else if(!ready){
    const e = EXPEDITIONS.find(x=>x.key===exp.durKey);
    $('#expRunTitle').textContent = (e?e.icon:'⏳') + ' Unterwegs' + (e ? ' ('+e.label+')' : '') + '…';
    $('#expRemain').textContent = 'Zurück in ' + fmtRemain(exp.endsAt - Date.now());
  } else {
    // Abenteuer fertig: tatsächliche Beute-Anzahl anzeigen (steigt mit der Dauer,
    // nicht fest „2") – Quelle ist die beim Start gewürfelte Item-Liste.
    const n = (exp.items||[]).length;
    const sub = $('#expDoneSub');
    if(sub) sub.innerHTML = 'Dein Held hat <b>' + (n===1 ? '1 Gegenstand' : n+' Gegenstände') + '</b> mitgebracht.';
  }
}

let _fullFlashTimer = null;
export function flashFullBanner(){
  const b = $('#fullBanner'); if(!b) return;
  b.classList.add('show','flash');
  clearTimeout(_fullFlashTimer);
  _fullFlashTimer = setTimeout(()=> b.classList.remove('flash'), 1200);
}

// ---- Charakter ------------------------------------------------------
function slotEl(slotKey){
  const slot = SLOTS[slotKey];
  const it = state.equipped[slotKey];
  const el = document.createElement('div');
  el.className = 'slot';
  if(it){
    const r = rarityOf(it.rarity);
    el.dataset.rarity = it.rarity;
    el.style.setProperty('--rc', r.color);
    el.innerHTML = '<img src="'+it.sprite+'" alt="'+it.name+'">';
    bindTooltip(el, it);
  } else {
    el.innerHTML = '<span class="empty-ic">'+SLOT_ICON[slotKey]+'</span>';
  }
  el.innerHTML += '<span class="slot-name">'+slot.name+'</span>';
  el.addEventListener('click', ()=> openSlotPicker(slotKey));
  return el;
}
export function renderCharacter(){
  const t = recomputeTotals();
  const tier = heroTier(t.power);
  $('#dollHero').src = heroSrc(tier);
  $('#tierBadge').textContent = TIER_NAME[tier] + ' · ' + t.power + ' Kampfkraft';
  $('#tierBadge').title = STAT_HELP.kampfkraft;
  const L = $('#dollLeft'), R = $('#dollRight'), B = $('#dollBottom');
  L.innerHTML=''; R.innerHTML=''; B.innerHTML='';
  LEFT_SLOTS.forEach(s => L.appendChild(slotEl(s)));
  RIGHT_SLOTS.forEach(s => R.appendChild(slotEl(s)));
  BOTTOM_SLOTS.forEach(s => B.appendChild(slotEl(s)));
  renderCharHeader(t, tier);
  renderCharStats(t);
  renderTalents();
}

// ---- Charakter-Header (Identität + Aktionen) -----------------------
export function renderCharHeader(t, tier){
  const box = $('#charHeader'); if(!box) return;
  const cls = classOf(state);
  const ch = state.character;
  const name = (ch && ch.name) ? ch.name : (ch ? cls.label : 'Neuer Held');
  const lvl = state.level || 1;
  const need = xpForLevel(lvl), cur = xpInLevel(state.xp || 0, lvl);
  const xpPct = Math.max(0, Math.min(100, cur/need*100));
  const hasHelm = !!(state.equipped && state.equipped.kopf);
  const hidden  = !!(state.settings && state.settings.hideHelmet);
  box.innerHTML =
    '<div class="ch-id">'+
      '<div class="ch-avatar"><img src="'+heroSrc(tier)+'" alt="">'+
        '<span class="ch-tier">'+TIER_NAME[tier]+'</span></div>'+
      '<div class="ch-main">'+
        '<div class="ch-name">'+name+'</div>'+
        '<div class="ch-class">'+cls.icon+' '+cls.label+'</div>'+
        '<div class="ch-level">Level <b>'+lvl+'</b> <small>'+cur+' / '+need+' XP</small></div>'+
        '<div class="ch-xpbar"><i style="width:'+xpPct+'%"></i></div>'+
        '<div class="ch-power" title="'+STAT_HELP.kampfkraft.replace(/"/g,'&quot;')+'">⚔️ Kampfkraft <b>'+t.power+'</b></div>'+
      '</div>'+
    '</div>'+
    '<div class="ch-actions">'+
      '<button class="btn ghost" id="autoEquipBtn" title="Stärkste tragbare Items aus dem Inventar anlegen">⬆️ Bestes anlegen</button>'+
      '<button class="btn ghost" id="editLookBtn">✏️ Aussehen</button>'+
      '<button class="btn ghost" id="helmBtn"'+(hasHelm?'':' disabled title="Kein Helm angelegt"')+'>'+
        (hidden?'🪖 Helm zeigen':'🪖 Helm verbergen')+'</button>'+
    '</div>';
  box.querySelector('#editLookBtn').addEventListener('click', ()=> openCharacterCreator(false));
  box.querySelector('#autoEquipBtn').addEventListener('click', ()=>{
    const n = autoEquipBest();
    toast(n ? '⬆️ '+n+' Gegenstand'+(n>1?'e':'')+' angelegt' : '✓ Bereits optimal ausgerüstet');
    if(n) renderAll();
  });
  const helm = box.querySelector('#helmBtn');
  if(helm && hasHelm) helm.addEventListener('click', ()=>{
    if(!state.settings) state.settings = {};
    state.settings.hideHelmet = !state.settings.hideHelmet;
    saveState(); renderAll();
  });
}

// ---- Talentbaum: 10 Stufen, pro Stufe genau EIN Talent -------------
export function renderTalents(){
  const box = $('#talentsPanel'); if(!box) return;
  if(!state.character){ box.innerHTML = ''; return; }
  const cls = classOf(state);
  const tree = talentTreeFor(cls.id);
  if(!tree.length){ box.innerHTML = ''; return; }
  const points = state.character.talentPoints || 0;
  const chosenCount = chosenTalentCount(state);
  const esc = s => (s||'').replace(/"/g,'&quot;');

  let html = '<div class="talents-head">'+
    '<span class="talents-class">'+cls.icon+' '+cls.label+'</span>'+
    '<span class="talents-progress">Stufe <b>'+chosenCount+'</b> / '+tree.length+'</span>'+
    '<span class="talent-points">Punkte: <b>'+points+'</b></span>'+
    '<button class="btn ghost talent-respec" id="respecBtn"'+(chosenCount<=0?' disabled':'')+'>'+
      '♻️ Zurücksetzen (🪙 '+fmtBig(RESPEC_COST*Math.max(1,chosenCount))+')</button>'+
    '</div>'+
    '<p class="talents-hint"><b>Pro Stufe</b> wählst du <b>genau ein</b> Talent (kostet 1 Punkt). Die nächste Stufe öffnet sich danach.</p>';

  tree.forEach((tier, ti) => {
    const unlocked = stufeUnlocked(state, ti);
    const chosenId = chosenTalentId(state, ti);
    const canPick  = unlocked && chosenId == null && points > 0;
    const stateLbl = chosenId != null ? '✓ gewählt' : (unlocked ? (points>0?'wählbar':'kein Punkt') : '🔒 gesperrt');
    html += '<div class="talent-tier'+(unlocked?'':' locked')+(chosenId!=null?' done':'')+'">'+
      '<div class="talent-tier-head"><span class="talent-tier-label">Stufe '+(ti+1)+'</span>'+
        '<span class="talent-tier-state">'+stateLbl+'</span></div>'+
      '<div class="talent-row">';
    tier.forEach(node => {
      const isChosen = chosenId === node.id;
      const dimmed = chosenId != null && !isChosen;
      const dis = !unlocked || (chosenId != null);
      // Tooltip: Wert + Wirk-Erklärung der betroffenen Stats.
      const explain = node.keys.map(k => STAT_INFO[k] ? STAT_INFO[k].help : '').filter(Boolean).join('\n');
      const tip = node.desc + (explain ? '\n\n' + explain : '');
      const isActive = !!node.active;
      const cssCls = 'talent-node' + (isChosen ? ' taken' : '') +
        (!unlocked ? ' locked' : '') + (dimmed ? ' dimmed' : '') + (canPick ? ' pickable' : '') +
        (isActive ? ' active-skill' : '') + (dis ? ' is-locked' : '');
      // Kein disabled-Attribut: nicht wählbare Nodes bleiben antippbar und zeigen
      // ihre Beschreibung als Toast (Touch-freundlich). Auswahl prüft canPick in JS.
      html += '<button class="'+cssCls+'" data-stufe="'+ti+'" data-talent="'+node.id+'"'+
        (dis?' aria-disabled="true"':'')+' data-pick="'+(canPick?'1':'0')+'" data-tip="'+esc(tip)+'"'+
        ' title="'+esc(tip)+'">'+
        (isChosen?'<span class="talent-check">✓</span>':'')+
        (isActive?'<span class="talent-active-badge">AKTIV</span>':'')+
        '<span class="talent-icon">'+(node.icon||'✦')+'</span>'+
        '<span class="talent-name">'+node.name+'</span>'+
        '<span class="talent-val">'+node.desc+'</span></button>';
    });
    html += '</div></div>';
  });

  // Werte-Legende (immer sichtbar, einklappbar) – erklärt jeden Klassen-Wert.
  const legendRows = classStatKeys(cls.id).map(k => {
    const i = STAT_INFO[k]; if(!i) return '';
    return '<div class="legend-row"><span class="legend-label">'+i.label+'</span>'+
      '<span class="legend-help">'+i.help.replace(/^[^:]*:\s*/,'')+'</span></div>';
  }).join('');
  html += '<details class="talent-legend"><summary>ℹ️ Was bewirken die Werte?</summary>'+
    '<div class="legend-list">'+legendRows+'</div></details>';

  box.innerHTML = html;

  box.querySelectorAll('.talent-node[data-talent]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.dataset.pick === '1') chooseTalent(parseInt(btn.dataset.stufe,10), btn.dataset.talent);
      else toast((btn.dataset.tip || '').replace(/\n+/g, ' · '));  // Touch: Erklärung zeigen
    });
  });
  const respec = box.querySelector('#respecBtn');
  if(respec) respec.addEventListener('click', respecTalents);
}

function chooseTalent(stufeIndex, optionId){
  if(!stufeUnlocked(state, stufeIndex)){ toast('Erst die vorige Stufe wählen.'); return; }
  if(chosenTalentId(state, stufeIndex) != null){
    toast('Pro Stufe nur ein Talent – erst zurücksetzen.'); return;
  }
  if((state.character.talentPoints||0) <= 0){ toast('Keine Talentpunkte verfügbar.'); return; }
  const ranks = state.character.talents || (state.character.talents = {});
  ranks[stufeIndex] = optionId;
  state.character.talentPoints--;
  saveState();
  renderAll();
}

function respecTalents(){
  const chosenCount = chosenTalentCount(state);
  if(chosenCount <= 0){ toast('Keine Talente zum Zurücksetzen.'); return; }
  // Kosten skalieren pro belegter Talentstufe: RESPEC_COST × Anzahl Stufen.
  const cost = RESPEC_COST * chosenCount;
  if(getCoins() < cost){ toast('Nicht genug Coins ('+fmtBig(cost)+' nötig).'); return; }
  confirmDialog({
    title:'Talente zurücksetzen?',
    body:'Kostet 🪙 '+fmtBig(cost)+' Coins ('+fmtBig(RESPEC_COST)+' pro Stufe × '+chosenCount+'). Du erhältst alle '+chosenCount+' Punkte zurück.',
    emoji:'♻️', confirmText:'Zurücksetzen', cancelText:'Abbrechen',
  }).then(async ok => {
    if(!ok) return;
    // Erst zahlen, dann erstatten – schlägt die Transaktion fehl, kein Gratis-Respec.
    const paid = await spendCoins(cost);
    if(!paid){ toast('Zahlung fehlgeschlagen – nicht genug Coins.'); return; }
    state.character.talentPoints = (state.character.talentPoints||0) + chosenCount;
    state.character.talents = {};
    saveState();
    renderAll();
    toast('♻️ Talente zurückgesetzt – '+chosenCount+' Punkte zurück.');
  });
}
function renderCharStats(t){
  const c = heroCombat(t);
  const lvl = state.level || 1;
  const need = xpForLevel(lvl), cur = xpInLevel(state.xp || 0, lvl);
  const pct = v => (v*100).toFixed(1).replace(/\.0$/,'') + '%';
  // info = Schlüssel in STAT_HELP → Hover-Erklärung (title) + Antippen (Toast).
  const row = (label, val, cls, info) => {
    const help = info && STAT_HELP[info] ? STAT_HELP[info] : '';
    const tAttr = help ? ' title="'+help.replace(/"/g,'&quot;')+'" data-help="'+info+'"' : '';
    const lbl = label + (help ? ' <span class="cs-info">ⓘ</span>' : '');
    return '<div class="cs-row'+(help?' has-help':'')+'"'+tAttr+'><span class="cs-l">'+lbl+
      '</span><b class="cs-v'+(cls?' '+cls:'')+'">'+val+'</b></div>';
  };
  // Sekundärwerte: nur anzeigen, wenn vorhanden (>0) – als eigene Gruppe.
  let secondary = '';
  if(t.lifesteal>0)   secondary += row('Lebensraub', pct(t.lifesteal), 'hp', 'lebensraub');
  if(t.dodge>0)       secondary += row('Ausweichen', pct(t.dodge), 'armor', 'ausweichen');
  if(t.versatility>0) secondary += row('Vielseitigkeit', pct(t.versatility), 'crit', 'vielseitigkeit');
  if(t.thorns>0)      secondary += row('Dornen', Math.round(t.thorns), 'damage', 'dornen');
  if(t.block>0)       secondary += row('Block', Math.round(t.block), 'armor', 'block');
  const secGroup = secondary
    ? '<div class="cs-group"><h4>Sekundärwerte</h4>'+secondary+'</div>' : '';
  const cls = classOf(state);
  // Aktive Schule fett markieren, inaktiven Krit dezent („wirkt nicht").
  const physActive = c.school === 'physisch', magicActive = c.school === 'magisch';
  const critRow = (label, val, active, info) =>
    row(label + (active ? ' <span class="cs-active">★</span>' : ' <small>(inaktiv)</small>'),
        pct(val), 'crit', info);
  const box = $('#charStats');
  box.innerHTML =
    '<div class="cs-group"><h4>Übersicht</h4>'+
      row('Klasse', cls.icon+' '+cls.label, 'power', 'klasse')+
      row('Level', lvl + ' <small>('+cur+' / '+need+' XP)</small>', 'level')+
      row('Kampfkraft', t.power, 'power', 'kampfkraft')+
      row('Gegenstandsstufe', gearScore(), 'crit', 'gegenstandsstufe')+
      row('Leben', fmtBig(c.maxHp), 'hp', 'leben')+
    '</div>'+
    '<div class="cs-group"><h4>Angriff ('+(magicActive?'magisch':'physisch')+')</h4>'+
      row('Schaden', c.atk, 'damage', 'schaden')+
      row('DPS', fmtBig(Math.round(c.dps)), 'damage', 'dps')+
      critRow('Physischer Krit', c.critPhys, physActive, 'kritphys')+
      critRow('Magischer Krit', c.critMagic, magicActive, 'kritmagic')+
      row('Krit-Schaden', pct(c.critMult), 'crit', 'kritschaden')+
      row('Angriffstempo', c.swingsPerSec.toFixed(2)+'/s', 'crit', 'angriffstempo')+
    '</div>'+
    '<div class="cs-group"><h4>Verteidigung</h4>'+
      row('Rüstung', Math.round(t.armor), 'armor', 'ruestung')+
      row('Schadensreduktion', '−'+Math.round(c.dmgReduction)+' / Treffer', 'armor', 'schadensreduktion')+
    '</div>'+
    secGroup;
  // Antippen einer Werte-Zeile → Erklärung als Toast (handytauglich).
  box.querySelectorAll('.cs-row.has-help').forEach(r => r.addEventListener('click', ()=>{
    const k = r.dataset.help; if(k && STAT_HELP[k]) toast(STAT_HELP[k]);
  }));
}

// ---- Inventar (Filter/Sortierung/Sperre, #23/#24) ------------------
let invTab = 'gear';
let invSort = 'value', invCat = 'all', invRar = 'all', invSearch = '', invWear = false;

function filteredSortedInventory(){
  let items = state.inventory.filter(it => {
    if(invCat !== 'all' && it.cat !== invCat) return false;
    if(invRar !== 'all' && it.rarity !== invRar) return false;
    if(invWear && !canEquip(it)) return false;
    if(invSearch && !it.name.toLowerCase().includes(invSearch.toLowerCase())) return false;
    return true;
  });
  const cmp = {
    value: (a,b)=> CAT_ORDER[a.cat]-CAT_ORDER[b.cat] || itemValue(b)-itemValue(a),
    ilvl:  (a,b)=> b.ilvl-a.ilvl,
    rarity:(a,b)=> rarityIndex(b.rarity)-rarityIndex(a.rarity) || itemValue(b)-itemValue(a),
    power: (a,b)=> itemPower(b)-itemPower(a),
    slot:  (a,b)=> a.slotKey.localeCompare(b.slotKey),
  }[invSort] || ((a,b)=>0);
  return items.sort(cmp);
}
export function sortedInventory(){
  return [...state.inventory].sort((a,b)=> CAT_ORDER[a.cat]-CAT_ORDER[b.cat] || itemValue(b)-itemValue(a));
}

export function renderInventory(){
  const panel = $('#inventoryPanel');
  panel.innerHTML = '';
  const subtabs = document.createElement('div');
  subtabs.className = 'inv-subtabs';
  subtabs.innerHTML =
    '<div class="inv-subtab'+(invTab==='gear'?' active':'')+'" data-tab="gear">🎒 Ausrüstung</div>'+
    '<div class="inv-subtab'+(invTab==='consum'?' active':'')+'" data-tab="consum">🧪 Verbrauch</div>';
  subtabs.querySelectorAll('.inv-subtab').forEach(el => el.addEventListener('click', ()=>{
    invTab = el.dataset.tab; hideTooltip(); renderInventory();
  }));
  panel.appendChild(subtabs);

  if(invTab === 'consum'){ renderConsumables(panel); return; }

  const total = state.inventory.length;
  const cap = invCapacity();
  const full = total >= cap;
  const head = document.createElement('div');
  head.className = 'inv-head';
  head.innerHTML = '<h2>🎒 Ausrüstung</h2>'+
    '<span class="count'+(full?' full':'')+'">'+total+' / '+cap+'</span>';
  panel.appendChild(head);

  // Filter-/Sortier-Leiste
  const ctrl = document.createElement('div');
  ctrl.className = 'inv-controls';
  ctrl.innerHTML =
    '<input id="invSearch" class="inv-search" type="text" placeholder="🔎 Suche…" value="'+invSearch.replace(/"/g,'&quot;')+'">'+
    '<select id="invCat"><option value="all">Alle Kategorien</option>'+
      '<option value="waffen">⚔️ Waffen</option><option value="ruestung">🛡️ Rüstung</option><option value="schmuck">💍 Schmuck</option></select>'+
    '<select id="invRar"><option value="all">Alle Seltenheiten</option>'+
      RARITIES.map(r=>'<option value="'+r.key+'">'+r.name+'</option>').join('')+'</select>'+
    '<select id="invSort"><option value="value">Sortieren: Wert</option>'+
      '<option value="power">Kampfkraft</option><option value="ilvl">Gegenstandsstufe</option>'+
      '<option value="rarity">Seltenheit</option><option value="slot">Slot</option></select>'+
    '<label class="inv-wear"><input id="invWear" type="checkbox"'+(invWear?' checked':'')+'> Nur tragbar</label>';
  panel.appendChild(ctrl);
  $('#invCat').value = invCat; $('#invRar').value = invRar; $('#invSort').value = invSort;
  $('#invCat').addEventListener('change', e=>{ invCat=e.target.value; renderInventory(); });
  $('#invRar').addEventListener('change', e=>{ invRar=e.target.value; renderInventory(); });
  $('#invSort').addEventListener('change', e=>{ invSort=e.target.value; renderInventory(); });
  $('#invWear').addEventListener('change', e=>{ invWear=e.target.checked; renderInventory(); });
  $('#invSearch').addEventListener('input', e=>{ invSearch=e.target.value; renderInventoryGridOnly(); });

  const gridWrap = document.createElement('div');
  gridWrap.id = 'invGridWrap';
  panel.appendChild(gridWrap);
  buildInvGrid(gridWrap);

  const hint = document.createElement('p');
  hint.className = 'inv-hint';
  if(!total) hint.textContent = 'Geh auf Abenteuer, um Ausrüstung zu finden!';
  else if(full) hint.innerHTML = '⚠️ Voll! Klick ein Item zum Ausrüsten, Sperren oder direkt <b>Verkaufen</b> – oder kauf beim Händler mehr Platz.';
  else hint.textContent = 'Klick ein Item: ausrüsten, vergleichen oder 🔒 sperren.';
  panel.appendChild(hint);
}
// Nur das Grid neu bauen (für Live-Suche, ohne Fokusverlust im Suchfeld)
function renderInventoryGridOnly(){
  const wrap = $('#invGridWrap'); if(wrap){ wrap.innerHTML=''; buildInvGrid(wrap); }
}
function buildInvGrid(wrap){
  const items = filteredSortedInventory();
  const grid = document.createElement('div');
  grid.className = 'backpack';
  const cells = Math.max(invCapacity(), state.inventory.length, items.length);
  for(let i=0;i<cells;i++){
    const it = items[i];
    const cell = document.createElement('div');
    cell.className = 'bp-slot';
    if(it){
      const r = rarityOf(it.rarity);
      cell.classList.add('filled');
      cell.style.setProperty('--rc', r.color);
      // Klasse kann es nicht tragen → Sperr-Markierung (B8). Gilt auch für
      // Schilde/Waffen ohne Material (Klassen-Restriktion per Slot).
      const blocked = !canEquip(it);
      if(blocked) cell.classList.add('not-equippable');
      cell.innerHTML = '<span class="bp-cat">'+CAT_ICON[it.cat]+'</span>'+
        (isLocked(it.id)?'<span class="bp-lock">🔒</span>':'')+
        (blocked?'<span class="bp-noequip" title="Deine Klasse kann das nicht tragen">✋</span>':'')+
        (it.proc?'<span class="bp-proc">★</span>':'')+
        '<img src="'+it.sprite+'" alt="'+it.name+'">';
      bindTooltip(cell, it, { compare:true });
      cell.addEventListener('click', ()=>{ hideTooltip(); openItemPreview(it); });
    } else {
      cell.innerHTML = '<span class="bp-empty">＋</span>';
    }
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
}

function renderConsumables(panel){
  const head = document.createElement('div');
  head.className = 'inv-head';
  head.innerHTML = '<h2>🧪 Verbrauch</h2>';
  panel.appendChild(head);
  const list = document.createElement('div');
  list.className = 'consum-list';
  const n = state.potions || 0;
  if(n > 0){
    const card = document.createElement('div');
    card.className = 'consum-card';
    card.innerHTML = '<div class="cc-icon">🧪</div>'+
      '<div class="cc-body"><div class="cc-name">Heiltrank</div>'+
      '<div class="cc-desc">Stellt 50 % der maximalen HP wieder her – im Bosskampf einsetzbar.</div></div>'+
      '<div class="cc-count">×'+n+'</div>';
    list.appendChild(card);
  }
  panel.appendChild(list);
  const hint = document.createElement('p');
  hint.className = 'inv-hint';
  hint.textContent = n > 0
    ? 'Heiltränke setzt du während eines Bosskampfes über den Heiltrank-Knopf ein.'
    : 'Noch keine Verbrauchsgegenstände – finde Heiltränke auf Abenteuern!';
  panel.appendChild(hint);
}

// ---- Händler --------------------------------------------------------
// Verkauf läuft jetzt direkt aus dem Inventar (Item-Modal). Der Händler bietet
// stattdessen Inventarerweiterungen: je Kauf +5 Plätze, Preis steigt pro Kauf
// (50k, 100k, …) bis maximal INV_SLOTS_MAX Plätze.
export function renderShop(){
  const panel = $('#shopPanel');
  panel.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'shop-head';
  head.innerHTML = '<h2>🪙 Händler</h2><span class="shop-gold">🪙 '+fmtBig(getCoins())+' Coins</span>';
  panel.appendChild(head);

  const cap = invCapacity();
  const note = document.createElement('p');
  note.className = 'shop-note';
  note.innerHTML = 'Erweitere dein Inventar. Aktuell <b>'+cap+' / '+INV_SLOTS_MAX+'</b> Plätzen. '+
    'Verkaufen kannst du Gegenstände direkt im Inventar.';
  panel.appendChild(note);

  const cost = nextExpandCost();
  const maxed = cost == null;
  const canAfford = !maxed && getCoins() >= cost;

  const card = document.createElement('div');
  card.className = 'shop-expand-card';
  card.innerHTML = '<div class="se-icon">🎒</div>'+
    '<div class="se-body">'+
      '<div class="se-name">Inventarerweiterung · +5 Plätze</div>'+
      '<div class="se-desc">'+(maxed
        ? 'Maximale Inventargröße ('+INV_SLOTS_MAX+' Plätze) erreicht.'
        : 'Preis: 🪙 <b>'+fmtBig(cost)+'</b> Coins'+(canAfford?'':' – nicht genug Coins'))+'</div>'+
    '</div>'+
    '<button class="btn" id="expandBuy"'+(canAfford?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>'+
      (maxed?'Maximum':'Kaufen')+'</button>';
  panel.appendChild(card);

  if(canAfford){
    card.querySelector('#expandBuy').addEventListener('click', async ()=>{
      const ok = await confirmDialog({ title:'Inventar erweitern?', emoji:'🎒',
        body:'+5 Inventarplätze für 🪙 <b>'+fmtBig(cost)+'</b> Coins kaufen?',
        confirmText:'Kaufen', cancelText:'Abbrechen' });
      if(!ok) return;
      const res = await buyInventoryExpansion();
      renderAll();
      if(res.ok) toast('🎒 +5 Inventarplätze!');
      else if(res.reason === 'coins') toast('Nicht genug Coins');
      else toast('Maximale Inventargröße erreicht');
    });
  }
}
