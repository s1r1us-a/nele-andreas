/* =====================================================================
   ITEMS: Generierung, Affixe, Procs, Wert, Verkauf, Ausrüsten.
   ===================================================================== */
import { ASSETS, VARIANTS, BASE_STAT, ILVL_K, INV_SLOTS } from '../data/tuning.js';
import { RARITIES, rarityOf, rarityIndex, rarityByIndex } from '../data/rarities.js';
import { SLOTS, SLOT_KEYS, FITS } from '../data/slots.js';
import { AFFIX_DEFS, AFFIX_KEYS, affixPool, AFFIX_COUNT } from '../data/affixes.js';
import { state, nextItemId, saveState } from './state.js';

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
export function affixValue(key, ilvl, rarity){
  const d = AFFIX_DEFS[key];
  const roll = 0.75 + Math.random()*0.5;   // WoW-artiger Range-Roll 75–125 %
  let v = (d.base + ilvl*d.perIlvl) * rarity.mult * roll;
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
export function rollAffixes(slotKey, ilvl, rarity){
  const cnt = AFFIX_COUNT[rarity.key];
  const n = typeof cnt === 'function' ? cnt() : (cnt||0);
  const pool = affixPool(slotKey).slice();
  const out = {};
  for(let i=0; i<n && pool.length; i++){
    const k = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
    out[k] = affixValue(k, ilvl, rarity);
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
// opts: { slots?, forceRarityKey?, minIlvl? }
export function rollItem(zone, lootBoost=0, opts={}){
  const slotKey = randSlotKey(opts.slots);
  const slot = SLOTS[slotKey];
  let rarity;
  if(opts.forceRarityKey) rarity = rarityOf(opts.forceRarityKey);
  else {
    // lokale Gewichtung ohne Zyklus zu loot.js: identische Formel
    const boost = zone*0.6 + lootBoost;
    const weights = RARITIES.map((r,i)=> Math.max(0.05, r.weight + i*boost - (i===0?boost*4:0)));
    const total = weights.reduce((a,b)=>a+b,0); let roll = Math.random()*total;
    rarity = RARITIES[0];
    for(let i=0;i<RARITIES.length;i++){ roll -= weights[i]; if(roll<=0){ rarity = RARITIES[i]; break; } }
  }
  let ilvl = Math.max(1, Math.round((zone*5 + 1) + (Math.random()*6-2) + rarityIndex(rarity.key)*2));
  if(opts.minIlvl) ilvl = Math.max(ilvl, opts.minIlvl);
  const quality = 0.80 + Math.random()*0.40;
  const stat = Math.max(1, Math.round(BASE_STAT[slot.statType] * rarity.mult * (1 + ilvl*ILVL_K) * quality));
  const variant = Math.floor(Math.random()*VARIANTS);
  return {
    id: nextItemId(),
    slotKey, cat: slot.cat, statType: slot.statType,
    rarity: rarity.key, ilvl, stat, variant,
    quality: Math.round(quality*100),
    affixes: rollAffixes(slotKey, ilvl, rarity),
    proc: buildProc(rarity.key, ilvl),
    sprite: ASSETS + 'icon_' + slot.art + '_' + variant + '.png',
    name: rarity.adj + ' ' + slot.base,
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
  item.sprite = ASSETS + 'icon_' + SLOTS[target].art + '_' + item.variant + '.png';
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
