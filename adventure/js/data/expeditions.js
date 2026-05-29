/* =====================================================================
   EXPEDITIONEN (Abenteuer auf Zeit). Phase 3 (#45): mehr Dauern.
   ===================================================================== */
export const EXPEDITIONS = [
  { key:'5',   label:'5 Minuten',  short:'5 Min',  ms:5*60*1000,    boost:0.1, icon:'🌱' },
  { key:'15',  label:'15 Minuten', short:'15 Min', ms:15*60*1000,   boost:0.3, icon:'🌿' },
  { key:'30',  label:'30 Minuten', short:'30 Min', ms:30*60*1000,   boost:0.8, icon:'🏞️' },
  { key:'60',  label:'1 Stunde',   short:'1 Std',  ms:60*60*1000,   boost:1.6, icon:'🗻' },
  { key:'180', label:'3 Stunden',  short:'3 Std',  ms:180*60*1000,  boost:3.2, icon:'🌋' },
  { key:'480', label:'8 Stunden',  short:'8 Std',  ms:480*60*1000,  boost:5.5, icon:'🌌' },
];
export const expeditionOf = k => EXPEDITIONS.find(e => e.key === k);
