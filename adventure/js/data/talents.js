/* =====================================================================
   TALENTBÄUME pro Klasse. Je Klasse 10 Stufen; pro Stufe stehen 2–3
   sich GEGENSEITIG AUSSCHLIESSENDE Talente zur Wahl – man wählt genau
   eines pro Stufe.

   Struktur:
   - TALENT_TREES[classId] = Array von Stufen (Reihen).
   - Jede Stufe = Array von Optionen { id, icon, name, desc, effect }.
   - effect(bundle): modifiziert den Stat-Bundle aus recomputeTotals.

   Auswahl-Speicherung: state.character.talents = { stufeIndex: optionId }.
   - Eine Stufe ist erst wählbar, wenn die vorige bereits belegt ist
     (sequentielle Freischaltung).
   - Jede Wahl kostet 1 Talentpunkt (1 je Level). Zurücksetzen via Respec
     (kostet Gold) in der UI.
   ===================================================================== */

// Effekt-Helfer: add = flache Boni, mult = prozentuale Boni (auf Bundle-Keys).
// Bundle-Keys: armor, damage, maxHp, critPhys, critMagic, critDamage,
//              attackSpeed, lifesteal, dodge, block, versatility, thorns.
function eff(mods){
  return (b)=>{
    if(mods.add)  for(const k in mods.add)  b[k] = (b[k]||0) + mods.add[k];
    if(mods.mult) for(const k in mods.mult) b[k] = (b[k]||0) * (1 + mods.mult[k]);
  };
}
// Talent-Knoten: id, Icon, Name, Effekt, Beschreibung.
function node(id, icon, name, effect, desc){ return { id, icon, name, desc, effect }; }

export const TALENT_TREES = {
  // ---- KÄMPFER (physisch, ausgewogen) ------------------------------
  kaempfer: [
    [ node('kaempfer_s1_wucht',  '💥', 'Wucht',      eff({mult:{damage:0.08}}),       '+8 % Schaden'),
      node('kaempfer_s1_zaeh',   '🪨', 'Zähigkeit',  eff({mult:{maxHp:0.10}}),        '+10 % Leben'),
      node('kaempfer_s1_flink',  '🏃', 'Flink',      eff({add:{attackSpeed:0.06}}),   '+6 % Angriffstempo') ],
    [ node('kaempfer_s2_klinge', '🗡️', 'Scharfe Klinge', eff({add:{critPhys:0.06}}), '+6 % phys. Krit'),
      node('kaempfer_s2_panzer', '🛡️', 'Panzerung',  eff({mult:{armor:0.12}}),        '+12 % Rüstung') ],
    [ node('kaempfer_s3_brutal', '💢', 'Brutalität', eff({add:{critDamage:0.25}}),    '+25 % Krit-Schaden'),
      node('kaempfer_s3_blut',   '🩸', 'Blutdurst',  eff({add:{lifesteal:0.04}}),     '+4 % Lebensraub') ],
    [ node('kaempfer_s4_hiebe',  '⚔️', 'Schwere Hiebe', eff({mult:{damage:0.12}}),    '+12 % Schaden'),
      node('kaempfer_s4_rasanz', '⚡', 'Rasanz',     eff({add:{attackSpeed:0.08}}),   '+8 % Angriffstempo') ],
    [ node('kaempfer_s5_treff',  '🎯', 'Treffsicher', eff({add:{critPhys:0.08}}),     '+8 % phys. Krit'),
      node('kaempfer_s5_konst',  '🐂', 'Konstitution', eff({mult:{maxHp:0.15}}),      '+15 % Leben') ],
    [ node('kaempfer_s6_berserk','🔥', 'Berserker',  eff({mult:{damage:0.15}}),       '+15 % Schaden'),
      node('kaempfer_s6_dornen', '🌵', 'Dornenhaut', eff({add:{thorns:6}}),           '+6 Dornen') ],
    [ node('kaempfer_s7_wucht',  '💥', 'Wuchtschlag', eff({add:{critDamage:0.35}}),   '+35 % Krit-Schaden'),
      node('kaempfer_s7_boll',   '🛡️', 'Bollwerk',   eff({mult:{armor:0.18}}),        '+18 % Rüstung') ],
    [ node('kaempfer_s8_sturm',  '⚡', 'Sturmangriff', eff({add:{attackSpeed:0.10}}), '+10 % Angriffstempo'),
      node('kaempfer_s8_vampir', '🩸', 'Vampirklinge', eff({add:{lifesteal:0.06}}),   '+6 % Lebensraub') ],
    [ node('kaempfer_s9_meister','🎯', 'Meisterschütze', eff({add:{critPhys:0.10}}),  '+10 % phys. Krit'),
      node('kaempfer_s9_klinge', '🗡️', 'Klingenmeister', eff({mult:{damage:0.18}}),  '+18 % Schaden') ],
    [ node('kaempfer_s10_fuerst','👑', 'Kriegsfürst', eff({mult:{damage:0.25}, add:{attackSpeed:0.10}}), '+25 % Schaden · +10 % Tempo'),
      node('kaempfer_s10_unbez', '🛡️', 'Unbezwingbar', eff({mult:{maxHp:0.25, armor:0.20}}),            '+25 % Leben · +20 % Rüstung') ],
  ],

  // ---- HEILER (magisch, starke Heilung) ----------------------------
  heiler: [
    [ node('heiler_s1_arkan',  '✨', 'Arkane Kraft', eff({mult:{damage:0.08}}),     '+8 % Schaden'),
      node('heiler_s1_leben',  '💚', 'Lebenskraft',  eff({mult:{maxHp:0.12}}),      '+12 % Leben'),
      node('heiler_s1_fokus',  '🔮', 'Fokus',        eff({add:{critMagic:0.06}}),   '+6 % magischer Krit') ],
    [ node('heiler_s2_macht',  '🌟', 'Zaubermacht',  eff({mult:{damage:0.12}}),     '+12 % Schaden'),
      node('heiler_s2_ader',   '🩹', 'Aderlass',     eff({add:{lifesteal:0.05}}),   '+5 % Lebensraub') ],
    [ node('heiler_s3_konz',   '💫', 'Konzentration', eff({add:{critMagic:0.08}}),  '+8 % magischer Krit'),
      node('heiler_s3_schild', '🛡️', 'Magieschild',  eff({mult:{armor:0.12}}),      '+12 % Rüstung') ],
    [ node('heiler_s4_schnell','⚡', 'Schnelles Wirken', eff({add:{attackSpeed:0.08}}), '+8 % Angriffstempo'),
      node('heiler_s4_viel',   '💎', 'Vielseitig',   eff({add:{versatility:0.05}}), '+5 % Vielseitigkeit') ],
    [ node('heiler_s5_licht',  '🌈', 'Lichtmagie',   eff({mult:{damage:0.15}}),     '+15 % Schaden'),
      node('heiler_s5_hleben', '💚', 'Hohe Lebenskraft', eff({mult:{maxHp:0.18}}),  '+18 % Leben') ],
    [ node('heiler_s6_verheer','🔥', 'Verheerung',   eff({add:{critDamage:0.30}}),  '+30 % Krit-Schaden'),
      node('heiler_s6_quell',  '🩹', 'Lebensquell',  eff({add:{lifesteal:0.07}}),   '+7 % Lebensraub') ],
    [ node('heiler_s7_erleucht','💫','Erleuchtung',  eff({add:{critMagic:0.10}}),   '+10 % magischer Krit'),
      node('heiler_s7_zeit',   '⚡', 'Zeitraffer',   eff({add:{attackSpeed:0.10}}), '+10 % Angriffstempo') ],
    [ node('heiler_s8_hmagie', '🌟', 'Hohe Magie',   eff({mult:{damage:0.18}}),     '+18 % Schaden'),
      node('heiler_s8_harm',   '💎', 'Harmonie',     eff({add:{versatility:0.08}}), '+8 % Vielseitigkeit') ],
    [ node('heiler_s9_meister','🔮', 'Arkanmeister', eff({add:{critDamage:0.40}}),  '+40 % Krit-Schaden'),
      node('heiler_s9_unsterb','💚', 'Unsterblichkeit', eff({mult:{maxHp:0.22}}),   '+22 % Leben') ],
    [ node('heiler_s10_erz',   '👑', 'Erzmagier',    eff({mult:{damage:0.28}, add:{critMagic:0.12}}), '+28 % Schaden · +12 % mag. Krit'),
      node('heiler_s10_avatar','🌟', 'Avatar des Lichts', eff({mult:{maxHp:0.30}, add:{lifesteal:0.10}}), '+30 % Leben · +10 % Lebensraub') ],
  ],

  // ---- VERTEIDIGER (Tank, sehr robust) -----------------------------
  verteidiger: [
    [ node('verteidiger_s1_panzer', '🛡️', 'Panzerung',  eff({mult:{armor:0.12}}),   '+12 % Rüstung'),
      node('verteidiger_s1_konst',  '🐂', 'Konstitution', eff({mult:{maxHp:0.12}}),  '+12 % Leben'),
      node('verteidiger_s1_wehr',   '🪓', 'Gegenwehr',  eff({mult:{damage:0.06}}),   '+6 % Schaden') ],
    [ node('verteidiger_s2_block',  '🧱', 'Blockmeister', eff({add:{block:8}}),      '+8 Block'),
      node('verteidiger_s2_dornen', '🌵', 'Dornen',     eff({add:{thorns:6}}),       '+6 Dornen') ],
    [ node('verteidiger_s3_srpanz', '🛡️', 'Schwere Rüstung', eff({mult:{armor:0.18}}), '+18 % Rüstung'),
      node('verteidiger_s3_ausw',   '💨', 'Ausweichen', eff({add:{dodge:0.05}}),     '+5 % Ausweichen') ],
    [ node('verteidiger_s4_hkonst', '🐂', 'Hohe Konstitution', eff({mult:{maxHp:0.18}}), '+18 % Leben'),
      node('verteidiger_s4_schild', '🎯', 'Schildschlag', eff({add:{critPhys:0.06}}), '+6 % phys. Krit') ],
    [ node('verteidiger_s5_stand',  '🧱', 'Standhaft',  eff({add:{block:12}}),       '+12 Block'),
      node('verteidiger_s5_stachel','🌵', 'Stachelpanzer', eff({add:{thorns:10}}),   '+10 Dornen') ],
    [ node('verteidiger_s6_fest',   '🛡️', 'Festung',    eff({mult:{armor:0.22}}),    '+22 % Rüstung'),
      node('verteidiger_s6_trotz',  '🩸', 'Trotz',      eff({add:{lifesteal:0.04}}), '+4 % Lebensraub') ],
    [ node('verteidiger_s7_titan',  '🐂', 'Titanenhaut', eff({mult:{maxHp:0.22}}),   '+22 % Leben'),
      node('verteidiger_s7_vergelt','⚔️', 'Vergeltung', eff({mult:{damage:0.12}}),   '+12 % Schaden') ],
    [ node('verteidiger_s8_wendig', '💨', 'Wendigkeit', eff({add:{dodge:0.08}}),     '+8 % Ausweichen'),
      node('verteidiger_s8_wall',   '🧱', 'Wall',       eff({add:{block:16}}),       '+16 Block') ],
    [ node('verteidiger_s9_feld',   '🌵', 'Dornenfeld', eff({add:{thorns:16}}),      '+16 Dornen'),
      node('verteidiger_s9_bast',   '🛡️', 'Bastion',    eff({mult:{armor:0.28}}),    '+28 % Rüstung') ],
    [ node('verteidiger_s10_unersch','👑','Unerschütterlich', eff({mult:{maxHp:0.30, armor:0.25}}), '+30 % Leben · +25 % Rüstung'),
      node('verteidiger_s10_waecht', '⚔️', 'Schildwächter', eff({mult:{damage:0.20}, add:{thorns:12, critPhys:0.06}}), '+20 % Schaden · +12 Dornen · +6 % Krit') ],
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
