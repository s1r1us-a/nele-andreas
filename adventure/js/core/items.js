/* =====================================================================
   ITEMS: Generierung, Affixe, Procs, Wert, Verkauf, Ausrüsten.
   ===================================================================== */
import { ASSETS, BASE_STAT, ILVL_K, ILVL_QUAD, INV_SLOTS,
         INV_SLOTS_MAX, INV_EXPAND_STEP, INV_EXPAND_BASE_COST } from '../data/tuning.js';
import { rarityOf, rarityIndex } from '../data/rarities.js';
import { weightedRarity } from './loot.js';
import { SLOTS, SLOT_KEYS, FITS } from '../data/slots.js';
import { AFFIX_DEFS, AFFIX_KEYS, affixPool, weightedAffixPool, AFFIX_COUNT } from '../data/affixes.js';
import { pickItemType, ITEM_TYPES, materialOf, MATERIAL_LABEL, typeOf, itemDisplayName,
         defaultTypeKey } from '../data/itemTypes.js';
import { allowedMaterials, classOf } from '../data/classes.js';
import { setOf, setThemeOf } from '../data/sets.js';
import { state, nextItemId, saveState } from './state.js';
import { buildItemSVG, elementOf } from './item-art.js';
import { dyeColorOf } from '../data/dyes.js';
import { awardCoins, spendCoins, getCoins } from './coins.js';
import { toast } from '../ui/dom.js';

// ---- Power-Gewichtung (eine Quelle für itemPower & recomputeTotals) ----
export const POWER_W = {
  armor:1, damage:1.5, maxHp:0.2, critPhys:200, critMagic:200, critDamage:60, attackSpeed:150,
  lifesteal:180, dodge:220, block:1, versatility:200, thorns:0.8,
};
export function powerOfBundle(b){
  let p = 0;
  for(const k in POWER_W) p += (b[k]||0) * POWER_W[k];
  return Math.round(p);
}

// ---- Affixe ---------------------------------------------------------
// Roll-Bereich je Seltenheit (Teil 2): seltene Drops rollen verlässlich hoch.
const AFFIX_ROLL_RANGE = {
  gewoehnlich:[0.75,1.25], ungewoehnlich:[0.75,1.25], selten:[0.80,1.25],
  episch:[0.85,1.25], legendaer:[0.90,1.28], mythisch:[0.95,1.30],
};
export function affixValue(key, ilvl, rarity){
  const d = AFFIX_DEFS[key];
  const [lo, hi] = AFFIX_ROLL_RANGE[rarity.key] || [0.75,1.25];
  const roll = lo + Math.random()*(hi-lo);  // WoW-artiger Range-Roll, seltenheitsabhängig
  let v = (d.base + ilvl*d.perIlvl) * rarity.mult * roll;
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
// Deterministischer Affix-Wert für SET-Teile (kein Math.random). Identische
// Mathematik wie affixValue, aber mit festem Roll-Faktor – damit Set-Affixe FEST
// sind. roll=1.20 = "starkes Legendär" (Legendär-Spanne [0.90–1.28], Ø 1.09).
// ilvl-Skalierung bleibt erhalten.
export function affixValueFixed(key, ilvl, rarity, roll=1.20){
  const d = AFFIX_DEFS[key];
  let v = (d.base + ilvl*d.perIlvl) * rarity.mult * roll;
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
// Festes Affix-Bündel aus einer Affix-Key-Liste (z. B. die festen Set-Affixe
// eines Slots) – ohne Zufall, ohne Pool-Filter.
export function fixedSetAffixes(keys, ilvl, rarity){
  const out = {};
  for(const k of (keys||[])) if(AFFIX_DEFS[k]) out[k] = affixValueFixed(k, ilvl, rarity);
  return out;
}

// Alle Vorkommen eines Keys aus dem (gewichteten) Pool entfernen.
function removeAll(arr, key){ for(let i=arr.length-1;i>=0;i--) if(arr[i]===key) arr.splice(i,1); }

export function rollAffixes(slotKey, ilvl, rarity, itype){
  const cnt = AFFIX_COUNT[rarity.key];
  let n = typeof cnt === 'function' ? cnt() : (cnt||0);
  const pool = (itype ? weightedAffixPool(slotKey, itype) : affixPool(slotKey)).slice();
  const out = {};
  // Archetyp-Garantie (Teil 2): ab Episch zuerst den Flavor-Affix setzen.
  if(itype && itype.flavorAffix && rarityIndex(rarity.key) >= 3 && pool.includes(itype.flavorAffix) && n > 0){
    out[itype.flavorAffix] = affixValue(itype.flavorAffix, ilvl, rarity);
    removeAll(pool, itype.flavorAffix);
    n--;
  }
  for(let i=0; i<n && pool.length; i++){
    const k = pool[Math.floor(Math.random()*pool.length)];
    out[k] = affixValue(k, ilvl, rarity);
    removeAll(pool, k);   // ohne Zurücklegen – alle gewichteten Kopien raus
  }
  return out;
}

// ---- Proc-Effekte (#22): nur Legendär/Mythisch -----------------------
const PROC_TYPES = [
  { type:'blitz',      label:'Blitzschlag',  emoji:'⚡', color:'#7fd0ff',
    mk:(ilvl,m)=>({ value: Math.round((20 + ilvl*2.2)*m) }) },
  { type:'lebensquell',label:'Lebensquell',  emoji:'💚', color:'#37d67a',
    mk:(ilvl,m)=>({ value: Math.round((30 + ilvl*3)*m) }) },
  { type:'zorn',       label:'Zorn',         emoji:'🔆', color:'#ffd24a',
    mk:(ilvl,m)=>({ value: 2 }) },  // 2 Runden Tempo-Schub
];
export function buildProc(rarityKey, ilvl){
  if(rarityKey !== 'legendaer' && rarityKey !== 'mythisch') return null;
  const mult = rarityKey === 'mythisch' ? 1.6 : 1.0;
  const p = PROC_TYPES[Math.floor(Math.random()*PROC_TYPES.length)];
  const chance = rarityKey === 'mythisch' ? 0.15 : 0.10;
  return Object.assign({ type:p.type, label:p.label, emoji:p.emoji, color:p.color, chance }, p.mk(ilvl, mult));
}
export function procText(proc){
  if(!proc) return '';
  const pct = Math.round(proc.chance*100);
  if(proc.type==='blitz')       return proc.emoji+' '+pct+'% pro Treffer: +'+proc.value+' Blitzschaden';
  if(proc.type==='lebensquell') return proc.emoji+' '+pct+'% pro Treffer: heilt '+proc.value+' HP';
  if(proc.type==='zorn')        return proc.emoji+' '+pct+'% pro Treffer: '+proc.value+ ' Runden Tempo-Schub';
  return '';
}

// ---- Item-Generierung ----------------------------------------------
function randSlotKey(slots){
  const keys = (slots && slots.length) ? slots : SLOT_KEYS;
  return keys[Math.floor(Math.random()*keys.length)];
}
// opts: { slots?, forceRarityKey?, minIlvl?, forceType?, minRarityCap? }
export function rollItem(zone, lootBoost=0, opts={}){
  const slotKey = randSlotKey(opts.slots);
  const slot = SLOTS[slotKey];
  // forceType (Dev): bestimmten Item-Typ erzwingen, sonst zufällig (Teil 1).
  let itype = pickItemType(slotKey);
  if(opts.forceType){
    const list = ITEM_TYPES[slot.art];
    const t = list && list.find(x => x.key === opts.forceType);
    if(t) itype = t;
  }
  let rarity;
  if(opts.forceRarityKey) rarity = rarityOf(opts.forceRarityKey);
  else rarity = weightedRarity(zone, lootBoost, opts.minRarityCap ?? -1);   // zentrale Gewichtung + Cap (loot.js)
  // Item-Level: sanft konvex (Teil 3) – Zusatz ist bei Zone 0 = 0.
  let ilvl = Math.max(1, Math.round((zone*5 + 1) + zone*zone*ILVL_QUAD + (Math.random()*6-2) + rarityIndex(rarity.key)*2));
  if(opts.minIlvl) ilvl = Math.max(ilvl, opts.minIlvl);
  // Item-Typ darf statType/art/cat des Slots überschreiben (Nebenhand-Slot trägt
  // Schilde=Rüstung, Zweitwaffen=Schaden, Orbs=Schaden mit eigenem Sprite/Glow).
  const statType = itype.statType ?? slot.statType;
  const art      = itype.art      ?? slot.art;
  const cat      = itype.cat      ?? slot.cat;
  const quality = 0.80 + Math.random()*0.40;
  const stat = Math.max(1, Math.round(BASE_STAT[statType] * rarity.mult * (1 + ilvl*ILVL_K) * quality * (itype.statMult ?? 1)));
  const variant = itype.variant;   // Typ bestimmt das Sprite (Teil 0/1)
  const id = nextItemId();
  return {
    id,
    slotKey, cat, statType,
    rarity: rarity.key, ilvl, stat, variant, itemType: itype.key,
    quality: Math.round(quality*100),
    affixes: rollAffixes(slotKey, ilvl, rarity, itype),
    proc: buildProc(rarity.key, ilvl),
    sprite: buildItemSVG(art, variant, rarity.key, elementOf(id), itype.orb, itype.material),
    name: itemDisplayName(rarity.key, itype),
  };
}

// Sprite eines Items sicherstellen/neu bauen (spiegelt hydrateItems in state.js).
// Wird z. B. für aus Firebase geladene Gast-Items gebraucht, deren Sprites beim
// Speichern entfernt wurden (stripItem) – sonst rendert <img src="undefined">.
export function ensureItemSprite(it){
  if(!it) return it;
  if(!it.affixes) it.affixes = {};
  // Set-Items (additiv): eigenes Set-Icon, Material/Variante bleiben erhalten
  // (typeOf liefert für Set-Items bewusst den Fallback → hier nicht überschreiben).
  const setTheme = setThemeOf(it);
  if(setTheme){
    const set = setOf(it);
    const art = (SLOTS[it.slotKey] && SLOTS[it.slotKey].art) || it.slotKey;
    it.sprite = buildItemSVG(art, it.variant|0, it.rarity, elementOf(it.id), null, set.material, null, setTheme);
    return it;
  }
  if(!it.itemType) it.itemType = defaultTypeKey(it.slotKey);
  const t = typeOf(it);
  // Variante folgt dem Typ → Typ-Updates wirken rückwirkend auf alte Stände.
  it.variant = t.variant;
  // art aus dem Item-Typ (Nebenhand: schild/waffe/orb), Fallback = Slot-art.
  const art = t.art || (SLOTS[it.slotKey] && SLOTS[it.slotKey].art) || it.slotKey;
  it.sprite = buildItemSVG(art, it.variant, it.rarity, elementOf(it.id), t.orb, t.material, dyeColorOf(it));
  return it;
}

// ---- Wert / Verkauf / Sperre ---------------------------------------
// Affix-Bewertung über die zentrale Kampfkraft-Gewichtung (POWER_W) – damit
// flache Defensiv-Affixe (Block/Dornen/Rüstung) nicht länger gegenüber
// Prozent-Affixen unterbewertet werden. Faktor 0.5 hält die Größenordnung der
// bisherigen Verkaufspreise grob bei.
export function affixScore(it){
  let s = 0; const a = it.affixes || {};
  for(const [k,v] of Object.entries(a)){ if(POWER_W[k] != null) s += v * POWER_W[k] * 0.5; }
  if(it.proc) s += 40;  // Proc-Effekt zählt zum Wert
  return s;
}
// Aufgewertete Items (upgradeLevel) sind wertvoller: stat/Affixe sind bereits
// erhöht (fließen automatisch ein), zusätzlich eine kleine Investitions-Prämie.
export const itemValue = it => rarityIndex(it.rarity)*1000 + it.stat + affixScore(it) + (it.upgradeLevel||0)*500;
// Effektive Inventar-Kapazität eines beliebigen Spielstands (auch fremder Slot
// bzw. Turm-myState): Basis + gekaufte Plätze, gedeckelt.
export function invCapacityOf(s){
  return Math.min(INV_SLOTS + ((s && s.extraSlots)||0), INV_SLOTS_MAX);
}
// Effektive Inventar-Kapazität des aktiven Spielstands.
export function invCapacity(){ return invCapacityOf(state); }

// Gewonnenes Item in einen Spielstand legen ODER – bei vollem Inventar – in die
// „ausstehende Beute" (pendingLoot) zurücklegen, sodass NICHTS verloren geht.
// Liefert true, wenn es direkt ins Inventar ging, sonst false (es wartet).
export function giveLoot(s, item){
  if(!s) return false;
  s.inventory = s.inventory || [];
  s.pendingLoot = s.pendingLoot || [];
  if(s.inventory.length < invCapacityOf(s)){ s.inventory.push(item); return true; }
  s.pendingLoot.push(item);
  return false;
}

// Ausstehende Beute des aktiven Spielstands nachrücken lassen, solange Platz
// ist. Liefert die Anzahl der nachgerückten Items (0 = nichts bewegt).
export function claimPendingLoot(){
  const pend = state.pendingLoot;
  if(!Array.isArray(pend) || !pend.length) return 0;
  let moved = 0;
  while(pend.length && state.inventory.length < invCapacity()){
    state.inventory.push(pend.shift()); moved++;
  }
  if(moved) saveState();
  return moved;
}
export const inventoryFull = () => state.inventory.length >= invCapacity();
export const freeSlots = () => Math.max(0, invCapacity() - state.inventory.length);
export const sellPrice = it => {
  const base = Math.round((it.stat + affixScore(it)*2) * (rarityIndex(it.rarity)+1) * 0.6);
  const price = it.cat === 'waffen' ? base*10 : base;   // Waffenpreise ×10
  // Mindestpreis steigt mit der Seltenheit (gewöhnlich 500 … mythisch 3000),
  // damit ein besseres Item bei niedrigen Stufen nie so wenig wie das
  // schlechteste bringt. Höher berechnete Preise bleiben unverändert.
  const floor = 500 * (rarityIndex(it.rarity) + 1);
  // Aufwertung schlägt sich im Verkaufswert nieder (+5 % je Stufe).
  return Math.round(Math.max(floor, price) * (1 + (it.upgradeLevel||0)*0.05));
};

// Einzel-Item-Kampfkraft (Vergleich im Vorschau-Modal)
export function itemPower(it){
  if(!it) return 0;
  const b = { armor:0, damage:0 };
  if(it.statType==='armor') b.armor += it.stat; else b.damage += it.stat;
  const a = it.affixes || {};
  for(const k of AFFIX_KEYS) b[k] = (b[k]||0) + (a[k]||0);
  let p = powerOfBundle(b);
  if(it.proc) p += 25;
  return p;
}

// Item-Sperre (#24)
export const isLocked = id => state.lockedIds.includes(id);
export function toggleLock(id){
  const i = state.lockedIds.indexOf(id);
  if(i>=0) state.lockedIds.splice(i,1); else state.lockedIds.push(id);
  saveState();
}

// Verkauf: Item entfernen und seinen Wert (sellPrice) als globale Coins
// gutschreiben. Liefert den ausgezahlten Betrag zurück (0, wenn nichts ging).
export function sellItem(id){
  if(isLocked(id)) return 0;
  const idx = state.inventory.findIndex(i => i.id === id);
  if(idx < 0) return 0;
  const it = state.inventory[idx];
  const price = sellPrice(it);
  state.inventory.splice(idx, 1);
  awardCoins(price).catch(()=>{});
  state.stats.goldEarned += price;
  saveState();
  return price;
}
// ---- Inventarerweiterung (Händler) ---------------------------------
// Kosten der nächsten +5-Erweiterung: steigt je Kauf um INV_EXPAND_BASE_COST
// (1. Kauf 50k, dann 100k, 150k …). null = Maximum bereits erreicht.
export function nextExpandCost(){
  if(invCapacity() >= INV_SLOTS_MAX) return null;
  const done = (state.extraSlots||0) / INV_EXPAND_STEP;   // bisher getätigte Käufe
  return (done + 1) * INV_EXPAND_BASE_COST;
}
// Kauf einer Inventarerweiterung. Zieht Coins kontoweit ab (spendCoins) und
// erhöht die Kapazität pro Charakter um INV_EXPAND_STEP. Rückgabe:
// { ok:true, cost } oder { ok:false, reason:'max'|'coins' }.
export async function buyInventoryExpansion(){
  const cost = nextExpandCost();
  if(cost == null) return { ok:false, reason:'max' };
  if(getCoins() < cost) return { ok:false, reason:'coins' };
  if(!(await spendCoins(cost))) return { ok:false, reason:'coins' };
  state.extraSlots = (state.extraSlots||0) + INV_EXPAND_STEP;
  saveState();
  return { ok:true, cost };
}

// ---- Ausrüsten ------------------------------------------------------
export function resolveTargetSlot(item){
  if(item.slotKey==='ring1' || item.slotKey==='ring2'){
    return !state.equipped.ring1 ? 'ring1' : (!state.equipped.ring2 ? 'ring2' : 'ring1');
  }
  return item.slotKey;
}
// Klassen-Restriktion (Tragbarkeit):
//  • Schild  → nur Verteidiger.
//  • Waffe   → magische Klassen (Heiler/Hexer) nur Zauberstäbe,
//              physische Klassen (Schurke/Verteidiger) nur physische Waffen.
//  • Rüstung → Material muss zur Klasse passen (Stoff/Leder/Platte).
//  • Schmuck → kein Material → von allen tragbar.
export function canEquip(item){
  const cls = classOf(state);
  // Nebenhand-Slot: je nach Item-Art eine andere Klasse.
  //  • Orb   → magische Klassen (Heiler/Hexer)
  //  • Waffe → Schurke (Zweitklinge)
  //  • Schild→ Verteidiger
  if(item.slotKey === 'schild'){
    const art = typeOf(item).art || 'schild';
    if(art === 'orb')   return cls.damageSchool === 'magisch';
    if(art === 'waffe') return cls.id === 'schurke';
    return cls.id === 'verteidiger';
  }
  if(item.slotKey === 'waffe'){
    const isStaff = materialOf(item) === 'zauberstab';
    return cls.damageSchool === 'magisch' ? isStaff : !isStaff;
  }
  const set = setOf(item);
  const mat = set ? set.material : materialOf(item);
  if(!mat) return true;
  return allowedMaterials(state).includes(mat);
}
// Begründung, warum ein Item nicht angelegt werden kann (für Toast/Tooltip).
export function equipBlockReason(item){
  const cls = classOf(state);
  if(item.slotKey === 'schild'){
    const art = typeOf(item).art || 'schild';
    if(art === 'orb')   return cls.label+' kann keine Kugeln tragen – nur Heiler und Hexer.';
    if(art === 'waffe') return cls.label+' kann keine Zweitklinge tragen – nur der Schurke.';
    return cls.label+' kann keine Schilde tragen – nur der Verteidiger.';
  }
  if(item.slotKey === 'waffe'){
    return cls.damageSchool === 'magisch'
      ? cls.label+' kann nur Zauberstäbe als Waffe tragen.'
      : cls.label+' kann keine Zauberstäbe tragen – nur physische Waffen.';
  }
  const _setMat = setOf(item) ? setOf(item).material : materialOf(item);
  return cls.label+' kann '+(MATERIAL_LABEL[_setMat]||'dieses Material')+' nicht tragen.';
}
// Kurzlabel für Material/Typ eines Items (Anzeige im Item-Modal).
//  • Waffe   → Typname + „Zauberstab" bzw. „Physische Waffe"
//  • Schild  → Typname (z. B. „Holzschild")
//  • Rüstung → Material (Stoff/Leder/Platte)
//  • Schmuck → „Schmuck (für alle)"
export function itemKindLabel(item){
  const set = setOf(item);
  if(set) return set.name + ' · Set (' + (MATERIAL_LABEL[set.material] || set.material) + ')';
  const t = typeOf(item);
  if(item.slotKey === 'schild'){
    const art = t.art || 'schild';
    if(art === 'orb')   return (t.name || 'Kugel') + ' · Kugel';
    if(art === 'waffe') return (t.name || 'Waffe') + ' · Zweitwaffe';
    return t.name || 'Schild';
  }
  if(item.slotKey === 'waffe'){
    const kind = materialOf(item) === 'zauberstab' ? 'Zauberstab' : 'Physische Waffe';
    return (t.name || 'Waffe') + ' · ' + kind;
  }
  const mat = materialOf(item);
  if(mat) return MATERIAL_LABEL[mat] || mat;
  return 'Schmuck (für alle tragbar)';
}
// Passendes Emoji-Icon zur Item-Kategorie (Anzeige im Item-Modal).
export function itemKindIcon(item){
  if(setOf(item)) return '⚜️';
  if(item.slotKey === 'schild'){
    const art = typeOf(item).art || 'schild';
    if(art === 'orb')   return '🔮';
    if(art === 'waffe') return '⚔️';
    return '🛡️';
  }
  if(item.slotKey === 'waffe')  return materialOf(item) === 'zauberstab' ? '🪄' : '⚔️';
  const mat = materialOf(item);
  if(mat === 'stoff')  return '🧵';
  if(mat === 'leder')  return '🟫';
  if(mat === 'platte') return '⛓️';
  return '💍';
}
export function equip(item, explicitTarget){
  if(!canEquip(item)){
    toast('✋ '+equipBlockReason(item));
    return;
  }
  const isRing = item.slotKey==='ring1' || item.slotKey==='ring2';
  let target = (isRing && (explicitTarget==='ring1' || explicitTarget==='ring2'))
    ? explicitTarget : resolveTargetSlot(item);
  const idx = state.inventory.findIndex(i => i.id === item.id);
  if(idx>=0) state.inventory.splice(idx,1);
  const prev = state.equipped[target];
  if(prev) state.inventory.push(prev);
  item.slotKey = target;
  const _st = setThemeOf(item);
  item.sprite = _st
    ? buildItemSVG(SLOTS[target].art, item.variant|0, item.rarity, elementOf(item.id), null, setOf(item).material, null, _st)
    : buildItemSVG(SLOTS[target].art, item.variant, item.rarity, elementOf(item.id), typeOf(item).orb, typeOf(item).material, dyeColorOf(item));
  state.equipped[target] = item;
  saveState();
}
export function unequip(slotKey){
  const it = state.equipped[slotKey];
  if(!it) return;
  state.equipped[slotKey] = null;
  state.inventory.push(it);
  saveState();
}

// Material-Rang: schwerere Rüstung ist für die tragende Klasse das „bessere"
// Material. Beim Auto-Anlegen wird darum nie ein leichteres Material angelegt,
// solange ein schwereres erlaubtes Teil für den Slot existiert (z. B. nie Stoff
// für den Schurken, wenn Leder verfügbar ist). Schmuck/Waffen haben Rang 0 und
// werden nicht eingeschränkt.
const MAT_RANK = { stoff:1, leder:2, platte:3 };
const matRank = it => MAT_RANK[(setOf(it) ? setOf(it).material : materialOf(it))] || 0;

// Auto-Equip: legt Slot für Slot das stärkste tragbare Item aus dem Inventar an
// (nach itemPower), bevorzugt aber das schwerste verfügbare Material. Ringe werden
// einzeln behandelt; gesperrte/falsche Klasse bleiben unberührt. equip() legt das
// jeweils ersetzte Teil zurück ins Inventar.
export function autoEquipBest(){
  const fits = (it, target) =>
    (target==='ring1' || target==='ring2')
      ? (it.slotKey==='ring1' || it.slotKey==='ring2')
      : it.slotKey === target;
  let changes = 0;
  for(const target of SLOT_KEYS){
    const cur = state.equipped[target];
    const cands = state.inventory.filter(it => fits(it, target) && canEquip(it));
    // Bestes verfügbares Material aus angelegtem Teil + Inventar bestimmen.
    let bestRank = matRank(cur);
    for(const it of cands) if(matRank(it) > bestRank) bestRank = matRank(it);
    // Liegt schon das beste Material an? → nur bei mehr Kampfkraft tauschen.
    // Sonst (leichteres Material angelegt oder Slot leer) das beste Teil des
    // besten Materials anlegen, auch wenn es etwas schwächer ist – so wird ein
    // angelegtes Stoffteil durch vorhandenes Leder/Platte ersetzt.
    const curIsBestMat = cur && matRank(cur) === bestRank;
    let bestItem = null, bestP = curIsBestMat ? itemPower(cur) : -1;
    for(const it of cands){
      if(matRank(it) > 0 && matRank(it) < bestRank) continue;   // leichteres Material überspringen
      const p = itemPower(it);
      if(p > bestP){ bestP = p; bestItem = it; }
    }
    if(bestItem){ equip(bestItem, target); changes++; }
  }
  return changes;
}

// ---- Logbuch & Statistik -------------------------------------------
export function addLog(item){
  state.log.unshift({ t:Date.now(), name:item.name, rarity:item.rarity, stat:item.stat, statType:item.statType });
  if(state.log.length > 40) state.log.pop();
}
export function recordDrop(item){
  if(state.stats.drops[item.rarity] != null) state.stats.drops[item.rarity]++;
  const v = itemValue(item);
  if(v > (state.stats.bestItemValue||0)){
    state.stats.bestItemValue = v;
    state.stats.bestItem = { name:item.name, rarity:item.rarity };
  }
}

// Durchschnittliche Gegenstandsstufe (Gearscore, #27)
export function gearScore(){
  const eq = Object.values(state.equipped).filter(Boolean);
  if(!eq.length) return 0;
  return Math.round(eq.reduce((s,it)=> s + (it.ilvl||0), 0) / eq.length);
}
