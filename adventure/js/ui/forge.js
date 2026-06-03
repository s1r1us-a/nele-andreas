/* =====================================================================
   SCHMIEDE-TAB: Materialbestand + Konvertieren, Item aufwerten/verzaubern.
   Das Zerlegen selbst läuft als Modus im Inventar (render.js) – hier werden
   die gewonnenen Materialien gezielt in ein Inventar-Item investiert.
   ===================================================================== */
import { AFFIX_DEFS, fmtAffix } from '../data/affixes.js';
import { rarityOf } from '../data/rarities.js';
import { SLOTS, CAT_ICON } from '../data/slots.js';
import { MATERIALS, MATERIAL_BY_KEY, CONVERT_RATE, nextMaterialKey,
         MAX_UPGRADE, UPGRADE_STAT_PCT, UPGRADE_AFFIX_PCT,
         upgradeCost, canUpgrade, rerollCost, canReroll } from '../data/materials.js';
import { state } from '../core/state.js';
import { itemPower, isLocked } from '../core/items.js';
import { upgradeItem, rerollAffixes, convertMaterial, materialCount } from '../core/crafting.js';
import { getCoins } from '../core/coins.js';
import { $, fmtBig, toast, confirmDialog } from './dom.js';
import { bindTooltip, hideTooltip } from './tooltip.js';

// Aktuell zum Bearbeiten gewähltes Inventar-Item (id) – modulweit.
let selectedId = null;

const baseStatOf = it => (it.base ? it.base.stat : it.stat);
const baseAffixesOf = it => (it.base ? it.base.affixes : (it.affixes || {}));

// Affix-Wert bei gegebener Aufwertungsstufe (Vorschau; identisch zur Mathe in
// crafting.js inkl. Caps – read-only, mutiert nichts).
function affixAtLevel(key, baseV, level){
  const d = AFFIX_DEFS[key]; if(!d) return baseV;
  let v = baseV * (1 + UPGRADE_AFFIX_PCT*level);
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
// Reiner Zahlenwert eines Affixes (ohne Label) für „X → Y"-Zeilen.
function affixValStr(key, v){ const d = AFFIX_DEFS[key]; return d.pct ? '+'+Math.round(v*100)+'%' : '+'+v; }

export function renderForge(){
  const panel = $('#forgePanel');
  if(!panel) return;
  panel.innerHTML = '';

  // Gewähltes Item ggf. zurücksetzen (verkauft/zerlegt/getauscht).
  if(selectedId != null && !state.inventory.some(i => i.id === selectedId)) selectedId = null;

  // ---- Kopf + Materialbestand --------------------------------------
  const head = document.createElement('div');
  head.className = 'shop-head';
  head.innerHTML = '<h2>⚒️ Schmiede</h2><span class="shop-gold">🪙 '+fmtBig(getCoins())+' Coins</span>';
  panel.appendChild(head);

  const note = document.createElement('p');
  note.className = 'shop-note';
  note.innerHTML = 'Zerlege überflüssige Items im <b>Inventar</b> (♻️ Zerlegen) zu Materialien und '+
    'investiere sie hier gezielt: ein Item <b>aufwerten</b> (stärker) oder <b>verzaubern</b> (Affixe neu würfeln).';
  panel.appendChild(note);

  const matBar = document.createElement('div');
  matBar.className = 'forge-mats';
  matBar.innerHTML = MATERIALS.map(m => {
    const next = nextMaterialKey(m.key);
    const have = materialCount(m.key);
    // Konvertieren-Button nur zeigen, wenn die Umwandlung wirklich möglich ist
    // (genug Material). Spart leere/ausgegraute Knöpfe und Platz auf Mobile.
    const convBtn = (next && have >= CONVERT_RATE)
      ? '<button class="btn ghost forge-conv" data-conv="'+m.key+'" title="'+CONVERT_RATE+' '+m.name+' → 1 '+MATERIAL_BY_KEY[next].name+'">'+
          '🔁 '+CONVERT_RATE+' → 1 '+MATERIAL_BY_KEY[next].icon+'</button>'
      : '';
    return '<div class="forge-mat">'+
      '<div class="fm-top">'+
        '<span class="fm-icon">'+m.icon+'</span>'+
        '<span class="fm-name">'+m.name+'</span>'+
        '<span class="fm-have">'+fmtBig(have)+'</span>'+
      '</div>'+convBtn+'</div>';
  }).join('');
  panel.appendChild(matBar);
  matBar.querySelectorAll('.forge-conv').forEach(btn => btn.addEventListener('click', async ()=>{
    const from = btn.dataset.conv; const to = nextMaterialKey(from);
    const ok = await confirmDialog({ title:'Materialien umwandeln?', emoji:'🔁',
      body:CONVERT_RATE+' '+MATERIAL_BY_KEY[from].icon+' '+MATERIAL_BY_KEY[from].name+
        ' → 1 '+MATERIAL_BY_KEY[to].icon+' '+MATERIAL_BY_KEY[to].name+'?',
      confirmText:'Umwandeln', cancelText:'Abbrechen' });
    if(!ok) return;
    const res = convertMaterial(from);
    renderForge();
    if(res.ok) toast('🔁 '+MATERIAL_BY_KEY[to].icon+' +1 '+MATERIAL_BY_KEY[to].name);
  }));

  // ---- Item-Auswahl (Inventar) -------------------------------------
  const pickHead = document.createElement('h3');
  pickHead.className = 'forge-sub';
  pickHead.textContent = '🎒 Item auswählen';
  panel.appendChild(pickHead);

  if(!state.inventory.length){
    const empty = document.createElement('p');
    empty.className = 'inv-hint';
    empty.textContent = 'Dein Inventar ist leer – geh auf Abenteuer, um Ausrüstung zu finden.';
    panel.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'backpack forge-pick';
  const items = [...state.inventory].sort((a,b)=> itemPower(b)-itemPower(a));
  for(const it of items){
    const r = rarityOf(it.rarity);
    const cell = document.createElement('div');
    cell.className = 'bp-slot filled' + (it.id===selectedId ? ' forge-selected' : '');
    cell.dataset.rarity = it.rarity;
    cell.style.setProperty('--rc', r.color);
    cell.innerHTML = '<span class="bp-cat">'+CAT_ICON[it.cat]+'</span>'+
      (isLocked(it.id)?'<span class="bp-lock">🔒</span>':'')+
      ((it.upgradeLevel||0)>0?'<span class="bp-upg">+'+it.upgradeLevel+'</span>':'')+
      (it.proc?'<span class="bp-proc">★</span>':'')+
      '<img src="'+it.sprite+'" alt="'+it.name+'">';
    bindTooltip(cell, it, { compare:true });
    cell.addEventListener('click', ()=>{ hideTooltip(); selectedId = it.id; renderForge(); });
    grid.appendChild(cell);
  }
  panel.appendChild(grid);

  // ---- Aktions-Panel für das gewählte Item -------------------------
  const sel = selectedId != null ? state.inventory.find(i => i.id === selectedId) : null;
  if(!sel){
    const hint = document.createElement('p');
    hint.className = 'inv-hint';
    hint.textContent = 'Wähle ein Item, um es aufzuwerten oder zu verzaubern.';
    panel.appendChild(hint);
    return;
  }
  panel.appendChild(buildActionCard(sel));
}

function buildActionCard(it){
  const r = rarityOf(it.rarity);
  const lvl = it.upgradeLevel || 0;
  const wrap = document.createElement('div');
  wrap.className = 'forge-card';

  const statLabel = it.statType === 'armor' ? 'Rüstung' : 'Schaden';
  const affixHtml = Object.entries(it.affixes||{}).map(([k,v]) => '<div class="forge-affix">'+fmtAffix(k,v)+'</div>').join('') || '<div class="forge-affix muted">keine Affixe</div>';

  let html = '<div class="forge-card-head" style="color:'+r.color+'">'+it.name+(lvl>0?' <b class="forge-lvl">+'+lvl+'</b>':'')+'</div>'+
    '<div class="sub">'+r.name+' · '+SLOTS[it.slotKey].name+' · Gegenstandsstufe '+it.ilvl+'</div>'+
    '<div class="forge-stats">'+
      '<div class="forge-stat"><span>'+statLabel+'</span><b>'+it.stat+'</b></div>'+
      affixHtml+
      '<div class="forge-stat power"><span>Kampfkraft</span><b>'+itemPower(it)+'</b></div>'+
    '</div>';

  // --- Aufwerten ---
  if(canUpgrade(it)){
    const c = upgradeCost(it);
    const m = MATERIAL_BY_KEY[c.matKey];
    const nextStat = Math.max(1, Math.round(baseStatOf(it) * (1 + UPGRADE_STAT_PCT*(lvl+1))));
    const enough = materialCount(c.matKey) >= c.mat && getCoins() >= c.coins;
    // Exakte Vorher → Nachher-Werte: Hauptwert + jeder einzelne Affix.
    const baseAff = baseAffixesOf(it);
    let prevLines = '<div class="fa-line">'+statLabel+': '+it.stat+' → <b>'+nextStat+'</b></div>';
    for(const k of Object.keys(it.affixes||{})){
      const nxt = affixAtLevel(k, baseAff[k], lvl+1);
      const capped = AFFIX_DEFS[k] && AFFIX_DEFS[k].cap && nxt >= AFFIX_DEFS[k].cap && nxt === it.affixes[k];
      prevLines += '<div class="fa-line">'+AFFIX_DEFS[k].label+': '+affixValStr(k, it.affixes[k])+
        ' → <b>'+affixValStr(k, nxt)+'</b>'+(capped?' <span class="fa-cap">(Max)</span>':'')+'</div>';
    }
    html += '<div class="forge-action">'+
      '<div class="fa-title">⚒️ Aufwerten · +'+lvl+' → +'+(lvl+1)+'</div>'+
      '<div class="fa-prev">'+prevLines+'</div>'+
      '<div class="fa-cost">Kosten: '+m.icon+' '+c.mat+' '+m.name+' ('+fmtBig(materialCount(c.matKey))+') · 🪙 '+fmtBig(c.coins)+'</div>'+
      '<button class="btn" id="forgeUpgrade"'+(enough?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Aufwerten</button>'+
    '</div>';
  } else {
    html += '<div class="forge-action"><div class="fa-title">⚒️ Aufwerten</div>'+
      '<div class="fa-info">Maximalstufe (+'+MAX_UPGRADE+') erreicht.</div></div>';
  }

  // --- Verzaubern ---
  if(canReroll(it)){
    const c = rerollCost(it);
    const m = MATERIAL_BY_KEY[c.matKey];
    const enough = materialCount(c.matKey) >= c.mat && getCoins() >= c.coins;
    html += '<div class="forge-action">'+
      '<div class="fa-title">✨ Verzaubern (Affixe neu würfeln)</div>'+
      '<div class="fa-info">Würfelt alle Affixe neu. Die Aufwertungsstufe (+'+lvl+') bleibt erhalten.</div>'+
      '<div class="fa-cost">Kosten: '+m.icon+' '+c.mat+' '+m.name+' ('+fmtBig(materialCount(c.matKey))+') · 🪙 '+fmtBig(c.coins)+'</div>'+
      '<button class="btn ghost" id="forgeReroll"'+(enough?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Verzaubern</button>'+
    '</div>';
  } else {
    html += '<div class="forge-action"><div class="fa-title">✨ Verzaubern</div>'+
      '<div class="fa-info">Erst ab Seltenheit „Selten" möglich (genug Affixe).</div></div>';
  }

  wrap.innerHTML = html;

  const upBtn = wrap.querySelector('#forgeUpgrade');
  if(upBtn) upBtn.addEventListener('click', async ()=>{
    upBtn.disabled = true;
    const res = await upgradeItem(it.id);
    if(res.ok) playUpgradeFx(res.level);
    renderAfterCraft(res, '⚒️ Aufgewertet auf +'+(res.level||''));
  });
  const rrBtn = wrap.querySelector('#forgeReroll');
  if(rrBtn) rrBtn.addEventListener('click', async ()=>{
    const res = await rerollAffixes(it.id);
    renderAfterCraft(res, '✨ Affixe neu gewürfelt!');
  });
  return wrap;
}

// Hochwertige Aufwert-Animation: Vollbild-FX (Blitz, Glüh-Ringe, Funken, „+N").
// An den <body> gehängt → überlebt das Re-Render des Schmiede-Panels.
export function playUpgradeFx(level){
  const fx = document.createElement('div');
  fx.className = 'forge-fx';
  let sparks = '';
  const N = 14;
  for(let i=0;i<N;i++){
    const a = Math.round(i * (360/N) + Math.random()*12);
    const d = 130 + Math.round(Math.random()*90);
    sparks += '<span class="ffx-spark" style="--a:'+a+'deg;--d:'+d+'px"></span>';
  }
  fx.innerHTML = '<div class="ffx-flash"></div>'+
    '<div class="ffx-ring"></div><div class="ffx-ring r2"></div>'+
    sparks+
    '<div class="ffx-text">+'+level+'</div>';
  document.body.appendChild(fx);
  setTimeout(()=> fx.remove(), 1300);
}

// Nach einer Crafting-Aktion: alles neu zeichnen (Werte/Kampfkraft/Charakter)
// und Rückmeldung geben. Import von renderAll lazy, um Zyklen zu vermeiden.
function renderAfterCraft(res, okMsg){
  import('./render.js').then(({ renderAll }) => renderAll());
  if(res && res.ok){ toast(okMsg); return; }
  const reason = res && res.reason;
  if(reason === 'mat')   toast('Nicht genug Material.');
  else if(reason === 'coins') toast('🪙 Nicht genug Coins.');
  else if(reason === 'max')   toast('Maximalstufe erreicht.');
  else toast('Aktion nicht möglich.');
}
