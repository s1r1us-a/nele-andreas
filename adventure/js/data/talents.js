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
    case 'echo':      return 'Sofort '+Math.round(a.burstMult*100)+' % Schaden, dann ein Echo mit '+Math.round((a.echoMult||a.burstMult)*100)+' %';
    case 'drain':     return a.dur
                        ? Math.round(a.burstMult*100)+' % Schaden/s für '+s+' s – heilt dich um den verursachten Schaden'
                        : 'Sofort '+Math.round(a.burstMult*100)+' % Schaden – heilt dich um den Schaden';
    case 'critBoost': return '+'+Math.round(a.critBonus*100)+' % Krit für '+s+' s';
    case 'dmgBoost':  return '+'+Math.round(a.dmgBonus*100)+' % Schaden für '+s+' s';
    case 'dmgReduce': return '−'+Math.round(a.dmgReduce*100)+' % erlittener Schaden für '+s+' s';
    case 'lifesteal': return '+'+Math.round(a.lifestealBonus*100)+' % Lebensraub für '+s+' s';
    case 'dot':       return Math.round(a.dotMult*100)+' % Schaden/s für '+s+' s (Schaden über Zeit)';
    case 'hot':       return 'Heilt '+Math.round(a.hotPct*100)+' % max. Leben/s für '+s+' s';
    case 'absorb':    return 'Schild: absorbiert '+Math.round(a.absorbPct*100)+' % max. Leben für '+s+' s';
    case 'cleanse':   return 'Entfernt einen Schwäche-Effekt und heilt um '+Math.round(a.healPct*100)+' %';
    case 'deathsave': return 'Überlebt '+s+' s lang einen tödlichen Treffer (mit '+Math.round(a.revivePct*100)+' % Leben)';
    case 'reflect':   return 'Reflektiert '+Math.round(a.reflectPct*100)+' % erlittenen Schaden für '+s+' s';
    case 'vulnerability': return 'Gegner erleidet +'+Math.round(a.vulnPct*100)+' % Schaden für '+s+' s';
    case 'avatar':    return '+'+Math.round(a.dmgBonus*100)+' % Schaden & −'+Math.round(a.dmgReduce*100)+' % erlittener Schaden für '+s+' s';
    case 'stun':      return Math.round((a.burstMult||0)*100)+' % Schaden, betäubt den Gegner '+Math.round((a.stunDur||0)/1000)+' s';
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

/* Säulen-Konzept (WoW-artig): In jedem Baum gehört Spalte 1/2/3 durchgehend
   DERSELBEN Spezialisierung an. Wer konsequent dieselbe Spalte wählt, baut
   einen kohärenten Spec; die Aktiv-Stufen (5/9) und der Schlussstein (10)
   verstärken genau diese Säule.
     Schurke:     1 Meucheln (Krit/Gift-Burst) · 2 Gesetzloser (Tempo/Lebensraub) · 3 Täuschung (Schatten-Schaden/Ausweichen)
     Verteidiger: 1 Bollwerk (Rüstung/Block) · 2 Rächer (Dornen/Konter)   · 3 Ausweicher (Ausweichen/Leben)
     Heiler:      1 Lichtwirker (Leben/Heilung) · 2 Sternenmagier (Schaden/Krit) · 3 Bewahrer (Vielseitigkeit/Rüstung)
     Hexer:       1 Verderbnis (Schaden/Krit) · 2 Seelensauger (Lebensraub) · 3 Schattenweber (Krit-Schaden/Leben) */
export const TALENT_TREES = {
  // ---- SCHURKE · 1 Meucheln · 2 Gesetzloser · 3 Täuschung ----------
  schurke: [
    [ node('schurke_s1_gift',   '☠️', 'Tödliche Gifte', {add:{critPhys:0.06}}),
      node('schurke_s1_flink',  '⚡', 'Flinke Klingen',  {add:{attackSpeed:0.06}}),
      node('schurke_s1_schatt', '🌑', 'Schattenschritt', {mult:{damage:0.10}}) ],
    [ node('schurke_s2_verst',  '🔪', 'Verstümmeln',     {add:{critPhys:0.04, critDamage:0.15}}),
      node('schurke_s2_saebel', '🗡️', 'Säbelhieb',       {add:{attackSpeed:0.07}}),
      node('schurke_s2_hinter', '🌑', 'Hinterhältig',    {mult:{damage:0.12}}) ],
    [ node('schurke_s3_klinge', '🗡️', 'Scharfe Klingen', {add:{critPhys:0.07}}),
      node('schurke_s3_beute',  '🍷', 'Beutezug',        {add:{lifesteal:0.05}}),
      node('schurke_s3_zaeh',   '🐂', 'Zähigkeit',       {mult:{maxHp:0.12}}) ],
    [ node('schurke_s4_praez',  '🎯', 'Tödliche Präzision',{add:{critPhys:0.05, critDamage:0.20}}),
      node('schurke_s4_kunst',  '⚔️', 'Schwertkunst',    {add:{attackSpeed:0.09}}),
      node('schurke_s4_finst',  '🌑', 'Finsternis',      {mult:{damage:0.15}}) ],
    [ activeNode('schurke_a5_gift',    '☠️', 'Tödliche Toxine','dot',     {cd:18000, dur:8000, tickMs:1000, dotMult:0.55}),
      activeNode('schurke_a5_beute',   '🍀', 'Beutejagd',    'critBoost', {cd:22000, dur:8000, critBonus:0.35}),
      activeNode('schurke_a5_wirbel',  '🌀', 'Klingensturm', 'dot',       {cd:20000, dur:2400, tickMs:600, dotMult:0.9}) ],
    [ node('schurke_s6_meist',  '☠️', 'Meistergift',     {add:{critPhys:0.09}}),
      node('schurke_s6_frei',   '🍷', 'Freibeuter',      {add:{lifesteal:0.07}}),
      node('schurke_s6_hart',   '🐂', 'Abgehärtet',      {mult:{maxHp:0.18}}) ],
    [ node('schurke_s7_enven',  '🔪', 'Auslöschen',      {add:{critPhys:0.06, critDamage:0.25}}),
      node('schurke_s7_tanz',   '💃', 'Klingentanz',     {add:{attackSpeed:0.10}}),
      node('schurke_s7_schatt', '🌑', 'Schattenklinge',  {mult:{damage:0.18}}) ],
    [ node('schurke_s8_aufsch', '🩸', 'Aufschlitzen',    {add:{critPhys:0.06, critDamage:0.30}}),
      node('schurke_s8_raeub',  '🍷', 'Räuberblut',      {add:{lifesteal:0.08}}),
      node('schurke_s8_meuch',  '🌑', 'Meucheltechnik',  {mult:{damage:0.18}}) ],
    [ activeNode('schurke_a9_aderlass','🩸', 'Aderlass',      'vulnerability',{cd:22000, dur:9000, vulnPct:0.30, burstMult:1.6}),
      activeNode('schurke_a9_meuchel', '🥷', 'Meuchelstoß',  'stun',      {cd:24000, stunDur:3000, burstMult:3.5}),
      activeNode('schurke_a9_versch', '💨', 'Schattentanz',  'dmgBoost',  {cd:24000, dur:9000, dmgBonus:0.55}) ],
    [ node('schurke_s10_meuch',  '☠️', 'Großmeuchler',    {mult:{damage:0.18}, add:{critPhys:0.12, critDamage:0.30}}),
      node('schurke_s10_frei',   '🪙', 'Freibeuterkönig', {mult:{damage:0.15}, add:{attackSpeed:0.12, lifesteal:0.10}}),
      node('schurke_s10_meister','👑', 'Meister der Schatten',{mult:{damage:0.25, maxHp:0.15}}) ],
  ],

  // ---- VERTEIDIGER · 1 Bollwerk · 2 Rächer · 3 Ausweicher ----------
  verteidiger: [
    [ node('verteidiger_s1_panzer','🛡️', 'Panzerung',   {mult:{armor:0.12}}),
      node('verteidiger_s1_block', '🌵', 'Dornenhaut',  {add:{thorns:6}}),
      node('verteidiger_s1_konst', '🐂', 'Konstitution',{mult:{maxHp:0.12}}) ],
    [ node('verteidiger_s2_srpanz','🧱', 'Schwere Rüstung',{add:{block:10}}),
      node('verteidiger_s2_dornen','🌵', 'Vergeltung',  {add:{thorns:8}}),
      node('verteidiger_s2_ausw',  '💨', 'Ausweichen',  {add:{dodge:0.06}}) ],
    [ node('verteidiger_s3_stand', '🧱', 'Standhaft',   {add:{block:12}}),
      node('verteidiger_s3_stach', '🌵', 'Stachelpanzer',{add:{thorns:10}}),
      node('verteidiger_s3_hkonst','🐂', 'Hohe Konstitution',{mult:{maxHp:0.18}}) ],
    [ node('verteidiger_s4_fest',  '🛡️', 'Festung',     {mult:{armor:0.18}}),
      node('verteidiger_s4_wehr',  '🪓', 'Gegenwehr',   {mult:{damage:0.12}, add:{thorns:6}}),
      node('verteidiger_s4_wend',  '💨', 'Wendigkeit',  {add:{dodge:0.07}}) ],
    [ activeNode('verteidiger_a5_wurf',   '🛡️', 'Schildwurf',   'vulnerability',{cd:20000, dur:8000, vulnPct:0.30, burstMult:1.5}),
      activeNode('verteidiger_a5_vergelt','🪞', 'Vergeltung',   'reflect',  {cd:24000, dur:8000, reflectPct:0.45}),
      activeNode('verteidiger_a5_bastion','🐂', 'Letzte Bastion','absorb',  {cd:24000, dur:10000, absorbPct:0.45}) ],
    [ node('verteidiger_s6_boll',  '🛡️', 'Bollwerk',    {mult:{armor:0.22}}),
      node('verteidiger_s6_wall',  '🌵', 'Klingenwall', {add:{thorns:14}}),
      node('verteidiger_s6_titan', '🐂', 'Titanenhaut', {mult:{maxHp:0.22}}) ],
    [ node('verteidiger_s7_bast',  '🧱', 'Bastion',     {add:{block:18}}),
      node('verteidiger_s7_feld',  '🌵', 'Dornenfeld',  {add:{thorns:16}}),
      node('verteidiger_s7_schritt','💨', 'Schattenschritt',{add:{dodge:0.08}}) ],
    [ node('verteidiger_s8_ublock','🧱', 'Unbeugsamer Block',{add:{block:20}}),
      node('verteidiger_s8_vdorn', '🌵', 'Vergeltungsdornen',{add:{thorns:20}}),
      node('verteidiger_s8_koloss','🐂', 'Koloss',      {mult:{maxHp:0.28}}) ],
    [ activeNode('verteidiger_a9_avatar','🌟', 'Avatar des Wächters','avatar',{cd:32000, dur:8000, dmgBonus:0.40, dmgReduce:0.40}),
      activeNode('verteidiger_a9_wall',  '✨', 'Letzter Wall','deathsave', {cd:40000, dur:8000, revivePct:0.30}),
      activeNode('verteidiger_a9_unbeug','🛡️', 'Unbeugsam',  'dmgReduce',{cd:30000, dur:9000, dmgReduce:0.70}) ],
    [ node('verteidiger_s10_wall',   '🧱','Festungswall',    {mult:{armor:0.25}, add:{block:20}}),
      node('verteidiger_s10_dorn',   '🌵','Dornengott',      {mult:{armor:0.15, damage:0.12}, add:{thorns:24}}),
      node('verteidiger_s10_unersch','👑','Unerschütterlich',{mult:{maxHp:0.30, armor:0.20}, add:{dodge:0.06}}) ],
  ],

  // ---- HEILER · 1 Lichtwirker · 2 Sternenmagier · 3 Bewahrer -------
  heiler: [
    [ node('heiler_s1_leben', '💚', 'Lebenskraft',  {mult:{maxHp:0.12}}),
      node('heiler_s1_arkan', '✨', 'Arkane Kraft', {mult:{damage:0.10}}),
      node('heiler_s1_fokus', '💎', 'Innere Ruhe',  {add:{versatility:0.05}}) ],
    [ node('heiler_s2_ader',  '🩹', 'Aderlass',     {add:{lifesteal:0.05}}),
      node('heiler_s2_macht', '🌟', 'Zaubermacht',  {mult:{damage:0.12}}),
      node('heiler_s2_viel',  '💎', 'Vielseitig',   {add:{versatility:0.06}}) ],
    [ node('heiler_s3_hleben','💚', 'Hohe Lebenskraft',{mult:{maxHp:0.18}}),
      node('heiler_s3_konz',  '💫', 'Konzentration',{add:{critMagic:0.08}}),
      node('heiler_s3_schild','🛡️', 'Magieschild',  {mult:{armor:0.15}}) ],
    [ node('heiler_s4_quell', '🩹', 'Lebensquell',  {add:{lifesteal:0.07}}),
      node('heiler_s4_licht', '🌈', 'Lichtmagie',   {mult:{damage:0.15}}),
      node('heiler_s4_harm',  '💎', 'Harmonie',     {add:{versatility:0.08}}) ],
    [ activeNode('heiler_a5_verjueng','🍃', 'Verjüngung',   'hot',     {cd:20000, dur:8000, tickMs:1000, hotPct:0.08}),
      activeNode('heiler_a5_arkan', '☄️', 'Arkanschlag',   'echo',    {cd:20000, burstMult:1.6, echoMult:1.0, echoDelay:500}),
      activeNode('heiler_a5_schild','🛡️', 'Schutzschild',  'absorb',  {cd:24000, dur:10000, absorbPct:0.40}) ],
    [ node('heiler_s6_unsterb','💚', 'Unsterblichkeit',{mult:{maxHp:0.20}}),
      node('heiler_s6_erleu',  '💫', 'Erleuchtung', {add:{critMagic:0.10}}),
      node('heiler_s6_qleben', '💎', 'Gleichmut',   {add:{versatility:0.10}}) ],
    [ node('heiler_s7_gleich','🩹', 'Lebensbrunnen',{add:{lifesteal:0.09}}),
      node('heiler_s7_hmagie','🌟', 'Hohe Magie',   {mult:{damage:0.18}}),
      node('heiler_s7_zeit',  '🛡️', 'Geistschild',  {mult:{armor:0.18}}) ],
    [ node('heiler_s8_ewig',  '💚', 'Ewiges Leben', {mult:{maxHp:0.25}}),
      node('heiler_s8_meist', '🔮', 'Arkanmeister', {add:{critMagic:0.06, critDamage:0.30}}),
      node('heiler_s8_brunn', '💎', 'Bewahrung',    {add:{versatility:0.12}}) ],
    [ activeNode('heiler_a9_engel', '😇', 'Engelsgeist',     'hot',      {cd:26000, dur:6000, tickMs:1000, hotPct:0.18}),
      activeNode('heiler_a9_stern', '🌠', 'Sternenregen',    'dot',      {cd:24000, dur:6000, tickMs:1000, dotMult:0.85}),
      activeNode('heiler_a9_rein',  '💧', 'Reinigung',       'cleanse',  {cd:18000, healPct:0.25}) ],
    [ node('heiler_s10_hohe',  '👑', 'Hohepriester',   {mult:{maxHp:0.30}, add:{lifesteal:0.12}}),
      node('heiler_s10_avatar','🌟', 'Avatar des Lichts',{mult:{damage:0.25}, add:{critMagic:0.12}}),
      node('heiler_s10_zeit',  '💎', 'Hüter der Zeit', {mult:{damage:0.12, armor:0.15}, add:{versatility:0.12}}) ],
  ],

  // ---- HEXER · 1 Verderbnis · 2 Seelensauger · 3 Schattenweber -----
  hexer: [
    [ node('hexer_s1_verderb','🔮', 'Verderbnis',   {mult:{damage:0.10}}),
      node('hexer_s1_durst',  '🩸', 'Seelendurst',  {add:{lifesteal:0.05}}),
      node('hexer_s1_fokus',  '🧪', 'Verderbtes Blut',{mult:{maxHp:0.12}}) ],
    [ node('hexer_s2_macht',  '🌑', 'Schattenmacht',{mult:{damage:0.12}}),
      node('hexer_s2_ader',   '🩸', 'Aderlass',     {add:{lifesteal:0.06}}),
      node('hexer_s2_verfall','💀', 'Verfall',      {add:{critDamage:0.25}}) ],
    [ node('hexer_s3_fluch',  '💫', 'Fluch der Schwäche',{add:{critMagic:0.08}}),
      node('hexer_s3_entzug', '🩸', 'Lebensentzug', {add:{lifesteal:0.07}}),
      node('hexer_s3_blut',   '🧪', 'Hexenblut',    {mult:{maxHp:0.15}}) ],
    [ node('hexer_s4_gewalt', '🌑', 'Finstere Gewalt',{mult:{damage:0.15}}),
      node('hexer_s4_pakt',   '🩸', 'Blutpakt',     {add:{lifesteal:0.08}}),
      node('hexer_s4_feuer',  '💀', 'Seelenfeuer',  {add:{critMagic:0.05, critDamage:0.25}}) ],
    [ activeNode('hexer_a5_verderb','🟣', 'Verderbnis',     'drain',    {cd:22000, dur:6000, tickMs:1000, burstMult:0.70}),
      activeNode('hexer_a5_ritual', '🩸', 'Aderlass-Ritual','drain',    {cd:20000, dur:4000, tickMs:1000, burstMult:0.65}),
      activeNode('hexer_a5_furcht', '💀', 'Schattenblitz',  'burst',    {cd:20000, burstMult:2.6}) ],
    [ node('hexer_s6_dunkel','🔮', 'Dunkle Magie', {mult:{damage:0.18}}),
      node('hexer_s6_vamp',  '🩸', 'Vampirismus',  {add:{lifesteal:0.09}}),
      node('hexer_s6_verdam','💀', 'Verdammnis',   {add:{critMagic:0.05, critDamage:0.30}}) ],
    [ node('hexer_s7_brand', '🌑', 'Seelenbrand',  {mult:{damage:0.18}}),
      node('hexer_s7_zaeh',  '🩸', 'Zähes Blut',   {add:{lifesteal:0.10}}),
      node('hexer_s7_qual',  '💀', 'Qual',         {add:{critDamage:0.40}}) ],
    [ node('hexer_s8_meist', '🔮', 'Schattenmeister',{mult:{damage:0.20}}),
      node('hexer_s8_blutm', '🩸', 'Blutmagie',    {add:{lifesteal:0.10}}),
      node('hexer_s8_hexm',  '💫', 'Hexenmeister', {add:{critMagic:0.06, critDamage:0.25}}) ],
    [ activeNode('hexer_a9_chaos',  '☄️', 'Chaosregen',      'dot',      {cd:24000, dur:7000, tickMs:1000, dotMult:0.80}),
      activeNode('hexer_a9_stein',  '💜', 'Seelenfresser',   'drain',    {cd:26000, dur:6000, tickMs:1000, burstMult:0.95}),
      activeNode('hexer_a9_orgie',  '🩸', 'Blutritual',      'lifesteal',{cd:26000, dur:8000, lifestealBonus:0.30}) ],
    [ node('hexer_s10_herr',  '💀', 'Seelenherr',   {mult:{damage:0.25}, add:{critMagic:0.12}}),
      node('hexer_s10_koenig','🩸', 'Blutkönig',    {mult:{damage:0.15}, add:{lifesteal:0.28}}),
      node('hexer_s10_daemon','👑', 'Dämonenfürst', {mult:{damage:0.18, maxHp:0.15}, add:{critDamage:0.40}}) ],
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
