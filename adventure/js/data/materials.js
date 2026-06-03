/* =====================================================================
   CRAFTING-MATERIALIEN & -KOSTEN (Schmiede).
   Materialien gewinnt man ausschließlich durch das Zerlegen von Items.
   Welche Sorte ein Item liefert (und welche es zum Aufwerten/Verzaubern
   braucht) hängt allein an seiner SELTENHEIT – nicht an der Item-Art.
     gewöhnlich/ungewöhnlich → Arkanstaub
     selten/episch           → Magiesplitter
     legendär                → Uressenz
     mythisch                → Urstoff
   Alle Balance-Zahlen liegen hier an einem Ort.
   ===================================================================== */
import { rarityIndex } from './rarities.js';

// Reihenfolge = Tier-Reihenfolge (für Konvertierung „nächsthöheres").
export const MATERIALS = [
  { key:'arkanstaub',   name:'Arkanstaub',   icon:'✨', fromRarities:['gewoehnlich','ungewoehnlich'] },
  { key:'magiesplitter',name:'Magiesplitter',icon:'🔹', fromRarities:['selten','episch'] },
  { key:'uressenz',     name:'Uressenz',     icon:'🟠', fromRarities:['legendaer'] },
  { key:'urstoff',      name:'Urstoff',      icon:'💠', fromRarities:['mythisch'] },
];
export const MATERIAL_KEYS = MATERIALS.map(m => m.key);
export const MATERIAL_BY_KEY = Object.fromEntries(MATERIALS.map(m => [m.key, m]));

// Leerer Material-Bestand (für freshState / Migration).
export function blankMaterials(){
  const o = {}; for(const k of MATERIAL_KEYS) o[k] = 0; return o;
}

// Welches Material gehört zu einer Seltenheit?
const RARITY_TO_MAT = (() => {
  const m = {};
  for(const mat of MATERIALS) for(const r of mat.fromRarities) m[r] = mat.key;
  return m;
})();
export function materialForRarity(rarityKey){ return RARITY_TO_MAT[rarityKey] || 'arkanstaub'; }

// ---- Aufwertung -----------------------------------------------------
export const MAX_UPGRADE      = 10;
export const UPGRADE_STAT_PCT = 0.06;   // +6 % Hauptwert je Stufe (additiv auf Basis)
export const UPGRADE_AFFIX_PCT= 0.04;   // +4 % je Affix je Stufe (additiv auf Basis)

// Kostenfaktoren je Seltenheit: Schritt auf +n kostet n × { mat, coins }.
const RARITY_FACTORS = {
  gewoehnlich:   { mat:1, coins:200  },
  ungewoehnlich: { mat:2, coins:400  },
  selten:        { mat:2, coins:800  },
  episch:        { mat:3, coins:1500 },
  legendaer:     { mat:2, coins:3000 },
  mythisch:      { mat:2, coins:6000 },
};
function factorOf(rarityKey){ return RARITY_FACTORS[rarityKey] || RARITY_FACTORS.gewoehnlich; }

// Kosten für den Schritt von item.upgradeLevel → +1.
export function upgradeCost(item){
  const lvl = item.upgradeLevel || 0;
  const f = factorOf(item.rarity);
  const step = lvl + 1;   // Schritt auf +step
  return { matKey: materialForRarity(item.rarity), mat: f.mat*step, coins: f.coins*step };
}
export const canUpgrade = item => (item.upgradeLevel || 0) < MAX_UPGRADE;

// ---- Verzaubern (Reroll) – Pauschale je Seltenheit ------------------
const REROLL_COSTS = {
  selten:    { mat:6, coins:4000  },
  episch:    { mat:9, coins:7500  },
  legendaer: { mat:6, coins:15000 },
  mythisch:  { mat:6, coins:30000 },
};
// Reroll erst ab „selten" sinnvoll (gewöhnlich/ungewöhnlich: 0–1 Affixe).
export const canReroll = item => !!REROLL_COSTS[item.rarity];
export function rerollCost(item){
  const c = REROLL_COSTS[item.rarity];
  if(!c) return null;
  return { matKey: materialForRarity(item.rarity), mat:c.mat, coins:c.coins };
}

// ---- Zerlegen (Salvage) ---------------------------------------------
// Grundausbeute je Seltenheit + Bonus aus Gegenstandsstufe + Upgrade-Rückgabe.
const SALVAGE_BASE = {
  gewoehnlich:1, ungewoehnlich:2, selten:1, episch:2, legendaer:1, mythisch:1,
};
export function salvageYield(item){
  const key = materialForRarity(item.rarity);
  const base = SALVAGE_BASE[item.rarity] ?? 1;
  const ilvlBonus = Math.floor((item.ilvl || 0) / 15);
  const upgRefund = Math.floor((item.upgradeLevel || 0) / 2);
  return { key, amount: Math.max(1, base + ilvlBonus + upgRefund) };
}

// ---- Konvertierung (Dust-Sink): 10 niedrigere → 1 höhere Stufe ------
export const CONVERT_RATE = 10;
// Nächsthöheres Material (oder null beim höchsten Tier).
export function nextMaterialKey(fromKey){
  const i = MATERIAL_KEYS.indexOf(fromKey);
  return (i >= 0 && i < MATERIAL_KEYS.length - 1) ? MATERIAL_KEYS[i+1] : null;
}
