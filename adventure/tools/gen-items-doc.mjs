/* Generiert adventure/ITEMS.md aus den Daten-Dateien (Single Source of Truth):
   itemTypes.js, rarities.js, slots.js, affixes.js, tuning.js, classes.js.
   Nutzung (im Repo-Wurzelverzeichnis):  node adventure/tools/gen-items-doc.mjs   */
import { writeFileSync } from 'fs';
const { ITEM_TYPES, MATERIAL_LABEL } = await import('../js/data/itemTypes.js');
const { RARITIES } = await import('../js/data/rarities.js');
const { SLOTS } = await import('../js/data/slots.js');
const { AFFIX_DEFS, AFFIX_COUNT } = await import('../js/data/affixes.js');
const { BASE_STAT, ILVL_K } = await import('../js/data/tuning.js');
const { CLASSES } = await import('../js/data/classes.js');

// ---- Helfer ----------------------------------------------------------
const affixLbl = k => (AFFIX_DEFS[k] ? AFFIX_DEFS[k].label : k);
const biasStr  = b => Object.keys(b||{}).map(affixLbl).join(', ') || '–';
const mult     = m => (m===1 ? '1.0' : String(m));
const fmtAffixCount = rk => { const c = AFFIX_COUNT[rk]; return typeof c==='function' ? '2–3' : String(c); };

// Referenz-Gegenstandsstufe für Beispielwerte (mittleres Spiel).
const ILVL_REF = 50;
const ilvlFactor = 1 + ILVL_REF*ILVL_K;       // = 7.0 bei ilvl 50
// Primärwert (Schaden/Rüstung) bei Qualität 1.0, gegebener Seltenheit & Typ.
function primStat(statType, rarityMult, statMult){
  return Math.max(1, Math.round(BASE_STAT[statType] * rarityMult * ilvlFactor * (statMult ?? 1)));
}
// Klassen, die ein Material tragen dürfen.
function classesFor(material){
  if(!material) return 'alle';
  return CLASSES.filter(c => c.allowedMaterials.includes(material)).map(c => c.label).join(', ');
}

// art → repräsentativer Slot
const artSample = { waffe:'waffe', schild:'schild', amulett:'amulett', ring:'ring1',
  kopf:'kopf', schultern:'schultern', brust:'brust', haende:'haende', beine:'beine', fuesse:'fuesse', umhang:'umhang' };

const GROUPS = [
  { title:'⚔️ Waffen', arts:['waffe'] },
  { title:'🛡️ Rüstung', arts:['kopf','schultern','brust','haende','beine','fuesse','umhang','schild'] },
  { title:'💍 Schmuck', arts:['amulett','ring'] },
];

let m = '# Item-Übersicht – Dämmerpfad\n\n';
m += '> **Automatisch generiert** aus den Daten-Dateien (Single Source of Truth).\n';
m += '> Nicht von Hand editieren – Datendatei ändern und `node adventure/tools/gen-items-doc.mjs` neu ausführen.\n\n';

// ---- Klassen & Materialien -------------------------------------------
m += '## 🧙 Klassen & Rüstungsmaterialien\n\n';
m += 'Die bei der Erstellung gewählte **Klasse** ist dauerhaft und bestimmt, welche Rüstungsmaterialien getragen werden dürfen und welche Schadensschule zählt.\n\n';
m += '| Klasse | Schule | Tragbare Materialien | Schadens-× | Heil-× |\n|---|---|---|---|---|\n';
for(const c of CLASSES){
  const mats = c.allowedMaterials.map(k => MATERIAL_LABEL[k]||k).join(', ');
  m += `| ${c.icon} ${c.label} | ${c.damageSchool} | ${mats} | ${c.dmgMult}× | ${c.healMult}× |\n`;
}
m += '\nRüstung gibt es in **3 Materialien**: **Stoff** (kaum Rüstung, magisch), **Leder** (mehr Rüstung, physisch), **Platte** (sehr viel Rüstung, wenig Schaden).\n\n';

// ---- Seltenheiten ----------------------------------------------------
m += '## ✨ Seltenheiten\n\n';
m += 'Seltenheit hebt den Primärwert (Multiplikator), die Affix-Anzahl und ab Episch die Roll-Qualität; Legendär/Mythisch tragen zusätzlich einen Proc-Effekt.\n\n';
m += '| Seltenheit | Wert-× | Drop-Gewicht | Affixe | Basis-Goldwert |\n|---|---|---|---|---|\n';
RARITIES.forEach((r,i) => {
  m += `| ${r.name} | ${r.mult}× | ${r.weight} | ${fmtAffixCount(r.key)} | ${i*1000} |\n`;
});
m += '\n';

// ---- Master-Tabelle aller Basis-Typen --------------------------------
m += `## 📋 Alle Gegenstände (Beispielwerte @ Gegenstandsstufe ${ILVL_REF}, Qualität 100 %)\n\n`;
m += 'Der **Primärwert** (Schaden bzw. Rüstung) skaliert mit Gegenstandsstufe und Seltenheit. Hier je Typ der Wert bei Stufe ' +
     ILVL_REF + ' für **Gewöhnlich** und **Episch** zum Vergleich.\n\n';

let totalTypes = 0;
const epis = RARITIES.find(r => r.key==='episch') || RARITIES[RARITIES.length-1];
const gew  = RARITIES[0];

for(const g of GROUPS){
  m += `### ${g.title}\n\n`;
  const isArmor = g.title.includes('Rüstung');
  for(const art of g.arts){
    const types = ITEM_TYPES[art]; if(!types) continue;
    const slot = SLOTS[artSample[art]];
    const statType = slot ? slot.statType : 'armor';
    const prim = statType==='armor' ? 'Rüstung' : 'Schaden';
    const slotLbl = art==='ring' ? 'Ring 1 & 2' : (slot ? slot.name : art);
    m += `#### ${slotLbl}  ·  Primär: ${prim}\n\n`;
    if(isArmor){
      m += '| Typ | Material | Tragbar | StatMult | '+prim+' (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |\n|---|---|---|---|---|---|---|\n';
      for(const t of types){
        totalTypes++;
        const matLbl = MATERIAL_LABEL[t.material] || '–';
        m += `| ${t.name} | ${matLbl} | ${classesFor(t.material)} | ${mult(t.statMult)} | `+
             `${primStat(statType, gew.mult, t.statMult)} / ${primStat(statType, epis.mult, t.statMult)} | `+
             `${biasStr(t.affixBias)} | ${t.flavorAffix?affixLbl(t.flavorAffix):'–'} |\n`;
      }
    } else {
      m += '| Typ | Variante | StatMult | '+prim+' (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |\n|---|---|---|---|---|---|\n';
      for(const t of types){
        totalTypes++;
        m += `| ${t.name} | v${t.variant} | ${mult(t.statMult)} | `+
             `${primStat(statType, gew.mult, t.statMult)} / ${primStat(statType, epis.mult, t.statMult)} | `+
             `${biasStr(t.affixBias)} | ${t.flavorAffix?affixLbl(t.flavorAffix):'–'} |\n`;
      }
    }
    m += '\n';
  }
}

// ---- Affix-Referenz --------------------------------------------------
m += '## 🔧 Sekundärwerte (Affixe)\n\n';
m += '`Basis` + `pro Stufe` × Gegenstandsstufe, dann × Seltenheits-Multiplikator und Roll (0,75–1,30). `%`-Werte sind Anteile.\n\n';
m += '| Affix | Typ | Basis | pro Stufe | Obergrenze |\n|---|---|---|---|---|\n';
for(const [k,d] of Object.entries(AFFIX_DEFS)){
  const typ = d.pct ? '%' : 'flach';
  const base = d.pct ? (d.base*100).toFixed(2)+'%' : d.base;
  const per  = d.pct ? (d.perIlvl*100).toFixed(3)+'%' : d.perIlvl;
  const cap  = d.cap != null ? (d.pct ? (d.cap*100)+'%' : d.cap) : '–';
  m += `| ${d.label} | ${typ} | ${base} | ${per} | ${cap} |\n`;
}
m += '\n';

// ---- Wert / Verkauf --------------------------------------------------
m += '## 💰 Wertigkeit & Verkauf\n\n';
m += '- **Gegenstandswert** = `Seltenheitsrang × 1000 + Primärwert + Affix-Score` (Affix-Score: %-Affixe × 100, flache × 0,5, Proc +40).\n';
m += '- **Verkaufspreis** = `max(1, (Primärwert + Affix-Score × 2) × (Seltenheitsrang + 1) × 0,6)`.\n';
m += '- **Kampfkraft** eines Items gewichtet alle Werte (z. B. Krit ×200, Schaden ×1,5, Rüstung ×1) zu einer Vergleichszahl.\n\n';

m += `---\n\n**Summe:** ${totalTypes} Basis-Typen × ${RARITIES.length} Seltenheiten = ${totalTypes*RARITIES.length} Item-Ausprägungen.\n`;
m += '\n> Sprites: `icon_<slot>_<variante>.png` (0–5). Waffen besitzen je Variante eine eigene Form\n';
m += '> (Schwert/Dolch/Streitkolben/Axt/Speer/Kriegshammer); Rüstung nutzt 3 Material-Varianten (Stoff v4, Leder v2, Platte v0).\n';

writeFileSync(new URL('../ITEMS.md', import.meta.url), m);
console.log('adventure/ITEMS.md generiert ('+totalTypes+' Basis-Typen)');
