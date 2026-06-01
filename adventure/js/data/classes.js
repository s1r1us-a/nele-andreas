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
    playstyle:'Magischer Fernkämpfer mit enormer Heilung. Sehr überlebensfähig, braucht aber Geduld, um Gegner niederzuringen.',
    pros:['Stärkste Heilung (×1,6 Heilwirkung)','Magischer Fernkampf mit Zauberstäben','Sehr robust – kämpft lange durch','Top-Stütze im Koop-Turm'],
    cons:['Geringster Schaden (×0,65)','Nur Stoffrüstung','Nur Zauberstäbe als Waffe','Kann keine Schilde tragen'],
    allowedMaterials:['stoff'],      damageSchool:'magisch',
    dmgMult:0.65, healMult:1.6,
    ability:{ id:'heilkreis', name:'Heilkreis', icon:'➕', kind:'heal', cd:30000, healPct:0.5,
              desc:'Zündet einen leuchtenden Heilkreis – heilt alle Helden um 50 % ihrer maximalen HP.' } },
  { id:'kaempfer',    label:'Kämpfer',     icon:'⚔️',
    desc:'Krieger. Trägt Stoff und Leder. Ausgewogener physischer Schaden.',
    playstyle:'Ausgewogener Nahkämpfer ohne echte Schwächen – der einfachste Einstieg und solide in jeder Lage.',
    pros:['Höchster Grundschaden (×1,0)','Ausgewogen & anfängerfreundlich','Stoff- & Lederrüstung','Raserei: +100 % Krit-Chance (7 s)'],
    cons:['Keine eigene Heilung','Keine Platte','Keine Zauberstäbe – nur physische Waffen','Kann keine Schilde tragen'],
    allowedMaterials:['stoff','leder'],          damageSchool:'physisch',
    dmgMult:1.0,  healMult:1.0,
    ability:{ id:'raserei', name:'Raserei', icon:'🔥', kind:'critBoost', cd:30000, dur:7000, critBonus:1.0,
              desc:'Entfacht 7 Sekunden lang flammende Raserei – +100 % Krit-Chance.' } },
  { id:'verteidiger', label:'Verteidiger', icon:'🛡️',
    desc:'Tank. Trägt Stoff, Leder und Platte. Sehr viel Rüstung, wenig Schaden.',
    playstyle:'Robuster Tank, der Treffer wegsteckt und Verbündete schützt. Stirbt selten, tötet aber langsam.',
    pros:['Trägt als Einziger Plattenrüstung','Einzige Klasse, die Schilde tragen kann','Höchste Rüstung & Überlebenskraft','Schildwall: −80 % erlittener Schaden (10 s)'],
    cons:['Niedriger Schaden (×0,7)','Lange Kämpfe','Keine Zauberstäbe – nur physische Waffen'],
    allowedMaterials:['stoff','leder','platte'], damageSchool:'physisch',
    dmgMult:0.7,  healMult:1.0,
    ability:{ id:'schildwall', name:'Schildwall', icon:'🛡️', kind:'dmgReduce', cd:30000, dur:10000, dmgReduce:0.8,
              desc:'Errichtet 10 Sekunden lang einen pulsierenden Schildwall – alle Helden erleiden 80 % weniger Schaden.' } },
  { id:'hexer',       label:'Hexer',       icon:'🔮',
    desc:'Hexenmeister. Trägt nur Stoff. Magischer Schaden mit starkem Lebensraub – heilt sich durch Verschlingen.',
    playstyle:'Magier mit Lebensraub: hält sich selbst durch ausgeteilten Schaden am Leben – schlagkräftig, aber zerbrechlich.',
    pros:['Magischer Schaden mit Lebensraub','Heilt sich selbst (×1,5 Heilwirkung)','Zauberstäbe mit starken Magie-Affixen','Seelenraub: 200 % Schaden + Selbstheilung'],
    cons:['Sehr zerbrechlich – nur Stoffrüstung','Nur Zauberstäbe als Waffe','Kann keine Schilde tragen','Mittlerer Schaden (×0,8)'],
    allowedMaterials:['stoff'],      damageSchool:'magisch',
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
