/* =====================================================================
   CRAFTING (Schmiede): Zerlegen, Aufwerten, Verzaubern, Konvertieren.
   Reine Logik – mutiert `state`, schreibt Coins über das globale Wallet
   und sichert mit saveState(). Rückgaben: { ok, ... } / { ok:false, reason }.

   WICHTIG (Korrektheit): Aufwerten/Verzaubern schreiben ausschließlich in
   item.stat und item.affixes – exakt die Felder, die recomputeTotals →
   heroCombat → Kampf/Fähigkeiten ohnehin lesen. Dadurch steigen Kampfkraft,
   Auto-Treffer UND Fähigkeits-Schaden/-Heilung automatisch mit (kein zweiter
   Rechenpfad). Der ursprünglich gerollte Wert wird in item.base gesichert,
   damit Boni additiv auf die Basis (nicht kumulativ) wirken.
   ===================================================================== */
import { AFFIX_DEFS } from '../data/affixes.js';
import { rarityOf } from '../data/rarities.js';
import { typeOf } from '../data/itemTypes.js';
import { MATERIAL_BY_KEY, materialForRarity, salvageYield,
         upgradeCost, canUpgrade, rerollCost, canReroll,
         nextMaterialKey, CONVERT_RATE,
         upgradeStatFactor, upgradeAffixFactor } from '../data/materials.js';
import { state, saveState } from './state.js';
import { rollAffixes, ensureItemSprite, isLocked } from './items.js';
import { getCoins, spendCoins } from './coins.js';

// Material-Bestand sicherstellen (defensiv, falls alter Stand ohne Feld).
function mats(){ if(!state.materials) state.materials = {}; return state.materials; }
export function materialCount(key){ return (mats()[key]||0); }

// Aufwerten/Verzaubern wirken auf Items im Inventar ODER auf ausgerüstete Teile.
// (Salvage bleibt bewusst inventarexklusiv – getragene Ausrüstung zerlegt man nicht.)
function findItem(itemId){
  const inv = state.inventory.find(i => i.id === itemId);
  if(inv) return inv;
  for(const k of Object.keys(state.equipped || {})){
    const e = state.equipped[k];
    if(e && e.id === itemId) return e;
  }
  return null;
}

// ---- Basis-Snapshot & Bonus-Anwendung -------------------------------
// Sichert die aktuell gerollten Werte als „Stufe 0"-Basis (einmalig / nach Reroll).
function snapshotBase(item){
  item.base = { stat: item.stat, affixes: { ...(item.affixes||{}) } };
}
function scaleAffix(key, baseV, level){
  const d = AFFIX_DEFS[key]; if(!d) return baseV;
  let v = baseV * upgradeAffixFactor(level);
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
// item.stat / item.affixes aus item.base + upgradeLevel neu berechnen.
function applyUpgradeBonus(item){
  if(!item.base) snapshotBase(item);
  const lvl = item.upgradeLevel || 0;
  item.stat = Math.max(1, Math.round(item.base.stat * upgradeStatFactor(lvl)));
  const out = {};
  for(const [k, baseV] of Object.entries(item.base.affixes || {})) out[k] = scaleAffix(k, baseV, lvl);
  item.affixes = out;
}

// ---- Zerlegen (Salvage) ---------------------------------------------
// Liefert { ok:true, key, amount, name } oder { ok:false, reason }.
export function salvage(itemId){
  if(isLocked(itemId)) return { ok:false, reason:'locked' };
  const idx = state.inventory.findIndex(i => i.id === itemId);
  if(idx < 0) return { ok:false, reason:'notfound' };
  const item = state.inventory[idx];
  const { key, amount } = salvageYield(item);
  state.inventory.splice(idx, 1);
  mats()[key] = (mats()[key]||0) + amount;
  saveState();
  return { ok:true, key, amount, name:item.name };
}

// ---- Aufwerten ------------------------------------------------------
export async function upgradeItem(itemId){
  const item = findItem(itemId);
  if(!item) return { ok:false, reason:'notfound' };
  if(!canUpgrade(item)) return { ok:false, reason:'max' };
  const cost = upgradeCost(item);
  if(materialCount(cost.matKey) < cost.mat) return { ok:false, reason:'mat' };
  if(getCoins() < cost.coins) return { ok:false, reason:'coins' };
  if(!(await spendCoins(cost.coins))) return { ok:false, reason:'coins' };
  // Coins sind abgezogen → jetzt Material verrechnen und Bonus anwenden.
  mats()[cost.matKey] -= cost.mat;
  if(!item.base) snapshotBase(item);
  item.upgradeLevel = (item.upgradeLevel || 0) + 1;
  applyUpgradeBonus(item);
  ensureItemSprite(item);
  saveState();
  return { ok:true, level:item.upgradeLevel, cost };
}

// ---- Verzaubern (Reroll Affixe) -------------------------------------
export async function rerollAffixes(itemId){
  const item = findItem(itemId);
  if(!item) return { ok:false, reason:'notfound' };
  if(!canReroll(item)) return { ok:false, reason:'norerolls' };
  const cost = rerollCost(item);
  if(materialCount(cost.matKey) < cost.mat) return { ok:false, reason:'mat' };
  if(getCoins() < cost.coins) return { ok:false, reason:'coins' };
  if(!(await spendCoins(cost.coins))) return { ok:false, reason:'coins' };
  mats()[cost.matKey] -= cost.mat;
  // Neue Affixe würfeln, als neue Basis sichern und den vorhandenen
  // Aufwertungs-Bonus (upgradeLevel) wieder darauf anwenden.
  item.affixes = rollAffixes(item.slotKey, item.ilvl, rarityOf(item.rarity), typeOf(item));
  snapshotBase(item);
  applyUpgradeBonus(item);
  ensureItemSprite(item);
  saveState();
  return { ok:true, cost };
}

// Wie viele Chargen (à CONVERT_RATE) lassen sich aus dem Bestand umwandeln?
// (0, wenn es kein höheres Material gibt oder zu wenig vorhanden ist.)
export function maxConvertBatches(fromKey){
  if(!nextMaterialKey(fromKey)) return 0;
  return Math.floor(materialCount(fromKey) / CONVERT_RATE);
}

// ---- Konvertieren (10 niedrigere → 1 höhere Stufe) ------------------
// `times` = Anzahl Chargen; wird auf den möglichen Höchstwert begrenzt.
export function convertMaterial(fromKey, times = 1){
  const toKey = nextMaterialKey(fromKey);
  if(!toKey) return { ok:false, reason:'top' };
  const batches = Math.min(Math.max(1, Math.floor(times)), maxConvertBatches(fromKey));
  if(batches < 1) return { ok:false, reason:'mat' };
  mats()[fromKey] -= CONVERT_RATE * batches;
  mats()[toKey] = (mats()[toKey]||0) + batches;
  saveState();
  return { ok:true, fromKey, toKey, batches };
}
