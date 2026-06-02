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
// Pro Material ein häufiger Grund-Archetyp + ein seltener, stärkerer Elite-Archetyp.
// Elite teilt sich das Material (→ gleiche Klassen-Regel), hat aber höheren statMult,
// schärferen Affix-Fokus und ein kleines Fund-Gewicht (selten).
const ARMOR_MATERIALS = [
  { key:'stoff',         material:'stoff',  prefix:'Stoff',         variant:4, statMult:0.55, weight:11,  affixBias:{ critMagic:3, versatility:2, maxHp:1 }, flavorAffix:'critMagic' },
  { key:'leder',         material:'leder',  prefix:'Leder',         variant:2, statMult:0.95, weight:11,  affixBias:{ dodge:3, critPhys:2, attackSpeed:2 },  flavorAffix:'critPhys' },
  { key:'platte',        material:'platte', prefix:'Platte',        variant:0, statMult:1.60, weight:9,   affixBias:{ armor:4, block:3, maxHp:2 },           flavorAffix:'armor' },
  { key:'seide',         material:'stoff',  prefix:'Seiden',        variant:4, statMult:0.72, weight:3,   affixBias:{ critMagic:4, versatility:3, maxHp:2 }, flavorAffix:'critMagic' },
  { key:'drachenleder',  material:'leder',  prefix:'Drachenleder',  variant:2, statMult:1.12, weight:2.5, affixBias:{ dodge:4, attackSpeed:3, critPhys:2 },  flavorAffix:'dodge' },
  { key:'drachenplatte', material:'platte', prefix:'Drachenplatten',variant:0, statMult:1.90, weight:1.4, affixBias:{ armor:5, maxHp:3, block:3 },           flavorAffix:'armor' },
  // 🧵 Zusätzliche Stoffrüstungen für Heiler & Hexer (Stoffträger). variant ∈ {3,4,5}
  //    = verschiedene Roben-Farben (ARMOR_MAT). Affixe nur aus dem Rüstungs-Pool
  //    (critMagic, versatility, maxHp, dodge, attackSpeed, armor) – kein lifesteal/critDamage.
  { key:'magierstoff',   material:'stoff',  prefix:'Magier',        variant:4, statMult:0.62, weight:6,   affixBias:{ critMagic:4, versatility:2 },          flavorAffix:'critMagic' },
  { key:'hexenstoff',    material:'stoff',  prefix:'Hexen',         variant:5, statMult:0.66, weight:5,   affixBias:{ critMagic:3, maxHp:2, versatility:2 }, flavorAffix:'critMagic' },
  { key:'heilerstoff',   material:'stoff',  prefix:'Heiler',        variant:3, statMult:0.70, weight:5,   affixBias:{ maxHp:4, versatility:2 },              flavorAffix:'maxHp' },
  { key:'arkanstoff',    material:'stoff',  prefix:'Arkan',         variant:4, statMult:0.74, weight:4,   affixBias:{ critMagic:4, attackSpeed:2 },          flavorAffix:'critMagic' },
  { key:'runenstoff',    material:'stoff',  prefix:'Runen',         variant:5, statMult:0.68, weight:4,   affixBias:{ versatility:4, critMagic:2 },          flavorAffix:'versatility' },
  { key:'astralstoff',   material:'stoff',  prefix:'Astral',        variant:3, statMult:0.78, weight:3,   affixBias:{ critMagic:3, maxHp:3 },                flavorAffix:'maxHp' },
  { key:'nebelstoff',    material:'stoff',  prefix:'Nebel',         variant:4, statMult:0.60, weight:3,   affixBias:{ dodge:4, versatility:2 },              flavorAffix:'dodge' },
  { key:'geisterstoff',  material:'stoff',  prefix:'Geister',       variant:5, statMult:0.72, weight:2.5, affixBias:{ dodge:3, critMagic:3 },                flavorAffix:'dodge' },
  { key:'schattenstoff', material:'stoff',  prefix:'Schatten',      variant:5, statMult:0.80, weight:2,   affixBias:{ critMagic:3, attackSpeed:3 },          flavorAffix:'attackSpeed' },
  { key:'phoenixstoff',  material:'stoff',  prefix:'Phönix',        variant:3, statMult:0.92, weight:1.4, affixBias:{ maxHp:4, critMagic:3, versatility:2 }, flavorAffix:'maxHp' },
  { key:'sternenseide',  material:'stoff',  prefix:'Sternenseiden', variant:4, statMult:0.95, weight:1.1, affixBias:{ critMagic:5, versatility:3 },          flavorAffix:'critMagic' },
  // ⛓️ Zusätzliche Materialien. variant = Farb-Index in ARMOR_MAT (0–11).
  //    Affixe nur aus dem Rüstungs-Pool (armor, maxHp, attackSpeed, dodge, block, versatility, critMagic, critPhys).
  { key:'stahl',         material:'platte', prefix:'Stahl',         variant:0,  statMult:1.62, weight:6,   affixBias:{ armor:4, block:2 },                    flavorAffix:'block' },
  { key:'bronze',        material:'platte', prefix:'Bronze',        variant:6,  statMult:1.50, weight:4,   affixBias:{ armor:4, block:3, maxHp:2 },           flavorAffix:'armor' },
  { key:'knochen',       material:'platte', prefix:'Knochen',       variant:7,  statMult:1.45, weight:3,   affixBias:{ armor:4, maxHp:2 },                    flavorAffix:'armor' },
  { key:'obsidian',      material:'platte', prefix:'Obsidian',      variant:5,  statMult:1.80, weight:1.2, affixBias:{ armor:5, critPhys:2 },                 flavorAffix:'armor' },
  { key:'mithril',       material:'platte', prefix:'Mithril',       variant:8,  statMult:1.70, weight:1.6, affixBias:{ armor:4, attackSpeed:2, dodge:2 },     flavorAffix:'armor' },
  { key:'titanmaterial', material:'platte', prefix:'Titan',         variant:0,  statMult:1.95, weight:1.0, affixBias:{ armor:5, maxHp:3, block:3 },           flavorAffix:'armor' },
  { key:'sternenstahl',  material:'platte', prefix:'Sternenstahl',  variant:10, statMult:1.85, weight:1.1, affixBias:{ armor:4, critMagic:2, versatility:2 }, flavorAffix:'armor' },
  { key:'ketten',        material:'leder',  prefix:'Ketten',        variant:6,  statMult:1.05, weight:6,   affixBias:{ armor:3, dodge:2 },                    flavorAffix:'armor' },
  { key:'schuppen',      material:'leder',  prefix:'Schuppen',      variant:8,  statMult:1.08, weight:5,   affixBias:{ armor:3, dodge:2 },                    flavorAffix:'dodge' },
  { key:'eisenholz',     material:'leder',  prefix:'Eisenholz',     variant:2,  statMult:1.00, weight:5,   affixBias:{ armor:2, dodge:2, versatility:2 },     flavorAffix:'versatility' },
  { key:'wolfsleder',    material:'leder',  prefix:'Wolfsleder',    variant:2,  statMult:1.02, weight:5,   affixBias:{ dodge:3, attackSpeed:2 },              flavorAffix:'attackSpeed' },
  { key:'baerenfell',    material:'leder',  prefix:'Bärenfell',     variant:2,  statMult:1.10, weight:4,   affixBias:{ maxHp:3, armor:2 },                    flavorAffix:'maxHp' },
  { key:'drachenschuppe',material:'leder',  prefix:'Drachenschuppen',variant:8, statMult:1.15, weight:2,   affixBias:{ dodge:4, armor:3 },                    flavorAffix:'dodge' },
  { key:'samt',          material:'stoff',  prefix:'Samt',          variant:4,  statMult:0.66, weight:6,   affixBias:{ critMagic:3, versatility:2 },          flavorAffix:'critMagic' },
  { key:'brokat',        material:'stoff',  prefix:'Brokat',        variant:11, statMult:0.72, weight:5,   affixBias:{ versatility:3, critMagic:2 },          flavorAffix:'versatility' },
  { key:'mondstoff',     material:'stoff',  prefix:'Mond',          variant:10, statMult:0.74, weight:4,   affixBias:{ critMagic:3, dodge:2 },                flavorAffix:'dodge' },
  { key:'phoenixfeder',  material:'stoff',  prefix:'Phönixfeder',   variant:9,  statMult:0.94, weight:1.3, affixBias:{ maxHp:4, critMagic:3 },                flavorAffix:'maxHp' },
  { key:'urweltstoff',   material:'stoff',  prefix:'Urwelt',        variant:11, statMult:0.96, weight:1.0, affixBias:{ critMagic:5, versatility:3 },          flavorAffix:'critMagic' },
];
export const ARMOR_MATERIAL_KEYS = ['stoff','leder','platte'];
export const MATERIAL_LABEL = { stoff:'Stoff', leder:'Leder', platte:'Platte', zauberstab:'Zauberstab', kugel:'Kugel' };

// g = grammatisches Genus des Slot-Nomens (m/f/n/pl) → korrekte
// Adjektiv-Endung im Item-Namen (siehe itemDisplayName in items.js).
function armorTypes(noun, g){
  return ARMOR_MATERIALS.map(m => ({
    key:m.key, material:m.material, name:m.prefix+'-'+noun, variant:m.variant,
    statMult:m.statMult, weight:m.weight, affixBias:m.affixBias, flavorAffix:m.flavorAffix, g,
  }));
}

// ---- Katalog je Slot-art ----------------------------------------------
export const ITEM_TYPES = {
  // ⚔️ Waffen – Pool: critPhys, critMagic, critDamage, attackSpeed, damage, lifesteal, versatility
  waffe: [
    // ⚔️ Physische Waffen (Kämpfer/Verteidiger) – Variante = Silhouette (0–5).
    { key:'schwert',     name:'Schwert',      g:'n', variant:0, statMult:1.00, weight:11, affixBias:{ damage:2, critPhys:2 },                 flavorAffix:'damage' },
    { key:'langschwert', name:'Langschwert',  g:'n', variant:0, statMult:1.08, weight:7,  affixBias:{ damage:3, critPhys:2 },                 flavorAffix:'damage' },
    { key:'dolch',       name:'Dolch',        g:'m', variant:1, statMult:0.85, weight:11, affixBias:{ critPhys:3, critDamage:2, attackSpeed:2 }, flavorAffix:'critPhys' },
    { key:'rapier',      name:'Rapier',       g:'n', variant:1, statMult:0.92, weight:7,  affixBias:{ critPhys:3, attackSpeed:3 },            flavorAffix:'attackSpeed' },
    { key:'streitkolben',name:'Streitkolben', g:'m', variant:2, statMult:1.20, weight:6,  affixBias:{ damage:3, versatility:2 },              flavorAffix:'damage' },
    { key:'morgenstern', name:'Morgenstern',  g:'m', variant:2, statMult:1.22, weight:3,  affixBias:{ damage:3, critDamage:2 },               flavorAffix:'critDamage' },
    { key:'axt',         name:'Axt',          g:'f', variant:3, statMult:1.10, weight:8,  affixBias:{ damage:2, lifesteal:3 },                flavorAffix:'lifesteal' },
    { key:'kriegsbeil',  name:'Kriegsbeil',   g:'n', variant:3, statMult:1.15, weight:5,  affixBias:{ lifesteal:3, damage:3 },                flavorAffix:'lifesteal' },
    { key:'speer',       name:'Speer',        g:'m', variant:4, statMult:1.05, weight:8,  affixBias:{ versatility:3, attackSpeed:2 },         flavorAffix:'versatility' },
    { key:'hellebarde',  name:'Hellebarde',   g:'f', variant:4, statMult:1.18, weight:4,  affixBias:{ versatility:3, damage:3 },              flavorAffix:'damage' },
    { key:'kriegshammer',name:'Kriegshammer', g:'m', variant:5, statMult:1.25, weight:4,  affixBias:{ damage:3, critDamage:2 },               flavorAffix:'critDamage' },
    // 🌟 Selten & stärkster Primärwert (kleine Fund-Chance).
    { key:'flammenklinge', name:'Flammenklinge', g:'f', variant:0, statMult:1.32, weight:1.4, affixBias:{ damage:4, critDamage:3 },           flavorAffix:'critDamage' },
    { key:'drachenlanze',  name:'Drachenlanze',  g:'f', variant:4, statMult:1.36, weight:0.9, affixBias:{ versatility:4, critDamage:3 },      flavorAffix:'critDamage' },
    { key:'zweihaender',   name:'Zweihänder',    g:'m', variant:5, statMult:1.45, weight:0.7, affixBias:{ damage:5, critDamage:3 },           flavorAffix:'damage' },
    // 🪄 Zauberstäbe – nur für magische Klassen (Heiler & Hexer, material:'zauberstab').
    //    Physische Klassen (Kämpfer/Verteidiger) können sie NICHT tragen. Weniger Schaden,
    //    dafür Magie-/Heilungs-Affixe. Eigene Orb-Farbe (orb) fürs SVG.
    { key:'stab',        name:'Kristallstab', g:'m', variant:6, statMult:0.85, weight:10, affixBias:{ critMagic:4, critDamage:3, attackSpeed:1 },  flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
    { key:'heilstab',    name:'Heilstab',     g:'m', variant:6, statMult:0.70, weight:9,  affixBias:{ lifesteal:4, maxHp:2, critMagic:1 },        flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'runenstab',   name:'Runenstab',    g:'m', variant:6, statMult:0.80, weight:9,  affixBias:{ attackSpeed:4, critMagic:2, versatility:1 },flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'zepter',      name:'Zepter',       g:'n', variant:6, statMult:0.90, weight:6,  affixBias:{ critMagic:3, critDamage:3 },                flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'nekrostab',   name:'Nekromantenstab', g:'m', variant:6, statMult:0.88, weight:5, affixBias:{ lifesteal:4, critMagic:2 },              flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'sturmstab',   name:'Sturmstab',    g:'m', variant:6, statMult:0.86, weight:5,  affixBias:{ attackSpeed:3, critMagic:3 },               flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'erzmagierstab', name:'Erzmagierstab', g:'m', variant:6, statMult:1.00, weight:1.1, affixBias:{ critMagic:5, critDamage:3 },           flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
    // 🪄 Weitere Zauberstäbe (nur magische Klassen). Affixe aus dem Waffen-Pool:
    //    critPhys, critMagic, critDamage, attackSpeed, damage, lifesteal, versatility.
    { key:'flammenstab',   name:'Flammenstab',   g:'m', variant:6, statMult:0.88, weight:6,  affixBias:{ critMagic:4, critDamage:3 },              flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'froststab',     name:'Froststab',     g:'m', variant:6, statMult:0.84, weight:6,  affixBias:{ critMagic:3, attackSpeed:3 },             flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'naturstab',     name:'Naturstab',     g:'m', variant:6, statMult:0.78, weight:5,  affixBias:{ lifesteal:4, critMagic:2 },               flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'schattenstab',  name:'Schattenstab',  g:'m', variant:6, statMult:0.86, weight:5,  affixBias:{ critMagic:3, lifesteal:3 },               flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'arkanstab',     name:'Arkanstab',     g:'m', variant:6, statMult:0.90, weight:5,  affixBias:{ critMagic:4, versatility:2 },             flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
    { key:'blitzstab',     name:'Blitzstab',     g:'m', variant:6, statMult:0.85, weight:5,  affixBias:{ attackSpeed:4, critMagic:2 },             flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'seelenstab',    name:'Seelenstab',    g:'m', variant:6, statMult:0.82, weight:4,  affixBias:{ lifesteal:4, critDamage:2 },              flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'mondstab',      name:'Mondstab',      g:'m', variant:6, statMult:0.80, weight:4,  affixBias:{ versatility:4, critMagic:2 },             flavorAffix:'versatility', material:'zauberstab', orb:'blau' },
    { key:'sonnenstab',    name:'Sonnenstab',    g:'m', variant:6, statMult:0.88, weight:4,  affixBias:{ critMagic:3, critDamage:3 },              flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'donnerzepter',  name:'Donnerzepter',  g:'n', variant:6, statMult:0.92, weight:3,  affixBias:{ critMagic:3, attackSpeed:3 },             flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'weltenstab',    name:'Weltenbaumstab',g:'m', variant:6, statMult:0.84, weight:2.5,affixBias:{ lifesteal:5, critMagic:2 },               flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'urzeitstab',    name:'Urzeitstab',    g:'m', variant:6, statMult:1.05, weight:1.0,affixBias:{ critMagic:5, critDamage:3 },              flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
    // ⚔️ Zusätzliche physische Waffen (Formen 0–5 & 7–12 = neue Silhouetten).
    { key:'breitschwert', name:'Breitschwert', g:'n', variant:0, statMult:1.06, weight:8,  affixBias:{ damage:2, critPhys:2 },             flavorAffix:'damage' },
    { key:'saebel',       name:'Säbel',        g:'m', variant:7, statMult:0.95, weight:7,  affixBias:{ critPhys:3, attackSpeed:2 },       flavorAffix:'attackSpeed' },
    { key:'falchion',     name:'Falchion',     g:'n', variant:7, statMult:1.05, weight:5,  affixBias:{ damage:3, critPhys:2 },            flavorAffix:'damage' },
    { key:'katana',       name:'Katana',       g:'n', variant:7, statMult:1.02, weight:4,  affixBias:{ critPhys:3, critDamage:2 },        flavorAffix:'critDamage' },
    { key:'krummdolch',   name:'Krummdolch',   g:'m', variant:1, statMult:0.82, weight:8,  affixBias:{ critPhys:3, attackSpeed:2 },       flavorAffix:'critPhys' },
    { key:'wurfdolch',    name:'Wurfdolch',    g:'m', variant:1, statMult:0.80, weight:6,  affixBias:{ attackSpeed:4, critPhys:2 },       flavorAffix:'attackSpeed' },
    { key:'stilett',      name:'Stilett',      g:'n', variant:1, statMult:0.84, weight:6,  affixBias:{ critPhys:4, critDamage:2 },        flavorAffix:'critPhys' },
    { key:'keule',        name:'Keule',        g:'f', variant:2, statMult:1.12, weight:7,  affixBias:{ damage:3, versatility:2 },         flavorAffix:'damage' },
    { key:'flegel',       name:'Flegel',       g:'m', variant:2, statMult:1.10, weight:5,  affixBias:{ damage:2, critDamage:3 },          flavorAffix:'critDamage' },
    { key:'wurfbeil',     name:'Wurfbeil',     g:'n', variant:3, statMult:1.05, weight:6,  affixBias:{ attackSpeed:2, damage:2 },         flavorAffix:'damage' },
    { key:'bartaxt',      name:'Bartaxt',      g:'f', variant:3, statMult:1.16, weight:4,  affixBias:{ lifesteal:3, damage:2 },           flavorAffix:'lifesteal' },
    { key:'pike',         name:'Pike',         g:'f', variant:4, statMult:1.10, weight:6,  affixBias:{ versatility:3, damage:2 },         flavorAffix:'versatility' },
    { key:'streithammer', name:'Streithammer', g:'m', variant:5, statMult:1.24, weight:4,  affixBias:{ damage:3, critDamage:2 },          flavorAffix:'critDamage' },
    { key:'kriegskeule',  name:'Kriegskeule',  g:'f', variant:12,statMult:1.20, weight:5,  affixBias:{ damage:3, versatility:2 },         flavorAffix:'damage' },
    { key:'sense',        name:'Sense',        g:'f', variant:9, statMult:1.18, weight:4,  affixBias:{ lifesteal:3, critDamage:2 },       flavorAffix:'lifesteal' },
    { key:'partisane',    name:'Partisane',    g:'f', variant:11,statMult:1.20, weight:4,  affixBias:{ versatility:3, critDamage:2 },     flavorAffix:'versatility' },
    { key:'glefe',        name:'Glefe',        g:'f', variant:11,statMult:1.22, weight:3,  affixBias:{ damage:3, versatility:2 },         flavorAffix:'damage' },
    { key:'doppelaxt',    name:'Doppelaxt',    g:'f', variant:10,statMult:1.28, weight:3,  affixBias:{ damage:3, lifesteal:3 },           flavorAffix:'lifesteal' },
    { key:'henkersbeil',  name:'Henkersbeil',  g:'n', variant:3, statMult:1.28, weight:1.5,affixBias:{ damage:3, critDamage:3 },          flavorAffix:'critDamage' },
    { key:'richtschwert', name:'Richtschwert', g:'n', variant:8, statMult:1.30, weight:2,  affixBias:{ damage:4, critDamage:2 },          flavorAffix:'damage' },
    { key:'kriegssense',  name:'Kriegssense',  g:'f', variant:9, statMult:1.30, weight:2,  affixBias:{ damage:4, lifesteal:3 },           flavorAffix:'lifesteal' },
    { key:'zweihandaxt',  name:'Zweihandaxt',  g:'f', variant:10,statMult:1.34, weight:1.2,affixBias:{ damage:4, lifesteal:3 },           flavorAffix:'damage' },
    // 🪄 Zusätzliche Zauberstäbe (nur magische Klassen). orb = rot/gruen/blau.
    { key:'feuerstab',    name:'Feuerstab',    g:'m', variant:6, statMult:0.88, weight:6,  affixBias:{ critMagic:4, critDamage:3 },       flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'eisstab',      name:'Eisstab',      g:'m', variant:6, statMult:0.84, weight:6,  affixBias:{ critMagic:3, attackSpeed:3 },      flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'giftstab',     name:'Giftstab',     g:'m', variant:6, statMult:0.80, weight:5,  affixBias:{ lifesteal:4, critMagic:2 },        flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'lichtstab',    name:'Lichtstab',    g:'m', variant:6, statMult:0.86, weight:5,  affixBias:{ critMagic:3, versatility:3 },      flavorAffix:'versatility', material:'zauberstab', orb:'rot' },
    { key:'dunkelstab',   name:'Dunkelstab',   g:'m', variant:6, statMult:0.84, weight:5,  affixBias:{ lifesteal:3, critMagic:3 },        flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'donnerstab',   name:'Donnerstab',   g:'m', variant:6, statMult:0.85, weight:5,  affixBias:{ attackSpeed:4, critMagic:2 },      flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'glutstab',     name:'Glutstab',     g:'m', variant:6, statMult:0.87, weight:5,  affixBias:{ critMagic:3, critDamage:3 },       flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'rankenstab',   name:'Rankenstab',   g:'m', variant:6, statMult:0.78, weight:4,  affixBias:{ lifesteal:4, critMagic:2 },        flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'weisheitsstab',name:'Weisheitsstab',g:'m', variant:6, statMult:0.82, weight:5,  affixBias:{ versatility:4, critMagic:2 },      flavorAffix:'versatility', material:'zauberstab', orb:'blau' },
    { key:'sternenstab',  name:'Sternenstab',  g:'m', variant:6, statMult:0.90, weight:4,  affixBias:{ critMagic:4, critDamage:2 },       flavorAffix:'critMagic', material:'zauberstab', orb:'blau' },
    { key:'lebensstab',   name:'Lebensstab',   g:'m', variant:6, statMult:0.72, weight:6,  affixBias:{ lifesteal:4, versatility:2 },      flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'zeitstab',     name:'Zeitstab',     g:'m', variant:6, statMult:0.88, weight:3,  affixBias:{ attackSpeed:5, critMagic:2 },      flavorAffix:'attackSpeed', material:'zauberstab', orb:'blau' },
    { key:'blutstab',     name:'Blutstab',     g:'m', variant:6, statMult:0.86, weight:4,  affixBias:{ lifesteal:5, critDamage:2 },       flavorAffix:'lifesteal', material:'zauberstab', orb:'gruen' },
    { key:'chaosstab',    name:'Chaosstab',    g:'m', variant:6, statMult:0.92, weight:3,  affixBias:{ critDamage:4, critMagic:3 },       flavorAffix:'critDamage', material:'zauberstab', orb:'rot' },
    { key:'drachenstab',  name:'Drachenstab',  g:'m', variant:6, statMult:1.00, weight:1.2,affixBias:{ critMagic:5, critDamage:3 },       flavorAffix:'critMagic', material:'zauberstab', orb:'rot' },
  ],
  // 🛡️ Schild – Pool: armor, maxHp, block, thorns, dodge
  schild: [
    { key:'holzschild',   name:'Holzschild',    g:'m', variant:1, statMult:0.85, weight:11, affixBias:{ armor:2, dodge:3 },  flavorAffix:'dodge' },
    { key:'rundschild',   name:'Rundschild',    g:'m', variant:1, statMult:1.00, weight:10, affixBias:{ armor:2, thorns:3 }, flavorAffix:'thorns' },
    { key:'buckler',      name:'Buckler',       g:'m', variant:2, statMult:0.90, weight:9,  affixBias:{ dodge:3, block:2 },  flavorAffix:'dodge' },
    { key:'wappenschild', name:'Wappenschild',  g:'m', variant:0, statMult:1.05, weight:8,  affixBias:{ armor:3, block:2 },  flavorAffix:'block' },
    { key:'turmschild',   name:'Turmschild',    g:'m', variant:0, statMult:1.10, weight:7,  affixBias:{ armor:3, block:2 },  flavorAffix:'block' },
    { key:'spiegelschild',name:'Spiegelschild', g:'m', variant:4, statMult:1.00, weight:7,  affixBias:{ block:3, dodge:2 },  flavorAffix:'block' },
    { key:'dornenschild', name:'Dornenschild',  g:'m', variant:1, statMult:1.02, weight:5,  affixBias:{ thorns:4, armor:2 }, flavorAffix:'thorns' },
    { key:'pavese',       name:'Pavese',        g:'f', variant:3, statMult:1.15, weight:5,  affixBias:{ armor:2, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'drachenschild',name:'Drachenschild', g:'m', variant:5, statMult:1.08, weight:4,  affixBias:{ armor:3, thorns:2 }, flavorAffix:'armor' },
    { key:'bollwerk',     name:'Bollwerk',      g:'n', variant:3, statMult:1.22, weight:2.5,affixBias:{ armor:4, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'aegis',        name:'Aegis',         g:'f', variant:4, statMult:1.20, weight:1.8,affixBias:{ block:4, dodge:3 },  flavorAffix:'block' },
    { key:'titanenschild',name:'Titanenschild', g:'m', variant:0, statMult:1.32, weight:0.9,affixBias:{ armor:5, maxHp:3 },  flavorAffix:'armor' },
    // Zusätzliche Schilde (Formen 0–4 vorhanden, 5=Drache, 6=Kite, 7=Sechseck, 8=Stachel).
    { key:'lederschild',  name:'Lederschild',     g:'m', variant:1, statMult:0.82, weight:10, affixBias:{ dodge:3, armor:2 },  flavorAffix:'dodge' },
    { key:'eisenschild',  name:'Eisenschild',     g:'m', variant:0, statMult:1.02, weight:9,  affixBias:{ armor:3, block:2 },  flavorAffix:'armor' },
    { key:'bronzeschild', name:'Bronzeschild',    g:'m', variant:0, statMult:0.98, weight:8,  affixBias:{ armor:2, block:2 },  flavorAffix:'armor' },
    { key:'kiteschild',   name:'Kite-Schild',     g:'m', variant:6, statMult:1.06, weight:8,  affixBias:{ armor:3, block:2 },  flavorAffix:'block' },
    { key:'tropfenschild',name:'Tropfenschild',   g:'m', variant:6, statMult:1.00, weight:7,  affixBias:{ armor:2, dodge:3 },  flavorAffix:'dodge' },
    { key:'sechseckschild',name:'Sechseckschild', g:'m', variant:7, statMult:1.08, weight:6,  affixBias:{ block:3, armor:2 },  flavorAffix:'block' },
    { key:'stachelschild',name:'Stachelschild',   g:'m', variant:8, statMult:1.04, weight:6,  affixBias:{ thorns:4, armor:2 }, flavorAffix:'thorns' },
    { key:'igelschild',   name:'Igelschild',      g:'m', variant:8, statMult:1.00, weight:5,  affixBias:{ thorns:4, dodge:2 }, flavorAffix:'thorns' },
    { key:'rabenschild',  name:'Rabenschild',     g:'m', variant:4, statMult:1.00, weight:6,  affixBias:{ dodge:3, block:2 },  flavorAffix:'dodge' },
    { key:'sonnenschild', name:'Sonnenschild',    g:'m', variant:1, statMult:1.06, weight:5,  affixBias:{ armor:2, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'mondschild',   name:'Mondschild',      g:'m', variant:4, statMult:1.02, weight:5,  affixBias:{ dodge:3, armor:2 },  flavorAffix:'dodge' },
    { key:'grabschild',   name:'Grabschild',      g:'m', variant:3, statMult:1.10, weight:4,  affixBias:{ thorns:3, armor:2 }, flavorAffix:'thorns' },
    { key:'phalanx',      name:'Phalanx',         g:'f', variant:7, statMult:1.18, weight:4,  affixBias:{ armor:3, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'wachturmschild',name:'Wachturm-Schild',g:'m', variant:0, statMult:1.15, weight:3,  affixBias:{ armor:4, block:2 },  flavorAffix:'armor' },
    { key:'festungsschild',name:'Festungsschild', g:'m', variant:3, statMult:1.20, weight:2.5,affixBias:{ armor:4, maxHp:3 },  flavorAffix:'maxHp' },
    { key:'drachenhornschild',name:'Drachenhornschild',g:'m',variant:8,statMult:1.18,weight:2,affixBias:{ thorns:4, armor:3 }, flavorAffix:'thorns' },
    { key:'titanenwall',  name:'Titanenwall',     g:'m', variant:0, statMult:1.30, weight:0.9,affixBias:{ armor:5, maxHp:3 },  flavorAffix:'armor' },
    // ⚔️ Nebenhand-Zweitwaffen (NUR Kämpfer) – liegen im Nebenhand-Slot, geben Schaden
    //    (`statType:'damage'`), aber reduziert (statMult ~0.50–0.68 ≈ 60 % einer Hauptwaffe).
    //    `art:'waffe'` → Waffen-Sprite + Waffen-Glow; `affixGroup:'waffe'` → Waffen-Affixe.
    //    Kein `material` (physisch). Können NICHT in den Haupt-Waffenslot (slotKey bleibt 'schild').
    { key:'parierdolch',  name:'Parierdolch',   g:'m', variant:1, statMult:0.55, weight:9, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, attackSpeed:3 }, flavorAffix:'critPhys' },
    { key:'kurzschwert',  name:'Kurzschwert',   g:'n', variant:0, statMult:0.62, weight:9, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:3, critPhys:2 },     flavorAffix:'damage' },
    { key:'handaxt',      name:'Handaxt',       g:'f', variant:3, statMult:0.60, weight:8, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ lifesteal:3, damage:2 },   flavorAffix:'lifesteal' },
    { key:'kriegsdolch',  name:'Kriegsdolch',   g:'m', variant:1, statMult:0.58, weight:8, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, critDamage:2 }, flavorAffix:'critPhys' },
    { key:'faustklinge',  name:'Faustklinge',   g:'f', variant:1, statMult:0.56, weight:8, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:4, critPhys:2 }, flavorAffix:'attackSpeed' },
    { key:'hakenklinge',  name:'Hakenklinge',   g:'f', variant:7, statMult:0.58, weight:7, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, attackSpeed:2 }, flavorAffix:'critPhys' },
    { key:'wurfmesser',   name:'Wurfmesser',    g:'n', variant:1, statMult:0.50, weight:7, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:4, critPhys:2 }, flavorAffix:'attackSpeed' },
    { key:'kampfsichel',  name:'Kampfsichel',   g:'f', variant:9, statMult:0.60, weight:7, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ lifesteal:3, critDamage:2 }, flavorAffix:'lifesteal' },
    { key:'maingauche',   name:'Main-Gauche',   g:'f', variant:1, statMult:0.57, weight:7, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, attackSpeed:2 }, flavorAffix:'critPhys' },
    { key:'bucklerklinge',name:'Buckler-Klinge',g:'f', variant:7, statMult:0.59, weight:6, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:2, versatility:3 },  flavorAffix:'versatility' },
    { key:'sax',          name:'Sax',           g:'m', variant:1, statMult:0.58, weight:7, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:3, critPhys:2 },     flavorAffix:'damage' },
    { key:'kukri',        name:'Kukri',         g:'m', variant:7, statMult:0.60, weight:6, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, lifesteal:2 },  flavorAffix:'critPhys' },
    { key:'stossdolch',   name:'Stoßdolch',     g:'m', variant:1, statMult:0.55, weight:6, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critDamage:3, critPhys:2 }, flavorAffix:'critDamage' },
    { key:'jagdmesser',   name:'Jagdmesser',    g:'n', variant:1, statMult:0.54, weight:6, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:3, critPhys:3 }, flavorAffix:'critPhys' },
    { key:'wurfaxt',      name:'Wurfaxt',       g:'f', variant:3, statMult:0.56, weight:6, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ lifesteal:3, attackSpeed:2 }, flavorAffix:'lifesteal' },
    { key:'kriegssichel', name:'Kriegssichel',  g:'f', variant:9, statMult:0.62, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ lifesteal:4, critDamage:2 }, flavorAffix:'lifesteal' },
    { key:'doppeldolch',  name:'Doppeldolch',   g:'m', variant:1, statMult:0.60, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:4, critDamage:2 }, flavorAffix:'attackSpeed' },
    { key:'kurzaxt',      name:'Kurzaxt',       g:'f', variant:3, statMult:0.62, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:3, lifesteal:2 },   flavorAffix:'damage' },
    { key:'stilettklinge',name:'Stilett-Klinge',g:'f', variant:1, statMult:0.55, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:4, critDamage:2 }, flavorAffix:'critPhys' },
    { key:'dornklinge',   name:'Dornklinge',    g:'f', variant:0, statMult:0.58, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:2, critDamage:3 },  flavorAffix:'critDamage' },
    { key:'faustdolch',   name:'Faustdolch',    g:'m', variant:1, statMult:0.56, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:3, critPhys:3 }, flavorAffix:'attackSpeed' },
    { key:'klauenklinge', name:'Klauenklinge',  g:'f', variant:7, statMult:0.59, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, lifesteal:2 },  flavorAffix:'critPhys' },
    { key:'schattenklinge',name:'Schattenklinge',g:'f',variant:1, statMult:0.63, weight:4, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critDamage:3, critPhys:3 }, flavorAffix:'critDamage' },
    { key:'eisendorn',    name:'Eisendorn',     g:'m', variant:1, statMult:0.57, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ versatility:3, damage:2 },  flavorAffix:'versatility' },
    { key:'kriegshaken',  name:'Kriegshaken',   g:'m', variant:7, statMult:0.58, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ lifesteal:3, critPhys:2 },  flavorAffix:'lifesteal' },
    { key:'spaltbeil',    name:'Spaltbeil',     g:'n', variant:3, statMult:0.64, weight:4, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:3, critDamage:2 },  flavorAffix:'damage' },
    { key:'kurzsaebel',   name:'Kurzsäbel',     g:'m', variant:7, statMult:0.60, weight:5, art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critPhys:3, attackSpeed:2 }, flavorAffix:'critPhys' },
    { key:'brechdolch',   name:'Brechdolch',    g:'m', variant:1, statMult:0.66, weight:2.2,art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ critDamage:4, critPhys:2 }, flavorAffix:'critDamage' },
    { key:'henkerklinge', name:'Henkerklinge',  g:'f', variant:8, statMult:0.68, weight:1.6,art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ damage:4, critDamage:3 },  flavorAffix:'critDamage' },
    { key:'zwillingsklinge',name:'Zwillingsklinge',g:'f',variant:0,statMult:0.66, weight:1.2,art:'waffe', statType:'damage', cat:'waffen', affixGroup:'waffe', affixBias:{ attackSpeed:5, critDamage:3 }, flavorAffix:'attackSpeed' },
    // 🔮 Nebenhand-Kugeln/Orbs (NUR Heiler & Hexer) – `art:'orb'`, `statType:'damage'` (magisch),
    //    reduziert (statMult ~0.50–0.62), gemischter Magie-/Support-Affixpool (`affixGroup:'kugel'`).
    //    `material:'kugel'` nur zur Klassifikation. `orb`-Farbe + variant (0–2) steuern den Look.
    //    Beide Magie-Klassen können beide Flavors tragen (wie bei Zauberstäben).
    // — Heiler-Flavor (leuchtend, grün/blau, support-lastig) —
    { key:'heilkugel',    name:'Heilkugel',     g:'f', variant:0, statMult:0.55, weight:9, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:4, maxHp:2 },       flavorAffix:'lifesteal' },
    { key:'lebensodem',   name:'Lebensodem',    g:'m', variant:2, statMult:0.52, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ maxHp:4, lifesteal:2 },       flavorAffix:'maxHp' },
    { key:'segenskugel',  name:'Segenskugel',   g:'f', variant:1, statMult:0.54, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ versatility:4, maxHp:2 },     flavorAffix:'versatility' },
    { key:'mondkugel',    name:'Mondkugel',     g:'f', variant:0, statMult:0.56, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ critMagic:3, versatility:2 }, flavorAffix:'critMagic' },
    { key:'lichtkugel',   name:'Lichtkugel',    g:'f', variant:1, statMult:0.55, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ versatility:3, critMagic:3 }, flavorAffix:'critMagic' },
    { key:'quellkugel',   name:'Quellkugel',    g:'f', variant:0, statMult:0.53, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:4, maxHp:2 },       flavorAffix:'lifesteal' },
    { key:'naturkugel',   name:'Naturkugel',    g:'f', variant:2, statMult:0.54, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:3, versatility:2 }, flavorAffix:'lifesteal' },
    { key:'friedenskugel',name:'Friedenskugel', g:'f', variant:1, statMult:0.55, weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ versatility:3, maxHp:3 },     flavorAffix:'maxHp' },
    { key:'sonnenkugel',  name:'Sonnenkugel',   g:'f', variant:0, statMult:0.56, weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ critMagic:3, versatility:2 }, flavorAffix:'critMagic' },
    { key:'sternkugel',   name:'Sternenkugel',  g:'f', variant:2, statMult:0.55, weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ critMagic:3, critDamage:3 },  flavorAffix:'critDamage' },
    { key:'reinheitskugel',name:'Reinheitskugel',g:'f',variant:1, statMult:0.54, weight:5, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ versatility:4, maxHp:2 },     flavorAffix:'versatility' },
    { key:'hoffnungskugel',name:'Hoffnungskugel',g:'f',variant:0, statMult:0.55, weight:5, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:3, maxHp:3 },       flavorAffix:'maxHp' },
    { key:'lebenskristall',name:'Lebenskristall',g:'m',variant:1, statMult:0.57, weight:5, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ maxHp:4, lifesteal:3 },       flavorAffix:'maxHp' },
    { key:'heilkristall', name:'Heilkristall',  g:'m', variant:2, statMult:0.58, weight:3, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ versatility:3, critMagic:3 }, flavorAffix:'critMagic' },
    { key:'engelskugel',  name:'Engelskugel',   g:'f', variant:0, statMult:0.60, weight:1.4,art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'blau',  affixBias:{ critMagic:4, versatility:3 }, flavorAffix:'critMagic' },
    // — Hexer-Flavor (dunkel, rot/dunkelgrün, magie/lebensraub-lastig) —
    { key:'seelenkugel',  name:'Seelenkugel',   g:'f', variant:0, statMult:0.55, weight:9, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ lifesteal:4, critMagic:2 },   flavorAffix:'lifesteal' },
    { key:'totenkugel',   name:'Totenkugel',    g:'f', variant:2, statMult:0.54, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:3, critDamage:3 },  flavorAffix:'critDamage' },
    { key:'schattenkugel',name:'Schattenkugel', g:'f', variant:1, statMult:0.56, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critMagic:4, lifesteal:2 },   flavorAffix:'critMagic' },
    { key:'blutkugel',    name:'Blutkugel',     g:'f', variant:0, statMult:0.55, weight:8, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ lifesteal:4, critDamage:2 },  flavorAffix:'lifesteal' },
    { key:'fluchkugel',   name:'Fluchkugel',    g:'f', variant:1, statMult:0.57, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critMagic:4, critDamage:2 },  flavorAffix:'critMagic' },
    { key:'daemonenauge', name:'Dämonenauge',   g:'n', variant:2, statMult:0.56, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critDamage:3, critMagic:3 },  flavorAffix:'critDamage' },
    { key:'chaoskugel',   name:'Chaoskugel',    g:'f', variant:0, statMult:0.58, weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critDamage:4, critMagic:3 },  flavorAffix:'critDamage' },
    { key:'nachtkugel',   name:'Nachtkugel',    g:'f', variant:1, statMult:0.54, weight:7, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:3, critMagic:3 },   flavorAffix:'critMagic' },
    { key:'hexenkugel',   name:'Hexenkugel',    g:'f', variant:0, statMult:0.55, weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critMagic:3, lifesteal:3 },   flavorAffix:'lifesteal' },
    { key:'verderbniskugel',name:'Verderbniskugel',g:'f',variant:2,statMult:0.56,weight:6, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:4, critDamage:2 },  flavorAffix:'lifesteal' },
    { key:'qualkugel',    name:'Qualkugel',     g:'f', variant:1, statMult:0.55, weight:5, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critDamage:3, lifesteal:3 },  flavorAffix:'critDamage' },
    { key:'abgrundkugel', name:'Abgrundkugel',  g:'f', variant:0, statMult:0.57, weight:5, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critMagic:4, critDamage:2 },  flavorAffix:'critMagic' },
    { key:'seelenkristall',name:'Seelenkristall',g:'m',variant:1, statMult:0.58, weight:4, art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'gruen', affixBias:{ lifesteal:4, critMagic:2 },   flavorAffix:'lifesteal' },
    { key:'daemonenkugel',name:'Dämonenkugel',  g:'f', variant:2, statMult:0.60, weight:1.6,art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critDamage:4, critMagic:3 },  flavorAffix:'critDamage' },
    { key:'hoellenauge',  name:'Höllenauge',    g:'n', variant:0, statMult:0.62, weight:1.2,art:'orb', statType:'damage', cat:'waffen', affixGroup:'kugel', material:'kugel', orb:'rot',   affixBias:{ critDamage:5, critMagic:3 },  flavorAffix:'critDamage' },
  ],
  // 💍 Schmuck – Pool: critPhys, critMagic, critDamage, maxHp, attackSpeed, armor, damage, lifesteal, versatility, dodge
  amulett: [
    { key:'kriegsamulett', name:'Kriegsamulett', g:'n', variant:0, statMult:1.00, weight:10, affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'lebensamulett', name:'Lebensamulett', g:'n', variant:1, statMult:1.00, weight:10, affixBias:{ maxHp:3, lifesteal:2 },       flavorAffix:'maxHp' },
    { key:'schutzamulett', name:'Schutzamulett', g:'n', variant:2, statMult:1.00, weight:9,  affixBias:{ armor:3, versatility:2 },     flavorAffix:'versatility' },
    { key:'kritamulett',   name:'Krit-Amulett',  g:'n', variant:3, statMult:1.00, weight:9,  affixBias:{ critPhys:3, critDamage:2 },   flavorAffix:'critPhys' },
    { key:'tempoamulett',  name:'Tempo-Amulett', g:'n', variant:4, statMult:1.00, weight:9,  affixBias:{ attackSpeed:3, dodge:2 },     flavorAffix:'attackSpeed' },
    { key:'raeuberamulett',name:'Räuber-Amulett',g:'n', variant:5, statMult:1.00, weight:8,  affixBias:{ lifesteal:3, critPhys:2 },    flavorAffix:'lifesteal' },
    { key:'magieamulett',  name:'Magie-Amulett', g:'n', variant:5, statMult:1.00, weight:8,  affixBias:{ critMagic:3, critDamage:2 },  flavorAffix:'critMagic' },
    { key:'gluecksamulett',name:'Glücks-Amulett',g:'n', variant:3, statMult:1.00, weight:7,  affixBias:{ dodge:3, critPhys:2 },        flavorAffix:'dodge' },
    { key:'titanamulett',  name:'Titanen-Amulett',g:'n',variant:2, statMult:1.00, weight:6,  affixBias:{ maxHp:3, armor:3 },           flavorAffix:'maxHp' },
    { key:'drachenauge',   name:'Drachenauge',   g:'n', variant:3, statMult:1.05, weight:2,  affixBias:{ critDamage:4, critPhys:3 },   flavorAffix:'critDamage' },
    { key:'phoenixanhaenger',name:'Phönix-Anhänger',g:'m',variant:1,statMult:1.05,weight:1.5,affixBias:{ maxHp:4, lifesteal:3 },       flavorAffix:'lifesteal' },
    // Zusätzlicher Schmuck (Formen 0–5 Rund, 6–8 Tropfen, 9–11 Medaillon).
    { key:'wolfsamulett',  name:'Wolfs-Amulett',  g:'n', variant:0, statMult:1.00, weight:10, affixBias:{ damage:3, attackSpeed:2 },   flavorAffix:'damage' },
    { key:'baerenamulett', name:'Bären-Amulett',  g:'n', variant:2, statMult:1.00, weight:10, affixBias:{ maxHp:3, armor:2 },          flavorAffix:'maxHp' },
    { key:'adleramulett',  name:'Adler-Amulett',  g:'n', variant:4, statMult:1.00, weight:9,  affixBias:{ critPhys:3, dodge:2 },       flavorAffix:'critPhys' },
    { key:'schlangenamulett',name:'Schlangen-Amulett',g:'n',variant:5,statMult:1.00,weight:8, affixBias:{ lifesteal:3, critPhys:2 },   flavorAffix:'lifesteal' },
    { key:'rubinkette',    name:'Rubinkette',     g:'f', variant:0, statMult:1.00, weight:9,  affixBias:{ damage:3, critDamage:2 },    flavorAffix:'critDamage' },
    { key:'saphirkette',   name:'Saphirkette',    g:'f', variant:1, statMult:1.00, weight:9,  affixBias:{ critMagic:3, maxHp:2 },      flavorAffix:'critMagic' },
    { key:'smaragdkette',  name:'Smaragdkette',   g:'f', variant:2, statMult:1.00, weight:9,  affixBias:{ maxHp:3, lifesteal:2 },      flavorAffix:'maxHp' },
    { key:'erdamulett',    name:'Erd-Amulett',    g:'n', variant:2, statMult:1.00, weight:8,  affixBias:{ armor:3, maxHp:2 },          flavorAffix:'armor' },
    { key:'sturmamulett',  name:'Sturm-Amulett',  g:'n', variant:4, statMult:1.00, weight:8,  affixBias:{ attackSpeed:3, critPhys:2 }, flavorAffix:'attackSpeed' },
    { key:'heldenamulett', name:'Helden-Amulett', g:'n', variant:3, statMult:1.00, weight:7,  affixBias:{ damage:3, maxHp:2 },         flavorAffix:'damage' },
    { key:'seelenstein',   name:'Seelenstein',    g:'m', variant:6, statMult:1.00, weight:8,  affixBias:{ lifesteal:3, critMagic:2 },  flavorAffix:'lifesteal' },
    { key:'herzstein',     name:'Herzstein',      g:'m', variant:6, statMult:1.00, weight:7,  affixBias:{ maxHp:4, versatility:2 },    flavorAffix:'maxHp' },
    { key:'blutstein',     name:'Blutstein',      g:'m', variant:7, statMult:1.00, weight:6,  affixBias:{ lifesteal:3, damage:2 },     flavorAffix:'lifesteal' },
    { key:'windamulett',   name:'Wind-Amulett',   g:'n', variant:8, statMult:1.00, weight:7,  affixBias:{ attackSpeed:3, dodge:2 },    flavorAffix:'attackSpeed' },
    { key:'sonnenmedaillon',name:'Sonnenmedaillon',g:'n',variant:9, statMult:1.00, weight:6,  affixBias:{ versatility:3, critMagic:2 },flavorAffix:'versatility' },
    { key:'sternmedaillon',name:'Sternmedaillon', g:'n', variant:10,statMult:1.00, weight:5,  affixBias:{ critMagic:3, critDamage:2 }, flavorAffix:'critDamage' },
    { key:'mondmedaillon', name:'Mondmedaillon',  g:'n', variant:11,statMult:1.00, weight:5,  affixBias:{ dodge:3, versatility:2 },    flavorAffix:'dodge' },
    { key:'drachenherz',   name:'Drachenherz',    g:'n', variant:10,statMult:1.05, weight:1.6,affixBias:{ maxHp:4, damage:3 },         flavorAffix:'maxHp' },
    { key:'weltenstein',   name:'Weltenstein',    g:'m', variant:9, statMult:1.05, weight:1.4,affixBias:{ versatility:4, critMagic:3 },flavorAffix:'versatility' },
  ],
  ring: [
    { key:'siegelring',  name:'Siegelring',       g:'m', variant:0, statMult:1.00, weight:10, affixBias:{ critPhys:3, critDamage:2 }, flavorAffix:'critPhys' },
    { key:'bluttropfen', name:'Bluttropfen-Ring', g:'m', variant:1, statMult:1.00, weight:10, affixBias:{ lifesteal:3, maxHp:2 },       flavorAffix:'lifesteal' },
    { key:'waechterring',name:'Wächterring',      g:'m', variant:2, statMult:1.00, weight:9,  affixBias:{ armor:3, dodge:2 },           flavorAffix:'dodge' },
    { key:'machtring',   name:'Macht-Ring',       g:'m', variant:3, statMult:1.00, weight:9,  affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'vitalring',   name:'Vitalring',        g:'m', variant:4, statMult:1.00, weight:9,  affixBias:{ maxHp:3, armor:2 },           flavorAffix:'maxHp' },
    { key:'talisman',    name:'Talisman',         g:'m', variant:5, statMult:1.00, weight:8,  affixBias:{ versatility:3, attackSpeed:2 }, flavorAffix:'versatility' },
    { key:'arkanring',   name:'Arkan-Ring',       g:'m', variant:5, statMult:1.00, weight:8,  affixBias:{ critMagic:3, critDamage:2 },  flavorAffix:'critMagic' },
    { key:'jagdring',    name:'Jäger-Ring',       g:'m', variant:0, statMult:1.00, weight:7,  affixBias:{ critPhys:3, attackSpeed:2 },  flavorAffix:'attackSpeed' },
    { key:'bollwerkring',name:'Bollwerk-Ring',    g:'m', variant:2, statMult:1.00, weight:6,  affixBias:{ armor:3, maxHp:2 },           flavorAffix:'armor' },
    { key:'sturmring',   name:'Sturm-Ring',       g:'m', variant:4, statMult:1.04, weight:2,  affixBias:{ attackSpeed:4, critPhys:3 },  flavorAffix:'attackSpeed' },
    { key:'drachenring', name:'Drachenring',      g:'m', variant:3, statMult:1.05, weight:1.3, affixBias:{ critDamage:4, damage:3 },    flavorAffix:'critDamage' },
    // Zusätzliche Ringe (Formen 0–5 Einzelstein, 6–8 Doppelstein, 9–11 Siegel).
    { key:'eisenring',   name:'Eisenring',        g:'m', variant:2, statMult:1.00, weight:10, affixBias:{ armor:3, maxHp:2 },           flavorAffix:'armor' },
    { key:'goldring',    name:'Goldring',         g:'m', variant:0, statMult:1.00, weight:10, affixBias:{ damage:2, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'silberreif',  name:'Silberreif',       g:'m', variant:4, statMult:1.00, weight:9,  affixBias:{ dodge:3, attackSpeed:2 },     flavorAffix:'dodge' },
    { key:'rubinring',   name:'Rubinring',        g:'m', variant:0, statMult:1.00, weight:9,  affixBias:{ damage:3, critPhys:2 },       flavorAffix:'critPhys' },
    { key:'saphirreif',  name:'Saphirreif',       g:'m', variant:1, statMult:1.00, weight:9,  affixBias:{ critMagic:3, maxHp:2 },       flavorAffix:'critMagic' },
    { key:'smaragdring', name:'Smaragdring',      g:'m', variant:2, statMult:1.00, weight:9,  affixBias:{ maxHp:3, lifesteal:2 },       flavorAffix:'lifesteal' },
    { key:'schutzring',  name:'Schutz-Ring',      g:'m', variant:2, statMult:1.00, weight:8,  affixBias:{ armor:3, dodge:2 },           flavorAffix:'dodge' },
    { key:'flinkring',   name:'Flink-Ring',       g:'m', variant:4, statMult:1.00, weight:8,  affixBias:{ attackSpeed:4, dodge:2 },     flavorAffix:'attackSpeed' },
    { key:'raubring',    name:'Raub-Ring',        g:'m', variant:5, statMult:1.00, weight:7,  affixBias:{ lifesteal:3, critPhys:2 },    flavorAffix:'lifesteal' },
    { key:'berserkerring',name:'Berserker-Ring',  g:'m', variant:3, statMult:1.00, weight:7,  affixBias:{ damage:3, lifesteal:2 },      flavorAffix:'damage' },
    { key:'weisenring',  name:'Weisen-Ring',      g:'m', variant:5, statMult:1.00, weight:7,  affixBias:{ versatility:3, critMagic:2 }, flavorAffix:'versatility' },
    { key:'zwillingsring',name:'Zwillingsring',   g:'m', variant:6, statMult:1.00, weight:7,  affixBias:{ critPhys:3, attackSpeed:2 },  flavorAffix:'attackSpeed' },
    { key:'paarring',    name:'Paar-Ring',        g:'m', variant:7, statMult:1.00, weight:6,  affixBias:{ damage:2, critDamage:3 },     flavorAffix:'critDamage' },
    { key:'doppelsteinring',name:'Doppelstein-Ring',g:'m',variant:8,statMult:1.00, weight:6,  affixBias:{ critMagic:3, critDamage:2 },  flavorAffix:'critMagic' },
    { key:'wappensiegel',name:'Wappensiegel',     g:'n', variant:9, statMult:1.00, weight:6,  affixBias:{ armor:2, damage:2 },          flavorAffix:'damage' },
    { key:'machtsiegel', name:'Macht-Siegel',     g:'n', variant:10,statMult:1.00, weight:5,  affixBias:{ damage:3, critDamage:2 },     flavorAffix:'critDamage' },
    { key:'ahnensiegel', name:'Ahnen-Siegel',     g:'n', variant:11,statMult:1.00, weight:5,  affixBias:{ versatility:3, maxHp:2 },     flavorAffix:'versatility' },
    { key:'drachensiegel',name:'Drachen-Siegel',  g:'n', variant:11,statMult:1.05, weight:1.4,affixBias:{ critDamage:4, damage:3 },     flavorAffix:'critDamage' },
    { key:'ewigkeitsring',name:'Ewigkeitsring',   g:'m', variant:8, statMult:1.05, weight:1.3,affixBias:{ versatility:4, maxHp:3 },     flavorAffix:'versatility' },
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

// Gewichtete Typ-Auswahl für einen Slot: `weight` steuert die Fund-Häufigkeit
// (hoch = häufig, niedrig = selten). So bleiben die besten Waffen/Rüstungen/
// Schilde selten. Fehlt das Gewicht, gilt ein neutraler Standard.
export function pickItemType(slotKey){
  const list = ITEM_TYPES[artOf(slotKey)];
  if(!list || !list.length) return fallbackType(slotKey);
  let total = 0;
  for(const t of list) total += (t.weight > 0 ? t.weight : 6);
  let r = Math.random() * total;
  for(const t of list){ r -= (t.weight > 0 ? t.weight : 6); if(r < 0) return t; }
  return list[list.length-1];
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

// Material eines Items: stoff/leder/platte (Rüstung) bzw. 'zauberstab' (Stab-Waffe),
// sonst null (physische Waffe/Schild/Schmuck). Die Klassen-Tragbarkeit von
// Waffe & Schild läuft slot-basiert in canEquip (items.js), nicht über das Material.
export function materialOf(item){
  return typeOf(item).material || null;
}
