/* =====================================================================
   ITEM-TYPEN (Vielfalt). Je Slot 6 Typen mit eigenem Stat-Archetyp.
   - variant (0..5) bindet den Typ an ein Sprite (icon_<art>_<variant>.png).
   - statMult verschiebt den Primär-Stat (z.B. Dolch 0.85 = mehr Affix-Fokus).
   - affixBias gewichtet den Affix-Pool des Slots (nur pool-gültige Affixe wirken).
   - flavorAffix wird ab Episch garantiert gerollt (falls im Slot-Pool).
   Gemappt nach SLOTS[slotKey].art (Ringe teilen sich 'ring').
   ===================================================================== */
import { SLOTS } from './slots.js';
import { rarityOf } from './rarities.js';

// ---- Item-Name: korrekte deutsche Adjektiv-Deklination ----------------
// Starke Deklination (Nominativ, ohne Artikel): m -er, f -e, n -es, pl -e.
// Endung richtet sich nach dem Genus (g) des Item-Nomens (siehe Typen unten).
const ADJ_END = { m:'er', f:'e', n:'es', pl:'e' };
export function itemDisplayName(rarityKey, itype){
  const r = rarityOf(rarityKey);
  const stem = r.adjStem || r.adj || '';
  const end = ADJ_END[(itype && itype.g) || 'm'];
  return stem + end + ' ' + (itype ? itype.name : 'Gegenstand');
}

// ---- Rüstungs-Material-Archetypen (WoW-artig, 3 Materialien) ----------
// Klassen-Tragbarkeit: stoff = alle, leder = Kämpfer/Verteidiger, platte = nur Verteidiger.
// Stoff: kaum Rüstung, magisch (critMagic). Leder: mehr Rüstung, physisch. Platte: viel Rüstung.
// Affixe im Rüstungs-Pool: armor, maxHp, attackSpeed, dodge, block, versatility, critMagic, critPhys.
const ARMOR_MATERIALS = [
  { key:'stoff',  material:'stoff',  prefix:'Stoff',  variant:4, statMult:0.55, affixBias:{ critMagic:3, versatility:2, maxHp:1 }, flavorAffix:'critMagic' },
  { key:'leder',  material:'leder',  prefix:'Leder',  variant:2, statMult:0.95, affixBias:{ dodge:3, critPhys:2, attackSpeed:2 },  flavorAffix:'critPhys' },
  { key:'platte', material:'platte', prefix:'Platte', variant:0, statMult:1.60, affixBias:{ armor:4, block:3, maxHp:2 },          flavorAffix:'armor' },
];
export const ARMOR_MATERIAL_KEYS = ['stoff','leder','platte'];
export const MATERIAL_LABEL = { stoff:'Stoff', leder:'Leder', platte:'Platte', zauberstab:'Zauberstab' };

// g = grammatisches Genus des Slot-Nomens (m/f/n/pl) → korrekte
// Adjektiv-Endung im Item-Namen (siehe itemDisplayName in items.js).
function armorTypes(noun, g){
  return ARMOR_MATERIALS.map(m => ({
    key:m.key, material:m.material, name:m.prefix+'-'+noun, variant:m.variant,
    statMult:m.statMult, affixBias:m.affixBias, flavorAffix:m.flavorAffix, g,
  }));
}

// ---- Katalog je Slot-art ----------------------------------------------
export const ITEM_TYPES = {
  // ⚔️ Waffen – Pool: critPhys, critMagic, critDamage, attackSpeed, damage, lifesteal, versatility
  waffe: [
    { key:'schwert',     name:'Schwert',      g:'n', variant:0, statMult:1.00, affixBias:{ damage:2, critPhys:2 },                 flavorAffix:'damage' },
    { key:'dolch',       name:'Dolch',        g:'m', variant:1, statMult:0.85, affixBias:{ critPhys:3, critDamage:2, attackSpeed:2 }, flavorAffix:'critPhys' },
    { key:'streitkolben',name:'Streitkolben', g:'m', variant:2, statMult:1.20, affixBias:{ damage:3, versatility:2 },                flavorAffix:'damage' },
    { key:'axt',         name:'Axt',          g:'f', variant:3, statMult:1.10, affixBias:{ damage:2, lifesteal:3 },                  flavorAffix:'lifesteal' },
    { key:'speer',       name:'Speer',        g:'m', variant:4, statMult:1.05, affixBias:{ versatility:3, attackSpeed:2 },           flavorAffix:'versatility' },
    { key:'kriegshammer',name:'Kriegshammer', g:'m', variant:5, statMult:1.25, affixBias:{ damage:3, critDamage:2 },                 flavorAffix:'critDamage' },
    // 🪄 Zauberstäbe – nur für Heiler (material:'zauberstab'). Weniger Schaden,
    // dafür Magie-/Heilungs-Affixe. Eigene Orb-Farbe (orb) fürs SVG.
    { key:'stab',        name:'Kristallstab', g:'m', variant:6, statMult:0.85, affixBias:{ critMagic:4, critDamage:3, attackSpeed:1 },        flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
    { key:'heilstab',    name:'Heilstab',     g:'m', variant:6, statMult:0.70, affixBias:{ lifesteal:4, maxHp:2, critMagic:1 },              flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'runenstab',   name:'Runenstab',    g:'m', variant:6, statMult:0.80, affixBias:{ attackSpeed:4, critMagic:2, versatility:1 },      flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
  ],
  // 🛡️ Schild – Pool: armor, maxHp, block, thorns, dodge
  schild: [
    { key:'turmschild',   name:'Turmschild',    g:'m', variant:0, statMult:1.10, affixBias:{ armor:3, block:2 },  flavorAffix:'block' },
    { key:'rundschild',   name:'Rundschild',    g:'m', variant:1, statMult:1.00, affixBias:{ armor:2, thorns:3 }, flavorAffix:'thorns' },
    { key:'buckler',      name:'Buckler',       g:'m', variant:2, statMult:0.90, affixBias:{ dodge:3, block:2 },  flavorAffix:'dodge' },
    { key:'pavese',       name:'Pavese',        g:'f', variant:3, statMult:1.15, affixBias:{ armor:2, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'spiegelschild',name:'Spiegelschild', g:'m', variant:4, statMult:1.00, affixBias:{ block:3, dodge:2 },  flavorAffix:'block' },
    { key:'drachenschild',name:'Drachenschild', g:'m', variant:5, statMult:1.05, affixBias:{ armor:3, thorns:2 }, flavorAffix:'armor' },
  ],
  // 💍 Schmuck – Pool: critPhys, critMagic, critDamage, maxHp, attackSpeed, armor, damage, lifesteal, versatility, dodge
  amulett: [
    { key:'kriegsamulett', name:'Kriegsamulett', g:'n', variant:0, statMult:1.00, affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'lebensamulett', name:'Lebensamulett', g:'n', variant:1, statMult:1.00, affixBias:{ maxHp:3, lifesteal:2 },       flavorAffix:'maxHp' },
    { key:'schutzamulett', name:'Schutzamulett', g:'n', variant:2, statMult:1.00, affixBias:{ armor:3, versatility:2 },     flavorAffix:'versatility' },
    { key:'kritamulett',   name:'Krit-Amulett',  g:'n', variant:3, statMult:1.00, affixBias:{ critPhys:3, critDamage:2 }, flavorAffix:'critPhys' },
    { key:'tempoamulett',  name:'Tempo-Amulett', g:'n', variant:4, statMult:1.00, affixBias:{ attackSpeed:3, dodge:2 },     flavorAffix:'attackSpeed' },
    { key:'raeuberamulett',name:'Räuber-Amulett',g:'n', variant:5, statMult:1.00, affixBias:{ lifesteal:3, critPhys:2 },  flavorAffix:'lifesteal' },
  ],
  ring: [
    { key:'siegelring',  name:'Siegelring',       g:'m', variant:0, statMult:1.00, affixBias:{ critPhys:3, critDamage:2 }, flavorAffix:'critPhys' },
    { key:'bluttropfen', name:'Bluttropfen-Ring', g:'m', variant:1, statMult:1.00, affixBias:{ lifesteal:3, maxHp:2 },       flavorAffix:'lifesteal' },
    { key:'waechterring',name:'Wächterring',      g:'m', variant:2, statMult:1.00, affixBias:{ armor:3, dodge:2 },           flavorAffix:'dodge' },
    { key:'machtring',   name:'Macht-Ring',       g:'m', variant:3, statMult:1.00, affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'vitalring',   name:'Vitalring',        g:'m', variant:4, statMult:1.00, affixBias:{ maxHp:3, armor:2 },           flavorAffix:'maxHp' },
    { key:'talisman',    name:'Talisman',         g:'m', variant:5, statMult:1.00, affixBias:{ versatility:3, attackSpeed:2 }, flavorAffix:'versatility' },
  ],
  // 🛡️ Rüstungs-Slots: gemeinsame Material-Archetypen mit Slot-Substantiv.
  // Genus des Slot-Nomens: Helm/Brustpanzer/Umhang = m; Schulterplatten/
  // Handschuhe/Beinschienen/Stiefel = Plural.
  kopf:      armorTypes('Helm', 'm'),
  schultern: armorTypes('Schulterplatten', 'pl'),
  brust:     armorTypes('Brustpanzer', 'm'),
  haende:    armorTypes('Handschuhe', 'pl'),
  beine:     armorTypes('Beinschienen', 'pl'),
  fuesse:    armorTypes('Stiefel', 'pl'),
  umhang:    armorTypes('Umhang', 'm'),
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

// Rüstungs-Material eines Items (stoff/leder/platte) oder null für
// Waffe/Schild/Schmuck (= klassenunabhängig tragbar).
export function materialOf(item){
  return typeOf(item).material || null;
}
