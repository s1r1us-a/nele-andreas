/* =====================================================================
   SEKUNDÄR-STATS (Affixe). Phase 2 (#20): mehr Affix-Typen.
   pct:true  -> Wert ist ein Bruch (0.05 = 5%), wird als % angezeigt
   pct:false -> flacher Wert
   ===================================================================== */
export const AFFIX_DEFS = {
  critChance:  { label:'Krit-Chance',     pct:true,  base:0.03, perIlvl:0.0015, cap:0.50 },
  critDamage:  { label:'Krit-Schaden',    pct:true,  base:0.15, perIlvl:0.006,  cap:2.00 },
  maxHp:       { label:'Lebenspunkte',    pct:false, base:12,   perIlvl:1.4 },
  attackSpeed: { label:'Angriffstempo',   pct:true,  base:0.03, perIlvl:0.0012, cap:0.40 },
  armor:       { label:'Rüstung',         pct:false, base:3,    perIlvl:0.5 },
  damage:      { label:'Schaden',         pct:false, base:4,    perIlvl:0.6 },
  // ---- NEU (#20) ---------------------------------------------------
  lifesteal:   { label:'Lebensraub',      pct:true,  base:0.02, perIlvl:0.0010, cap:0.40 },
  dodge:       { label:'Ausweichen',      pct:true,  base:0.02, perIlvl:0.0008, cap:0.35 },
  block:       { label:'Block',           pct:false, base:2,    perIlvl:0.4 },
  versatility: { label:'Vielseitigkeit',  pct:true,  base:0.02, perIlvl:0.0009, cap:0.30 },
  thorns:      { label:'Dornen',          pct:false, base:3,    perIlvl:0.5 },
};
export const AFFIX_KEYS = Object.keys(AFFIX_DEFS);

// Welche Affixe können je Slot/Kategorie rollen
export const AFFIX_POOL = {
  waffe:   ['critChance','critDamage','attackSpeed','damage','lifesteal','versatility'],
  schild:  ['armor','maxHp','block','thorns','dodge'],
  ruestung:['armor','maxHp','attackSpeed','dodge','block','versatility'],
  schmuck: ['critChance','critDamage','maxHp','attackSpeed','armor','damage','lifesteal','versatility','dodge'],
};
export function affixPool(slotKey){
  if(slotKey==='waffe') return AFFIX_POOL.waffe;
  if(slotKey==='schild') return AFFIX_POOL.schild;
  if(slotKey==='amulett'||slotKey==='ring1'||slotKey==='ring2') return AFFIX_POOL.schmuck;
  return AFFIX_POOL.ruestung;
}

// Gewichteter Pool für einen Item-Typ: jeder Affix-Key kommt entsprechend
// itemType.affixBias mehrfach vor (Default-Gewicht 1). Nur pool-gültige
// Affixe wirken. Ziehen erfolgt ohne Zurücklegen (alle Kopien per Key raus).
export function weightedAffixPool(slotKey, itemType){
  const base = affixPool(slotKey);
  const bias = (itemType && itemType.affixBias) || {};
  const out = [];
  for(const k of base){
    const w = Math.max(1, bias[k] || 1);
    for(let i=0;i<w;i++) out.push(k);
  }
  return out;
}

// Anzahl Affixe je Seltenheit (Funktion = variabel)
export const AFFIX_COUNT = {
  gewoehnlich:0, ungewoehnlich:1, selten:2,
  episch: ()=> 2 + (Math.random()<0.5 ? 1 : 0),
  legendaer:3,
  mythisch:4,
};

// Anzeige-String für einen Affix-Wert
export function fmtAffix(key, v){
  const d = AFFIX_DEFS[key];
  return (d.pct ? '+'+Math.round(v*100)+'%' : '+'+v) + ' ' + d.label;
}
