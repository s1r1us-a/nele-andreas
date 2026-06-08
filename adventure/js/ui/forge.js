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
import { upgradeItem, rerollAffixes, convertMaterial, materialCount, maxConvertBatches } from '../core/crafting.js';
import { getCoins } from '../core/coins.js';
import { $, fmtBig, toast } from './dom.js';
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

// Auswählbares Item finden – Inventar ODER ausgerüstet (für Aufwerten/Verzaubern).
function findSelectable(id){
  if(id == null) return null;
  return state.inventory.find(i => i.id === id)
    || Object.values(state.equipped||{}).find(e => e && e.id === id)
    || null;
}

// Eine Auswahl-Kategorie (Überschrift + Item-Grid) anhängen. `worn` markiert
// ausgerüstete Teile (kleines 🎽-Badge statt Kategorie-Icon).
function appendPickSection(panel, title, items, emptyText, worn){
  const head = document.createElement('h3');
  head.className = 'forge-sub';
  head.textContent = title;
  panel.appendChild(head);
  if(!items.length){
    const hint = document.createElement('p');
    hint.className = 'inv-hint'; hint.textContent = emptyText;
    panel.appendChild(hint);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'backpack forge-pick';
  for(const it of items){
    const r = rarityOf(it.rarity);
    const cell = document.createElement('div');
    cell.className = 'bp-slot filled' + (it.id===selectedId ? ' forge-selected' : '');
    cell.dataset.rarity = it.rarity;
    cell.style.setProperty('--rc', r.color);
    cell.innerHTML = '<span class="bp-cat">'+(worn ? '🎽' : CAT_ICON[it.cat])+'</span>'+
      (isLocked(it.id)?'<span class="bp-lock">🔒</span>':'')+
      ((it.upgradeLevel||0)>0?'<span class="bp-upg">+'+it.upgradeLevel+'</span>':'')+
      (it.proc?'<span class="bp-proc">★</span>':'')+
      '<img src="'+it.sprite+'" alt="'+it.name+'">';
    bindTooltip(cell, it, { compare:true });
    cell.addEventListener('click', ()=>{ hideTooltip(); selectedId = it.id; renderForge(); });
    grid.appendChild(cell);
  }
  panel.appendChild(grid);
}

export function renderForge(){
  const panel = $('#forgePanel');
  if(!panel) return;
  panel.classList.add('forge-room');   // eigene Schmiede-Optik (Eisen/Glut)
  panel.innerHTML = '';

  // Gewähltes Item ggf. zurücksetzen (verkauft/zerlegt/getauscht/abgelegt).
  if(selectedId != null && !findSelectable(selectedId)) selectedId = null;

  // ---- Schmiede-Banner (Amboss + Esse + glimmende Funken) ----------
  const banner = document.createElement('div');
  banner.className = 'forge-banner';
  banner.innerHTML =
    '<div class="fb-embers" aria-hidden="true">'+
      '<span></span><span></span><span></span><span></span><span></span><span></span>'+
    '</div>'+
    '<div class="fb-fire" aria-hidden="true"></div>'+
    '<div class="fb-row">'+
      '<span class="fb-anvil">⚒️</span>'+
      '<div class="fb-titles"><h2 class="fb-title">Die Schmiede</h2>'+
        '<div class="fb-sub">Glut · Stahl · Macht</div></div>'+
      '<span class="fb-gold">🪙 '+fmtBig(getCoins())+'</span>'+
    '</div>';
  panel.appendChild(banner);

  const note = document.createElement('p');
  note.className = 'forge-note';
  note.innerHTML = '🔥 Zerlege Überflüssiges im <b>Inventar</b> (♻️) zu Materialien und schmiede daraus Macht: '+
    'ein Item <b>aufwerten</b> oder <b>verzaubern</b>.';
  panel.appendChild(note);

  const matBar = document.createElement('div');
  matBar.className = 'forge-mats';
  matBar.innerHTML = MATERIALS.map(m => {
    const next = nextMaterialKey(m.key);
    const have = materialCount(m.key);
    const batches = next ? maxConvertBatches(m.key) : 0;
    // Konvertieren-Button nur zeigen, wenn die Umwandlung wirklich möglich ist
    // (genug Material). Öffnet ein Modal mit Slider zum Wählen der Menge.
    const convBtn = (batches >= 1)
      ? '<button class="btn ghost forge-conv" data-conv="'+m.key+'" title="'+CONVERT_RATE+' '+m.name+' → 1 '+MATERIAL_BY_KEY[next].name+'">'+
          '🔁 Umwandeln ('+CONVERT_RATE+' → 1 '+MATERIAL_BY_KEY[next].icon+')</button>'
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
    // Modal mit Slider: Menge (Chargen) wählen, statt vielfach zu klicken.
    const times = await convertSliderDialog(from, to);
    if(!times) return;
    const res = convertMaterial(from, times);
    renderForge();
    if(res.ok) toast('🔁 '+MATERIAL_BY_KEY[to].icon+' +'+res.batches+' '+MATERIAL_BY_KEY[to].name);
  }));

  // ---- Item-Auswahl: zwei Kategorien (Inventar + Ausgerüstet) -------
  const invItems = [...state.inventory].sort((a,b)=> itemPower(b)-itemPower(a));
  const eqItems = Object.values(state.equipped||{}).filter(Boolean).sort((a,b)=> itemPower(b)-itemPower(a));

  if(!invItems.length && !eqItems.length){
    const empty = document.createElement('p');
    empty.className = 'inv-hint';
    empty.textContent = 'Keine Items – geh auf Abenteuer, um Ausrüstung zu finden.';
    panel.appendChild(empty);
    return;
  }

  appendPickSection(panel, '🎒 Im Inventar', invItems, 'Keine Items im Inventar.');
  appendPickSection(panel, '🎽 Ausgerüstet', eqItems, 'Nichts ausgerüstet.', true);

  // ---- Aktions-Panel für das gewählte Item -------------------------
  const sel = findSelectable(selectedId);
  if(!sel){
    const hint = document.createElement('p');
    hint.className = 'inv-hint';
    hint.textContent = 'Wähle ein Item, um es aufzuwerten oder zu verzaubern.';
    panel.appendChild(hint);
    return;
  }
  panel.appendChild(buildActionCard(sel));
}

// Modal mit Slider: wählt die Anzahl umzuwandelnder Chargen (à CONVERT_RATE).
// Liefert die gewählte Charge-Anzahl (≥1) oder 0 bei Abbruch. Renutzt die
// cdlg-Optik der Bestätigungsdialoge, ergänzt um einen Mengen-Slider.
function convertSliderDialog(fromKey, toKey){
  const max = maxConvertBatches(fromKey);
  const fm = MATERIAL_BY_KEY[fromKey], tm = MATERIAL_BY_KEY[toKey];
  return new Promise(resolve => {
    let val = max;   // Standard: alles umwandeln
    const ov = document.createElement('div');
    ov.className = 'cdlg-overlay';
    ov.innerHTML =
      '<div class="cdlg-card" role="dialog" aria-modal="true">'+
        '<div class="cdlg-emoji">🔁</div>'+
        '<div class="cdlg-title">Materialien umwandeln</div>'+
        '<div class="conv-slider">'+
          '<div class="conv-preview">'+
            '<span class="conv-from"><span class="cs-amt" data-from>'+(CONVERT_RATE*val)+'</span> '+fm.icon+' '+fm.name+'</span>'+
            '<span class="conv-arrow">→</span>'+
            '<span class="conv-to"><span class="cs-amt" data-to>'+val+'</span> '+tm.icon+' '+tm.name+'</span>'+
          '</div>'+
          '<input type="range" class="conv-range" min="1" max="'+max+'" value="'+val+'" step="1"'+(max<2?' disabled':'')+'>'+
          '<div class="conv-row">'+
            '<button class="btn ghost conv-min" type="button">Min</button>'+
            '<span class="conv-count"><b data-cnt>'+val+'</b> / '+max+' Chargen</span>'+
            '<button class="btn ghost conv-max" type="button">Max</button>'+
          '</div>'+
        '</div>'+
        '<div class="cdlg-actions">'+
          '<button class="btn ghost" data-act="cancel">Abbrechen</button>'+
          '<button class="btn" data-act="ok">Umwandeln</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(()=> ov.classList.add('show'));

    const range = ov.querySelector('.conv-range');
    const fromEl = ov.querySelector('[data-from]');
    const toEl = ov.querySelector('[data-to]');
    const cntEl = ov.querySelector('[data-cnt]');
    const sync = () => {
      val = Math.min(max, Math.max(1, parseInt(range.value, 10) || 1));
      fromEl.textContent = CONVERT_RATE * val;
      toEl.textContent = val;
      cntEl.textContent = val;
    };
    range.addEventListener('input', sync);
    ov.querySelector('.conv-min').addEventListener('click', ()=>{ range.value = 1; sync(); });
    ov.querySelector('.conv-max').addEventListener('click', ()=>{ range.value = max; sync(); });

    const done = result => {
      document.removeEventListener('keydown', onKey);
      ov.classList.remove('show');
      setTimeout(()=> ov.remove(), 200);
      resolve(result);
    };
    const onKey = e => {
      if(e.key === 'Escape') done(0);
      else if(e.key === 'Enter') done(val);
    };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if(e.target === ov) done(0); });
    ov.querySelector('[data-act="cancel"]').addEventListener('click', ()=> done(0));
    ov.querySelector('[data-act="ok"]').addEventListener('click', ()=> done(val));
  });
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
  // Mehr Funken + zufällige Streuung für einen wuchtigen Esse-Schlag.
  let sparks = '';
  const N = 22;
  for(let i=0;i<N;i++){
    const a = Math.round(i * (360/N) + Math.random()*14);
    const d = 150 + Math.round(Math.random()*140);
    const delay = (Math.random()*0.12).toFixed(2);
    sparks += '<span class="ffx-spark" style="--a:'+a+'deg;--d:'+d+'px;animation-delay:'+delay+'s"></span>';
  }
  fx.innerHTML =
    '<div class="ffx-flash"></div>'+
    '<div class="ffx-shock"></div>'+               // Schockwelle
    '<div class="ffx-ring"></div><div class="ffx-ring r2"></div>'+
    '<div class="ffx-anvil">⚒️</div>'+             // zuschlagender Amboss/Hammer
    sparks+
    '<div class="ffx-text">+'+level+'</div>';
  document.body.appendChild(fx);
  // Kurzes Bildschirm-Wackeln (Hammerschlag).
  document.body.classList.add('forge-shake');
  setTimeout(()=> document.body.classList.remove('forge-shake'), 420);
  setTimeout(()=> fx.remove(), 1400);
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
