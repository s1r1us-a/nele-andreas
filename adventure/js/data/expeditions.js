/* =====================================================================
   EXPEDITIONEN (Abenteuer auf Zeit). Phase 3 (#45): mehr Dauern.
   ===================================================================== */
// boost = Loot-Verschiebung Richtung besserer Seltenheit (gezähmt, Teil 3b:
// hebt die Verteilung INNERHALB des fortschrittsabhängigen Caps, sprengt ihn nicht).
// items = Anzahl der Gegenstände, die das Abenteuer mitbringt (steigt mit der Dauer:
// 5 Min → 2, 15 Min → 3, 30 Min → 4, 1 Std → 5, 3 Std → 6, 8 Std → 7).
export const EXPEDITIONS = [
  { key:'5',   label:'5 Minuten',  short:'5 Min',  ms:5*60*1000,    boost:0.1, items:2, icon:'🌱' },
  { key:'15',  label:'15 Minuten', short:'15 Min', ms:15*60*1000,   boost:0.3, items:3, icon:'🌿' },
  { key:'30',  label:'30 Minuten', short:'30 Min', ms:30*60*1000,   boost:0.6, items:4, icon:'🏞️' },
  { key:'60',  label:'1 Stunde',   short:'1 Std',  ms:60*60*1000,   boost:1.1, items:5, icon:'🗻' },
  { key:'180', label:'3 Stunden',  short:'3 Std',  ms:180*60*1000,  boost:2.2, items:6, icon:'🌋' },
  { key:'480', label:'8 Stunden',  short:'8 Std',  ms:480*60*1000,  boost:3.5, items:7, icon:'🌌' },
];
export const expeditionOf = k => EXPEDITIONS.find(e => e.key === k);
