/* =====================================================================
   MODALS – Slot-Picker, Item-Vorschau/Vergleich, Verkauf, Belohnung,
   Charakter-Editor, Dev-Werkzeuge, Boss-Liste/Farm (#17), Statistik (#28),
   Onboarding (#29).
   ===================================================================== */
import { RARITIES, rarityOf, rarityIndex } from '../data/rarities.js';
import { SLOTS, FITS, SLOT_KEYS, SLOT_ICON } from '../data/slots.js';
import { AFFIX_DEFS, AFFIX_KEYS } from '../data/affixes.js';
import { GENDERS, HAIR_STYLES, HAIR_COLORS, BEARD_STYLES, SKIN_TONES, EYE_COLORS,
         DEFAULT_CHARACTER } from '../data/character-options.js';
import { CLASSES, CLASS_BY_ID, classOf, abilitiesOf } from '../data/classes.js';
import { materialOf, MATERIAL_LABEL } from '../data/itemTypes.js';
import { rarityChances } from '../core/loot.js';
import { INV_SLOTS } from '../data/tuning.js';
import { expeditionOf } from '../data/expeditions.js';
import { BOSS_DEFS, BOSS_COUNT, bossFor, zoneName, MECH_DEFS } from '../data/bosses.js';
import { state, saveState, listCharacters, createCharacter,
         switchCharacter, deleteCharacter, canAddCharacter, activeCharId } from '../core/state.js';
import { recomputeTotals, heroTier } from '../core/character.js';
import { buildHeroSVG } from '../core/avatar.js';
import { equip, unequip, sellItem, sellPrice, itemPower, resolveTargetSlot,
         isLocked, toggleLock, canEquip, equipBlockReason } from '../core/items.js';
import { startExpedition, expeditionActive } from '../core/expedition.js';
import { startBossFight, updatePotionBtn,
         openDuelArena, applyDuelSnapshot, resolveArenaOpponentLeft } from '../core/combat.js';
import { computePlayerStats } from '../core/tower.js';
import { db, ref, get, userKey } from '../core/firebase.js';
import { getCoins } from '../core/coins.js';
import { createDuel, joinDuel, listenDuel, listenDuelCombat, setDuelReady,
         setDuelHeroes, setStartAt, setDuelStatus, leaveDuel, requestDuelAction,
         requestDuelForfeit, startDuelHost, stopDuelHost, serverNow, otherKey,
         loadGuestSave, resolveActiveSlot } from '../core/duel.js';
import { $, fmtVal, fmtBig, IS_TOUCH, toast, confirmDialog } from './dom.js';
import { bindTooltip, hideTooltip, affixLinesHTML } from './tooltip.js';
import { renderAll, bossDifficulty } from './render.js';

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
    .sort((a,b)=> (canEquip(b)-canEquip(a)) || rarityIndex(b.rarity)-rarityIndex(a.rarity) || b.stat-a.stat);
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
      if(!canEquip(it)) cell.style.opacity = '.45';   // Material nicht tragbar
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
  const equipOk = canEquip(item);
  const blockLine = equipOk ? '' :
    '<div class="preview-hint" style="color:#ff6b6b">✋ '+equipBlockReason(item)+'</div>';
  openModal('<h2 style="color:'+r.color+'">'+item.name+(locked?' 🔒':'')+'</h2>'+
    '<div class="sub">'+r.name+' · '+SLOTS[item.slotKey].name+' · Gegenstandsstufe '+item.ilvl+'</div>'+
    (cur ? '<div class="preview-hint">Vergleich mit aktuell ausgerüstetem Teil:</div>'
         : '<div class="preview-hint">Dieser Slot ist noch frei.</div>')+
    '<div class="preview-stats">'+body+'</div>'+procLine+blockLine+
    '<div class="preview-actions">'+
      '<button class="btn" id="previewEquip"'+(equipOk?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Anlegen</button>'+
      '<button class="btn ghost" id="previewLock">'+(locked?'🔓 Entsperren':'🔒 Sperren')+'</button>'+
      '<button class="btn ghost" id="previewCancel">Abbrechen</button>'+
    '</div>');
  if(equipOk) modal().querySelector('#previewEquip').addEventListener('click', ()=>{ equip(item, target); renderAll(); closeModal(); });
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
    '<div class="preview-hint" style="margin-top:12px;">Verkaufen für 🪙 '+fmtBig(price)+' Coins?</div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="sellConfirm">Verkaufen</button>'+
      '<button class="btn ghost" id="sellLock">'+(isLocked(item.id)?'🔓 Entsperren':'🔒 Sperren')+'</button>'+
      '<button class="btn ghost" id="sellCancel">Abbrechen</button>'+
    '</div>');
  modal().querySelector('#sellConfirm').addEventListener('click', ()=>{
    const p = sellItem(item.id); renderAll(); closeModal(); if(p) toast('+'+fmtBig(p)+' Coins');
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
  // Inventar-Platz VOR dem Start prüfen (Expedition bringt 2 Items mit).
  const free = INV_SLOTS - state.inventory.length;
  const tooFull = free < 2;
  const warn = tooFull
    ? '<div class="exp-warn">🎒 Zu wenig Platz im Inventar – du brauchst <b>2 freie Plätze</b> '+
      '(aktuell '+Math.max(0,free)+'). Verkaufe erst etwas im Shop.</div>'
    : '';
  openModal('<h2>'+exp.icon+' '+exp.label+'</h2>'+
    '<div class="sub">Dein Held bringt genau <b>2 Gegenstände</b> mit. Chancen je Seltenheit:</div>'+
    '<div class="chance-list">'+rows+'</div>'+ warn +
    '<div class="preview-actions">'+
      '<button class="btn" id="startExpBtn"'+(tooFull?' disabled':'')+'>⚔️ Los geht’s</button>'+
      '<button class="btn ghost" id="cancelExpBtn">Abbrechen</button>'+
    '</div>');
  const startBtn = modal().querySelector('#startExpBtn');
  if(!tooFull) startBtn.addEventListener('click', ()=>{ closeModal(); startExpedition(durKey); });
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
    const diff = bossDifficulty(t.power, b.recPower);
    const diffBadge = '<span class="diff-badge '+diff.cls+'">'+diff.label+'</span>';
    rows += '<div class="bl-row'+(isCurrent?' current':'')+'">'+
      '<img class="bl-portrait" src="'+b.sprite+'" alt="">'+
      '<div class="bl-info"><div class="bl-name">'+(beaten?'↻ ':'👑 ')+b.name+' '+tag+' '+diffBadge+'</div>'+
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
        row('Coins verdient', fmtBig(s.goldEarned))+
        row('Bestes Item', best)+
      '</div>'+
      '<div class="cs-group" style="grid-column:1 / -1;"><h4>Drops nach Seltenheit</h4>'+dropRows+'</div>'+
    '</div>'+
    '<div class="close-row"><button class="btn" id="statsClose">Schließen</button></div>');
  modal().querySelector('#statsClose').addEventListener('click', closeModal);
}

// ---- Profil des anderen Spielers (read-only Ansicht) ---------------
export async function openOtherProfile(){
  hideTooltip();
  const ok = otherKey();
  const oName = ok[0].toUpperCase() + ok.slice(1);
  openModal('<h2>👁️ '+oName+'s Held</h2><div class="sub">Lädt …</div>');
  let slot, st;
  try {
    const loaded = await loadGuestSave(ok);
    slot = resolveActiveSlot(loaded);
    if(!slot || !slot.character) throw new Error('no-char');
    st = computePlayerStats(slot);
  } catch(e) {
    openModal('<h2>👁️ '+oName+'s Held</h2>'+
      '<p style="text-align:center; color:var(--txt-dim); margin:18px 0;">'+oName+
      ' hat noch keinen Helden im Dämmerpfad erstellt.</p>'+
      '<div class="close-row"><button class="btn ghost" id="opClose">Schließen</button></div>');
    modal().querySelector('#opClose').addEventListener('click', closeModal);
    return;
  }
  const cls = CLASS_BY_ID[st.classId] || classOf(slot);
  const charName = (slot.character && slot.character.name) || (cls ? cls.label : 'Held');
  const avatar = buildHeroSVG(slot.character, st.tier, { equipped: slot.equipped || {} });

  // Ausrüstung (read-only) – belegte Slots als Item-Zellen, leere dezent.
  let gear = '';
  for(const sk of SLOT_KEYS){
    const it = (slot.equipped || {})[sk];
    if(it){
      const r = rarityOf(it.rarity);
      gear += '<div class="inv-item op-cell" style="--rc:'+r.color+'" data-op="'+sk+'">'+
        '<img src="'+it.sprite+'" alt="'+(it.name||'')+'"></div>';
    } else {
      gear += '<div class="inv-item op-empty" title="'+(SLOTS[sk]?SLOTS[sk].name:'')+'">'+
        '<span>'+(SLOT_ICON[sk]||'')+'</span></div>';
    }
  }

  const pct = v => Math.round((v||0)*100)+'%';
  const row = (label, val, cls2) => '<div class="cs-row"><span class="cs-l">'+label+
    '</span><b class="cs-v'+(cls2?' '+cls2:'')+'">'+val+'</b></div>';
  let sec = '';
  if(st.lifesteal>0)   sec += row('Lebensraub', pct(st.lifesteal), 'hp');
  if(st.dodge>0)       sec += row('Ausweichen', pct(st.dodge), 'armor');
  if(st.versatility>0) sec += row('Vielseitigkeit', pct(st.versatility), 'crit');
  if(st.block>0)       sec += row('Block', Math.round(st.block), 'armor');
  if(st.thorns>0)      sec += row('Dornen', Math.round(st.thorns), 'damage');

  openModal('<h2>👁️ '+oName+'s Held</h2>'+
    '<div class="op-head">'+
      '<img class="op-avatar" src="'+avatar+'" alt="">'+
      '<div class="op-meta">'+
        '<div class="op-name">'+charName+'</div>'+
        '<div class="op-cls">'+(cls?cls.icon+' '+cls.label:'')+'</div>'+
        '<div class="op-lvl">⭐ Level <b>'+(st.level||1)+'</b> · ⚔️ Kampfkraft <b>'+fmtBig(st.power)+'</b></div>'+
      '</div>'+
    '</div>'+
    '<h3 class="op-sub">Ausrüstung</h3>'+
    '<div class="picker-list op-gear">'+gear+'</div>'+
    '<h3 class="op-sub">Werte</h3>'+
    '<div class="preview-stats">'+
      row('⚔️ Kampfkraft', fmtBig(st.power), 'power')+
      row('❤️ Max HP', fmtBig(Math.round(st.maxHp)), 'hp')+
      row('🗡️ Schaden', fmtBig(st.atk), 'damage')+
      row('🛡️ Rüstung', fmtBig(Math.round(st.armor)), 'armor')+
      row('🎯 Krit-Chance', pct(st.critChance), 'crit')+
      sec+
    '</div>'+
    '<div class="close-row"><button class="btn ghost" id="opClose">Schließen</button></div>');
  // Tooltips für ausgerüstete Items (read-only, kein Vergleich).
  modal().querySelectorAll('.op-cell[data-op]').forEach(cell => {
    const it = (slot.equipped || {})[cell.dataset.op];
    if(it) bindTooltip(cell, it, { compare:false });
  });
  modal().querySelector('#opClose').addEventListener('click', closeModal);
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
let _draftChar = null, _creatorForced = false, _creatingNew = false, _prevCharId = null;
const creatorOverlay = () => $('#creatorOverlay');
const creatorModal = () => $('#creatorModal');
export function isCreatorForced(){ return _creatorForced; }
export function openCharacterCreator(forced, isNew){
  _creatorForced = !!forced;
  _creatingNew = !!isNew;
  _draftChar = Object.assign({}, DEFAULT_CHARACTER, state.character || {});
  // Erst-Erstellung: keine Klasse vorausgewählt → bewusste Wahl erzwingen.
  if(!state.character) _draftChar.classId = null;
  renderCreator();
  creatorOverlay().classList.add('show');
}
// Abbruch beim Anlegen eines NEUEN Charakters: leeren Slot entfernen und
// auf den vorigen Charakter zurückwechseln.
function cancelNewCharacter(){
  const newId = activeCharId();
  if(_prevCharId && _prevCharId !== newId) switchCharacter(_prevCharId);
  deleteCharacter(newId);
  _creatingNew = false; _prevCharId = null;
  renderAll();
}
// Detaillierte Klassen-Infokarte für die Charaktererstellung:
// Spielstil, Stärken, Schwächen, Rüstungen und Spezialfähigkeit.
function classInfoHtml(c){
  if(!c) return '';
  const MAT = { stoff:'Stoff', leder:'Leder', platte:'Platte' };
  const mats = (c.allowedMaterials||[]).filter(m=>m!=='zauberstab').map(m => MAT[m]||m).join(', ');
  const magic = c.damageSchool === 'magisch';
  const weapons = magic ? 'Zauberstäbe' : 'physische Waffen';
  const shield  = c.id === 'verteidiger' ? 'Schild ✅' : 'kein Schild ❌';
  const pros = (c.pros||[]).map(p => '<li>'+p+'</li>').join('');
  const cons = (c.cons||[]).map(p => '<li>'+p+'</li>').join('');
  const ab = c.ability;
  return ''+
    '<div class="ci-title">'+c.icon+' '+c.label+'</div>'+
    '<div class="ci-play">'+(c.playstyle||c.desc||'')+'</div>'+
    '<div class="ci-cols">'+
      '<div class="ci-pros"><span class="ci-h">✅ Stärken</span><ul>'+pros+'</ul></div>'+
      '<div class="ci-cons"><span class="ci-h">⚠️ Schwächen</span><ul>'+cons+'</ul></div>'+
    '</div>'+
    (ab ? '<div class="ci-ability"><span class="ci-h">'+ab.icon+' Spezialfähigkeit: '+ab.name+'</span>'+
          '<div class="ci-ability-desc">'+(ab.desc||'')+' · Abklingzeit '+Math.round(ab.cd/1000)+' s</div></div>' : '')+
    '<div class="ci-meta">⚔️ Schaden: '+c.damageSchool+
      '<br>🗡️ Waffen: '+weapons+' · 🛡️ '+shield+
      '<br>🪖 Rüstung: '+mats+'</div>';
}

function renderCreator(){
  const tier = heroTier(recomputeTotals().power);
  // Klasse ist dauerhaft: einmal gesetzt (im gespeicherten Charakter) → gesperrt.
  const classLocked = !!(state.character && state.character.classId);
  const classBtns = CLASSES.map(c => {
    const sel = _draftChar.classId === c.id;
    const dis = classLocked && !sel;
    return '<div class="opt-btn'+(sel?' sel':'')+(dis?' disabled':'')+'"'+
      (classLocked?'':' data-class="'+c.id+'"')+' title="'+c.desc.replace(/"/g,'&quot;')+'"'+
      (dis?' style="opacity:.4;cursor:not-allowed"':'')+'>'+c.icon+' '+c.label+'</div>';
  }).join('');
  const selClass = _draftChar.classId ? CLASS_BY_ID[_draftChar.classId] : null;
  const classDesc = selClass ? classInfoHtml(selClass)
    : '<span class="sub">Wähle eine Klasse – sie ist dauerhaft und kann später nicht geändert werden. Tippe eine Klasse an, um ihre Stärken, Schwächen und Spezialfähigkeit zu sehen.</span>';
  const genderBtns = GENDERS.map(g =>
    '<div class="opt-btn'+(_draftChar.gender===g.id?' sel':'')+'" data-gender="'+g.id+'">'+g.icon+' '+g.label+'</div>').join('');
  const hairBtns = HAIR_STYLES.map(h =>
    '<div class="opt-btn'+(_draftChar.hairId===h.id?' sel':'')+'" data-hair="'+h.id+'">'+h.label+'</div>').join('');
  const colorBtns = HAIR_COLORS.map(c =>
    '<div class="color-swatch'+(_draftChar.hairColor===c.color?' sel':'')+'" data-color="'+c.color+'" title="'+c.label+'" style="background:'+c.color+'"></div>').join('');
  const beardBtns = BEARD_STYLES.map(b =>
    '<div class="opt-btn'+(_draftChar.beardId===b.id?' sel':'')+'" data-beard="'+b.id+'">'+b.label+'</div>').join('');
  const hasBeard = _draftChar.beardId && _draftChar.beardId !== 'kein';
  const beardColorBtns = HAIR_COLORS.map(c =>
    '<div class="color-swatch'+(_draftChar.beardColor===c.color?' sel':'')+'" data-beardcolor="'+c.color+'" title="'+c.label+'" style="background:'+c.color+'"></div>').join('');
  const skinBtns = SKIN_TONES.map(s =>
    '<div class="color-swatch'+(_draftChar.skinTone===s.color?' sel':'')+'" data-skin="'+s.color+'" title="'+s.label+'" style="background:'+s.color+'"></div>').join('');
  const eyeBtns = EYE_COLORS.map(e =>
    '<div class="color-swatch'+(_draftChar.eyeColor===e.color?' sel':'')+'" data-eye="'+e.color+'" title="'+e.label+'" style="background:'+e.color+'"></div>').join('');
  creatorModal().innerHTML =
    '<h2>👤 Charakter erstellen</h2>'+
    '<img class="creator-preview" id="creatorPreview" alt="Vorschau">'+
    '<div class="creator-section"><h3>Name</h3>'+
      '<input type="text" id="creatorName" class="creator-name" maxlength="16" '+
      'placeholder="Name deines Helden" value="'+(_draftChar.name||'').replace(/"/g,'&quot;')+'"></div>'+
    '<div class="creator-section"><h3>Klasse'+(classLocked?' (dauerhaft)':'')+'</h3>'+
      '<div class="opt-grid class-grid">'+classBtns+'</div>'+
      '<div class="class-info">'+classDesc+'</div></div>'+
    '<div class="creator-section"><h3>Geschlecht</h3><div class="opt-grid cols3">'+genderBtns+'</div></div>'+
    '<div class="creator-section"><h3>Frisur</h3><div class="opt-grid cols3">'+hairBtns+'</div></div>'+
    '<div class="creator-section"><h3>Haarfarbe</h3><div class="color-grid">'+colorBtns+'</div></div>'+
    '<div class="creator-section"><h3>Bart</h3><div class="opt-grid cols2">'+beardBtns+'</div></div>'+
    '<div class="creator-section"'+(hasBeard?'':' style="opacity:.4;pointer-events:none;')+'"><h3>Bartfarbe</h3><div class="color-grid">'+beardColorBtns+'</div></div>'+
    '<div class="creator-section"><h3>Hautton</h3><div class="color-grid">'+skinBtns+'</div></div>'+
    '<div class="creator-section"><h3>Augenfarbe</h3><div class="color-grid">'+eyeBtns+'</div></div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="saveCharBtn">✓ Fertig</button>'+
      ((_creatorForced && !_creatingNew) ? '' : '<button class="btn ghost" id="cancelCharBtn">Abbrechen</button>')+
    '</div>';
  creatorModal().querySelector('#creatorPreview').src = buildHeroSVG(_draftChar, tier);
  const nameInput = creatorModal().querySelector('#creatorName');
  if(nameInput) nameInput.addEventListener('input', e=>{ _draftChar.name = e.target.value; });
  creatorModal().querySelectorAll('[data-class]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.classId = el.dataset.class; renderCreator(); }));
  creatorModal().querySelectorAll('[data-gender]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.gender = el.dataset.gender; renderCreator(); }));
  creatorModal().querySelectorAll('[data-hair]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.hairId = el.dataset.hair; renderCreator(); }));
  creatorModal().querySelectorAll('[data-color]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.hairColor = el.dataset.color; renderCreator(); }));
  creatorModal().querySelectorAll('[data-beard]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.beardId = el.dataset.beard; renderCreator(); }));
  creatorModal().querySelectorAll('[data-beardcolor]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.beardColor = el.dataset.beardcolor; renderCreator(); }));
  creatorModal().querySelectorAll('[data-skin]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.skinTone = el.dataset.skin; renderCreator(); }));
  creatorModal().querySelectorAll('[data-eye]').forEach(el =>
    el.addEventListener('click', ()=>{ _draftChar.eyeColor = el.dataset.eye; renderCreator(); }));
  creatorModal().querySelector('#saveCharBtn').addEventListener('click', applyCharacter);
  const cancel = creatorModal().querySelector('#cancelCharBtn');
  if(cancel) cancel.addEventListener('click', ()=>{
    creatorOverlay().classList.remove('show');
    if(_creatingNew) cancelNewCharacter();
  });
}
function applyCharacter(){
  if(!_draftChar.classId){ toast('Bitte wähle eine Klasse.'); return; }
  // Vorhandene Klasse ist unveränderlich – nie überschreiben.
  if(state.character && state.character.classId) _draftChar.classId = state.character.classId;
  // Name: leer → Klassenname als Standard.
  if(!_draftChar.name || !_draftChar.name.trim()) _draftChar.name = CLASS_BY_ID[_draftChar.classId].label;
  else _draftChar.name = _draftChar.name.trim();
  // Talente/Punkte beim Aussehen-Ändern bewahren bzw. neu initialisieren.
  const prevTalents = (state.character && state.character.talents) || {};
  const prevPoints  = (state.character && typeof state.character.talentPoints === 'number')
    ? state.character.talentPoints : Math.max(0, (state.level||1) - 1);
  state.character = Object.assign({}, _draftChar, { talents: prevTalents, talentPoints: prevPoints });
  saveState();
  creatorOverlay().classList.remove('show');
  _creatingNew = false; _prevCharId = null;
  renderAll();
}

// ---- Charakter-Roster (Wechsel / Neu / Löschen) --------------------
export function openRosterModal(){
  hideTooltip();
  const chars = listCharacters();
  let rows = '';
  for(const c of chars){
    const cls = c.classId ? CLASS_BY_ID[c.classId] : null;
    const icon = cls ? cls.icon : '👤';
    const name = c.name || (cls ? cls.label : 'Neuer Held');
    const sub = (cls ? cls.label : 'Ohne Klasse') + ' · Level ' + c.level;
    rows += '<div class="bl-row'+(c.isActive?' current':'')+'">'+
      '<span class="cr-list-ico">'+icon+'</span>'+
      '<div class="bl-info"><div class="bl-name">'+name+(c.isActive?' <span class="bl-tag cur">Aktiv</span>':'')+'</div>'+
        '<div class="bl-meta">'+sub+'</div></div>'+
      (c.isActive ? '' : '<button class="btn ghost" data-pick="'+c.id+'">Wählen</button>')+
      (chars.length>1 ? '<button class="btn ghost cr-del" data-del="'+c.id+'" title="Löschen">🗑️</button>' : '')+
    '</div>';
  }
  const addDisabled = !canAddCharacter();
  openModal('<h2>👥 Charaktere</h2>'+
    '<div class="sub">Wechsle zwischen Helden oder erstelle einen neuen – jeder startet komplett bei 0.</div>'+
    '<div class="boss-list">'+rows+'</div>'+
    '<div class="preview-actions">'+
      '<button class="btn" id="newCharBtn"'+(addDisabled?' disabled':'')+'>➕ Neuer Charakter</button>'+
      '<button class="btn ghost" id="rosterClose">Schließen</button>'+
    '</div>'+
    (addDisabled?'<div class="preview-hint">Maximale Charakterzahl erreicht.</div>':''));
  modal().querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', ()=>{
    if(switchCharacter(btn.dataset.pick)){ closeModal(); renderAll(); }
  }));
  modal().querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', ()=>{
    const c = listCharacters().find(x => x.id === btn.dataset.del);
    const nm = c && c.name ? c.name : 'diesen Charakter';
    const esc = s => (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    confirmDialog({
      title:'Charakter löschen?',
      body:'„<b>'+esc(nm)+'</b>" wird unwiderruflich gelöscht – der gesamte Fortschritt geht verloren.',
      emoji:'🗑️', confirmText:'Löschen', cancelText:'Abbrechen', danger:true,
    }).then(ok => {
      if(!ok) return;
      deleteCharacter(btn.dataset.del); renderAll(); openRosterModal();
    });
  }));
  const nb = modal().querySelector('#newCharBtn');
  if(nb) nb.addEventListener('click', ()=>{
    if(!canAddCharacter()){ toast('Maximale Charakterzahl erreicht.'); return; }
    _prevCharId = activeCharId();
    closeModal();
    createCharacter();                 // leerer Slot, sofort aktiv
    openCharacterCreator(true, true);  // forced + isNew (Abbruch räumt leeren Slot)
  });
  modal().querySelector('#rosterClose').addEventListener('click', closeModal);
}

// =====================================================================
//  LIVE-PvP-DUELL – Lobby (nutzt das vorhandene Lobby-System aus duel.js)
// =====================================================================
let _dId = null, _dHost = false, _dStake = 0;
let _dUnsubLobby = null, _dUnsubCombat = null, _dCountTimer = null;
let _dStarting = false, _dArena = false;

function cap(k){ return k ? k[0].toUpperCase() + k.slice(1) : ''; }
function dMyName(){ return cap(userKey) || 'Du'; }

function stopDuelCountdown(){ if(_dCountTimer){ clearInterval(_dCountTimer); _dCountTimer = null; } }

function cleanupDuel(leaveDb){
  stopDuelCountdown();
  stopDuelHost();
  if(_dUnsubLobby){ _dUnsubLobby(); _dUnsubLobby = null; }
  if(_dUnsubCombat){ _dUnsubCombat(); _dUnsubCombat = null; }
  if(leaveDb && _dId){ leaveDuel(_dId); }
  _dId = null; _dHost = false; _dStarting = false; _dArena = false;
}

export function openDuelLobby(){
  if(!state.character){ toast('Erst einen Charakter erstellen.'); return; }
  // Während eines laufenden Abenteuers ist der Held unterwegs – kein Duell.
  if(expeditionActive()){ toast('🧭 Dein Held ist gerade auf Abenteuer – erst zurückkehren.'); return; }
  cleanupDuel(false);
  openModal(
    '<h2>⚔️🆚 Duell – Live-PvP</h2>'+
    '<div class="sub">Tritt live gegen <b>'+cap(otherKey())+'</b> an – beide setzen Coins ein, der Sieger bekommt den Pott. '+
      'Eure echten Werte zählen. (Deine Coins: 🪙 '+fmtBig(getCoins())+')</div>'+
    '<div class="duel-box">'+
      '<label class="duel-row">Einsatz 🪙 <input id="duelStake" type="number" min="0" value="50"></label>'+
      '<label class="duel-row">Code <input id="duelCode" type="text" placeholder="z. B. nele"></label>'+
      '<div class="duel-actions">'+
        '<button class="btn" id="duelCreateBtn">Lobby erstellen</button>'+
        '<button class="btn ghost" id="duelJoinBtn">Beitreten</button>'+
        '<button class="btn ghost" id="duelHomeClose">Schließen</button>'+
      '</div>'+
      '<div class="duel-status" id="duelStatus"></div>'+
    '</div>');
  $('#duelCreateBtn').addEventListener('click', duelCreate);
  $('#duelJoinBtn').addEventListener('click', duelJoin);
  $('#duelHomeClose').addEventListener('click', ()=>{ cleanupDuel(false); closeModal(); });
}

async function duelCreate(){
  const stake = Math.max(0, parseInt($('#duelStake').value, 10) || 0);
  if(getCoins() < stake){ toast('🪙 Dafür reichen deine Coins nicht.'); return; }
  const code = ($('#duelCode').value || '').trim();
  try {
    _dHost = true; _dStake = stake;
    _dId = await createDuel(dMyName(), classOf(state).id, stake, code);
    _dUnsubLobby = listenDuel(_dId, onDuelUpdate);
  } catch(e){ toast('Fehler: ' + e.message); _dHost = false; _dId = null; }
}

async function duelJoin(){
  const code = ($('#duelCode').value || '').trim();
  if(!code){ toast('Bitte einen Lobby-Code eingeben.'); return; }
  try {
    _dHost = false;
    await joinDuel(code, dMyName(), classOf(state).id);
    _dId = code;
    _dUnsubLobby = listenDuel(_dId, onDuelUpdate);
  } catch(e){ toast('Fehler: ' + e.message); _dId = null; }
}

function onDuelUpdate(lobby){
  if(!lobby || lobby.status === 'ended'){
    if(_dArena){ resolveArenaOpponentLeft(); }   // Gegner mitten im Duell weg → wir gewinnen
    else { stopDuelCountdown(); toast('Duell-Lobby geschlossen.'); cleanupDuel(false); closeModal(); renderAll(); }
    return;
  }
  _dStake = lobby.stake || 0;

  if(lobby.status === 'in_progress'){ enterDuelArena(lobby); return; }

  // Host steuert den Auto-Start-Countdown.
  if(_dHost){
    if(lobby.hostReady && lobby.guestReady && !lobby.startAt) setStartAt(_dId, serverNow() + 5000);
    else if((!lobby.hostReady || !lobby.guestReady) && lobby.startAt) setStartAt(_dId, null);
  }
  renderDuelLobby(lobby);

  stopDuelCountdown();
  if(lobby.startAt){
    _dCountTimer = setInterval(()=>{
      const rem = Math.max(0, Math.ceil((lobby.startAt - serverNow())/1000));
      const el = $('#duelStatus'); if(el) el.textContent = rem > 0 ? ('⚔️ Duell startet in ' + rem + '…') : '⚔️ Los!';
      if(rem <= 0){ stopDuelCountdown(); if(_dHost) hostBeginDuel(lobby); }
    }, 200);
  }
}

function chip(name, ready, present){
  return '<div class="duel-chip'+(ready?' ready':'')+'">'+
    '<div class="dc-name">'+(present?(name||'…'):'wartet…')+'</div>'+
    '<div class="dc-state">'+(present?(ready?'✓ Bereit':'…'):'offen')+'</div></div>';
}

function renderDuelLobby(lobby){
  const both = lobby.host && lobby.guest;
  const meReady = _dHost ? lobby.hostReady : lobby.guestReady;
  openModal(
    '<h2>⚔️🆚 Duell-Lobby</h2>'+
    '<div class="sub">Einsatz: 🪙 '+fmtBig(lobby.stake||0)+' · Code: <b>'+_dId+'</b> (teile ihn mit '+cap(otherKey())+')</div>'+
    '<div class="duel-vs">'+chip(lobby.hostName, lobby.hostReady, lobby.host)+
      '<span class="duel-vs-mid">VS</span>'+chip(lobby.guestName, lobby.guestReady, lobby.guest)+'</div>'+
    '<div class="duel-status" id="duelStatus"></div>'+
    '<div class="duel-actions">'+
      (both ? '<button class="btn" id="duelReadyBtn">'+(meReady?'Bereit ✓ (abbrechen)':'Bereit!')+'</button>' : '')+
      '<button class="btn ghost" id="duelLeaveBtn">Verlassen</button>'+
    '</div>');
  const rb = $('#duelReadyBtn');
  if(rb) rb.addEventListener('click', ()=>{
    if(!meReady && getCoins() < (lobby.stake||0)){ toast('🪙 Dafür reichen deine Coins nicht.'); return; }
    setDuelReady(_dId, _dHost, !meReady);
  });
  $('#duelLeaveBtn').addEventListener('click', ()=>{ cleanupDuel(true); closeModal(); renderAll(); });
}

// Host: lädt beide Spielstände, prüft den Einsatz, startet die Engine.
async function hostBeginDuel(lobby){
  if(_dStarting) return;
  _dStarting = true;
  try {
    const oppKey = otherKey();
    const oppLoaded = await loadGuestSave(oppKey);
    const oppSave = resolveActiveSlot(oppLoaded);
    const hostStats = computePlayerStats(state);
    const guestStats = computePlayerStats(oppSave);
    const stake = lobby.stake || 0;
    // Coinstände beider Spieler aus dem globalen Wallet prüfen (nicht aus dem Save).
    let oppCoins = 0;
    try { oppCoins = Number((await get(ref(db, `coins/${oppKey}`))).val()) || 0; } catch(e){}
    if(getCoins() < stake || oppCoins < stake){
      toast('🪙 Einer von euch hat nicht genug Coins für den Einsatz.');
      setDuelStatus(_dId, { hostReady:false, guestReady:false, startAt:null });
      _dStarting = false; return;
    }
    // Aussehen beider Helden veröffentlichen (optional – Clients laden ohnehin selbst).
    setDuelHeroes(_dId, { tier: hostStats.tier }, { tier: guestStats.tier });
    // Engine starten, DANN Status auf in_progress (erster Snapshot existiert schon).
    startDuelHost(_dId, hostStats, guestStats, {
      hostName: lobby.hostName, guestName: lobby.guestName,
      hostKey: userKey, guestKey: oppKey,
    });
    setDuelStatus(_dId, { status: 'in_progress', startAt: null });
  } catch(e){
    toast('Duell-Start fehlgeschlagen: ' + e.message);
    _dStarting = false;
  }
}

// Beide Clients: Arena öffnen und auf Kampf-Snapshots lauschen.
function enterDuelArena(lobby){
  if(_dArena) return;
  _dArena = true;
  stopDuelCountdown();
  const role = _dHost ? 'host' : 'guest';
  const oppKey = otherKey();
  loadGuestSave(oppKey).then(loaded => {
    const opp = resolveActiveSlot(loaded);
    const oppStats = computePlayerStats(opp);
    const oppSrc = buildHeroSVG(opp.character, oppStats.tier,
      { equipped: opp.equipped || {}, hideHelmet: !!(opp.settings && opp.settings.hideHelmet) });
    closeModal();
    openDuelArena({
      lobbyId: _dId, role, stake: lobby.stake || 0,
      myName: dMyName(), oppName: _dHost ? lobby.guestName : lobby.hostName,
      oppSrc, abilities: abilitiesOf(state),
      onAction: (kind) => requestDuelAction(_dId, role, kind),
      onForfeit: () => requestDuelForfeit(_dId, role),
      onClose: () => cleanupDuel(true),
    });
    _dUnsubCombat = listenDuelCombat(_dId, snap => { if(snap) applyDuelSnapshot(snap); });
  }).catch(e => {
    toast('Gegner-Spielstand fehlt: ' + e.message);
    cleanupDuel(true); closeModal(); renderAll();
  });
}
