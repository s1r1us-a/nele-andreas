/* =====================================================================
   ITEMS: Generierung, Affixe, Procs, Wert, Verkauf, Ausrüsten.
   ===================================================================== */
import { ASSETS, BASE_STAT, ILVL_K, ILVL_QUAD, INV_SLOTS } from '../data/tuning.js';
import { RARITIES, rarityOf, rarityIndex, rarityByIndex, maxRarityIndex } from '../data/rarities.js';
import { SLOTS, SLOT_KEYS, FITS } from '../data/slots.js';
import { AFFIX_DEFS, AFFIX_KEYS, affixPool, weightedAffixPool, AFFIX_COUNT } from '../data/affixes.js';
import { pickItemType, ITEM_TYPES } from '../data/itemTypes.js';
import { state, nextItemId, saveState } from './state.js';
import { buildItemSVG } from './item-art.js';

// ---- Power-Gewichtung (eine Quelle für itemPower & recomputeTotals) ----
export const POWER_W = {
  armor:1, damage:1.5, maxHp:0.2, critChance:200, critDamage:60, attackSpeed:150,
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
// opts: { slots?, forceRarityKey?, minIlvl?, forceType? }
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
  else {
    // lokale Gewichtung ohne Zyklus zu loot.js: identische Formel + Cap (Teil 3b)
    const boost = zone*0.6 + lootBoost;
    const cap = maxRarityIndex(zone);
    const weights = RARITIES.map((r,i)=> i>cap ? 0 : Math.max(0.05, r.weight + i*boost - (i===0?boost*4:0)));
    const total = weights.reduce((a,b)=>a+b,0); let roll = Math.random()*total;
    rarity = RARITIES[0];
    for(let i=0;i<RARITIES.length;i++){ roll -= weights[i]; if(roll<=0){ rarity = RARITIES[i]; break; } }
  }
  // Item-Level: sanft konvex (Teil 3) – Zusatz ist bei Zone 0 = 0.
  let ilvl = Math.max(1, Math.round((zone*5 + 1) + zone*zone*ILVL_QUAD + (Math.random()*6-2) + rarityIndex(rarity.key)*2));
  if(opts.minIlvl) ilvl = Math.max(ilvl, opts.minIlvl);
  const quality = 0.80 + Math.random()*0.40;
  const stat = Math.max(1, Math.round(BASE_STAT[slot.statType] * rarity.mult * (1 + ilvl*ILVL_K) * quality * (itype.statMult ?? 1)));
  const variant = itype.variant;   // Typ bestimmt das Sprite (Teil 0/1)
  return {
    id: nextItemId(),
    slotKey, cat: slot.cat, statType: slot.statType,
    rarity: rarity.key, ilvl, stat, variant, itemType: itype.key,
    quality: Math.round(quality*100),
    affixes: rollAffixes(slotKey, ilvl, rarity, itype),
    proc: buildProc(rarity.key, ilvl),
    sprite: buildItemSVG(slot.art, variant, rarity.key),
    name: rarity.adj + ' ' + itype.name,
  };
}

// ---- Wert / Verkauf / Sperre ---------------------------------------
export function affixScore(it){
  let s = 0; const a = it.affixes || {};
  for(const [k,v] of Object.entries(a)){ if(AFFIX_DEFS[k]) s += AFFIX_DEFS[k].pct ? v*100 : v*0.5; }
  if(it.proc) s += 40;  // Proc-Effekt zählt zum Wert
  return s;
}
export const itemValue = it => rarityIndex(it.rarity)*1000 + it.stat + affixScore(it);
export const inventoryFull = () => state.inventory.length >= INV_SLOTS;
export const freeSlots = () => Math.max(0, INV_SLOTS - state.inventory.length);
export const sellPrice = it => Math.max(1, Math.round((it.stat + affixScore(it)*2) * (rarityIndex(it.rarity)+1) * 0.6));

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

export function sellItem(id){
  if(isLocked(id)) return 0;
  const idx = state.inventory.findIndex(i => i.id === id);
  if(idx < 0) return 0;
  const it = state.inventory[idx];
  const price = sellPrice(it);
  state.inventory.splice(idx, 1);
  state.gold += price;
  state.stats.goldEarned += price;
  saveState();
  return price;
}
export function sellMany(filterFn){
  let gold = 0, n = 0;
  const keep = [];
  for(const it of state.inventory){
    if(!isLocked(it.id) && filterFn(it)){ gold += sellPrice(it); n++; } else keep.push(it);
  }
  state.inventory = keep;
  state.gold += gold;
  state.stats.goldEarned += gold;
  saveState();
  return { gold, n };
}

// ---- Ausrüsten ------------------------------------------------------
export function resolveTargetSlot(item){
  if(item.slotKey==='ring1' || item.slotKey==='ring2'){
    return !state.equipped.ring1 ? 'ring1' : (!state.equipped.ring2 ? 'ring2' : 'ring1');
  }
  return item.slotKey;
}
export function equip(item, explicitTarget){
  const isRing = item.slotKey==='ring1' || item.slotKey==='ring2';
  let target = (isRing && (explicitTarget==='ring1' || explicitTarget==='ring2'))
    ? explicitTarget : resolveTargetSlot(item);
  const idx = state.inventory.findIndex(i => i.id === item.id);
  if(idx>=0) state.inventory.splice(idx,1);
  const prev = state.equipped[target];
  if(prev) state.inventory.push(prev);
  item.slotKey = target;
  item.sprite = buildItemSVG(SLOTS[target].art, item.variant, item.rarity);
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
