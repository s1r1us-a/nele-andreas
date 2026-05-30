/* =====================================================================
   TALENTBÄUME pro Klasse. Je Klasse 10 Stufen; pro Stufe stehen 2–3
   sich GEGENSEITIG AUSSCHLIESSENDE Talente zur Wahl – man wählt genau
   eines pro Stufe.

   Struktur:
   - TALENT_TREES[classId] = Array von Stufen (Reihen).
   - Jede Stufe = Array von Optionen { id, icon, name, mods, keys, desc, effect }.
   - mods = { add:{...}, mult:{...} } auf Bundle-Keys (recomputeTotals).
   - desc/keys werden AUTOMATISCH aus mods erzeugt (eine Quelle = mods),
     sodass UI Beschreibung & Erklärung ableiten kann.

   Auswahl-Speicherung: state.character.talents = { stufeIndex: optionId }.
   - Eine Stufe ist erst wählbar, wenn die vorige belegt ist (sequentiell).
   - Jede Wahl kostet 1 Talentpunkt (1 je Level). Respec (Gold) in der UI.
   ===================================================================== */
import { STAT_INFO } from './statHelp.js';

// Effekt-Helfer: add = flache Boni, mult = prozentuale Boni (auf Bundle-Keys).
// Bundle-Keys: armor, damage, maxHp, critPhys, critMagic, critDamage,
//              attackSpeed, lifesteal, dodge, block, versatility, thorns.
function eff(mods){
  return (b)=>{
    if(mods.add)  for(const k in mods.add)  b[k] = (b[k]||0) + mods.add[k];
    if(mods.mult) for(const k in mods.mult) b[k] = (b[k]||0) * (1 + mods.mult[k]);
  };
}
// Anzeige eines Einzel-Mods: mult IMMER als %, add je nach Wert-Typ (% oder flach).
function fmtMod(key, v, isMult){
  const info = STAT_INFO[key] || { label:key, pct:false };
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
// Talent-Knoten: id, Icon, Name, mods → Effekt/Beschreibung/Keys automatisch.
function node(id, icon, name, mods){
  return { id, icon, name, mods, keys: keysOf(mods), desc: descOf(mods), effect: eff(mods) };
}

export const TALENT_TREES = {
  // ---- KÄMPFER (physisch, ausgewogen) ------------------------------
  kaempfer: [
    [ node('kaempfer_s1_wucht',  '💥', 'Wucht',      {mult:{damage:0.08}}),
      node('kaempfer_s1_zaeh',   '🪨', 'Zähigkeit',  {mult:{maxHp:0.10}}),
      node('kaempfer_s1_flink',  '🏃', 'Flink',      {add:{attackSpeed:0.06}}) ],
    [ node('kaempfer_s2_klinge', '🗡️', 'Scharfe Klinge', {add:{critPhys:0.06}}),
      node('kaempfer_s2_panzer', '🛡️', 'Panzerung',  {mult:{armor:0.12}}) ],
    [ node('kaempfer_s3_brutal', '💢', 'Brutalität', {add:{critDamage:0.25}}),
      node('kaempfer_s3_blut',   '🩸', 'Blutdurst',  {add:{lifesteal:0.04}}) ],
    [ node('kaempfer_s4_hiebe',  '⚔️', 'Schwere Hiebe', {mult:{damage:0.12}}),
      node('kaempfer_s4_rasanz', '⚡', 'Rasanz',     {add:{attackSpeed:0.08}}) ],
    [ node('kaempfer_s5_treff',  '🎯', 'Treffsicher', {add:{critPhys:0.08}}),
      node('kaempfer_s5_konst',  '🐂', 'Konstitution', {mult:{maxHp:0.15}}) ],
    [ node('kaempfer_s6_berserk','🔥', 'Berserker',  {mult:{damage:0.15}}),
      node('kaempfer_s6_dornen', '🌵', 'Dornenhaut', {add:{thorns:6}}) ],
    [ node('kaempfer_s7_wucht',  '💥', 'Wuchtschlag', {add:{critDamage:0.35}}),
      node('kaempfer_s7_boll',   '🛡️', 'Bollwerk',   {mult:{armor:0.18}}) ],
    [ node('kaempfer_s8_sturm',  '⚡', 'Sturmangriff', {add:{attackSpeed:0.10}}),
      node('kaempfer_s8_vampir', '🩸', 'Vampirklinge', {add:{lifesteal:0.06}}) ],
    [ node('kaempfer_s9_meister','🎯', 'Meisterschütze', {add:{critPhys:0.10}}),
      node('kaempfer_s9_klinge', '🗡️', 'Klingenmeister', {mult:{damage:0.18}}) ],
    [ node('kaempfer_s10_fuerst','👑', 'Kriegsfürst', {mult:{damage:0.25}, add:{attackSpeed:0.10}}),
      node('kaempfer_s10_unbez', '🛡️', 'Unbezwingbar', {mult:{maxHp:0.25, armor:0.20}}) ],
  ],

  // ---- HEILER (magisch, starke Heilung) ----------------------------
  heiler: [
    [ node('heiler_s1_arkan',  '✨', 'Arkane Kraft', {mult:{damage:0.08}}),
      node('heiler_s1_leben',  '💚', 'Lebenskraft',  {mult:{maxHp:0.12}}),
      node('heiler_s1_fokus',  '🔮', 'Fokus',        {add:{critMagic:0.06}}) ],
    [ node('heiler_s2_macht',  '🌟', 'Zaubermacht',  {mult:{damage:0.12}}),
      node('heiler_s2_ader',   '🩹', 'Aderlass',     {add:{lifesteal:0.05}}) ],
    [ node('heiler_s3_konz',   '💫', 'Konzentration', {add:{critMagic:0.08}}),
      node('heiler_s3_schild', '🛡️', 'Magieschild',  {mult:{armor:0.12}}) ],
    [ node('heiler_s4_schnell','⚡', 'Schnelles Wirken', {add:{attackSpeed:0.08}}),
      node('heiler_s4_viel',   '💎', 'Vielseitig',   {add:{versatility:0.05}}) ],
    [ node('heiler_s5_licht',  '🌈', 'Lichtmagie',   {mult:{damage:0.15}}),
      node('heiler_s5_hleben', '💚', 'Hohe Lebenskraft', {mult:{maxHp:0.18}}) ],
    [ node('heiler_s6_verheer','🔥', 'Verheerung',   {add:{critDamage:0.30}}),
      node('heiler_s6_quell',  '🩹', 'Lebensquell',  {add:{lifesteal:0.07}}) ],
    [ node('heiler_s7_erleucht','💫','Erleuchtung',  {add:{critMagic:0.10}}),
      node('heiler_s7_zeit',   '⚡', 'Zeitraffer',   {add:{attackSpeed:0.10}}) ],
    [ node('heiler_s8_hmagie', '🌟', 'Hohe Magie',   {mult:{damage:0.18}}),
      node('heiler_s8_harm',   '💎', 'Harmonie',     {add:{versatility:0.08}}) ],
    [ node('heiler_s9_meister','🔮', 'Arkanmeister', {add:{critDamage:0.40}}),
      node('heiler_s9_unsterb','💚', 'Unsterblichkeit', {mult:{maxHp:0.22}}) ],
    [ node('heiler_s10_erz',   '👑', 'Erzmagier',    {mult:{damage:0.28}, add:{critMagic:0.12}}),
      node('heiler_s10_avatar','🌟', 'Avatar des Lichts', {mult:{maxHp:0.30}, add:{lifesteal:0.10}}) ],
  ],

  // ---- VERTEIDIGER (Tank, sehr robust) -----------------------------
  verteidiger: [
    [ node('verteidiger_s1_panzer', '🛡️', 'Panzerung',  {mult:{armor:0.12}}),
      node('verteidiger_s1_konst',  '🐂', 'Konstitution', {mult:{maxHp:0.12}}),
      node('verteidiger_s1_wehr',   '🪓', 'Gegenwehr',  {mult:{damage:0.06}}) ],
    [ node('verteidiger_s2_block',  '🧱', 'Blockmeister', {add:{block:8}}),
      node('verteidiger_s2_dornen', '🌵', 'Dornen',     {add:{thorns:6}}) ],
    [ node('verteidiger_s3_srpanz', '🛡️', 'Schwere Rüstung', {mult:{armor:0.18}}),
      node('verteidiger_s3_ausw',   '💨', 'Ausweichen', {add:{dodge:0.05}}) ],
    [ node('verteidiger_s4_hkonst', '🐂', 'Hohe Konstitution', {mult:{maxHp:0.18}}),
      node('verteidiger_s4_schild', '🎯', 'Schildschlag', {add:{critPhys:0.06}}) ],
    [ node('verteidiger_s5_stand',  '🧱', 'Standhaft',  {add:{block:12}}),
      node('verteidiger_s5_stachel','🌵', 'Stachelpanzer', {add:{thorns:10}}) ],
    [ node('verteidiger_s6_fest',   '🛡️', 'Festung',    {mult:{armor:0.22}}),
      node('verteidiger_s6_trotz',  '🩸', 'Trotz',      {add:{lifesteal:0.04}}) ],
    [ node('verteidiger_s7_titan',  '🐂', 'Titanenhaut', {mult:{maxHp:0.22}}),
      node('verteidiger_s7_vergelt','⚔️', 'Vergeltung', {mult:{damage:0.12}}) ],
    [ node('verteidiger_s8_wendig', '💨', 'Wendigkeit', {add:{dodge:0.08}}),
      node('verteidiger_s8_wall',   '🧱', 'Wall',       {add:{block:16}}) ],
    [ node('verteidiger_s9_feld',   '🌵', 'Dornenfeld', {add:{thorns:16}}),
      node('verteidiger_s9_bast',   '🛡️', 'Bastion',    {mult:{armor:0.28}}) ],
    [ node('verteidiger_s10_unersch','👑','Unerschütterlich', {mult:{maxHp:0.30, armor:0.25}}),
      node('verteidiger_s10_waecht', '⚔️', 'Schildwächter', {mult:{damage:0.20}, add:{thorns:12, critPhys:0.06}}) ],
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

// Eindeutige Bundle-Keys, die in den Talenten einer Klasse vorkommen
// (für die Werte-Legende der Klasse). Reihenfolge = STAT_INFO-Reihenfolge.
export function talentStatKeys(classId){
  const present = new Set();
  for(const n of talentNodes(classId)) for(const k of n.keys) present.add(k);
  return Object.keys(STAT_INFO).filter(k => present.has(k));
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

// Wendet die gewählten Talente einer Stufe auf den Stat-Bundle an.
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
