/* =====================================================================
   TALENTBÄUME pro Klasse. GERÜST – die konkreten Talente sind noch leer
   (Platzhalter) und werden später befüllt.

   Struktur:
   - TALENT_TREES[classId] = Array von Tiers (Reihen).
   - Jedes Tier = Array von Knoten { id, name, icon, desc, maxRank, effect }.
   - Platzhalter-Knoten haben name:'' → werden im UI als „Bald verfügbar"
     deaktiviert dargestellt.
   - effect: null  → wirkungslos. Später: function(rank, bundle){ … } die den
     Stat-Bundle in computePlayerStats/recomputeTotals modifiziert.

   Zum Befüllen genügt es, name/icon/desc/maxRank zu setzen und effect zu
   implementieren – die Verdrahtung (Punkte, Persistenz, UI, applyTalents)
   steht bereits.
   ===================================================================== */

// Hilfsfunktion: leerer Platzhalter-Knoten.
function slot(id){ return { id, name:'', icon:'', desc:'', maxRank:1, effect:null }; }

export const TALENT_TREES = {
  heiler: [
    [ slot('heiler_t1_a'), slot('heiler_t1_b'), slot('heiler_t1_c') ],
    [ slot('heiler_t2_a'), slot('heiler_t2_b') ],
    [ slot('heiler_t3_a') ],
  ],
  kaempfer: [
    [ slot('kaempfer_t1_a'), slot('kaempfer_t1_b'), slot('kaempfer_t1_c') ],
    [ slot('kaempfer_t2_a'), slot('kaempfer_t2_b') ],
    [ slot('kaempfer_t3_a') ],
  ],
  verteidiger: [
    [ slot('verteidiger_t1_a'), slot('verteidiger_t1_b'), slot('verteidiger_t1_c') ],
    [ slot('verteidiger_t2_a'), slot('verteidiger_t2_b') ],
    [ slot('verteidiger_t3_a') ],
  ],
};

// Talentbaum einer Klasse (null-sicher, leeres Gerüst als Fallback).
export function talentTreeFor(classId){
  return TALENT_TREES[classId] || [];
}

// Alle Knoten einer Klasse flach (für Lookups).
export function talentNodes(classId){
  return talentTreeFor(classId).flat();
}

// Ein Knoten gilt als „echtes" (befüllbares) Talent, sobald er einen Namen hat.
export function isRealTalent(node){ return !!(node && node.name); }

// Wendet die aktiven Talent-Ränge auf ein Stat-Bundle an.
// no-op solange alle effect:null sind – später hier die Effekte einhängen.
export function applyTalents(state, bundle){
  const classId = state && state.character && state.character.classId;
  const ranks = (state && state.character && state.character.talents) || {};
  for(const node of talentNodes(classId)){
    const rank = ranks[node.id] || 0;
    if(rank > 0 && typeof node.effect === 'function'){
      node.effect(rank, bundle);
    }
  }
  return bundle;
}
