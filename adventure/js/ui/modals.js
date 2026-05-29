/* =====================================================================
   MODALS – Slot-Picker, Item-Vorschau/Vergleich, Verkauf, Belohnung,
   Charakter-Editor, Dev-Werkzeuge, Boss-Liste/Farm (#17), Statistik (#28),
   Onboarding (#29).
   ===================================================================== */
import { INV_SLOTS } from '../data/tuning.js';
import { RARITIES, rarityOf, rarityIndex } from '../data/rarities.js';
import { SLOTS, FITS } from '../data/slots.js';
import { AFFIX_DEFS, AFFIX_KEYS } from '../data/affixes.js';
import { GENDERS, HAIR_STYLES, HAIR_COLORS, SKIN_TONES, EYE_COLORS,
         DEFAULT_CHARACTER } from '../data/character-options.js';
import { rarityChances } from '../core/loot.js';
import { expeditionOf } from '../data/expeditions.js';
import { BOSS_DEFS, BOSS_COUNT, bossFor, zoneName, MECH_DEFS } from '../data/bosses.js';
import { state, saveState, resetState } from '../core/state.js';
import { recomputeTotals, heroTier, gainXp } from '../core/character.js';
import { buildHeroSVG } from '../core/avatar.js';
import { equip, unequip, sellItem, sellPrice, itemPower, resolveTargetSlot,
         isLocked, toggleLock, rollItem, inventoryFull } from '../core/items.js';
import { startExpedition } from '../core/expedition.js';
import { startBossFight, updatePotionBtn } from '../core/combat.js';
import { $, fmtVal, fmtBig, IS_TOUCH, toast } from './dom.js';
import { bindTooltip, hideTooltip, affixLinesHTML } from './tooltip.js';
import { renderAll } from './render.js';

const overlay = () => $('#overlay');
const modal = () => $('#modal');
export function closeModal(){ overlay().classList.remove('show'); }
function openModal(html){ modal().innerHTML = html; overlay().classList.add('show'); }

// ---- Slot-Picker ----------------------------------------------------
export function openSlotPicker(slotKey){
  hideTooltip();
  const slot = SLOTS[slotKey];
  const fitKeys = FITS(slotKey);
  const candidates = state.inventory
    .filter(i => fitKeys.includes(i.slotKey))
    .sort((a,b)=> rarityIndex(b.rarity)-rarityIndex(a.rarity) || b.stat-a.stat);
  const cur = state.equipped[slotKey];
  let html = '<h2>'+slot.name+'</h2><div class="sub">Wähle einen Gegenstand zum Ausrüsten</div>';
  if(cur){
    const sLbl = cur.statType==='armor' ? 'Rüstung' : 'Schaden';
    html += '<div class="cur-equip">'+
      '<div class="cur-label">Aktuell ausgerüstet</div>'+
      '<span class="rarity-name" data-r="'+cur.rarity+'" style="font-weight:700">'+cur.name+'</span>'+
      '<div class="cur-stats"><div class="tt-stat '+cur.statType+'">+'+cur.stat+' '+sLbl+'</div>'+affixLinesHTML(cur)+'</div>'+
      '<button class="btn ghost" id="unequipBtn" style="margin-top:10px;">Ablegen</button></div>';
  }
  html += candidates.length ? '<div class="picker-list" id="pickerList"></div>'
    : '<p style="text-align:center; color:var(--txt-dim);">Keine passenden Gegenstände im Inventar.</p>';
  html += '<div class="close-row"><button class="btn ghost" id="closeModalBtn">Schließen</button></div>';
  openModal(html);
  if(cur) modal().querySelector('#unequipBtn').addEventListener('click', ()=>{ unequip(slotKey); renderAll(); closeModal(); });
  modal().querySelector('#closeModalBtn').addEventListener('click', closeModal);
  if(candidates.length){
    const list = modal().querySelector('#pickerList');
    for(const it of candidates){
      const r = rarityOf(it.rarity);
      const cell = document.createElement('div');
      cell.className = 'inv-item';
      cell.style.setProperty('--rc', r.color);
      cell.innerHTML = '<img src="'+it.sprite+'" alt="'+it.name+'">';
      bindTooltip(cell, it, { compare:true });
      cell.addEventListener('click', ()=>{ hideTooltip(); openItemPreview(it, slotKey, ()=>openSlotPicker(slotKey)); });
      list.appendChild(cell);
    }
  }
}

// ---- Item-Vorschau / Vergleich -------------------------------------
function statRows(neu, alt){
  alt = alt || null;
  const get = (it, key) => !it ? 0 : (key==='__main' ? it.stat : (it.affixes && it.affixes[key]) || 0);
  const rows = [];
  const mainLbl = neu.statType==='armor' ? 'Rüstung' : 'Schaden';
  const altMain = (alt && alt.statType===neu.statType) ? alt.stat : 0;
  rows.push({ key:'__main', label:mainLbl, val:neu.stat, delta:neu.stat-altMain, pct:false, type:neu.statType });
  for(const k of AFFIX_KEYS){
    const nv = get(neu, k), av = get(alt, k);
    if(nv === 0 && av === 0) continue;
    rows.push({ key:k, label:AFFIX_DEFS[k].label, val:nv, delta:nv-av, pct:AFFIX_DEFS[k].pct });
  }
  return rows;
}
function deltaSpan(delta, pct){
  if(Math.abs(delta) < (pct?0.0005:0.5)) return '<span class="diff-zero">±0</span>';
  const cls = delta>0 ? 'diff-pos' : 'diff-neg';
  return '<span class="'+cls+'">'+(delta>0?'+':'−')+fmtVal(Math.abs(delta), pct)+'</span>';
}
export function openItemPreview(item, fromSlotKey, backFn){
  hideTooltip();
  const r = rarityOf(item.rarity);
  const target = (fromSlotKey === 'ring2') ? 'ring2'
    : (fromSlotKey && SLOTS[fromSlotKey] ? fromSlotKey : resolveTargetSlot(item));
  const cur = state.equipped[target] || null;
  const rows = statRows(item, cur);
  let body = '';
  for(const row of rows){
    body += '<div class="diff-row"><span class="diff-label">'+row.label+'</span>'+
      '<span class="diff-new'+(row.type? ' '+row.type:'')+'">+'+fmtVal(row.val, row.pct)+'</span>'+
      deltaSpan(row.delta, row.pct)+'</div>';
  }
  const powDelta = itemPower(item) - itemPower(cur);
  body += '<div class="diff-row power-row"><span class="diff-label">Kampfkraft</span>'+
    '<span class="diff-new power">'+itemPower(item)+'</span>'+deltaSpan(powDelta, false)+'</div>';
  const procLine = item.proc ? '<div class="preview-hint" style="color:'+item.proc.color+'">'+
    '★ '+item.proc.label+'</div>' : '';
  const locked = isLocked(item.id);
  openModal('<h2 style="color:'+r.color+'">'+item.name+(locked?' 🔒':'')+'</h2>'+
    '<div class="sub">'+r.name+' · '+SLOTS[item.slotKey].name+' · Gegenstandsstufe '+item.ilvl+'</div>'+
    (cur ? '<div class="preview-hint">Vergleich mit aktuell ausgerüstetem Teil:</div>'
         : '<div class="preview-hint">Dieser Slot ist noch frei.</div>')+
    '<div class="preview-stats">'+body+'</div>'+procLine+
    '<div class="preview-actions">'+
      '<button class="btn" id="previewEquip">Anlegen</button>'+
      '<button class="btn ghost" id="previewLock">'+(locked?'🔓 Entsperren':'🔒 Sperren')+'</button>'+
      '<button class="btn ghost" id="previewCancel">Abbrechen</button>'+
    '</div>');
  modal().querySelector('#previewEquip').addEventListener('click', ()=>{ equip(item, target); renderAll(); closeModal(); });
  modal().querySelector('#previewLock').addEventListener('click', ()=>{ toggleLock(item.id); renderAll(); openItemPreview(item, fromSlotKey, backFn); });
  modal().querySelector('#previewCancel').addEventListener('click', ()=>{ backFn ? backFn() : closeModal(); });
}

// ---- Verkaufs-Modal (v.a. Touch) -----------------------------------
export function openSellModal(item){
  hideTooltip();
  const r = rarityOf(item.rarity);
  const sLbl = item.statType==='armor' ? 'Rüstung' : 'Schaden';
  let stats = '<div class="diff-row"><span class="diff-label">'+sLbl+'</span>'+
    '<span class="diff-new '+item.statType+'">+'+item.stat+'</span></div>';
  for(const k of AFFIX_KEYS){
    const v = item.affixes && item.affixes[k];
    if(v == null) continue;
    stats += '<div class="diff-row"><span class="diff-label">'+AFFIX_DEFS[k].label+'</span>'+
      '<span class="diff-new">+'+fmtVal(v, AFFIX_DEFS[k].pct)+'</span></div>';
  }
  const price = sellPrice(item);
  openModal('<h2 style="color:'+r.color+'">'+item.name+'</h2>'+
    '<div class="sub">'+r.name+' · '+SLOTS[item.slotKey].name+' · Gegenstandsstufe '+item.ilvl+'</div>'+
    '<div class="preview-stats">'+stats+'</div>'+
    '<div class="preview-hint" style="margin-top:12px;">Verkaufen für 💰 '+fmtBig(price)+' Gold?</div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="sellConfirm">Verkaufen</button>'+
      '<button class="btn ghost" id="sellLock">'+(isLocked(item.id)?'🔓 Entsperren':'🔒 Sperren')+'</button>'+
      '<button class="btn ghost" id="sellCancel">Abbrechen</button>'+
    '</div>');
  modal().querySelector('#sellConfirm').addEventListener('click', ()=>{
    const p = sellItem(item.id); renderAll(); closeModal(); if(p) toast('+'+fmtBig(p)+' Gold');
  });
  modal().querySelector('#sellLock').addEventListener('click', ()=>{ toggleLock(item.id); openSellModal(item); });
  modal().querySelector('#sellCancel').addEventListener('click', closeModal);
}

// ---- Chancen-Vorschau vor dem Abenteuer-Start ----------------------
export function previewExpedition(durKey){
  const exp = expeditionOf(durKey); if(!exp) return;
  const chances = rarityChances(state.zone, exp.boost);
  let rows = '';
  for(const c of chances){
    if(c.p < 0.0005) continue;
    const pct = (c.p*100) < 1 ? (c.p*100).toFixed(1) : Math.round(c.p*100);
    const w = Math.max(2, Math.round(c.p*100));
    rows += '<div class="chance-row">'+
      '<span class="chance-name" style="color:'+c.rarity.color+'">'+c.rarity.name+'</span>'+
      '<span class="chance-bar"><i style="width:'+w+'%; background:'+c.rarity.color+'"></i></span>'+
      '<span class="chance-pct">'+pct+'%</span></div>';
  }
  openModal('<h2>'+exp.icon+' '+exp.label+'</h2>'+
    '<div class="sub">Dein Held bringt genau <b>2 Gegenstände</b> mit. Chancen je Seltenheit:</div>'+
    '<div class="chance-list">'+rows+'</div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="startExpBtn">⚔️ Los geht’s</button>'+
      '<button class="btn ghost" id="cancelExpBtn">Abbrechen</button>'+
    '</div>');
  modal().querySelector('#startExpBtn').addEventListener('click', ()=>{ closeModal(); startExpedition(durKey); });
  modal().querySelector('#cancelExpBtn').addEventListener('click', closeModal);
}

// ---- Belohnungs-Modal (nach dem Abholen) ---------------------------
export function showRewardModal(items, potionGained){
  let cards = '';
  for(const it of items){
    const r = rarityOf(it.rarity);
    const sLbl = it.statType==='armor' ? 'Rüstung' : 'Schaden';
    cards += '<div class="reward-card" style="--rc:'+r.color+'">'+
      '<img src="'+it.sprite+'" alt="'+it.name+'">'+
      '<div class="rc-name" style="color:'+r.color+'">'+it.name+'</div>'+
      '<div class="tt-stat '+it.statType+'">+'+it.stat+' '+sLbl+'</div>'+
      affixLinesHTML(it)+'</div>';
  }
  if(potionGained){
    cards += '<div class="reward-card" style="--rc:#37d67a">'+
      '<div class="rc-emoji">🧪</div>'+
      '<div class="rc-name" style="color:#37d67a">Heiltrank</div>'+
      '<div class="tt-stat" style="color:#37d67a">+50% HP im Kampf</div></div>';
  }
  const sub = 'Du hast '+items.length+' Gegenstände'+(potionGained?' + einen Heiltrank':'')+' erhalten!';
  openModal('<h2>🎁 Belohnung</h2><div class="sub">'+sub+'</div>'+
    '<div class="reward-grid">'+cards+'</div>'+
    '<div class="close-row"><button class="btn" id="rewardOkBtn">Super!</button></div>');
  modal().querySelector('#rewardOkBtn').addEventListener('click', closeModal);
}

// ---- Boss-Liste / Farm-Modus (#17) ---------------------------------
export function openBossList(){
  hideTooltip();
  const maxIdx = state.zone; // aktueller (noch nicht besiegter) Boss
  const t = recomputeTotals();
  let rows = '';
  for(let i=0; i<=Math.min(maxIdx, BOSS_COUNT+30); i++){
    const b = bossFor(i);
    const beaten = i < state.zone;
    const isCurrent = i === state.zone;
    const kills = state.killCounts[i] || 0;
    const first = state.firstClears[i];
    const mechs = (Array.isArray(b.mechanic)?b.mechanic:[b.mechanic]).filter(Boolean)
      .map(m => MECH_DEFS[m]?MECH_DEFS[m].emoji:'').join('');
    const lootSlots = b.loot && b.loot.slots ? b.loot.slots.map(s=>SLOTS[s]?SLOTS[s].name:s).join(', ') : '–';
    const tag = isCurrent ? '<span class="bl-tag cur">Aktuell</span>'
      : (beaten ? '<span class="bl-tag done">✓ '+(first?'Erstkill':'')+'</span>' : '');
    rows += '<div class="bl-row'+(isCurrent?' current':'')+'">'+
      '<img class="bl-portrait" src="'+b.sprite+'" alt="">'+
      '<div class="bl-info"><div class="bl-name">'+(beaten?'↻ ':'👑 ')+b.name+' '+tag+'</div>'+
        '<div class="bl-meta">'+zoneName(i)+' · Kraft '+fmtBig(b.recPower)+' '+mechs+
        (kills?(' · '+kills+'× besiegt'):'')+'</div>'+
        '<div class="bl-loot">🎁 Beute-Fokus: '+lootSlots+'</div>'+
      '</div>'+
      '<button class="btn '+(isCurrent?'boss-btn':'ghost')+'" data-fight="'+i+'">'+(beaten?'Farmen':'Kämpfen')+'</button>'+
    '</div>';
  }
  openModal('<h2>👑 Bosse & Farmen</h2>'+
    '<div class="sub">Besiegte Bosse erneut farmen (reduzierte Belohnung) oder den aktuellen herausfordern. Deine Kraft: <b>'+t.power+'</b></div>'+
    '<div class="boss-list">'+rows+'</div>'+
    '<div class="close-row"><button class="btn ghost" id="blClose">Schließen</button></div>');
  modal().querySelectorAll('[data-fight]').forEach(btn => btn.addEventListener('click', ()=>{
    const idx = parseInt(btn.dataset.fight,10);
    closeModal(); startBossFight(idx);
  }));
  modal().querySelector('#blClose').addEventListener('click', closeModal);
}

// ---- Statistik-Panel (#28) -----------------------------------------
export function openStats(){
  const s = state.stats;
  const days = Math.max(0, Math.floor((Date.now() - s.createdAt)/86400000));
  const dropRows = RARITIES.map(r =>
    '<div class="cs-row"><span class="cs-l" style="color:'+r.color+'">'+r.name+'</span>'+
    '<b class="cs-v">'+(s.drops[r.key]||0)+'</b></div>').join('');
  const best = s.bestItem ? '<span style="color:'+rarityOf(s.bestItem.rarity).color+'">'+s.bestItem.name+'</span>' : '–';
  const row = (l,v) => '<div class="cs-row"><span class="cs-l">'+l+'</span><b class="cs-v">'+v+'</b></div>';
  openModal('<h2>📊 Statistik</h2>'+
    '<div class="char-stats" style="grid-template-columns:1fr 1fr;">'+
      '<div class="cs-group"><h4>Fortschritt</h4>'+
        row('Höchster Boss', state.zone)+
        row('Bosse besiegt', state.bossesBeaten)+
        row('Farm-Siege', s.farmKills)+
        row('Erstkills', Object.keys(state.firstClears).length)+
        row('Spieltage', days)+
      '</div>'+
      '<div class="cs-group"><h4>Beute</h4>'+
        row('Funde gesamt', state.totalFinds||0)+
        row('Expeditionen', s.expeditionsDone)+
        row('Gold verdient', fmtBig(s.goldEarned))+
        row('Bestes Item', best)+
      '</div>'+
      '<div class="cs-group" style="grid-column:1 / -1;"><h4>Drops nach Seltenheit</h4>'+dropRows+'</div>'+
    '</div>'+
    '<div class="close-row"><button class="btn" id="statsClose">Schließen</button></div>');
  modal().querySelector('#statsClose').addEventListener('click', closeModal);
}

// ---- Onboarding (#29) ----------------------------------------------
export function maybeOnboarding(){
  if(state.settings.seenOnboarding) return;
  state.settings.seenOnboarding = true; saveState();
  openModal('<h2>👋 Willkommen, Abenteurer!</h2>'+
    '<div class="ob-list">'+
      '<p>🧭 <b>Abenteuer:</b> Schick deinen Helden auf Expeditionen – er bringt Items mit (auch wenn du offline bist).</p>'+
      '<p>🎒 <b>Inventar:</b> Rüste bessere Teile an, vergleiche im Tooltip und 🔒 sperre Lieblingsstücke.</p>'+
      '<p>👑 <b>Bosse:</b> Jeder Boss ist <b>deutlich härter</b> als der letzte. Ohne Item-Grind kommst du nicht weiter – ein <b>Enrage-Timer</b> bestraft zu wenig Schaden.</p>'+
      '<p>↻ <b>Farmen:</b> Über „Bosse" kannst du besiegte Bosse erneut für Loot farmen.</p>'+
      '<p>📊 <b>Werte:</b> Die <b>Kampfkraft</b> bündelt all deine Werte (Schaden, Rüstung, Krit, Tempo …) zu einer Vergleichszahl – liegt sie über der empfohlenen Boss-Kampfkraft, stehen die Chancen gut. <b>DPS</b> ist dein Schaden pro Sekunde gegen den Enrage-Timer. Fahre im <b>Charakter</b>-Tab über einen Wert (ⓘ) für die Erklärung.</p>'+
    '</div>'+
    '<div class="close-row"><button class="btn" id="obOk">Los geht’s!</button></div>');
  modal().querySelector('#obOk').addEventListener('click', closeModal);
}

// ---- Charakter-Editor ----------------------------------------------
let _draftChar = null, _creatorForced = false;
const creatorOverlay = () => $('#creatorOverlay');
const creatorModal = () => $('#creatorModal');
export function isCreatorForced(){ return _creatorForced; }
export function openCharacterCreator(forced){
  _creatorForced = !!forced;
  _draftChar = Object.assign({}, DEFAULT_CHARACTER, state.character || {});
  renderCreator();
  creatorOverlay().classList.add('show');
}
function renderCreator(){
  const tier = heroTier(recomputeTotals().power);
  const genderBtns = GENDERS.map(g =>
    '<div class="opt-btn'+(_draftChar.gender===g.id?' sel':'')+'" data-gender="'+g.id+'">'+g.icon+' '+g.label+'</div>').join('');
  const hairBtns = HAIR_STYLES.map(h =>
    '<div class="opt-btn'+(_draftChar.hairId===h.id?' sel':'')+'" data-hair="'+h.id+'">'+h.label+'</div>').join('');
  const colorBtns = HAIR_COLORS.map(c =>
    '<div class="color-swatch'+(_draftChar.hairColor===c.color?' sel':'')+'" data-color="'+c.color+'" title="'+c.label+'" style="background:'+c.color+'"></div>').join('');
  const skinBtns = SKIN_TONES.map(s =>
    '<div class="color-swatch'+(_draftChar.skinTone===s.color?' sel':'')+'" data-skin="'+s.color+'" title="'+s.label+'" style="background:'+s.color+'"></div>').join('');
  const eyeBtns = EYE_COLORS.map(e =>
    '<div class="color-swatch'+(_draftChar.eyeColor===e.color?' sel':'')+'" data-eye="'+e.color+'" title="'+e.label+'" style="background:'+e.color+'"></div>').join('');
  creatorModal().innerHTML =
    '<h2>👤 Charakter erstellen</h2>'+
    '<img class="creator-preview" id="creatorPreview" alt="Vorschau">'+
    '<div class="creator-section"><h3>Geschlecht</h3><div class="opt-grid cols2">'+genderBtns+'</div></div>'+
    '<div class="creator-section"><h3>Frisur</h3><div class="opt-grid cols3">'+hairBtns+'</div></div>'+
    '<div class="creator-section"><h3>Haarfarbe</h3><div class="color-grid">'+colorBtns+'</div></div>'+
    '<div class="creator-section"><h3>Hautton</h3><div class="color-grid">'+skinBtns+'</div></div>'+
    '<div class="creator-section"><h3>Augenfarbe</h3><div class="color-grid">'+eyeBtns+'</div></div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="saveCharBtn">✓ Fertig</button>'+
      (_creatorForced ? '' : '<button class="btn ghost" id="cancelCharBtn">Abbrechen</button>')+
    '</div>';
  creatorModal().querySelector('#creatorPreview').src = buildHeroSVG(_draftChar, tier);
  creatorModal().querySelectorAll('[data-gender]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.gender = el.dataset.gender; renderCreator(); }));
  creatorModal().querySelectorAll('[data-hair]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.hairId = el.dataset.hair; renderCreator(); }));
  creatorModal().querySelectorAll('[data-color]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.hairColor = el.dataset.color; renderCreator(); }));
  creatorModal().querySelectorAll('[data-skin]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.skinTone = el.dataset.skin; renderCreator(); }));
  creatorModal().querySelectorAll('[data-eye]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.eyeColor = el.dataset.eye; renderCreator(); }));
  creatorModal().querySelector('#saveCharBtn').addEventListener('click', applyCharacter);
  const cancel = creatorModal().querySelector('#cancelCharBtn');
  if(cancel) cancel.addEventListener('click', ()=> creatorOverlay().classList.remove('show'));
}
function applyCharacter(){
  state.character = Object.assign({}, _draftChar);
  saveState();
  creatorOverlay().classList.remove('show');
  renderAll();
}

// ---- Dev-/Test-Werkzeuge -------------------------------------------
const devOverlay = () => $('#devOverlay');
const devModal = () => $('#devModal');
export function openDevPanel(){
  devModal().innerHTML =
    '<h2>🛠 Test-Werkzeuge</h2>'+
    '<div class="sub">Nur zum Testen – nicht Teil des normalen Spiels.</div>'+
    '<div class="dev-list">'+
      '<button class="btn ghost" id="devFinish">⏭️ Abenteuer sofort beenden</button>'+
      '<button class="btn ghost" id="devFill">🎒 Inventar mit Items füllen</button>'+
      '<button class="btn ghost" id="devClear">🗑️ Inventar leeren (außer 🔒)</button>'+
      '<button class="btn ghost" id="devGold">💰 +100000 Gold</button>'+
      '<button class="btn ghost" id="devXp">⭐ +5000 XP</button>'+
      '<button class="btn ghost" id="devPotion">🧪 +3 Heiltränke</button>'+
      '<button class="btn ghost" id="devSkip">⏩ Boss überspringen (+1 Zone)</button>'+
      '<button class="btn" id="devReset" style="background:linear-gradient(180deg,#c0392b,#922d22);">♻️ Spiel komplett zurücksetzen</button>'+
    '</div>'+
    '<div class="close-row"><button class="btn ghost" id="devClose">Schließen</button></div>';
  const q = s => devModal().querySelector(s);
  q('#devFinish').addEventListener('click', ()=>{ if(state.expedition){ state.expedition.endsAt = Date.now(); saveState(); renderAll(); } devOverlay().classList.remove('show'); });
  q('#devFill').addEventListener('click', ()=>{ while(state.inventory.length < INV_SLOTS) state.inventory.push(rollItem(state.zone, 2)); saveState(); renderAll(); });
  q('#devClear').addEventListener('click', ()=>{ state.inventory = state.inventory.filter(it=>isLocked(it.id)); saveState(); renderAll(); });
  q('#devGold').addEventListener('click', ()=>{ state.gold += 100000; saveState(); renderAll(); });
  q('#devXp').addEventListener('click', ()=>{ gainXp(5000); saveState(); renderAll(); });
  q('#devPotion').addEventListener('click', ()=>{ state.potions = (state.potions||0) + 3; saveState(); renderAll(); updatePotionBtn(); });
  q('#devSkip').addEventListener('click', ()=>{ state.firstClears[state.zone]=true; state.zone++; saveState(); renderAll(); });
  q('#devReset').addEventListener('click', ()=>{
    if(!confirm('Wirklich alles löschen und neu starten?')) return;
    resetState(); devOverlay().classList.remove('show'); renderAll(); openCharacterCreator(true);
  });
  q('#devClose').addEventListener('click', ()=> devOverlay().classList.remove('show'));
  devOverlay().classList.add('show');
}
