/* =====================================================================
   FÄRBEREI-TAB: Farbstoff-Bestand + Rüstungsteile einfärben.
   Nur Rüstung ist färbbar (kopf…umhang). Färben verbraucht 1 Farbstoff der
   gewählten Farbe, Entfernen ist kostenlos. Eng an forge.js angelehnt
   (Item-Auswahl, Aktionskarte, Lazy-Rerender).
   ===================================================================== */
import { DYES, DYE_BY_KEY, isDyeable } from '../data/dyes.js';
import { rarityOf } from '../data/rarities.js';
import { SLOTS, CAT_ICON } from '../data/slots.js';
import { upgradeBadge } from '../data/materials.js';
import { state } from '../core/state.js';
import { itemPower, isLocked } from '../core/items.js';
import { dyeItem, undyeItem, dyeCount } from '../core/dyeing.js';
import { $, fmtBig, toast } from './dom.js';
import { bindTooltip, hideTooltip } from './tooltip.js';

// Aktuell zum Färben gewähltes Item (id) – modulweit.
let selectedId = null;

// Auswählbares, FÄRBBARES Item finden – Inventar ODER ausgerüstet.
function findDyeable(id){
  if(id == null) return null;
  const it = state.inventory.find(i => i.id === id)
    || Object.values(state.equipped || {}).find(e => e && e.id === id)
    || null;
  return (it && isDyeable(it)) ? it : null;
}

// Eine Auswahl-Kategorie (Überschrift + Item-Grid) anhängen (vgl. forge.js).
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
      ((it.upgradeLevel||0)>0?'<span class="bp-upg">'+upgradeBadge(it)+'</span>':'')+
      (it.dye?'<span class="bp-dye" style="background:'+DYE_BY_KEY[it.dye].color+'"></span>':'')+
      '<img src="'+it.sprite+'" alt="'+it.name+'">';
    bindTooltip(cell, it);
    cell.addEventListener('click', ()=>{ hideTooltip(); selectedId = it.id; renderDyes(); });
    grid.appendChild(cell);
  }
  panel.appendChild(grid);
}

export function renderDyes(){
  const panel = $('#dyesPanel');
  if(!panel) return;
  panel.classList.add('dye-room');
  panel.innerHTML = '';

  // Gewähltes Item ggf. zurücksetzen (verkauft/zerlegt/getauscht/abgelegt).
  if(selectedId != null && !findDyeable(selectedId)) selectedId = null;

  // ---- Banner ------------------------------------------------------
  const banner = document.createElement('div');
  banner.className = 'dye-banner';
  banner.innerHTML =
    '<div class="db-row">'+
      '<span class="db-icon">🎨</span>'+
      '<div class="db-titles"><h2 class="db-title">Die Färberei</h2>'+
        '<div class="db-sub">Farbe · Stil · Charakter</div></div>'+
    '</div>';
  panel.appendChild(banner);

  const note = document.createElement('p');
  note.className = 'forge-note';
  note.innerHTML = '🎨 Bosse und Abenteuer droppen <b>Farbstoffe</b>. Färbe damit deine '+
    '<b>Rüstungsteile</b> ein – jede Färbung verbraucht einen Farbstoff, Entfernen ist gratis.';
  panel.appendChild(note);

  // ---- Farbstoff-Bestand -------------------------------------------
  const bar = document.createElement('div');
  bar.className = 'dye-stock';
  bar.innerHTML = DYES.map(d => {
    const have = dyeCount(d.key);
    return '<div class="dye-stock-item'+(have>0?'':' empty')+'" title="'+d.name+'">'+
      '<span class="dye-swatch lg" style="background:'+d.color+'"></span>'+
      '<span class="ds-name">'+d.name+'</span>'+
      '<span class="ds-have">'+fmtBig(have)+'</span>'+
    '</div>';
  }).join('');
  panel.appendChild(bar);

  // ---- Item-Auswahl: nur färbbare Rüstung --------------------------
  const invItems = state.inventory.filter(isDyeable).sort((a,b)=> itemPower(b)-itemPower(a));
  const eqItems = Object.values(state.equipped||{}).filter(it => it && isDyeable(it)).sort((a,b)=> itemPower(b)-itemPower(a));

  if(!invItems.length && !eqItems.length){
    const empty = document.createElement('p');
    empty.className = 'inv-hint';
    empty.textContent = 'Keine färbbaren Rüstungsteile – finde oder rüste Rüstung aus.';
    panel.appendChild(empty);
    return;
  }

  appendPickSection(panel, '🎒 Im Inventar', invItems, 'Keine Rüstung im Inventar.');
  appendPickSection(panel, '🎽 Ausgerüstet', eqItems, 'Keine Rüstung ausgerüstet.', true);

  // ---- Aktionskarte für das gewählte Item --------------------------
  const sel = findDyeable(selectedId);
  if(!sel){
    const hint = document.createElement('p');
    hint.className = 'inv-hint';
    hint.textContent = 'Wähle ein Rüstungsteil, um es einzufärben.';
    panel.appendChild(hint);
    return;
  }
  panel.appendChild(buildDyeCard(sel));
}

function buildDyeCard(it){
  const r = rarityOf(it.rarity);
  const wrap = document.createElement('div');
  wrap.className = 'forge-card dye-card';

  const curName = it.dye && DYE_BY_KEY[it.dye] ? DYE_BY_KEY[it.dye].name : 'Originalfarbe';
  let html = '<div class="dye-card-top">'+
      '<img class="dye-preview" src="'+it.sprite+'" alt="'+it.name+'">'+
      '<div>'+
        '<div class="forge-card-head" style="color:'+r.color+'">'+it.name+'</div>'+
        '<div class="sub">'+r.name+' · '+SLOTS[it.slotKey].name+'</div>'+
        '<div class="dye-current">🎨 Aktuell: <b>'+curName+'</b></div>'+
      '</div>'+
    '</div>';

  // Palette: nur BESESSENE Farbstoffe (mit Bestand > 0).
  const owned = DYES.filter(d => dyeCount(d.key) > 0);
  if(owned.length){
    html += '<div class="dye-pick-title">Farbe wählen</div>'+
      '<div class="dye-palette">'+
      owned.map(d => '<button class="dye-chip'+(it.dye===d.key?' active':'')+'" '+
        'data-dye="'+d.key+'" title="'+d.name+' ('+fmtBig(dyeCount(d.key))+')">'+
        '<span class="dye-swatch lg" style="background:'+d.color+'"></span>'+
        '<span class="dc-have">'+fmtBig(dyeCount(d.key))+'</span>'+
      '</button>').join('')+
      '</div>';
  } else {
    html += '<p class="inv-hint">Noch keine Farbstoffe – besiege Bosse oder schließe Abenteuer ab.</p>';
  }

  if(it.dye){
    html += '<div class="dye-actions"><button class="btn ghost" id="dyeRemove">Färbung entfernen (gratis)</button></div>';
  }

  wrap.innerHTML = html;

  wrap.querySelectorAll('.dye-chip').forEach(btn => btn.addEventListener('click', ()=>{
    const key = btn.dataset.dye;
    const res = dyeItem(it.id, key);
    if(res.ok){
      import('./render.js').then(({ renderAll }) => renderAll());
      renderDyes();
      toast('🎨 Gefärbt: '+DYE_BY_KEY[key].name);
    } else if(res.reason==='same') toast('Schon in dieser Farbe gefärbt.');
    else if(res.reason==='mat') toast('Nicht genug Farbstoff.');
    else toast('Färben nicht möglich.');
  }));
  const rm = wrap.querySelector('#dyeRemove');
  if(rm) rm.addEventListener('click', ()=>{
    const res = undyeItem(it.id);
    if(res.ok){
      import('./render.js').then(({ renderAll }) => renderAll());
      renderDyes();
      toast('🧽 Färbung entfernt.');
    }
  });
  return wrap;
}
