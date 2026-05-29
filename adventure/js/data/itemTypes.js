/* =====================================================================
   ITEM-TYPEN (Vielfalt). Je Slot 6 Typen mit eigenem Stat-Archetyp.
   - variant (0..5) bindet den Typ an ein Sprite (icon_<art>_<variant>.png).
   - statMult verschiebt den Primär-Stat (z.B. Dolch 0.85 = mehr Affix-Fokus).
   - affixBias gewichtet den Affix-Pool des Slots (nur pool-gültige Affixe wirken).
   - flavorAffix wird ab Episch garantiert gerollt (falls im Slot-Pool).
   Gemappt nach SLOTS[slotKey].art (Ringe teilen sich 'ring').
   ===================================================================== */
import { SLOTS } from './slots.js';

// ---- Rüstungs-Material-Archetypen (für alle Rüstungs-Slots gleich) -----
// Affixe im Rüstungs-Pool: armor, maxHp, attackSpeed, dodge, block, versatility.
const ARMOR_MATERIALS = [
  { key:'platten',  prefix:'Platten',  variant:0, statMult:1.10, affixBias:{ armor:3, block:2 },              flavorAffix:'armor' },
  { key:'ketten',   prefix:'Ketten',   variant:1, statMult:1.00, affixBias:{ armor:2, maxHp:2, versatility:2 }, flavorAffix:'maxHp' },
  { key:'leder',    prefix:'Leder',    variant:2, statMult:0.90, affixBias:{ dodge:3, attackSpeed:2 },         flavorAffix:'dodge' },
  { key:'schuppen', prefix:'Schuppen', variant:3, statMult:1.05, affixBias:{ armor:2, block:3 },              flavorAffix:'block' },
  { key:'gewand',   prefix:'Gewand',   variant:4, statMult:0.90, affixBias:{ versatility:3, maxHp:2 },        flavorAffix:'versatility' },
  { key:'drachen',  prefix:'Drachen',  variant:5, statMult:1.05, affixBias:{ armor:2, attackSpeed:3 },        flavorAffix:'attackSpeed' },
];
const ARMOR_SLOT_ARTS = ['kopf','schultern','brust','haende','beine','fuesse','umhang'];

function armorTypes(noun){
  return ARMOR_MATERIALS.map(m => ({
    key:m.key, name:m.prefix+'-'+noun, variant:m.variant,
    statMult:m.statMult, affixBias:m.affixBias, flavorAffix:m.flavorAffix,
  }));
}

// ---- Katalog je Slot-art ----------------------------------------------
export const ITEM_TYPES = {
  // ⚔️ Waffen – Pool: critChance, critDamage, attackSpeed, damage, lifesteal, versatility
  waffe: [
    { key:'schwert',     name:'Schwert',      variant:0, statMult:1.00, affixBias:{ damage:2, critChance:2 },                 flavorAffix:'damage' },
    { key:'dolch',       name:'Dolch',        variant:1, statMult:0.85, affixBias:{ critChance:3, critDamage:2, attackSpeed:2 }, flavorAffix:'critChance' },
    { key:'streitkolben',name:'Streitkolben', variant:2, statMult:1.20, affixBias:{ damage:3, versatility:2 },                flavorAffix:'damage' },
    { key:'axt',         name:'Axt',          variant:3, statMult:1.10, affixBias:{ damage:2, lifesteal:3 },                  flavorAffix:'lifesteal' },
    { key:'speer',       name:'Speer',        variant:4, statMult:1.05, affixBias:{ versatility:3, attackSpeed:2 },           flavorAffix:'versatility' },
    { key:'kriegshammer',name:'Kriegshammer', variant:5, statMult:1.25, affixBias:{ damage:3, critDamage:2 },                 flavorAffix:'critDamage' },
  ],
  // 🛡️ Schild – Pool: armor, maxHp, block, thorns, dodge
  schild: [
    { key:'turmschild',   name:'Turmschild',    variant:0, statMult:1.10, affixBias:{ armor:3, block:2 },  flavorAffix:'block' },
    { key:'rundschild',   name:'Rundschild',    variant:1, statMult:1.00, affixBias:{ armor:2, thorns:3 }, flavorAffix:'thorns' },
    { key:'buckler',      name:'Buckler',       variant:2, statMult:0.90, affixBias:{ dodge:3, block:2 },  flavorAffix:'dodge' },
    { key:'pavese',       name:'Pavese',        variant:3, statMult:1.15, affixBias:{ armor:2, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'spiegelschild',name:'Spiegelschild', variant:4, statMult:1.00, affixBias:{ block:3, dodge:2 },  flavorAffix:'block' },
    { key:'drachenschild',name:'Drachenschild', variant:5, statMult:1.05, affixBias:{ armor:3, thorns:2 }, flavorAffix:'armor' },
  ],
  // 💍 Schmuck – Pool: critChance, critDamage, maxHp, attackSpeed, armor, damage, lifesteal, versatility, dodge
  amulett: [
    { key:'kriegsamulett', name:'Kriegsamulett', variant:0, statMult:1.00, affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'lebensamulett', name:'Lebensamulett', variant:1, statMult:1.00, affixBias:{ maxHp:3, lifesteal:2 },       flavorAffix:'maxHp' },
    { key:'schutzamulett', name:'Schutzamulett', variant:2, statMult:1.00, affixBias:{ armor:3, versatility:2 },     flavorAffix:'versatility' },
    { key:'kritamulett',   name:'Krit-Amulett',  variant:3, statMult:1.00, affixBias:{ critChance:3, critDamage:2 }, flavorAffix:'critChance' },
    { key:'tempoamulett',  name:'Tempo-Amulett', variant:4, statMult:1.00, affixBias:{ attackSpeed:3, dodge:2 },     flavorAffix:'attackSpeed' },
    { key:'raeuberamulett',name:'Räuber-Amulett',variant:5, statMult:1.00, affixBias:{ lifesteal:3, critChance:2 },  flavorAffix:'lifesteal' },
  ],
  ring: [
    { key:'siegelring',  name:'Siegelring',       variant:0, statMult:1.00, affixBias:{ critChance:3, critDamage:2 }, flavorAffix:'critChance' },
    { key:'bluttropfen', name:'Bluttropfen-Ring', variant:1, statMult:1.00, affixBias:{ lifesteal:3, maxHp:2 },       flavorAffix:'lifesteal' },
    { key:'waechterring',name:'Wächterring',      variant:2, statMult:1.00, affixBias:{ armor:3, dodge:2 },           flavorAffix:'dodge' },
    { key:'machtring',   name:'Macht-Ring',       variant:3, statMult:1.00, affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'vitalring',   name:'Vitalring',        variant:4, statMult:1.00, affixBias:{ maxHp:3, armor:2 },           flavorAffix:'maxHp' },
    { key:'talisman',    name:'Talisman',         variant:5, statMult:1.00, affixBias:{ versatility:3, attackSpeed:2 }, flavorAffix:'versatility' },
  ],
  // 🛡️ Rüstungs-Slots: gemeinsame Material-Archetypen mit Slot-Substantiv.
  kopf:      armorTypes('Helm'),
  schultern: armorTypes('Schulterplatten'),
  brust:     armorTypes('Brustpanzer'),
  haende:    armorTypes('Handschuhe'),
  beine:     armorTypes('Beinschienen'),
  fuesse:    armorTypes('Stiefel'),
  umhang:    armorTypes('Umhang'),
};

// art-Schlüssel zu einem Slot ermitteln (Ringe → 'ring').
function artOf(slotKey){
  const slot = SLOTS[slotKey];
  return slot ? slot.art : null;
}

// Fallback-Typ, falls nichts passt (alte Items / unbekannte Slots).
function fallbackType(slotKey){
  const slot = SLOTS[slotKey];
  return { key:'base', name:(slot && slot.base) || 'Gegenstand', variant:0, statMult:1, affixBias:{}, flavorAffix:null };
}

// Zufälligen Typ für einen Slot wählen.
export function pickItemType(slotKey){
  const list = ITEM_TYPES[artOf(slotKey)];
  if(!list || !list.length) return fallbackType(slotKey);
  return list[Math.floor(Math.random()*list.length)];
}

// Typ-Objekt zu einem Item (null-sicher mit Fallback).
export function typeOf(item){
  if(!item) return fallbackType('');
  const list = ITEM_TYPES[artOf(item.slotKey)];
  const t = list && list.find(x => x.key === item.itemType);
  return t || fallbackType(item.slotKey);
}

// Default-Typ-Key für einen Slot (für Migration alter Stände).
export function defaultTypeKey(slotKey){
  const list = ITEM_TYPES[artOf(slotKey)];
  return (list && list[0]) ? list[0].key : 'base';
}
