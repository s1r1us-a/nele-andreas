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
    pros:['Stärkste Heilung (×1,6 Heilwirkung)','Magischer Fernkampf mit Zauberstäben','Magische Kugel als Nebenhand','Sehr robust – kämpft lange durch'],
    cons:['Geringster Schaden (×0,65)','Nur Stoffrüstung','Nur Zauberstäbe als Waffe','Nebenhand nur Kugeln – keine Schilde'],
    allowedMaterials:['stoff'],      damageSchool:'magisch',
    dmgMult:0.65, healMult:1.6,
    ability:{ id:'heilkreis', name:'Heilkreis', icon:'➕', kind:'heal', cd:30000, healPct:0.5,
              desc:'Zündet einen leuchtenden Heilkreis – heilt alle Helden um 50 % ihrer maximalen HP.' },
    ability2:{ id:'lichtsaeule', name:'Lichtsäule', icon:'🌟', kind:'healBurst', cd:30000, healPct:0.35, burstMult:3.0,
              desc:'Ruft eine gewaltige Lichtsäule herab – heilt alle Helden um 35 % ihrer maximalen HP und verbrennt den Gegner mit 300 % Schaden.' } },
  { id:'schurke',     label:'Schurke',     icon:'🗡️',
    desc:'Meuchelmörder. Trägt Stoff und Leder. Wendiger physischer Schaden mit zwei Klingen.',
    playstyle:'Flinker Schurke, der aus dem Verborgenen zuschlägt – höchstes Tempo und tödliche Krits, aber zerbrechlich, wenn er steht.',
    pros:['Höchster Grundschaden (×1,0)','Zweitklinge in der Nebenhand (Dual-Wield)','Stoff- & Lederrüstung','Kaltblütigkeit: +100 % Krit-Chance (7 s)'],
    cons:['Keine eigene Heilung','Keine Platte','Keine Zauberstäbe – nur physische Waffen','Keine Schilde – dafür Zweitklinge'],
    allowedMaterials:['stoff','leder'],          damageSchool:'physisch',
    dmgMult:1.0,  healMult:1.0,
    ability:{ id:'kaltblut', name:'Kaltblütigkeit', icon:'🩸', kind:'critBoost', cd:28000, dur:7000, critBonus:1.0,
              desc:'Versetzt dich 7 Sekunden lang in kalte Mordlust – +100 % Krit-Chance.' },
    ability2:{ id:'nebelschritt', name:'Nebelschritt', icon:'💨', kind:'vanish', cd:30000, dur:5000, ambushMult:4.0,
              desc:'Löst sich in einer Rauchwolke auf und ist 5 Sekunden lang unsichtbar – der Gegner kann dich weder sehen noch angreifen, und du greifst selbst nicht an. Beim Wiederauftauchen führst du einen garantierten kritischen Überfall (400 % Schaden) aus.' } },
  { id:'verteidiger', label:'Verteidiger', icon:'🛡️',
    desc:'Tank. Trägt Stoff, Leder und Platte. Sehr viel Rüstung, wenig Schaden.',
    playstyle:'Robuster Tank, der Treffer wegsteckt und Verbündete schützt. Stirbt selten, tötet aber langsam.',
    pros:['Trägt als Einziger Plattenrüstung','Einzige Klasse, die Schilde tragen kann','Höchste Rüstung & Überlebenskraft','Schildwall: −80 % erlittener Schaden (10 s)'],
    cons:['Niedriger Schaden (×0,7)','Lange Kämpfe','Keine Zauberstäbe – nur physische Waffen'],
    allowedMaterials:['stoff','leder','platte'], damageSchool:'physisch',
    dmgMult:0.7,  healMult:1.0,
    ability:{ id:'schildwall', name:'Schildwall', icon:'🛡️', kind:'dmgReduce', cd:32000, dur:10000, dmgReduce:0.8,
              desc:'Errichtet 10 Sekunden lang einen pulsierenden Schildwall – alle Helden erleiden 80 % weniger Schaden.' },
    ability2:{ id:'donnerknall', name:'Donnerknall', icon:'💥', kind:'stun', cd:26000, stunDur:4000, burstMult:1.2,
              desc:'Rammt den Schild mit einer Druckwelle in den Boden – fügt Schaden zu und betäubt den Gegner 4 Sekunden lang, sodass er nicht angreifen kann.' } },
  { id:'hexer',       label:'Hexer',       icon:'🔮',
    desc:'Hexenmeister. Trägt nur Stoff. Magischer Schaden mit starkem Lebensraub – heilt sich durch Verschlingen.',
    playstyle:'Magier mit Lebensraub: hält sich selbst durch ausgeteilten Schaden am Leben – schlagkräftig, aber zerbrechlich.',
    pros:['Magischer Schaden mit Lebensraub','Heilt sich selbst (×1,5 Heilwirkung)','Seelenkugel als Nebenhand','Seelenraub: 200 % Schaden/s + Selbstheilung (4 s)'],
    cons:['Sehr zerbrechlich – nur Stoffrüstung','Nur Zauberstäbe als Waffe','Nebenhand nur Kugeln – keine Schilde','Mittlerer Schaden (×0,8)'],
    allowedMaterials:['stoff'],      damageSchool:'magisch',
    dmgMult:0.8,  healMult:1.5,
    ability:{ id:'seelenraub', name:'Seelenraub', icon:'💀', kind:'drain', cd:26000,
              dur:4000, tickMs:1000, burstMult:2.0,
              desc:'Entfesselt 4 Sekunden lang einen Seelenstrahl – 200 % Schaden pro Sekunde und heilt dich um den gesamten verursachten Schaden.' },
    ability2:{ id:'teufelswache', name:'Teufelswache', icon:'👹', kind:'summon', cd:40000, petDur:10000, petBonus:0.25,
              desc:'Beschwört 10 Sekunden lang eine gewaltige Teufelswache an deiner Seite – sie verstärkt deinen gesamten Schaden um 25 %.' } },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]));
export const DEFAULT_CLASS_ID = 'schurke';

// Geschlechtsspezifischer Klassenname: männlich = Basis (Hexer), weiblich = +"in"
// (Hexerin), divers = +":in" (Hexer:in). Gilt einheitlich für alle Klassen
// (Heiler/Heilerin/Heiler:in, Verteidiger/Verteidigerin/Verteidiger:in, …).
// Endet die Basis auf "-e" (z. B. "Schurke"), entfällt das "e" vor dem Suffix
// → Schurke / Schurkin / Schurk:in.
const GENDER_SUFFIX = { w:'in', d:':in' };   // 'm' → kein Suffix
export function genderedLabel(baseLabel, gender){
  const suffix = GENDER_SUFFIX[gender];
  const base = baseLabel || '';
  if(!suffix) return base;                       // männlich = Basis
  const stem = base.endsWith('e') ? base.slice(0, -1) : base;
  return stem + suffix;
}
export function classLabelFor(classId, gender){
  const c = CLASS_BY_ID[classId] || CLASS_BY_ID[DEFAULT_CLASS_ID];
  return genderedLabel(c.label, gender);
}
// Aus einem Spielstand/Slot (null-sicher): Klassenname passend zum Geschlecht.
export function classLabelOf(stateLike){
  const ch = stateLike && stateLike.character;
  const c = classOf(stateLike);
  return genderedLabel(c.label, ch && ch.gender);
}

// Aktuelle Klasse aus dem State (null-sicher mit Fallback).
export function classOf(state){ return CLASS_BY_ID[state && state.character && state.character.classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; }
export function allowedMaterials(state){ return classOf(state).allowedMaterials; }
export function damageSchool(state){ return classOf(state).damageSchool; }
// Grund-Spezialfähigkeit einer Klasse (null-sicher).
export function abilityOf(classId){ const c = CLASS_BY_ID[classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; return c.ability || null; }
// Zweite, dauerhaft verfügbare Spezialfähigkeit einer Klasse (null-sicher).
export function ability2Of(classId){ const c = CLASS_BY_ID[classId] || CLASS_BY_ID[DEFAULT_CLASS_ID]; return c.ability2 || null; }

// Alle nutzbaren aktiven Fähigkeiten eines Spielstands: beide Grundfähigkeiten +
// die im Talentbaum gewählten Aktiven (max. 2). Jede mit eindeutiger id
// als Cooldown-Schlüssel.
export function abilitiesOf(stateLike){
  const classId = stateLike && stateLike.character && stateLike.character.classId;
  const base = abilityOf(classId);
  const list = base ? [base] : [];
  const base2 = ability2Of(classId);
  if(base2) list.push(base2);
  for(const a of chosenActiveAbilities(stateLike)) list.push(a);
  return list;
}
