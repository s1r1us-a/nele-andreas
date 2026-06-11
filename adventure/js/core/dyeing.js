/* =====================================================================
   FÄRBEN (Färberei). Ein Rüstungsteil mit einem Farbstoff einfärben oder die
   Färbung wieder entfernen. Färben verbraucht 1 Farbstoff der gewählten Farbe;
   Entfernen ist kostenlos. Das Sprite des Items wird sofort neu gebaut, damit
   Inventar-Icon UND (bei getragenen Teilen) der Avatar sich sofort umfärben.
   ===================================================================== */
import { typeOf } from '../data/itemTypes.js';
import { SLOTS } from '../data/slots.js';
import { DYE_BY_KEY, isDyeable, dyeColorOf } from '../data/dyes.js';
import { state, saveState } from './state.js';
import { buildItemSVG, elementOf } from './item-art.js';

// Aktueller Farbstoff-Bestand einer Farbe.
export function dyeCount(key){ return (state.dyes && state.dyes[key]) || 0; }

// Item finden – Inventar ODER ausgerüstet (analog findSelectable in forge.js).
function findItem(itemId){
  if(itemId == null) return null;
  return state.inventory.find(i => i.id === itemId)
    || Object.values(state.equipped || {}).find(e => e && e.id === itemId)
    || null;
}

// Sprite eines Items mit aktueller Färbung neu bauen.
function rebuildSprite(it){
  const t = typeOf(it);
  const art = t.art || (SLOTS[it.slotKey] && SLOTS[it.slotKey].art) || it.slotKey;
  it.sprite = buildItemSVG(art, it.variant, it.rarity, t.element || elementOf(it.id), t.orb, t.material, dyeColorOf(it), null, t.special);
}

// Vorschau-Sprite (OHNE Zustandsänderung): liefert das Item-Sprite so, wie es in
// einer Wunschfarbe aussähe – für die Live-Vorschau in der Färberei. dyeKey=null
// → Originalfarbe. Nutzt exakt dieselbe Art-Logik wie rebuildSprite.
export function previewItemSprite(it, dyeKey){
  const t = typeOf(it);
  const art = t.art || (SLOTS[it.slotKey] && SLOTS[it.slotKey].art) || it.slotKey;
  const color = (dyeKey && DYE_BY_KEY[dyeKey]) ? DYE_BY_KEY[dyeKey].color : null;
  return buildItemSVG(art, it.variant, it.rarity, t.element || elementOf(it.id), t.orb, t.material, color, null, t.special);
}

// Item einfärben. Liefert { ok, reason }.
export function dyeItem(itemId, dyeKey){
  const it = findItem(itemId);
  if(!it || !isDyeable(it)) return { ok:false, reason:'item' };
  if(!DYE_BY_KEY[dyeKey])   return { ok:false, reason:'dye' };
  if(it.dye === dyeKey)     return { ok:false, reason:'same' };
  if(dyeCount(dyeKey) < 1)  return { ok:false, reason:'mat' };
  state.dyes[dyeKey] = dyeCount(dyeKey) - 1;
  it.dye = dyeKey;
  rebuildSprite(it);
  saveState();
  return { ok:true };
}

// Färbung entfernen (kostenlos) → zurück zur Material-Standardfarbe.
export function undyeItem(itemId){
  const it = findItem(itemId);
  if(!it || !it.dye) return { ok:false, reason:'nodye' };
  it.dye = null;
  rebuildSprite(it);
  saveState();
  return { ok:true };
}
