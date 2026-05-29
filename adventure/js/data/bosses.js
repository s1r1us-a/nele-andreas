/* =====================================================================
   BOSSE & GEBIETE (Fortschritts-Gate). Phase 1 (#6–#18).
   - state.zone ist der Fortschritts-Index = Index in BOSS_DEFS.
   - Jeder Boss verlangt SPÜRBAR mehr als der Vorgänger (~×1,45 HP/Runde) →
     ohne Item-Grind nicht besiegbar (zusätzlich Soft-Enrage, siehe combat.js).
   - area = Index in ZONES (Name); bg = Bild-Index (0–4); spr = Boss-Sprite (0–4).
     Mehrere Bosse/Gebiete teilen sich vorhandene Grafiken (kein neues Asset nötig).
   ===================================================================== */
import { ASSETS, ENDLESS } from './tuning.js';

// ---- Mechanik-Katalog (für Tooltips, Log & Boss-Info) --------------
export const MECH_DEFS = {
  wut:           { label:'Wut',           emoji:'😡', color:'#ff6b4a', desc:'Unter 30 % HP: Angriff +50 %.' },
  dornen:        { label:'Dornen',        emoji:'🌵', color:'#9acd32', desc:'Reflektiert 15 % erlittenen Schaden.' },
  gift:          { label:'Gift',          emoji:'☠️', color:'#9b59b6', desc:'Stapelndes Gift, Schaden pro Runde.' },
  berserk:       { label:'Berserk',       emoji:'💢', color:'#ff8a3d', desc:'Angriff +3 % kumulativ pro Runde.' },
  betaeubung:    { label:'Betäubung',     emoji:'😵', color:'#7fd0ff', desc:'12 % Chance, dich eine Runde auszusetzen.' },
  regen:         { label:'Regeneration', emoji:'➕', color:'#37d67a', desc:'Heilt alle 3 Runden 4 % max HP.' },
  eispanzer:     { label:'Eispanzer',     emoji:'🛡️', color:'#7fd0ff', desc:'Alle 5 Runden 2 Runden −60 % Schaden.' },
  ruestungsbruch:{ label:'Rüstungsbruch', emoji:'🔨', color:'#c0653a', desc:'Senkt deine Rüstung pro Treffer.' },
  feueratem:     { label:'Feueratem',     emoji:'🔥', color:'#ff8a3d', desc:'Alle 4 Runden Großschlag, ignoriert Rüstung.' },
  lebensentzug:  { label:'Lebensentzug',  emoji:'🩸', color:'#37d67a', desc:'Heilt sich um 40 % des Schadens.' },
  hinrichtung:   { label:'Hinrichtung',   emoji:'⚔️', color:'#ff5a5a', desc:'+100 % Schaden, wenn du unter 25 % HP bist.' },
  frost:         { label:'Frost',         emoji:'❄️', color:'#7fd0ff', desc:'Verlangsamt deinen Angriffstakt.' },
  // ---- NEU (#12) -------------------------------------------------
  enrage:        { label:'Raserei',       emoji:'⏱️', color:'#ff3b3b', desc:'Früher harter Enrage – erzwingt hohen DPS.' },
  add_spawn:     { label:'Beschwörung',   emoji:'👹', color:'#d28bff', desc:'Ruft Diener, die mit der Zeit mehr Schaden machen.' },
  schildphase:   { label:'Schildphase',   emoji:'✨', color:'#9ec5ff', desc:'Wird periodisch kurz unverwundbar.' },
  fluch:         { label:'Fluch',         emoji:'🟣', color:'#a335ee', desc:'Senkt zeitweise deine Krit-Chance & Tempo.' },
  verbrennung:   { label:'Verbrennung',   emoji:'🔥', color:'#ff5a2a', desc:'Starker stapelnder Brand-Schaden.' },
  schwaechung:   { label:'Schwächung',    emoji:'💔', color:'#c0653a', desc:'Reduziert deine Heilung & Lebensraub.' },
  teilung:       { label:'Teilung',       emoji:'➗', color:'#ffd24a', desc:'Bei 50 % HP: Wutausbruch, Angriff stark erhöht.' },
  eskalation:    { label:'Eskalation',    emoji:'📈', color:'#ff7b7b', desc:'Je weniger HP, desto mehr Schaden.' },
};

// ---- Gebiete (Name + Bild-Index 0–4) -------------------------------
export const ZONES = [
  { name:'Blühende Wiesen',   bg:0 },
  { name:'Dunkelwald',        bg:1 },
  { name:'Tiefe Höhlen',      bg:2 },
  { name:'Vulkanschlund',     bg:3 },
  { name:'Frostgipfel',       bg:4 },
  { name:'Versunkene Tiefen', bg:2 },
  { name:'Schattenreich',     bg:1 },
  { name:'Aschewüste',        bg:3 },
  { name:'Himmelszitadelle',  bg:4 },
  { name:'Die Leere',         bg:0 },
];

// Hilfs-Phase: ab HP-Anteil weitere Mechaniken aktivieren (#13)
const phase = (hp, ...add) => ({ hp, add });

// ---- Roster (40 Bosse, danach endlose Skalierung) ------------------
export const BOSS_DEFS = [
  { name:'Grollzahn der Goblin',        area:0, spr:0, maxHp:800,        atk:16,       recPower:70,        mechanic:['wut'] },
  { name:'Borkenschreck der Waldgeist', area:0, spr:1, maxHp:1700,       atk:23,       recPower:150,       mechanic:['dornen'] },
  { name:'Königin Summbrand',           area:0, spr:2, maxHp:3600,       atk:33,       recPower:320,       mechanic:['gift'], loot:{slots:['amulett','ring1']} },
  { name:'Schattenrudel-Alpha',         area:0, spr:3, maxHp:7700,       atk:48,       recPower:680,       mechanic:['berserk'] },
  { name:'Webmutter Schwarzbein',       area:1, spr:1, maxHp:16000,      atk:68,       recPower:1450,      mechanic:['gift','dornen'], loot:{slots:['beine','fuesse']} },
  { name:'Nachtmar der Schrecken',      area:1, spr:0, maxHp:34000,      atk:96,       recPower:3100,      mechanic:['betaeubung'] },
  { name:'Gorrak der Höhlentroll',      area:1, spr:2, maxHp:71000,      atk:136,      recPower:6600,      mechanic:['regen'] },
  { name:'Kristallweber',               area:1, spr:4, maxHp:150000,     atk:194,      recPower:14000,     mechanic:['eispanzer'], loot:{slots:['waffe']} },
  { name:'Erzfresser',                  area:2, spr:3, maxHp:316000,     atk:275,      recPower:29800,     mechanic:['ruestungsbruch','wut'] },
  { name:'Pyraxis der Lavadrache',      area:2, spr:3, maxHp:664000,     atk:390,      recPower:63600,     mechanic:['feueratem'], loot:{slots:['brust','kopf']} },
  { name:'Magmaherz der Elementar',     area:2, spr:4, maxHp:963000,     atk:540,      recPower:92800,     mechanic:['lebensentzug'] },
  { name:'Aschefürst Zinnober',         area:2, spr:0, maxHp:1400000,    atk:760,      recPower:135000,    mechanic:['hinrichtung','berserk'] },
  { name:'Frostherz der Golem',         area:3, spr:4, maxHp:2020000,    atk:1080,     recPower:198000,    mechanic:['eispanzer','regen'], loot:{slots:['schild','schultern']} },
  { name:'Eiskönigin Glacira',          area:3, spr:1, maxHp:2940000,    atk:1530,     recPower:289000,    mechanic:['frost'] },
  { name:'Sturmtitan Boreas',           area:3, spr:2, maxHp:4260000,    atk:2180,     recPower:422000,    mechanic:['berserk','betaeubung'] },
  { name:'Schattendrache Nyx',          area:3, spr:3, maxHp:6180000,    atk:3100,     recPower:616000,    mechanic:['feueratem','lebensentzug'], loot:{slots:['waffe','amulett']} },
  { name:'Der Vergessene Wächter',      area:4, spr:4, maxHp:8960000,    atk:4400,     recPower:899000,    mechanic:['regen','eispanzer','dornen'] },
  { name:'Weltenfresser',               area:4, spr:4, maxHp:13000000,   atk:6240,     recPower:1313000,   mechanic:['hinrichtung','dornen','berserk'] },
  // ---- Versunkene Tiefen ----
  { name:'Tiefenleviathan Abyssal',     area:5, spr:2, maxHp:18840000,   atk:8870,     recPower:1917000,   mechanic:['enrage','schildphase'], phases:[phase(0.5,'wut')] },
  { name:'Korallentyrann Murlok',       area:5, spr:3, maxHp:27300000,   atk:12590,    recPower:2799000,   mechanic:['add_spawn'], loot:{slots:['fuesse','haende','beine']} },
  { name:'Versunkener König Na.this',   area:5, spr:0, maxHp:39600000,   atk:17880,    recPower:4087000,   mechanic:['fluch','frost'] },
  { name:'Gezeitenfürst Maelstrom',     area:5, spr:4, maxHp:57500000,   atk:25380,    recPower:5967000,   mechanic:['verbrennung','lebensentzug'], phases:[phase(0.4,'enrage')] },
  // ---- Schattenreich ----
  { name:'Schattenweber Umbral',        area:6, spr:1, maxHp:83300000,   atk:36040,    recPower:8712000,   mechanic:['schwaechung','gift'], loot:{slots:['umhang','amulett']} },
  { name:'Albtraumfürst Mordeth',       area:6, spr:0, maxHp:120800000,  atk:51180,    recPower:12718000,  mechanic:['teilung'], phases:[phase(0.5,'berserk')] },
  { name:'Leerenpriester Vex',          area:6, spr:3, maxHp:175200000,  atk:72680,    recPower:18569000,  mechanic:['eskalation','fluch'], phases:[phase(0.6,'verbrennung'), phase(0.3,'enrage')] },
  { name:'Seelenschnitter Grimm',       area:6, spr:4, maxHp:254000000,  atk:103200,   recPower:27110000,  mechanic:['schildphase','hinrichtung'], loot:{slots:['waffe']} },
  // ---- Aschewüste ----
  { name:'Ascheboss Cinderon',          area:7, spr:0, maxHp:368000000,  atk:146540,   recPower:39581000,  mechanic:['add_spawn','berserk'], phases:[phase(0.5,'feueratem')] },
  { name:'Magmakoloss Vulcanar',        area:7, spr:3, maxHp:534000000,  atk:208090,   recPower:57788000,  mechanic:['fluch','frost'], loot:{slots:['schild','brust']} },
  { name:'Glutdämon Infernox',          area:7, spr:4, maxHp:774000000,  atk:295490,   recPower:84370000,  mechanic:['verbrennung','lebensentzug'], phases:[phase(0.4,'enrage'), phase(0.2,'hinrichtung')] },
  { name:'Pyroklast der Verbrenner',    area:7, spr:0, maxHp:1120000000, atk:419600,   recPower:123181000, mechanic:['enrage','dornen','verbrennung'] },
  // ---- Himmelszitadelle ----
  { name:'Himmelsrichter Solarius',     area:8, spr:1, maxHp:1630000000, atk:595830,   recPower:179844000, mechanic:['teilung','eskalation'], phases:[phase(0.5,'enrage')], loot:{slots:['amulett','ring1','ring2']} },
  { name:'Sturmgott Tempest',           area:8, spr:2, maxHp:2360000000, atk:846080,   recPower:262500000, mechanic:['schwaechung','ruestungsbruch','gift'] },
  { name:'Lichtbringer Auriel',         area:8, spr:4, maxHp:3420000000, atk:1201430,  recPower:383250000, mechanic:['add_spawn','feueratem'], phases:[phase(0.6,'berserk'), phase(0.3,'enrage')] },
  { name:'Titanenwächter Aegis',        area:8, spr:4, maxHp:4960000000, atk:1706030,  recPower:559545000, mechanic:['eskalation','hinrichtung','berserk'], loot:{slots:['schild','kopf','brust']} },
  // ---- Die Leere ----
  { name:'Voidfürst Nihil',             area:9, spr:3, maxHp:7190000000, atk:2422560,  recPower:816935000, mechanic:['schildphase','regen','lebensentzug'], phases:[phase(0.5,'enrage')] },
  { name:'Entropiebestie Chaos',        area:9, spr:0, maxHp:10420000000, atk:3440040, recPower:1192800000, mechanic:['fluch','verbrennung','frost'] },
  { name:'Der Namenlose',               area:9, spr:4, maxHp:15110000000, atk:4884860, recPower:1741500000, mechanic:['teilung','dornen','eskalation'], phases:[phase(0.6,'enrage'), phase(0.3,'hinrichtung')], loot:{slots:['waffe','amulett']} },
  { name:'Sternenfresser Astaroth',     area:9, spr:3, maxHp:21910000000, atk:6936500, recPower:2542000000, mechanic:['enrage','hinrichtung','schwaechung'] },
  { name:'Urzeit-Drache Bahamut',       area:9, spr:4, maxHp:31770000000, atk:9849830, recPower:3711000000, mechanic:['add_spawn','eskalation','berserk','gift'], phases:[phase(0.5,'feueratem'), phase(0.2,'enrage')] },
  { name:'Erzdämon der Ewigkeit',       area:9, spr:0, maxHp:46070000000, atk:13986750, recPower:5418000000, mechanic:['enrage','teilung','hinrichtung','dornen','eskalation'], phases:[phase(0.7,'verbrennung'), phase(0.4,'add_spawn'), phase(0.2,'schildphase')], loot:{slots:['waffe']} },
];

export const BOSS_COUNT = BOSS_DEFS.length;

// Jenseits der definierten Bosse: gestaffelte Endlos-Skalierung (#14).
export function bossFor(zone){
  if(zone < BOSS_DEFS.length){
    const b = BOSS_DEFS[zone];
    return { ...b, sprite: ASSETS+'boss_'+b.spr+'.png', zone };
  }
  const over = zone - BOSS_DEFS.length + 1;
  const last = BOSS_DEFS[BOSS_DEFS.length-1];
  return {
    ...last,
    name: last.name + ' +' + over,
    maxHp: Math.round(last.maxHp * Math.pow(ENDLESS.hpFactor, over)),
    atk:   Math.round(last.atk   * Math.pow(ENDLESS.atkFactor, over)),
    recPower: Math.round(last.recPower * Math.pow(ENDLESS.powFactor, over)),
    sprite: ASSETS + 'boss_' + last.spr + '.png',
    zone,
  };
}
export const zoneBg = z => ASSETS + 'bg_zone_' + ZONES[bossFor(z).area].bg + '.png';
export const zoneName = z => ZONES[bossFor(z).area].name + (z >= BOSS_DEFS.length ? ' +' + (z-BOSS_DEFS.length+1) : '');

// Garantierte Drop-Seltenheit je Boss-Index (#15): später → besser.
export function guaranteedRarityIndex(bossIndex){
  if(bossIndex >= 34) return 5; // mythisch
  if(bossIndex >= 22) return 4; // legendär
  return 3;                     // episch
}
