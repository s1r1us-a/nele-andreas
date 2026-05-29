/* Generiert adventure/ITEMS.md aus adventure/js/data/itemTypes.js + rarities.js
   (Single Source of Truth).
   Nutzung (im Repo-Wurzelverzeichnis):  node adventure/tools/gen-items-doc.mjs   */
import { writeFileSync } from 'fs';
const { ITEM_TYPES } = await import('../js/data/itemTypes.js');
const { RARITIES } = await import('../js/data/rarities.js');
const { SLOTS } = await import('../js/data/slots.js');
const { AFFIX_DEFS } = await import('../js/data/affixes.js');

const affixLbl = k => (AFFIX_DEFS[k] ? AFFIX_DEFS[k].label : k);
const biasStr  = b => Object.keys(b||{}).map(affixLbl).join(', ') || '–';
const mult     = m => (m===1 ? '1.0' : String(m));

// art → ein repräsentativer Slot-Name + Primär-Stat
const artSample = { waffe:'waffe', schild:'schild', amulett:'amulett', ring:'ring1',
  kopf:'kopf', schultern:'schultern', brust:'brust', haende:'haende', beine:'beine', fuesse:'fuesse', umhang:'umhang' };

// Kategorie-Gruppierung für die Ausgabe
const GROUPS = [
  { title:'⚔️ Waffen', arts:['waffe'] },
  { title:'🛡️ Rüstung', arts:['kopf','schultern','brust','haende','beine','fuesse','umhang','schild'] },
  { title:'💍 Schmuck', arts:['amulett','ring'] },
];

let m = '# Item-Übersicht – Idle Abenteuer\n\n';
m += '> **Automatisch generiert** aus `adventure/js/data/itemTypes.js` (Single Source of Truth).\n';
m += '> Nicht von Hand editieren – Datendatei ändern und `node adventure/tools/gen-items-doc.mjs` neu ausführen.\n\n';
m += 'Jeder Slot bietet **6 Item-Typen** mit eigenem Stat-Archetyp. Jeder Typ existiert in allen **6 Seltenheiten**:\n';
m += RARITIES.map(r => r.name).join(' · ') + '.\n\n';
m += '- **StatMult** verschiebt den Primär-Stat (Schaden/Rüstung); <1 = mehr Fokus auf Affixe.\n';
m += '- **Affix-Bias** = Sekundär-Stats, die der Typ bevorzugt rollt.\n';
m += '- **Flavor (Episch+)** = ab Episch garantiert vorhandener Archetyp-Affix.\n';
m += '- Seltenheit hebt Werte (Multiplikator), Affix-Anzahl und ab Episch die Roll-Qualität; Legendär/Mythisch tragen zusätzlich einen Proc-Effekt.\n\n';

let totalTypes = 0;
for(const g of GROUPS){
  m += `## ${g.title}\n\n`;
  for(const art of g.arts){
    const types = ITEM_TYPES[art]; if(!types) continue;
    const slot = SLOTS[artSample[art]];
    const prim = slot && slot.statType==='armor' ? 'Rüstung' : 'Schaden';
    const slotLbl = art==='ring' ? 'Ring 1 & 2' : (slot ? slot.name : art);
    m += `### ${slotLbl}  ·  Primär: ${prim}\n\n`;
    m += '| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |\n|---|---|---|---|---|\n';
    for(const t of types){
      totalTypes++;
      m += `| ${t.name} | v${t.variant} | ${mult(t.statMult)} | ${biasStr(t.affixBias)} | ${t.flavorAffix?affixLbl(t.flavorAffix):'–'} |\n`;
    }
    m += '\n';
  }
}
m += `---\n\n**Summe:** ${totalTypes} Basis-Typen × ${RARITIES.length} Seltenheiten = ${totalTypes*RARITIES.length} Item-Ausprägungen.\n`;
m += '\n> Sprites: `icon_<slot>_<variante>.png` (0–5). Waffen besitzen je Variante eine eigene Form\n';
m += '> (Schwert/Dolch/Streitkolben/Axt/Speer/Kriegshammer); übrige Slots unterscheiden sich per Material-Farbe.\n';

writeFileSync(new URL('../ITEMS.md', import.meta.url), m);
console.log('adventure/ITEMS.md generiert ('+totalTypes+' Basis-Typen)');
