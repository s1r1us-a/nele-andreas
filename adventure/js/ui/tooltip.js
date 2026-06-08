/* =====================================================================
   TOOLTIP – Item-Infos + Vergleich gegen angelegtes Teil (#21, #25).
   ===================================================================== */
import { AFFIX_DEFS, AFFIX_KEYS, fmtAffix } from '../data/affixes.js';
import { SLOTS } from '../data/slots.js';
import { typeOf } from '../data/itemTypes.js';
import { rarityOf } from '../data/rarities.js';
import { classOf } from '../data/classes.js';
import { upgradeBadge } from '../data/materials.js';
import { state } from '../core/state.js';
import { itemPower, isLocked, procText, resolveTargetSlot, canEquip, equipBlockReason, itemKindLabel, itemKindIcon } from '../core/items.js';
import { $ } from './dom.js';

let tt = null;
const el = () => (tt = tt || $('#tooltip'));
export function hideTooltip(){ const t = el(); if(t) t.style.display = 'none'; }

export function affixLinesHTML(it){
  const a = it.affixes || {};
  let html = '';
  for(const k of AFFIX_KEYS){
    if(a[k] == null) continue;
    html += '<div class="tt-stat affix">'+fmtAffix(k, a[k])+'</div>';
  }
  if(it.proc) html += '<div class="tt-proc" style="color:'+it.proc.color+'">'+procText(it.proc)+'</div>';
  return html;
}

function compareHTML(it){
  // Vergleich gegen das im Zielslot angelegte Teil
  const target = resolveTargetSlot(it);
  const cur = state.equipped[target];
  if(!cur || cur.id === it.id) return '';
  const d = itemPower(it) - itemPower(cur);
  if(d === 0) return '<div class="tt-cmp tt-cmp-zero">±0 Kampfkraft (angelegt)</div>';
  const cls = d>0 ? 'tt-cmp-pos' : 'tt-cmp-neg';
  return '<div class="tt-cmp '+cls+'">'+(d>0?'▲ +':'▼ −')+Math.abs(d)+' Kampfkraft ggü. angelegt</div>';
}

export function tooltipHTML(it, opts={}){
  const r = rarityOf(it.rarity);
  const slot = SLOTS[it.slotKey];
  const sCls = it.statType==='armor' ? 'armor' : 'damage';
  const sLbl = it.statType==='armor' ? 'Rüstung' : 'Schaden';
  let qLine = '';
  if(typeof it.quality === 'number'){
    const mark = it.quality >= 110 ? ' ⭐' : (it.quality <= 90 ? ' ▽' : '');
    const col = it.quality >= 110 ? '#37d67a' : (it.quality <= 90 ? '#c0653a' : 'var(--txt-mute)');
    qLine = '<div class="tt-ilvl" style="color:'+col+'">Qualität '+it.quality+'%'+mark+'</div>';
  }
  const lock = isLocked(it.id) ? ' 🔒' : '';
  const upg = (it.upgradeLevel||0) > 0 ? ' <span style="color:#ffd24a">'+upgradeBadge(it)+'</span>' : '';
  // Archetyp-Fokus aus dem Item-Typ (z.B. „Fokus: Krit-Chance").
  const ty = typeOf(it);
  const focus = (ty && ty.flavorAffix && AFFIX_DEFS[ty.flavorAffix])
    ? '<div class="tt-focus">🎯 Fokus: '+AFFIX_DEFS[ty.flavorAffix].label+'</div>' : '';
  // Typ-/Material-Zeile für JEDES Item: Waffe → „Schwert · Physische Waffe"
  // bzw. „Kristallstab · Zauberstab", Rüstung → Stoff/Leder/Platte,
  // Schild → Typname, Schmuck → „Schmuck (für alle tragbar)".
  let matLine = '<div class="tt-mat">'+itemKindIcon(it)+' '+itemKindLabel(it)+'</div>';
  // Klassen-Sperre (auch für Schilde/Waffen) anzeigen.
  if(!canEquip(it)){
    matLine += '<div class="tt-locked">✋ '+equipBlockReason(it)+'</div>';
  }
  return '<div class="tt-name" style="color:'+r.color+'">'+it.name+upg+lock+'</div>'+
    '<div class="tt-slot">'+r.name+' · '+slot.name+'</div>'+
    focus+
    matLine+
    '<div class="tt-stat '+sCls+'">+'+it.stat+' '+sLbl+'</div>'+
    affixLinesHTML(it)+
    qLine+
    '<div class="tt-ilvl">Gegenstandsstufe '+it.ilvl+'</div>'+
    (opts.compare ? compareHTML(it) : '');
}

export function bindTooltip(node, it, opts={}){
  node.addEventListener('mousemove', e => {
    const t = el();
    t.innerHTML = tooltipHTML(it, opts);
    t.style.display = 'block';
    const x = Math.min(e.clientX+14, window.innerWidth-250);
    const y = Math.min(e.clientY+14, window.innerHeight-160);
    t.style.left = x+'px'; t.style.top = y+'px';
  });
  node.addEventListener('mouseleave', hideTooltip);
}
window.addEventListener('scroll', hideTooltip, true);

// Fund-Pop bei Drop
export function popFind(item){
  const r = rarityOf(item.rarity);
  const node = document.createElement('div');
  node.className = 'find-pop';
  node.innerHTML = '<img src="'+item.sprite+'" alt="">'+
    '<div class="fp-name" style="color:'+r.color+'">'+item.name+'</div>';
  document.body.appendChild(node);
  requestAnimationFrame(()=> node.classList.add('go'));
  setTimeout(()=> node.remove(), 1900);
}
