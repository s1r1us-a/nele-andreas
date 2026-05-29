/* =====================================================================
   KLASSEN (WoW-artig). Bei der Charaktererstellung gewählt, danach
   dauerhaft. Bestimmt tragbare Rüstungsmaterialien (stoff/leder/platte),
   die Schadensschule (magisch/physisch) und Kampf-Multiplikatoren.
   - allowedMaterials: welche Rüstungs-Materialien angelegt werden dürfen.
   - damageSchool: welcher Krit (critMagic/critPhys) im Kampf zählt.
   - dmgMult: skaliert den Grundangriff (Heiler/Verteidiger machen weniger).
   - healMult: skaliert Lebensraub/Heilung (Heiler heilt mehr).
   ===================================================================== */
export const CLASSES = [
  { id:'heiler',      label:'Heiler',      icon:'✨',
    desc:'Magier-Heiler. Trägt Stoff und Zauberstäbe. Starke Heilung, magischer Fernkampf.',
    allowedMaterials:['stoff','zauberstab'],      damageSchool:'magisch',
    dmgMult:0.65, healMult:1.6 },
  { id:'kaempfer',    label:'Kämpfer',     icon:'⚔️',
    desc:'Krieger. Trägt Stoff und Leder. Ausgewogener physischer Schaden.',
    allowedMaterials:['stoff','leder'],          damageSchool:'physisch',
    dmgMult:1.0,  healMult:1.0 },
  { id:'verteidiger', label:'Verteidiger', icon:'🛡️',
    desc:'Tank. Trägt Stoff, Leder und Platte. Sehr viel Rüstung, wenig Schaden.',
    allowedMaterials:['stoff','leder','platte'], damageSchool:'physisch',
    dmgMult:0.7,  healMult:1.0 },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]));
export const DEFAULT_CLASS_ID = 'kaempfer';

// Aktuelle Klasse aus dem State (null-sicher mit Fallback).
export function classOf(state){ return CLASS_BY_ID[state && state.character && state.character.classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; }
export function allowedMaterials(state){ return classOf(state).allowedMaterials; }
export function damageSchool(state){ return classOf(state).damageSchool; }
