/* =====================================================================
   TALENTBÄUME pro Klasse. Je Klasse 10 Stufen; pro Stufe stehen GENAU 3
   sich GEGENSEITIG AUSSCHLIESSENDE Optionen zur Wahl – man wählt genau eine.

   - Stufe 5 und Stufe 9 sind "Aktiv-Stufen": die 3 Optionen sind AKTIVE
     Fähigkeiten (Kampf-Knöpfe mit Cooldown). Man kann so bis zu 2 aktive
     Fähigkeiten skillen (zusätzlich zur Klassen-Grundfähigkeit).
   - Alle übrigen Optionen sind passive Stat-Boni.

   Struktur:
   - TALENT_TREES[classId] = Array von Stufen (Reihen).
   - Passiv-Knoten: { id, icon, name, mods, keys, desc, effect } (mods → Effekt).
   - Aktiv-Knoten:  zusätzlich { active:{ id, kind, cd, ... } }, mods leer.

   Auswahl-Speicherung: state.character.talents = { stufeIndex: optionId }.
   ===================================================================== */
const MOD_META = {
  damage:{label:'Schaden',pct:false}, maxHp:{label:'Leben',pct:false},
  armor:{label:'Rüstung',pct:false}, critPhys:{label:'Physischer Krit',pct:true},
  critMagic:{label:'Magischer Krit',pct:true}, critDamage:{label:'Krit-Schaden',pct:true},
  attackSpeed:{label:'Angriffstempo',pct:true}, lifesteal:{label:'Lebensraub',pct:true},
  dodge:{label:'Ausweichen',pct:true}, versatility:{label:'Vielseitigkeit',pct:true},
  thorns:{label:'Dornen',pct:false}, block:{label:'Block',pct:false},
};

// Effekt-Helfer: add = flache Boni, mult = prozentuale Boni (auf Bundle-Keys).
function eff(mods){
  return (b)=>{
    if(mods.add)  for(const k in mods.add)  b[k] = (b[k]||0) + mods.add[k];
    if(mods.mult) for(const k in mods.mult) b[k] = (b[k]||0) * (1 + mods.mult[k]);
  };
}
function fmtMod(key, v, isMult){
  const info = MOD_META[key] || { label:key, pct:false };
  const pct = isMult || info.pct;
  const num = pct ? '+'+Math.round(v*100)+' %' : '+'+v;
  return num + ' ' + info.label;
}
function descOf(mods){
  const parts = [];
  if(mods.mult) for(const k in mods.mult) parts.push(fmtMod(k, mods.mult[k], true));
  if(mods.add)  for(const k in mods.add)  parts.push(fmtMod(k, mods.add[k], false));
  return parts.join(' · ');
}
function keysOf(mods){
  const s = new Set();
  if(mods.mult) Object.keys(mods.mult).forEach(k => s.add(k));
  if(mods.add)  Object.keys(mods.add).forEach(k => s.add(k));
  return [...s];
}
// Passiv-Knoten: id, Icon, Name, mods → Effekt/Beschreibung/Keys automatisch.
function node(id, icon, name, mods){
  return { id, icon, name, mods, keys: keysOf(mods), desc: descOf(mods), effect: eff(mods) };
}

// ---- Aktive Fähigkeiten -------------------------------------------------
// Beschreibung einer aktiven Fähigkeit automatisch aus kind + Parametern.
export function descOfActive(a){
  const s = Math.round((a.dur||0)/1000);
  switch(a.kind){
    case 'heal':      return 'Heilt dich sofort um '+Math.round(a.healPct*100)+' % deines max. Lebens';
    case 'burst':     return 'Sofort '+Math.round(a.burstMult*100)+' % Schaden';
    case 'drain':     return 'Sofort '+Math.round(a.burstMult*100)+' % Schaden – heilt dich um den Schaden';
    case 'critBoost': return '+'+Math.round(a.critBonus*100)+' % Krit für '+s+' s';
    case 'dmgBoost':  return '+'+Math.round(a.dmgBonus*100)+' % Schaden für '+s+' s';
    case 'dmgReduce': return '−'+Math.round(a.dmgReduce*100)+' % erlittener Schaden für '+s+' s';
    case 'lifesteal': return '+'+Math.round(a.lifestealBonus*100)+' % Lebensraub für '+s+' s';
  }
  return '';
}
// Aktiv-Knoten: trägt einen `active`-Deskriptor; passiver Effekt ist leer.
function activeNode(id, icon, name, kind, params){
  const active = Object.assign({ id, name, icon, kind }, params);
  active.desc = descOfActive(active);
  const desc = active.desc + ' · CD ' + Math.round(active.cd/1000) + ' s';
  return { id, icon, name, mods:{}, keys:[], desc, effect:()=>{}, active };
}

export const TALENT_TREES = {
  // ---- KÄMPFER (physischer Burst-/Krit-Schaden) --------------------
  kaempfer: [
    [ node('kaempfer_s1_wucht', '💥', 'Wucht',        {mult:{damage:0.08}}),
      node('kaempfer_s1_treff', '🎯', 'Treffsicher',  {add:{critPhys:0.06}}),
      node('kaempfer_s1_flink', '🏃', 'Flink',        {add:{attackSpeed:0.06}}) ],
    [ node('kaempfer_s2_hiebe', '⚔️', 'Schwere Hiebe',{mult:{damage:0.10}}),
      node('kaempfer_s2_brutal','💢', 'Brutalität',   {add:{critDamage:0.25}}),
      node('kaempfer_s2_rasanz','⚡', 'Rasanz',        {add:{attackSpeed:0.08}}) ],
    [ node('kaempfer_s3_klinge','🗡️', 'Scharfe Klinge',{add:{critPhys:0.08}}),
      node('kaempfer_s3_wuchts','💥', 'Wuchtschlag',  {add:{critDamage:0.30}}),
      node('kaempfer_s3_blut',  '🩸', 'Blutdurst',    {add:{lifesteal:0.05}}) ],
    [ node('kaempfer_s4_bers',  '🔥', 'Berserker',    {mult:{damage:0.15}}),
      node('kaempfer_s4_haerte','🐂', 'Kampfhärte',   {mult:{maxHp:0.12}}),
      node('kaempfer_s4_sturm', '⚡', 'Sturmangriff',  {add:{attackSpeed:0.10}}) ],
    [ activeNode('kaempfer_a5_wirbel', '🌀', 'Wirbelsturm', 'burst',     {cd:22000, burstMult:2.5}),
      activeNode('kaempfer_a5_rausch', '🔥', 'Kampfrausch', 'dmgBoost',  {cd:25000, dur:8000, dmgBonus:0.40}),
      activeNode('kaempfer_a5_tanz',   '🌪️', 'Klingentanz', 'critBoost', {cd:25000, dur:7000, critBonus:0.60}) ],
    [ node('kaempfer_s6_meist', '🎯', 'Meisterschütze',{add:{critPhys:0.10}}),
      node('kaempfer_s6_schlae','💥', 'Schlächter',   {add:{critDamage:0.40}}),
      node('kaempfer_s6_vampir','🩸', 'Vampirklinge', {add:{lifesteal:0.06}}) ],
    [ node('kaempfer_s7_kmeist','🗡️', 'Klingenmeister',{mult:{damage:0.18}}),
      node('kaempfer_s7_wind',  '⚡', 'Windläufer',   {add:{attackSpeed:0.10}}),
      node('kaempfer_s7_eisen', '🐂', 'Eisenhaut',    {mult:{maxHp:0.15}}) ],
    [ node('kaempfer_s8_henker','💢', 'Henkersbeil',  {add:{critDamage:0.45}}),
      node('kaempfer_s8_scharf','🎯', 'Scharfschütze',{add:{critPhys:0.10}}),
      node('kaempfer_s8_wut',   '🔥', 'Schlachtwut',  {mult:{damage:0.18}}) ],
    [ activeNode('kaempfer_a9_hinricht','💀', 'Hinrichtung',   'burst',     {cd:30000, burstMult:4.5}),
      activeNode('kaempfer_a9_modus',   '💥', 'Berserkermodus','dmgBoost',  {cd:28000, dur:8000, dmgBonus:0.50}),
      activeNode('kaempfer_a9_blut',    '🩸', 'Blutrausch',    'lifesteal', {cd:28000, dur:8000, lifestealBonus:0.30}) ],
    [ node('kaempfer_s10_fuerst','👑', 'Kriegsfürst',  {mult:{damage:0.25}, add:{attackSpeed:0.12}}),
      node('kaempfer_s10_meist', '⚔️', 'Schlachtmeister',{mult:{damage:0.20}, add:{critPhys:0.12}}),
      node('kaempfer_s10_blut',  '🩸', 'Blutfürst',    {mult:{damage:0.18}, add:{lifesteal:0.10}}) ],
  ],

  // ---- VERTEIDIGER (Verteidigung & Überleben) ----------------------
  verteidiger: [
    [ node('verteidiger_s1_panzer','🛡️', 'Panzerung',   {mult:{armor:0.12}}),
      node('verteidiger_s1_konst', '🐂', 'Konstitution',{mult:{maxHp:0.12}}),
      node('verteidiger_s1_block', '🧱', 'Blockmeister',{add:{block:8}}) ],
    [ node('verteidiger_s2_dornen','🌵', 'Dornen',      {add:{thorns:6}}),
      node('verteidiger_s2_ausw',  '💨', 'Ausweichen',  {add:{dodge:0.05}}),
      node('verteidiger_s2_srpanz','🛡️', 'Schwere Rüstung',{mult:{armor:0.15}}) ],
    [ node('verteidiger_s3_hkonst','🐂', 'Hohe Konstitution',{mult:{maxHp:0.18}}),
      node('verteidiger_s3_stand', '🧱', 'Standhaft',   {add:{block:12}}),
      node('verteidiger_s3_stach', '🌵', 'Stachelpanzer',{add:{thorns:10}}) ],
    [ node('verteidiger_s4_fest',  '🛡️', 'Festung',     {mult:{armor:0.18}}),
      node('verteidiger_s4_wend',  '💨', 'Wendigkeit',  {add:{dodge:0.06}}),
      node('verteidiger_s4_wehr',  '🪓', 'Gegenwehr',   {mult:{damage:0.08}}) ],
    [ activeNode('verteidiger_a5_trotz',  '🛡️', 'Trotzschlag',  'dmgReduce',{cd:24000, dur:8000, dmgReduce:0.55}),
      activeNode('verteidiger_a5_bastion','🐂', 'Letzte Bastion','heal',    {cd:26000, healPct:0.35}),
      activeNode('verteidiger_a5_schild', '🪓', 'Schildschlag', 'burst',    {cd:22000, burstMult:2.0}) ],
    [ node('verteidiger_s6_boll',  '🛡️', 'Bollwerk',    {mult:{armor:0.22}}),
      node('verteidiger_s6_wall',  '🧱', 'Wall',        {add:{block:16}}),
      node('verteidiger_s6_titan', '🐂', 'Titanenhaut', {mult:{maxHp:0.22}}) ],
    [ node('verteidiger_s7_feld',  '🌵', 'Dornenfeld',  {add:{thorns:16}}),
      node('verteidiger_s7_schritt','💨', 'Schattenschritt',{add:{dodge:0.08}}),
      node('verteidiger_s7_bast',  '🛡️', 'Bastion',     {mult:{armor:0.25}}) ],
    [ node('verteidiger_s8_koloss','🐂', 'Koloss',      {mult:{maxHp:0.28}}),
      node('verteidiger_s8_ublock','🧱', 'Unbeugsamer Block',{add:{block:20}}),
      node('verteidiger_s8_vdorn', '🌵', 'Vergeltungsdornen',{add:{thorns:20}}) ],
    [ activeNode('verteidiger_a9_unbeug','🛡️', 'Unbeugsam',  'dmgReduce',{cd:30000, dur:9000, dmgReduce:0.70}),
      activeNode('verteidiger_a9_halten','🐂', 'Standhalten','heal',     {cd:30000, healPct:0.50}),
      activeNode('verteidiger_a9_wucht', '⚔️', 'Schildwucht','burst',    {cd:30000, burstMult:3.0}) ],
    [ node('verteidiger_s10_unersch','👑','Unerschütterlich',{mult:{maxHp:0.30, armor:0.25}}),
      node('verteidiger_s10_wall',   '🧱','Festungswall',    {mult:{armor:0.20}, add:{block:20}}),
      node('verteidiger_s10_dorn',   '🌵','Dornengott',      {mult:{armor:0.20}, add:{thorns:20}}) ],
  ],

  // ---- HEILER (Heilung, Sustain & magischer Support) ---------------
  heiler: [
    [ node('heiler_s1_leben', '💚', 'Lebenskraft',  {mult:{maxHp:0.12}}),
      node('heiler_s1_arkan', '✨', 'Arkane Kraft', {mult:{damage:0.08}}),
      node('heiler_s1_fokus', '🔮', 'Fokus',        {add:{critMagic:0.06}}) ],
    [ node('heiler_s2_ader',  '🩹', 'Aderlass',     {add:{lifesteal:0.05}}),
      node('heiler_s2_viel',  '💎', 'Vielseitig',   {add:{versatility:0.05}}),
      node('heiler_s2_macht', '🌟', 'Zaubermacht',  {mult:{damage:0.12}}) ],
    [ node('heiler_s3_hleben','💚', 'Hohe Lebenskraft',{mult:{maxHp:0.18}}),
      node('heiler_s3_konz',  '💫', 'Konzentration',{add:{critMagic:0.08}}),
      node('heiler_s3_schild','🛡️', 'Magieschild',  {mult:{armor:0.12}}) ],
    [ node('heiler_s4_quell', '🩹', 'Lebensquell',  {add:{lifesteal:0.07}}),
      node('heiler_s4_licht', '🌈', 'Lichtmagie',   {mult:{damage:0.15}}),
      node('heiler_s4_harm',  '💎', 'Harmonie',     {add:{versatility:0.08}}) ],
    [ activeNode('heiler_a5_blitz', '💚', 'Lichtblitz',    'heal',    {cd:24000, healPct:0.40}),
      activeNode('heiler_a5_arkan', '☄️', 'Arkanschlag',   'burst',   {cd:22000, burstMult:2.6}),
      activeNode('heiler_a5_inf',   '🔮', 'Macht-Infusion','dmgBoost',{cd:26000, dur:8000, dmgBonus:0.45}) ],
    [ node('heiler_s6_unsterb','💚', 'Unsterblichkeit',{mult:{maxHp:0.20}}),
      node('heiler_s6_qleben', '🩹', 'Quell des Lebens',{add:{lifesteal:0.08}}),
      node('heiler_s6_erleu',  '💫', 'Erleuchtung', {add:{critMagic:0.10}}) ],
    [ node('heiler_s7_hmagie','🌟', 'Hohe Magie',   {mult:{damage:0.18}}),
      node('heiler_s7_gleich','💎', 'Gleichmut',    {add:{versatility:0.10}}),
      node('heiler_s7_zeit',  '⚡', 'Zeitraffer',   {add:{attackSpeed:0.10}}) ],
    [ node('heiler_s8_ewig',  '💚', 'Ewiges Leben', {mult:{maxHp:0.25}}),
      node('heiler_s8_meist', '🔮', 'Arkanmeister', {add:{critDamage:0.35}}),
      node('heiler_s8_brunn', '🩹', 'Lebensbrunnen',{add:{lifesteal:0.09}}) ],
    [ activeNode('heiler_a9_segen', '🌈', 'Segen des Lichts','heal',     {cd:30000, healPct:0.60}),
      activeNode('heiler_a9_stern', '🌠', 'Sternenregen',    'burst',    {cd:30000, burstMult:4.0}),
      activeNode('heiler_a9_klar',  '✨', 'Arkane Klarheit', 'critBoost',{cd:28000, dur:7000, critBonus:0.70}) ],
    [ node('heiler_s10_hohe',  '👑', 'Hohepriester',   {mult:{maxHp:0.30}, add:{lifesteal:0.10}}),
      node('heiler_s10_avatar','🌟', 'Avatar des Lichts',{mult:{damage:0.25}, add:{critMagic:0.12}}),
      node('heiler_s10_zeit',  '💎', 'Hüter der Zeit', {mult:{damage:0.18}, add:{versatility:0.12}}) ],
  ],

  // ---- HEXER (magischer Lebensraub & Verschlingen) -----------------
  hexer: [
    [ node('hexer_s1_verderb','🔮', 'Verderbnis',   {mult:{damage:0.08}}),
      node('hexer_s1_durst',  '🩸', 'Seelendurst',  {add:{lifesteal:0.05}}),
      node('hexer_s1_fokus',  '💫', 'Dunkler Fokus',{add:{critMagic:0.06}}) ],
    [ node('hexer_s2_macht',  '🌑', 'Schattenmacht',{mult:{damage:0.12}}),
      node('hexer_s2_ader',   '🩸', 'Aderlass',     {add:{lifesteal:0.06}}),
      node('hexer_s2_verfall','💀', 'Verfall',      {add:{critDamage:0.25}}) ],
    [ node('hexer_s3_fluch',  '💫', 'Fluch der Schwäche',{add:{critMagic:0.08}}),
      node('hexer_s3_entzug', '🩸', 'Lebensentzug', {add:{lifesteal:0.07}}),
      node('hexer_s3_blut',   '🧪', 'Hexenblut',    {mult:{maxHp:0.12}}) ],
    [ node('hexer_s4_gewalt', '🌑', 'Finstere Gewalt',{mult:{damage:0.15}}),
      node('hexer_s4_feuer',  '💀', 'Seelenfeuer',  {add:{critDamage:0.30}}),
      node('hexer_s4_pakt',   '🩸', 'Blutpakt',     {add:{lifesteal:0.08}}) ],
    [ activeNode('hexer_a5_ritual', '🩸', 'Aderlass-Ritual','drain',    {cd:22000, burstMult:2.5}),
      activeNode('hexer_a5_brand',  '🔥', 'Schattenbrand',  'dmgBoost', {cd:25000, dur:8000, dmgBonus:0.45}),
      activeNode('hexer_a5_rausch', '🩸', 'Blutrausch',     'lifesteal',{cd:25000, dur:8000, lifestealBonus:0.30}) ],
    [ node('hexer_s6_dunkel','🔮', 'Dunkle Magie', {mult:{damage:0.18}}),
      node('hexer_s6_verdam','💫', 'Verdammnis',   {add:{critMagic:0.10}}),
      node('hexer_s6_vamp',  '🩸', 'Vampirismus',  {add:{lifesteal:0.09}}) ],
    [ node('hexer_s7_brand', '🌑', 'Seelenbrand',  {mult:{damage:0.18}}),
      node('hexer_s7_qual',  '💀', 'Qual',         {add:{critDamage:0.40}}),
      node('hexer_s7_zaeh',  '🧪', 'Zähes Blut',   {mult:{maxHp:0.15}}) ],
    [ node('hexer_s8_blutm', '🩸', 'Blutmagie',    {add:{lifesteal:0.10}}),
      node('hexer_s8_meist', '🔮', 'Schattenmeister',{mult:{damage:0.20}}),
      node('hexer_s8_hexm',  '💫', 'Hexenmeister', {add:{critMagic:0.10}}) ],
    [ activeNode('hexer_a9_fresser','💀', 'Seelenfresser',   'drain',    {cd:30000, burstMult:4.0}),
      activeNode('hexer_a9_explo',  '🌑', 'Schattenexplosion','burst',   {cd:30000, burstMult:4.2}),
      activeNode('hexer_a9_orgie',  '🩸', 'Blutorgie',       'lifesteal',{cd:28000, dur:8000, lifestealBonus:0.40}) ],
    [ node('hexer_s10_daemon','👑', 'Dämonenfürst', {mult:{damage:0.25}, add:{lifesteal:0.12}}),
      node('hexer_s10_herr',  '💀', 'Seelenherr',   {mult:{damage:0.22}, add:{critMagic:0.12}}),
      node('hexer_s10_koenig','🩸', 'Blutkönig',    {mult:{maxHp:0.15}, add:{lifesteal:0.30}}) ],
  ],
};

// Talentbaum einer Klasse (null-sicher, leeres Gerüst als Fallback).
export function talentTreeFor(classId){
  return TALENT_TREES[classId] || [];
}

// Alle Optionen einer Klasse flach (für Lookups).
export function talentNodes(classId){
  return talentTreeFor(classId).flat();
}

// Eindeutige Bundle-Keys, die in den Talenten einer Klasse vorkommen.
export function talentStatKeys(classId){
  const present = new Set();
  for(const n of talentNodes(classId)) for(const k of n.keys) present.add(k);
  return Object.keys(MOD_META).filter(k => present.has(k));
}

// Gewählte Option einer Stufe (optionId oder null).
export function chosenTalentId(state, stufeIndex){
  const ranks = (state && state.character && state.character.talents) || {};
  return ranks[stufeIndex] != null ? ranks[stufeIndex] : null;
}

// Anzahl belegter Stufen.
export function chosenTalentCount(state){
  const ranks = (state && state.character && state.character.talents) || {};
  return Object.keys(ranks).length;
}

// Eine Stufe ist freigeschaltet, wenn es die erste ist oder die vorige belegt ist.
export function stufeUnlocked(state, i){
  return i === 0 || chosenTalentId(state, i-1) != null;
}

// Knoten per Id finden (über alle Stufen einer Klasse).
function nodeById(classId, optionId){
  return talentNodes(classId).find(n => n.id === optionId) || null;
}

// Prüft, ob eine optionId zu einer bestimmten Stufe der Klasse gehört (für Migration).
export function isValidChoice(classId, stufeIndex, optionId){
  const tier = talentTreeFor(classId)[stufeIndex];
  return !!(tier && tier.some(n => n.id === optionId));
}

// Die gewählten AKTIVEN Fähigkeiten (active-Deskriptoren) eines Spielstands.
export function chosenActiveAbilities(state){
  const classId = state && state.character && state.character.classId;
  const ranks = (state && state.character && state.character.talents) || {};
  const out = [];
  for(const key of Object.keys(ranks)){
    const n = nodeById(classId, ranks[key]);
    if(n && n.active) out.push(n.active);
  }
  return out;
}

// Wendet die gewählten (passiven) Talente einer Klasse auf den Stat-Bundle an.
export function applyTalents(state, bundle){
  const classId = state && state.character && state.character.classId;
  const ranks = (state && state.character && state.character.talents) || {};
  for(const key of Object.keys(ranks)){
    const node = nodeById(classId, ranks[key]);
    if(node && typeof node.effect === 'function') node.effect(bundle);
  }
  // Soft-Clamp: Talente dürfen Gear-Caps überschreiten, aber nicht ins Absurde.
  if(bundle.critPhys  > 0.9)  bundle.critPhys  = 0.9;
  if(bundle.critMagic > 0.9)  bundle.critMagic = 0.9;
  if(bundle.attackSpeed > 0.75) bundle.attackSpeed = 0.75;
  return bundle;
}
