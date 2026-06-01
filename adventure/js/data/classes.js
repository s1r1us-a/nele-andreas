/* =====================================================================
   KLASSEN (WoW-artig). Bei der Charaktererstellung gewählt, danach
   dauerhaft. Bestimmt tragbare Rüstungsmaterialien (stoff/leder/platte),
   die Schadensschule (magisch/physisch) und Kampf-Multiplikatoren.
   - allowedMaterials: welche Rüstungs-Materialien angelegt werden dürfen.
   - damageSchool: welcher Krit (critMagic/critPhys) im Kampf zählt.
   - dmgMult: skaliert den Grundangriff (Heiler/Verteidiger machen weniger).
   - healMult: skaliert Lebensraub/Heilung (Heiler/Hexer heilen mehr).
   - ability: Grund-Spezialfähigkeit (Kampf-Knopf). `kind` steuert den
     Effekt generisch: heal · burst · drain · critBoost · dmgBoost ·
     dmgReduce · lifesteal.
   ===================================================================== */
import { chosenActiveAbilities } from './talents.js';

export const CLASSES = [
  { id:'heiler',      label:'Heiler',      icon:'✨',
    desc:'Magier-Heiler. Trägt Stoff und Zauberstäbe. Starke Heilung, magischer Fernkampf.',
    allowedMaterials:['stoff','zauberstab'],      damageSchool:'magisch',
    dmgMult:0.65, healMult:1.6,
    ability:{ id:'heilkreis', name:'Heilkreis', icon:'➕', kind:'heal', cd:30000, healPct:0.5,
              desc:'Zündet einen leuchtenden Heilkreis – heilt alle Helden um 50 % ihrer maximalen HP.' } },
  { id:'kaempfer',    label:'Kämpfer',     icon:'⚔️',
    desc:'Krieger. Trägt Stoff und Leder. Ausgewogener physischer Schaden.',
    allowedMaterials:['stoff','leder'],          damageSchool:'physisch',
    dmgMult:1.0,  healMult:1.0,
    ability:{ id:'raserei', name:'Raserei', icon:'🔥', kind:'critBoost', cd:30000, dur:7000, critBonus:1.0,
              desc:'Entfacht 7 Sekunden lang flammende Raserei – +100 % Krit-Chance.' } },
  { id:'verteidiger', label:'Verteidiger', icon:'🛡️',
    desc:'Tank. Trägt Stoff, Leder und Platte. Sehr viel Rüstung, wenig Schaden.',
    allowedMaterials:['stoff','leder','platte'], damageSchool:'physisch',
    dmgMult:0.7,  healMult:1.0,
    ability:{ id:'schildwall', name:'Schildwall', icon:'🛡️', kind:'dmgReduce', cd:30000, dur:10000, dmgReduce:0.8,
              desc:'Errichtet 10 Sekunden lang einen pulsierenden Schildwall – alle Helden erleiden 80 % weniger Schaden.' } },
  { id:'hexer',       label:'Hexer',       icon:'🔮',
    desc:'Hexenmeister. Trägt nur Stoff. Magischer Schaden mit starkem Lebensraub – heilt sich durch Verschlingen.',
    allowedMaterials:['stoff','zauberstab'],      damageSchool:'magisch',
    dmgMult:0.8,  healMult:1.5,
    ability:{ id:'seelenraub', name:'Seelenraub', icon:'💀', kind:'drain', cd:26000, burstMult:2.0,
              desc:'Verschlingt die Seele des Ziels – 200 % Schaden und heilt dich um den verursachten Schaden.' } },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]));
export const DEFAULT_CLASS_ID = 'kaempfer';

// Aktuelle Klasse aus dem State (null-sicher mit Fallback).
export function classOf(state){ return CLASS_BY_ID[state && state.character && state.character.classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; }
export function allowedMaterials(state){ return classOf(state).allowedMaterials; }
export function damageSchool(state){ return classOf(state).damageSchool; }
// Grund-Spezialfähigkeit einer Klasse (null-sicher).
export function abilityOf(classId){ const c = CLASS_BY_ID[classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; return c.ability || null; }

// Alle nutzbaren aktiven Fähigkeiten eines Spielstands: Grundfähigkeit +
// die im Talentbaum gewählten Aktiven (max. 2). Jede mit eindeutiger id
// als Cooldown-Schlüssel.
export function abilitiesOf(stateLike){
  const classId = stateLike && stateLike.character && stateLike.character.classId;
  const base = abilityOf(classId);
  const list = base ? [base] : [];
  for(const a of chosenActiveAbilities(stateLike)) list.push(a);
  return list;
}
