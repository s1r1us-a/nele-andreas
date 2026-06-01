/* =====================================================================
   LOOT-GEWICHTUNG. zone + lootBoost verschieben die Verteilung Richtung
   selten/episch/legendär/mythisch.
   ===================================================================== */
import { RARITIES, maxRarityIndex, rarityIndex } from '../data/rarities.js';

// Abenteuer (Expeditionen) schalten als Mindest-Cap „Episch" frei – auch in
// frühen Zonen. So kann man auf Abenteuer Epische Items finden; durch die
// Basis-Gewichte bleibt Episch (Gewicht 4) aber seltener als Selten (10).
export const EXPEDITION_MIN_CAP = rarityIndex('episch');

// minCap: optionale Untergrenze für den Seltenheits-Cap (z. B. Expeditionen).
export function rarityWeights(zone, lootBoost=0, minCap=-1){
  const boost = zone * 0.6 + lootBoost;
  const cap = Math.max(maxRarityIndex(zone), minCap);   // Anti-OP-Gating (Teil 3b)
  // Multiplikativer „Magic Find": jede Stufe höher wird um den Faktor m
  // bevorzugt. m ist gedeckelt (< größtes Basis-Verhältnis 25/60 ≈ 2,4),
  // damit die REIHENFOLGE erhalten bleibt – eine höhere Seltenheit ist
  // immer seltener als eine niedrigere (Gewöhnlich bleibt am häufigsten).
  const m = 1 + Math.min(1.2, 0.18 * boost);
  return RARITIES.map((r,i) => i > cap ? 0 : Math.max(0.05, r.weight * Math.pow(m, i)));
}
export function weightedRarity(zone, lootBoost=0, minCap=-1){
  const weights = rarityWeights(zone, lootBoost, minCap);
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = Math.random()*total;
  for(let i=0;i<RARITIES.length;i++){ roll -= weights[i]; if(roll<=0) return RARITIES[i]; }
  return RARITIES[0];
}
// Normierte Wahrscheinlichkeiten (0..1) je Seltenheit – für die Chancen-Vorschau.
export function rarityChances(zone, lootBoost=0, minCap=-1){
  const weights = rarityWeights(zone, lootBoost, minCap);
  const total = weights.reduce((a,b)=>a+b,0) || 1;
  return RARITIES.map((r,i) => ({ rarity:r, p: weights[i]/total }));
}
