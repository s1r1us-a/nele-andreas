/* =====================================================================
   SELTENHEITEN (WoW-Farben). Phase 2 (#19): neue Stufe „Mythisch".
   ===================================================================== */
// adjStem = Adjektiv-Stamm OHNE Endung. Die korrekte Endung (m -er, f -e,
// n -es, pl -e) wird in itemDisplayName() je nach Genus des Item-Nomens
// angehängt (deutsche starke Deklination, Nominativ ohne Artikel). adj bleibt
// als feminin/Plural-Variante für Abwärtskompatibilität erhalten.
export const RARITIES = [
  { key:'gewoehnlich',   name:'Gewöhnlich',   adj:'Abgenutzte',   adjStem:'Abgenutzt',  color:'#9d9d9d', mult:1.0, weight:60 },
  { key:'ungewoehnlich', name:'Ungewöhnlich', adj:'Solide',       adjStem:'Solid',      color:'#1eff00', mult:1.4, weight:25 },
  { key:'selten',        name:'Seltene',      adj:'Funkelnde',    adjStem:'Funkelnd',   color:'#0070dd', mult:1.9, weight:10 },
  { key:'episch',        name:'Epische',      adj:'Glühende',     adjStem:'Glühend',    color:'#a335ee', mult:2.6, weight:4  },
  { key:'legendaer',     name:'Legendäre',    adj:'Sagenhafte',   adjStem:'Sagenhaft',  color:'#ff8000', mult:3.5, weight:1  },
  // NEU (#19): über Legendär, nur von späten Bossen / hohen Zonen erreichbar.
  { key:'mythisch',      name:'Mythische',    adj:'Urzeitliche',  adjStem:'Urzeitlich', color:'#e6cc80', mult:4.7, weight:0.18 },
];
export const rarityOf = k => RARITIES.find(r => r.key === k) || RARITIES[0];
export const rarityIndex = k => Math.max(0, RARITIES.findIndex(r => r.key === k));
export const rarityByIndex = i => RARITIES[Math.max(0, Math.min(RARITIES.length-1, i))];

// Höchste erreichbare Seltenheit je Fortschritt (Anti-OP-Gating, Teil 3b).
// Pro ~2 Zonen wird eine Stufe freigeschaltet → lange Frühloot-Läufe können
// keine Legendären/Mythischen ausspucken, bevor der Fortschritt es erlaubt.
//   Zone 0–1 → Selten · 2–3 → Episch · 4–6 → Legendär · 7+ → Mythisch
export function maxRarityIndex(zone){
  zone = Math.max(0, zone|0);
  if(zone >= 7) return 5;
  if(zone >= 4) return 4;
  if(zone >= 2) return 3;
  return 2;
}
