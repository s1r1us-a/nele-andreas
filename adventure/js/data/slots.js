/* =====================================================================
   SLOTS (Paper-Doll). art = Sprite-Basisname (icon_<art>_<v>.png).
   ===================================================================== */
export const SLOTS = {
  kopf:      { name:'Kopf',       art:'kopf',      cat:'ruestung', statType:'armor',  base:'Helm' },
  schultern: { name:'Schultern',  art:'schultern', cat:'ruestung', statType:'armor',  base:'Schulterplatten' },
  brust:     { name:'Brust',      art:'brust',     cat:'ruestung', statType:'armor',  base:'Brustpanzer' },
  haende:    { name:'Hände',      art:'haende',    cat:'ruestung', statType:'armor',  base:'Handschuhe' },
  beine:     { name:'Beine',      art:'beine',     cat:'ruestung', statType:'armor',  base:'Beinschienen' },
  fuesse:    { name:'Füße',       art:'fuesse',    cat:'ruestung', statType:'armor',  base:'Stiefel' },
  umhang:    { name:'Umhang',     art:'umhang',    cat:'ruestung', statType:'armor',  base:'Umhang' },
  amulett:   { name:'Amulett',    art:'amulett',   cat:'schmuck',  statType:'armor',  base:'Amulett' },
  ring1:     { name:'Ring 1',     art:'ring',      cat:'schmuck',  statType:'armor',  base:'Ring' },
  ring2:     { name:'Ring 2',     art:'ring',      cat:'schmuck',  statType:'armor',  base:'Ring' },
  schild:    { name:'Nebenhand',  art:'schild',    cat:'ruestung', statType:'armor',  base:'Schild' },
  waffe:     { name:'Waffe',      art:'waffe',     cat:'waffen',   statType:'damage', base:'Schwert' },
};
// Zwei Ring-Slots teilen sich dieselbe Inventar-Kategorie/„passt-in"-Logik
export const FITS = slotKey => (slotKey === 'ring1' || slotKey === 'ring2') ? ['ring1','ring2'] : [slotKey];

// Anordnung im Charakterfenster
export const LEFT_SLOTS   = ['kopf','schultern','brust','haende','beine','fuesse'];
export const RIGHT_SLOTS  = ['amulett','umhang','ring1','ring2','schild'];
export const BOTTOM_SLOTS = ['waffe'];

export const SLOT_ICON = { kopf:'🪖', schultern:'🎽', brust:'🛡️', haende:'🧤', beine:'👖',
  fuesse:'🥾', umhang:'🧣', amulett:'📿', ring1:'💍', ring2:'💍', schild:'🛡️', waffe:'⚔️' };

export const CAT_LABEL = { waffen:'⚔️ Waffen', ruestung:'🛡️ Rüstung', schmuck:'💍 Schmuck' };
export const CAT_ICON  = { waffen:'⚔️', ruestung:'🛡️', schmuck:'💍' };
export const CAT_ORDER = { waffen:0, ruestung:1, schmuck:2 };

export const SLOT_KEYS = Object.keys(SLOTS);
