/* =====================================================================
   SET-LOGIK (additiv & isoliert). Verändert KEINE bestehende Logik –
   wird nur über den 1-Zeilen-Hook in character.js (recomputeTotals) und
   die Set-Händler-UI (ui/setshop.js) betreten.

   Enthält:
   - applySetBonuses(state, b): addiert die aktiven Set-Boni ins Totals-Bündel
     (flache + prozentuale Boni), respektiert die vorhandenen Stat-Caps.
   - Tribut-Siegel-Währung (getSetTokens/awardSetTokens/spendSetTokens).
   - createSetPiece(): erzeugt ein Legendär-Set-Teil (feste Affixe via
     fixedSetAffixes + buildItemSVG) → unbegrenzt in der Schmiede aufwertbar.
   - buySetPiece(): Kauf beim Set-Händler gegen Tribut-Siegel.
   ===================================================================== */
import { BASE_STAT, ILVL_K } from '../data/tuning.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { rarityOf } from '../data/rarities.js';
import { SLOTS } from '../data/slots.js';
import { classOf } from '../data/classes.js';
import { SETS, SET_SLOTS, SET_TOKEN_CAP, setOf, setForClass, setPieceCost, setPieceName } from '../data/sets.js';
import { state, nextItemId, saveState } from './state.js';
import { fixedSetAffixes, ensureItemSprite, giveLoot, itemPower } from './items.js';
import { buildItemSVG, elementOf } from './item-art.js';

// ---- Tribut-Siegel (Sonderwährung) ----------------------------------
export function getSetTokens(){ return (state && state.setTokens) || 0; }
export function awardSetTokens(n){
  n = Math.max(0, Math.round(n||0));
  if(!n) return 0;
  const before = getSetTokens();
  state.setTokens = Math.min(SET_TOKEN_CAP, before + n);   // Cap: nie über SET_TOKEN_CAP
  const added = state.setTokens - before;                   // tatsächlich gutgeschriebene Menge
  if(added && state.stats) state.stats.setTokensEarned = (state.stats.setTokensEarned||0) + added;
  return added;
}
export function spendSetTokens(n){
  n = Math.max(0, Math.round(n||0));
  if(getSetTokens() < n) return false;
  state.setTokens = getSetTokens() - n;
  return true;
}

// ---- Aktive Set-Boni ------------------------------------------------
// Anzahl getragener Teile je Set.
export function equippedSetCounts(s){
  const counts = {};
  const eq = (s && s.equipped) || {};
  for(const k of Object.keys(eq)){
    const it = eq[k];
    if(it && it.setId) counts[it.setId] = (counts[it.setId]||0) + 1;
  }
  return counts;
}

// Set-Übersicht für die UI: das zur Klasse passende Set + aktive Boni-Stufen.
export function activeSetInfo(s){
  s = s || state;
  const cls = classOf(s);
  const set = setForClass(cls.id);
  if(!set) return null;
  const count = (equippedSetCounts(s))[set.id] || 0;
  const bonuses = set.bonuses.map(bn => ({ ...bn, active: count >= bn.need }));
  return { set, count, bonuses };
}

// Set-Boni ins (bereits summierte) Totals-Bündel mischen. Boni gelten NUR für
// die passende Klasse (ein Verteidiger im Schurken-Leder bekommt keine Boni).
export function applySetBonuses(s, b){
  const cls = classOf(s);
  const counts = equippedSetCounts(s);
  const flat = {}, pct = {};
  for(const setId of Object.keys(counts)){
    const set = SETS[setId];
    if(!set || set.classId !== cls.id) continue;
    for(const bn of set.bonuses){
      if(counts[setId] < bn.need) continue;
      if(bn.flat) for(const [k,v] of Object.entries(bn.flat)) flat[k] = (flat[k]||0) + v;
      if(bn.pct)  for(const [k,v] of Object.entries(bn.pct))  pct[k]  = (pct[k]||0)  + v;
    }
  }
  // 1) flach addieren …
  for(const [k,v] of Object.entries(flat)) b[k] = (b[k]||0) + v;
  // 2) … dann prozentual auf das summierte Bündel (skaliert mit Gear/Transzendenz).
  for(const [k,v] of Object.entries(pct))  b[k] = (b[k]||0) * (1 + v);
  // 3) Vorhandene Caps erneut anwenden (Set darf sie nicht überschreiten) –
  //    identisch zu recomputeTotals, damit keine Degeneration entsteht.
  b.critPhys    = Math.min(0.60, b.critPhys||0);
  b.critMagic   = Math.min(0.60, b.critMagic||0);
  b.attackSpeed = Math.min(0.60, b.attackSpeed||0);
  b.lifesteal   = Math.min(AFFIX_DEFS.lifesteal.cap,   b.lifesteal||0);
  b.dodge       = Math.min(AFFIX_DEFS.dodge.cap,       b.dodge||0);
  b.versatility = Math.min(AFFIX_DEFS.versatility.cap, b.versatility||0);
  return b;
}

// ---- Set-Teil erzeugen ----------------------------------------------
// Gegenstandsstufe eines gekauften Set-Teils – skaliert mit dem Fortschritt,
// damit die Teile beim Erwerb spürbar stark sind (danach in der Schmiede beliebig
// transzendierbar).
export function setPieceIlvl(s){
  s = s || state;
  return Math.max(40, (s.zone|0) * 6 + 24);
}

// Itype-Stellvertreter (für Sprite/Material/Variant). NICHT im ITEM_TYPES-
// Katalog → typeOf() liefert für Set-Items bewusst den Fallback; die Set-spezifische
// Behandlung (Material/Sprite/Tragbarkeit) läuft isoliert über item.setId.
function setItype(set, slotKey){
  return { key:'set_'+set.themeKey, name:(SLOTS[slotKey]||{}).base || 'Teil',
           material:set.material, variant:SET_SLOTS.indexOf(slotKey),
           statMult:set.statMult, affixBias:set.affixBias, flavorAffix:set.flavorAffix, g:'n' };
}

export function createSetPiece(setId, slotKey, ilvl){
  const set = SETS[setId]; if(!set) return null;
  const slot = SLOTS[slotKey]; if(!slot) return null;
  ilvl = Math.max(1, ilvl|0);
  const rarity = rarityOf('legendaer');                 // → canTranscend (unbegrenzt aufwertbar)
  const itype = setItype(set, slotKey);
  const statType = slot.statType;                       // armor
  const stat = Math.max(1, Math.round(BASE_STAT[statType] * rarity.mult * (1 + ilvl*ILVL_K) * set.statMult));
  const id = nextItemId();
  const it = {
    id, slotKey, cat:slot.cat, statType,
    rarity:'legendaer', ilvl, stat, variant:itype.variant, itemType:itype.key,
    quality:100,
    affixes: fixedSetAffixes(set.fixedAffixes && set.fixedAffixes[slotKey], ilvl, rarity),
    proc: null,
    setId, setSlot:slotKey,
    name: setPieceName(set, slotKey),
    sprite: buildItemSVG(slot.art, itype.variant, 'legendaer', elementOf(id), null, set.material, null, set.themeKey),
  };
  return it;
}

// Vorschau-Item eines Set-Teils OHNE Kauf/State-Mutation (für den Tooltip im
// Set-Händler). Liefert die deterministischen Werte (Primärwert, Seltenheit,
// Slot, Gegenstandsstufe, Qualität) – identisch zur späteren Kauf-Pipeline.
// Die Affixe sind FEST (createSetPiece → fixedSetAffixes), daher zeigt die
// Vorschau exakt die Affixe, die man beim Kauf erhält.
export function previewSetPiece(setId, slotKey, ilvl){
  const set = SETS[setId]; if(!set) return null;
  const slot = SLOTS[slotKey]; if(!slot) return null;
  ilvl = Math.max(1, ilvl|0);
  const rarity = rarityOf('legendaer');
  const statType = slot.statType;
  const stat = Math.max(1, Math.round(BASE_STAT[statType] * rarity.mult * (1 + ilvl*ILVL_K) * set.statMult));
  return {
    id: 'setpreview_'+setId+'_'+slotKey,   // synthetische Id → verbraucht keine nextItemId
    slotKey, cat:slot.cat, statType,
    rarity:'legendaer', ilvl, stat,
    variant: SET_SLOTS.indexOf(slotKey), itemType:'set_'+set.themeKey,
    quality:100, affixes: fixedSetAffixes(set.fixedAffixes && set.fixedAffixes[slotKey], ilvl, rarity), proc:null,
    setId, setSlot:slotKey,
    name: setPieceName(set, slotKey),
    preview:true,
  };
}

// Besitzt der Spielstand bereits dieses Set-Teil (Inventar/ausgerüstet/Beute)?
export function ownsSetPiece(s, setId, slotKey){
  s = s || state;
  const has = arr => Array.isArray(arr) && arr.some(it => it && it.setId===setId && it.setSlot===slotKey);
  if(has(s.inventory) || has(s.pendingLoot)) return true;
  const eq = s.equipped || {};
  return Object.keys(eq).some(k => { const it = eq[k]; return it && it.setId===setId && it.setSlot===slotKey; });
}

// ---- Kauf beim Set-Händler ------------------------------------------
// Kauft das Set-Teil der EIGENEN Klasse für den Slot gegen Tribut-Siegel.
// Rückgabe: { ok, item } | { ok:false, reason:'noset'|'owned'|'tokens'|'badslot' }.
export function buySetPiece(slotKey){
  const set = setForClass(classOf(state).id);
  if(!set) return { ok:false, reason:'noset' };
  if(!SET_SLOTS.includes(slotKey)) return { ok:false, reason:'badslot' };
  if(ownsSetPiece(state, set.id, slotKey)) return { ok:false, reason:'owned' };
  const cost = setPieceCost(slotKey);
  if(getSetTokens() < cost) return { ok:false, reason:'tokens' };
  const item = createSetPiece(set.id, slotKey, setPieceIlvl(state));
  if(!item) return { ok:false, reason:'badslot' };
  if(!spendSetTokens(cost)) return { ok:false, reason:'tokens' };
  ensureItemSprite(item);
  giveLoot(state, item);
  saveState();
  return { ok:true, item };
}

// Kampfkraft-Hilfe (re-export, falls die UI sie braucht).
export { itemPower };
