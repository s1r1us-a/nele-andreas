/* =====================================================================
   LOOT-GEWICHTUNG. zone + lootBoost verschieben die Verteilung Richtung
   selten/episch/legendär/mythisch.
   ===================================================================== */
import { RARITIES } from '../data/rarities.js';

export function rarityWeights(zone, lootBoost=0){
  const boost = zone * 0.6 + lootBoost;
  return RARITIES.map((r,i) => Math.max(0.05, r.weight + i*boost - (i===0 ? boost*4 : 0)));
}
export function weightedRarity(zone, lootBoost=0){
  const weights = rarityWeights(zone, lootBoost);
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = Math.random()*total;
  for(let i=0;i<RARITIES.length;i++){ roll -= weights[i]; if(roll<=0) return RARITIES[i]; }
  return RARITIES[0];
}
// Normierte Wahrscheinlichkeiten (0..1) je Seltenheit – für die Chancen-Vorschau.
export function rarityChances(zone, lootBoost=0){
  const weights = rarityWeights(zone, lootBoost);
  const total = weights.reduce((a,b)=>a+b,0) || 1;
  return RARITIES.map((r,i) => ({ rarity:r, p: weights[i]/total }));
}
