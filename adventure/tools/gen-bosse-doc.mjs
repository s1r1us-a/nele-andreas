/* Generiert adventure/BOSSE.md aus adventure/js/data/bosses.js (Single Source of Truth).
   Nutzung (im Repo-Wurzelverzeichnis):  node adventure/tools/gen-bosse-doc.mjs   */
import { writeFileSync } from 'fs';
const { BOSS_DEFS, ZONES, MECH_DEFS } = await import('../js/data/bosses.js');
const { ENDLESS } = await import('../js/data/tuning.js');
const fmt = n => n>=1e9?(n/1e9).toFixed(2).replace(/\.?0+$/,'')+' Mrd':n>=1e6?(n/1e6).toFixed(2).replace(/\.?0+$/,'')+' Mio':n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,'')+'k':''+n;
let m='# Boss-Übersicht – Idle Abenteuer\n\n';
m+='> **Automatisch generiert** aus `adventure/js/data/bosses.js` (Single Source of Truth).\n';
m+='> Nicht von Hand editieren – stattdessen die Datendatei ändern und `node adventure/tools/gen-bosse-doc.mjs` neu ausführen.\n\n';
m+='Bosse sind das Fortschritts-Gate: Wer einen Boss besiegt, schaltet den nächsten frei und erhält\n';
m+='**Gold + XP + einen garantierten Gegenstand**. Jeder Boss ist **deutlich härter** als der Vorgänger\n';
m+='(~×1,45 HP/Angriff pro Stufe). Zusätzlich erzwingt ein **Soft-Enrage** ab Runde 45 (bzw. 22 bei der\n';
m+='`enrage`/Raserei-Mechanik) hohen Schaden – ohne Item-Grind sind späte Bosse nicht besiegbar.\n\n';
m+='- **Gold pro Sieg:** `recPower × 1.5 + 40`\n- **XP pro Sieg:** `recPower × 0.6 + 30` (Niederlage: 15 % als Trost-XP)\n';
m+='- **Garantierter Drop:** episch (Boss 1–22) · legendär (23–34) · mythisch (35+)\n';
m+='- **Erstkill-Bonus:** zusätzliches Gold + Heiltrank beim ersten Sieg\n';
m+='- **Farmen:** besiegte Bosse erneut für Loot farmbar (reduzierte Belohnung)\n\n';
m+='## Mechaniken\n\n| Key | Effekt |\n|-----|--------|\n';
for(const k in MECH_DEFS) m+=`| \`${k}\` | ${MECH_DEFS[k].emoji} ${MECH_DEFS[k].desc} |\n`;
m+='\n## Gebiete\n\n'+ZONES.map((z,i)=>`${i}. ${z.name}`).join(' · ')+'\n\n';
m+='## Roster ('+BOSS_DEFS.length+' Bosse + endlose Skalierung)\n\n';
m+='| # | Name | Gebiet | HP | Angriff | Kraft | Mechaniken | Phasen |\n|---|------|--------|----|---------|-------|------------|--------|\n';
BOSS_DEFS.forEach((b,i)=>{
  const mech=(Array.isArray(b.mechanic)?b.mechanic:[b.mechanic]).join(', ');
  const ph=b.phases?b.phases.map(p=>Math.round(p.hp*100)+'%: '+p.add.join('/')).join('; '):'–';
  m+=`| ${i} | ${b.name} | ${ZONES[b.area].name} | ${fmt(b.maxHp)} | ${fmt(b.atk)} | ${fmt(b.recPower)} | ${mech} | ${ph} |\n`;
});
m+=`\nAb Boss #${BOSS_DEFS.length} skaliert der letzte Boss endlos weiter: HP ×${ENDLESS.hpFactor}ⁿ, Angriff ×${ENDLESS.atkFactor}ⁿ, Kraft ×${ENDLESS.powFactor}ⁿ.\n\n`;
m+='> Sprites/Hintergründe: Es existieren `boss_0..4.png` und `bg_zone_0..4.png`. Mehrere Bosse/Gebiete\n';
m+='> teilen sich vorhandene Grafiken (Felder `area`/`spr`/`bg`). Eigene Grafiken können später ergänzt werden.\n';
writeFileSync(new URL('../BOSSE.md', import.meta.url), m);
console.log('adventure/BOSSE.md generiert ('+BOSS_DEFS.length+' Bosse)');
