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
import { dyeItem, undyeItem, dyeCount, previewItemSprite } from '../core/dyeing.js';
import { recomputeTotals, heroTier } from '../core/character.js';
import { buildHeroSVG } from '../core/avatar.js';
import { $, fmtBig, toast, confirmDialog } from './dom.js';
import { bindTooltip, hideTooltip } from './tooltip.js';

// Aktuell zum Färben gewähltes Item (id) – modulweit.
let selectedId = null;
// Vorschau-Farbe (Farbstoff-Key): nur für die Live-Vorschau gewählt, NOCH NICHT
// angewendet → verbraucht keinen Farbstoff. Erst die Bestätigung färbt wirklich.
let previewDye = null;

// Kompletten Helden so rendern, als trüge er `it` in der Wunschfarbe `dyeKey`.
// Das gewählte Teil wird (auch aus dem Inventar) in seinen Slot gelegt, damit man
// den vollständigen Charakter-Look sieht. dyeKey=null → Originalfarbe des Teils.
function heroPreviewSrc(it, dyeKey, tier){
  const eq = Object.assign({}, state.equipped || {});
  eq[it.slotKey] = Object.assign({}, it, { dye: dyeKey || null });
  // Helm in der Vorschau immer zeigen – auch wenn er sonst ausgeblendet ist –,
  // damit ein gefärbter Kopf-Slot sichtbar bleibt.
  return buildHeroSVG(state.character, tier, { equipped: eq, hideHelmet:false });
}

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
    cell.addEventListener('click', ()=>{ hideTooltip(); selectedId = it.id; previewDye = null; renderDyes(); });
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
  if(selectedId != null && !findDyeable(selectedId)){ selectedId = null; previewDye = null; }

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

  // Vorschau-Farbe validieren: kein Bestand mehr oder = aktuelle Farbe → verwerfen.
  if(previewDye && (previewDye === it.dye || dyeCount(previewDye) < 1)) previewDye = null;

  const tier = heroTier(recomputeTotals().power);
  const curName = it.dye && DYE_BY_KEY[it.dye] ? DYE_BY_KEY[it.dye].name : 'Originalfarbe';
  const pd = previewDye ? DYE_BY_KEY[previewDye] : null;

  // Großes Item-Sprite im jeweils gewählten Zustand (Vorschau-Farbe oder aktuell).
  const topSprite = pd ? previewItemSprite(it, previewDye) : it.sprite;
  let html = '<div class="dye-card-top">'+
      '<img class="dye-preview" src="'+topSprite+'" alt="'+it.name+'">'+
      '<div>'+
        '<div class="forge-card-head" style="color:'+r.color+'">'+it.name+'</div>'+
        '<div class="sub">'+r.name+' · '+SLOTS[it.slotKey].name+'</div>'+
        '<div class="dye-current">🎨 Aktuell: <b>'+curName+'</b>'+
          (pd ? ' → <b style="color:'+pd.color+'">'+pd.name+'</b>' : '')+'</div>'+
      '</div>'+
    '</div>';

  // ---- Komplette Charakter-Vorschau (Vorher/Nachher) ----------------
  // Der Held wird mit dem Teil in seinem Slot gerendert – so sieht man den
  // vollständigen Look. Ohne gewählte Vorschau-Farbe nur der Ist-Zustand.
  const beforeSrc = heroPreviewSrc(it, it.dye, tier);
  html += '<div class="dye-pick-title">Vorschau am Charakter</div>'+
    '<div class="dye-compare">'+
      '<figure class="dye-fig"><img class="dye-char" src="'+beforeSrc+'" alt="Vorher">'+
        '<figcaption>Vorher</figcaption></figure>'+
      (pd
        ? '<span class="dye-arrow">→</span>'+
          '<figure class="dye-fig after"><img class="dye-char" src="'+heroPreviewSrc(it, previewDye, tier)+'" alt="Nachher">'+
            '<figcaption style="color:'+pd.color+'">Vorschau</figcaption></figure>'
        : '<span class="dye-compare-hint">Wähle unten eine Farbe – die Vorschau zeigt deinen Helden danach.</span>')+
    '</div>';

  // ---- Palette: nur BESESSENE Farbstoffe (Bestand > 0) --------------
  const owned = DYES.filter(d => dyeCount(d.key) > 0);
  if(owned.length){
    html += '<div class="dye-pick-title">Farbe wählen</div>'+
      '<div class="dye-palette">'+
      owned.map(d => '<button class="dye-chip'+(previewDye===d.key?' preview':'')+(it.dye===d.key?' active':'')+'" '+
        'data-dye="'+d.key+'" title="'+d.name+' ('+fmtBig(dyeCount(d.key))+')">'+
        '<span class="dye-swatch lg" style="background:'+d.color+'"></span>'+
        '<span class="dc-have">'+fmtBig(dyeCount(d.key))+'</span>'+
      '</button>').join('')+
      '</div>';
  } else {
    html += '<p class="inv-hint">Noch keine Farbstoffe – besiege Bosse oder schließe Abenteuer ab.</p>';
  }

  // ---- Aktionen: Einfärben (mit Bestätigung) + Entfernen (gratis) ---
  html += '<div class="dye-actions">';
  if(owned.length){
    html += '<button class="btn" id="dyeApply"'+(pd?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>'+
      '🎨 '+(pd ? 'Mit '+pd.name+' einfärben' : 'Farbe wählen')+'</button>';
  }
  if(it.dye){
    html += '<button class="btn ghost" id="dyeRemove">Färbung entfernen (gratis)</button>';
  }
  html += '</div>';

  wrap.innerHTML = html;

  // Farb-Chip: NUR Vorschau setzen (kein Verbrauch) und Karte neu zeichnen.
  wrap.querySelectorAll('.dye-chip').forEach(btn => btn.addEventListener('click', ()=>{
    const key = btn.dataset.dye;
    previewDye = (key === it.dye) ? null : key;   // bereits aktive Farbe → keine Vorschau
    renderDyes();
  }));

  // Einfärben: Bestätigungsmodal mit Vorher/Nachher-Avatar, dann erst anwenden.
  const apply = wrap.querySelector('#dyeApply');
  if(apply && previewDye) apply.addEventListener('click', ()=> confirmAndDye(it, previewDye));

  const rm = wrap.querySelector('#dyeRemove');
  if(rm) rm.addEventListener('click', ()=>{
    const res = undyeItem(it.id);
    if(res.ok){
      previewDye = null;
      import('./render.js').then(({ renderAll }) => renderAll());
      renderDyes();
      toast('🧽 Färbung entfernt.');
    }
  });
  return wrap;
}

// Bestätigungsmodal vor dem Verbrauch eines Farbstoffs: zeigt den kompletten
// Charakter vorher/nachher, Farbe, Kosten und den Rest-Bestand. Erst „Einfärben"
// verbraucht den Farbstoff.
async function confirmAndDye(it, key){
  const d = DYE_BY_KEY[key];
  if(!d || dyeCount(key) < 1){ toast('Nicht genug Farbstoff.'); return; }
  const tier = heroTier(recomputeTotals().power);
  const before = heroPreviewSrc(it, it.dye, tier);
  const after  = heroPreviewSrc(it, key, tier);
  const remain = Math.max(0, dyeCount(key) - 1);
  const body =
    '<div class="dye-confirm">'+
      '<div class="dye-confirm-avatars">'+
        '<figure class="dye-fig"><img src="'+before+'" alt="Vorher"><figcaption>Vorher</figcaption></figure>'+
        '<span class="dye-arrow">→</span>'+
        '<figure class="dye-fig after"><img src="'+after+'" alt="Nachher"><figcaption style="color:'+d.color+'">Nachher</figcaption></figure>'+
      '</div>'+
      '<div class="dye-confirm-info">'+
        '<span class="dye-swatch lg" style="background:'+d.color+'"></span> '+
        '<b>'+d.name+'</b> auf <b>'+it.name+'</b>'+
      '</div>'+
      '<div class="dye-confirm-cost">Kosten: <b>1× '+d.name+'</b> · Rest danach: <b>'+fmtBig(remain)+'</b></div>'+
    '</div>';
  const ok = await confirmDialog({ title:'Einfärben?', emoji:'🎨', body,
    confirmText:'🎨 Einfärben', cancelText:'Abbrechen' });
  if(!ok) return;
  const res = dyeItem(it.id, key);
  if(res.ok){
    previewDye = null;
    import('./render.js').then(({ renderAll }) => renderAll());
    renderDyes();
    toast('🎨 Gefärbt: '+d.name);
  } else if(res.reason==='same') toast('Schon in dieser Farbe gefärbt.');
  else if(res.reason==='mat') toast('Nicht genug Farbstoff.');
  else toast('Färben nicht möglich.');
}
