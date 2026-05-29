/* =====================================================================
   SELTENHEITEN (WoW-Farben). Phase 2 (#19): neue Stufe „Mythisch".
   ===================================================================== */
export const RARITIES = [
  { key:'gewoehnlich',   name:'Gewöhnlich',   adj:'Abgenutzte',   color:'#9d9d9d', mult:1.0, weight:60 },
  { key:'ungewoehnlich', name:'Ungewöhnlich', adj:'Solide',       color:'#1eff00', mult:1.4, weight:25 },
  { key:'selten',        name:'Seltene',      adj:'Funkelnde',    color:'#0070dd', mult:1.9, weight:10 },
  { key:'episch',        name:'Epische',      adj:'Glühende',     color:'#a335ee', mult:2.6, weight:4  },
  { key:'legendaer',     name:'Legendäre',    adj:'Sagenhafte',   color:'#ff8000', mult:3.5, weight:1  },
  // NEU (#19): über Legendär, nur von späten Bossen / hohen Zonen erreichbar.
  { key:'mythisch',      name:'Mythische',    adj:'Urzeitliche',  color:'#e6cc80', mult:4.7, weight:0.18 },
];
export const rarityOf = k => RARITIES.find(r => r.key === k) || RARITIES[0];
export const rarityIndex = k => Math.max(0, RARITIES.findIndex(r => r.key === k));
export const rarityByIndex = i => RARITIES[Math.max(0, Math.min(RARITIES.length-1, i))];
