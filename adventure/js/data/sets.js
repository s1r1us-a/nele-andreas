/* =====================================================================
   KLASSEN-SETS (WoW-artige Tier-Sets). REIN ADDITIV – verändert keine
   bestehende Logik. Ein Set besteht aus 7 Rüstungsteilen und gewährt
   gestaffelte Set-Boni (2/4/6/7 Teile). Jedes Set hat einen eigenen,
   komplett abgehobenen Look (`themeKey`, gerendert in svg-fx.js / item-art.js
   / avatar.js) und gehört fest zu einer Klasse.

   Beschaffung: Set-Teile werden beim „Set-Händler" (ui/setshop.js) gegen die
   Sonderwährung „Tribut-Siegel" gekauft (von Bossen gedroppt, core/sets.js).
   Aufwertung: Set-Teile sind Legendär → nutzen die vorhandene Transzendenz
   (materials.js) und sind damit unbegrenzt aufwertbar – OHNE Schmiede-Eingriff.

   Diese Datei ist reine Daten (keine core-Importe) → von Daten- UND
   Renderer-Schicht gefahrlos importierbar.
   ===================================================================== */
import { SLOTS } from './slots.js';

// Rüstungs-Slots, die zu einem Set zählen (klassisches Tier-Set, 7 Teile).
export const SET_SLOTS = ['kopf','schultern','brust','haende','beine','fuesse','umhang'];

// Sonderwährung für die Set-Beschaffung.
export const SET_TOKEN = { key:'tribut', name:'Tribut-Siegel', icon:'⚜️' };

// Maximal hortbare Tribut-Siegel (Cap). Über dieses Maximum hinaus wird nichts
// mehr gutgeschrieben (siehe core/sets.js awardSetTokens). Im Set-Tab sichtbar.
export const SET_TOKEN_CAP = 250;

// Kosten je Slot (in Tribut-Siegeln). Große Teile kosten mehr.
export const SET_PIECE_COST = {
  kopf:150, schultern:200, brust:240, haende:120, beine:160, fuesse:120, umhang:120,
};
export const setPieceCost = slotKey => SET_PIECE_COST[slotKey] || 50;
export const setFullCost = () => SET_SLOTS.reduce((s,k)=> s+setPieceCost(k), 0);

// Tribut-Siegel-Belohnung pro Bosssieg. Höhere Zonen geben mehr; Farm anteilig.
export function setTokensForKill(bossIndex, isFarm){
  const base = 1 + Math.max(0, bossIndex|0);
  return isFarm ? Math.max(1, Math.round(base * 0.34)) : base;
}

/* ---------------------------------------------------------------------
   SET-DEFINITIONEN
   - classId      : an welche Klasse gebunden (Boni nur für diese Klasse).
   - themeKey     : Visual-Stil (svg-fx.js SET_THEME): molten/bloodshadow/void/holy.
   - material     : Rüstungsmaterial (Tragbarkeit) – passend zur Klasse.
   - statMult     : Primärwert-Faktor (analog ARMOR_MATERIALS).
   - affixBias    : Affix-Gewichtung der Einzelteile (Rüstungs-Pool).
   - flavorAffix  : ab Episch garantierter Affix (Set ist Legendär → immer).
   - bonuses[]    : { need, name, desc, flat?, pct? }
       flat: addiert absolute Werte ins Totals-Bündel (Prozent-Affixe als Bruch).
       pct : multipliziert den summierten Bündelwert (z. B. 0.15 = +15 %).
   --------------------------------------------------------------------- */
export const SETS = {
  // 🔥 VERTEIDIGER – „Höllenwächter": geschmolzene Glut-Platte, Hörnerhelm,
  //    Flammen-Flügelschultern, Totenkopf-Brust. Unkaputtbarer Vergeltungs-Tank.
  hoellenwaechter: {
    id:'hoellenwaechter', classId:'verteidiger', name:'Höllenwächter',
    themeKey:'molten', material:'platte', statMult:1.7,
    accent:'#ff7a2a', accent2:'#ffd36a', glow:'#ff4a14',
    affixBias:{ armor:5, block:3, maxHp:2, versatility:2 }, flavorAffix:'armor',
    // Feste Affixe je Set-Teil (3 pro Slot – wie Legendär). Direkt gesetzt → kein Pool-Filter.
    fixedAffixes:{
      kopf:     ['armor','maxHp','versatility'],
      schultern:['armor','block','thorns'],
      brust:    ['armor','maxHp','block'],
      haende:   ['armor','block','versatility'],
      beine:    ['armor','maxHp','dodge'],
      fuesse:   ['armor','dodge','versatility'],
      umhang:   ['armor','maxHp','thorns'],
    },
    lore:'Geschmiedet im Herzen eines erloschenen Vulkans – die Glut erlischt nie.',
    bonuses:[
      { need:2, name:'Glutpanzer',           desc:'+10 % Rüstung, +400 Leben',          pct:{ armor:0.10 }, flat:{ maxHp:400 } },
      { need:4, name:'Brennende Vergeltung',  desc:'+40 Dornen, +20 Block',              flat:{ thorns:40, block:20 } },
      { need:6, name:'Höllenkern',            desc:'+15 % max. Leben, +8 % Vielseitigkeit', pct:{ maxHp:0.15 }, flat:{ versatility:0.08 } },
      { need:7, name:'Avatar der Glut',       desc:'+20 % Rüstung, +60 Dornen',          pct:{ armor:0.20 }, flat:{ thorns:60 } },
    ],
  },

  // 🗡️ SCHURKE – „Blutschatten": schwarzes Leder, rotglühende Kapuze, rote
  //    Klingen-Spitzen auf den Schultern. Highspeed-Krit-Assassine.
  blutschatten: {
    id:'blutschatten', classId:'schurke', name:'Blutschatten',
    themeKey:'bloodshadow', material:'leder', statMult:1.08,
    accent:'#e01f3a', accent2:'#ff5a4a', glow:'#ff1f2f',
    affixBias:{ critDamage:4, attackSpeed:3, dodge:2, versatility:1 }, flavorAffix:'critDamage',
    // Fokus auf Krit-SCHADEN statt Krit-Chance. critPhys nur als kleiner Rest (Handschuhe).
    // Vielseitigkeit auf 3 Slots (kopf/schultern/umhang) → hebt Grundschlag + Überleben.
    fixedAffixes:{
      kopf:     ['critDamage','attackSpeed','versatility'],
      schultern:['critDamage','versatility','dodge'],
      brust:    ['critDamage','attackSpeed','maxHp'],
      haende:   ['critDamage','attackSpeed','critPhys'],
      beine:    ['critDamage','dodge','attackSpeed'],
      fuesse:   ['critDamage','attackSpeed','dodge'],
      umhang:   ['critDamage','versatility','dodge'],
    },
    lore:'Getränkt im Blut von tausend lautlosen Klingen.',
    bonuses:[
      { need:2, name:'Schattenklingen', desc:'+20 % Krit-Schaden, +6 % Angriffstempo', flat:{ critDamage:0.20, attackSpeed:0.06 } },
      { need:4, name:'Blutrausch',      desc:'+25 % Krit-Schaden, +5 % Ausweichen',     flat:{ critDamage:0.25, dodge:0.05 } },
      { need:6, name:'Lautloser Tod',   desc:'+12 % Angriffstempo, +5 % Phys. Krit',    flat:{ attackSpeed:0.12, critPhys:0.05 } },
      { need:7, name:'Avatar der Schatten', desc:'+40 % Krit-Schaden, +8 % Ausweichen', flat:{ critDamage:0.40, dodge:0.08 } },
    ],
  },

  // 🟣 HEXER – „Leerenfürst": violette Leeren-Robe, glühende Augen,
  //    Geweih-/Dornen-Spitzen-Schultern, leuchtendes Brust-Juwel. Lebensraub-Magier.
  leerenfuerst: {
    id:'leerenfuerst', classId:'hexer', name:'Leerenfürst',
    themeKey:'void', material:'stoff', statMult:0.78,
    accent:'#a24bff', accent2:'#d9b0ff', glow:'#7a2fff',
    affixBias:{ critMagic:4, maxHp:2, versatility:2 }, flavorAffix:'critMagic',
    // Vielseitigkeit auf 3 Slots (kopf/schultern/beine).
    fixedAffixes:{
      kopf:     ['critMagic','maxHp','versatility'],
      schultern:['critMagic','lifesteal','versatility'],
      brust:    ['critMagic','maxHp','lifesteal'],
      haende:   ['critMagic','critDamage','lifesteal'],
      beine:    ['critMagic','maxHp','versatility'],
      fuesse:   ['critMagic','lifesteal','critDamage'],
      umhang:   ['critMagic','critDamage','maxHp'],
    },
    lore:'Gewebt aus dem Stoff zwischen den Welten – die Leere flüstert darin.',
    bonuses:[
      { need:2, name:'Leerenberührung', desc:'+8 % Mag. Krit, +250 Leben',           flat:{ critMagic:0.08, maxHp:250 } },
      { need:4, name:'Seelenfraß',      desc:'+12 % Lebensraub',                       flat:{ lifesteal:0.12 } },
      { need:6, name:'Verdammnis',      desc:'+10 % Mag. Krit, +8 % Vielseitigkeit',  flat:{ critMagic:0.10, versatility:0.08 } },
      { need:7, name:'Avatar der Leere',desc:'+20 % Lebensraub, +25 % Krit-Schaden',  flat:{ lifesteal:0.20, critDamage:0.25 } },
    ],
  },

  // ✨ HEILER – „Morgenröte": weiß-goldene Lichtrobe, Heiligenschein aus
  //    Lichtkugeln, goldene Ranken, Federschultern. Unsterblicher Heiler.
  morgenroete: {
    id:'morgenroete', classId:'heiler', name:'Morgenröte',
    themeKey:'holy', material:'stoff', statMult:0.80,
    accent:'#ffd86a', accent2:'#fff4cf', glow:'#ffe89a',
    affixBias:{ maxHp:4, versatility:3, critMagic:2 }, flavorAffix:'maxHp',
    // Vielseitigkeit auf 4 Slots (kopf/brust/haende/beine) – vorher überladen (7).
    fixedAffixes:{
      kopf:     ['maxHp','versatility','critMagic'],
      schultern:['maxHp','critMagic','armor'],
      brust:    ['maxHp','versatility','critMagic'],
      haende:   ['maxHp','critMagic','versatility'],
      beine:    ['maxHp','versatility','armor'],
      fuesse:   ['maxHp','dodge','critMagic'],
      umhang:   ['maxHp','critMagic','lifesteal'],
    },
    lore:'Im ersten Licht der Morgenröte gewebt – Dunkelheit weicht ihrem Schein.',
    bonuses:[
      { need:2, name:'Segen des Lichts', desc:'+12 % max. Leben, +4 % Vielseitigkeit', pct:{ maxHp:0.12 }, flat:{ versatility:0.04 } },
      { need:4, name:'Heilige Aura',     desc:'+400 Leben, +8 % Mag. Krit',            flat:{ maxHp:400, critMagic:0.08 } },
      { need:6, name:'Lichtquell',       desc:'+15 % max. Leben, +8 % Vielseitigkeit', pct:{ maxHp:0.15 }, flat:{ versatility:0.08 } },
      { need:7, name:'Avatar des Lichts',desc:'+25 % max. Leben, +10 % Vielseitigkeit', pct:{ maxHp:0.25 }, flat:{ versatility:0.10 } },
    ],
  },
};

export const SET_LIST = Object.values(SETS);
export const setById = id => SETS[id] || null;
export const setForClass = classId => SET_LIST.find(s => s.classId === classId) || null;

// Set-Def eines Items (null-sicher) – nur über das additive Feld item.setId.
export const setOf = item => (item && item.setId ? (SETS[item.setId] || null) : null);
// Visual-Theme eines Items (oder null) – für die Renderer (item-art/avatar).
export const setThemeOf = item => { const s = setOf(item); return s ? s.themeKey : null; };
// Genus für den Teil-Namen je Slot (korrekte Anzeige „· Brustpanzer" etc.).
export const setPieceName = (set, slotKey) => set.name + ' · ' + ((SLOTS[slotKey] && SLOTS[slotKey].base) || 'Teil');
