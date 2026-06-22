// ============================================================
//  BOWLING · DATEN & SCORING  🎳
//  Reine Konstanten, Bahn-/Pin-Geometrie und Punktelogik.
//  Keine Three.js-/Firebase-Abhängigkeiten → isoliert testbar
//  (vgl. minigolf-course.js / billiard-table.js).
// ============================================================

// ── Maße (Weltkoordinaten, Z = lange Bahnachse) ─────────────
export const BALL_R = 0.17;
export const PIN_R = 0.095;        // Kollisions-Radius des Pins
export const PIN_H = 0.62;         // Pin-Höhe
export const LANE_W = 1.6;         // spielbare Bahnbreite (zwischen den Rinnen)
export const GUTTER_W = 0.34;      // Rinnenbreite je Seite
export const FOUL_Z = 0;           // Foul-Linie
export const BALL_START_Z = -1.25; // Abwurfpunkt hinter der Foul-Linie
export const LANE_Z0 = -2.8;       // Bahn-/Anlaufbeginn (hinter dem Spieler)
export const LANE_Z1 = 19.2;       // Bahnende (hinter dem Pin-Deck → Grube)
export const HEAD_PIN_Z = 16.4;    // Position des vordersten Pins (Pin 1)

const SPACING = 0.46;              // seitlicher Pin-Abstand (Mitte–Mitte)
const ROW_DZ = SPACING * 0.866;    // Tiefenabstand der Reihen (gleichseitiges Dreieck)

// 10 Pins (Index 0..9 = Pins 1..10), Standard-Dreieck, Spitze zum Spieler
export const PINS = [
  { x: 0,            z: HEAD_PIN_Z },                 // 1
  { x: -SPACING / 2, z: HEAD_PIN_Z + ROW_DZ },        // 2
  { x:  SPACING / 2, z: HEAD_PIN_Z + ROW_DZ },        // 3
  { x: -SPACING,     z: HEAD_PIN_Z + ROW_DZ * 2 },    // 4
  { x: 0,            z: HEAD_PIN_Z + ROW_DZ * 2 },     // 5
  { x:  SPACING,     z: HEAD_PIN_Z + ROW_DZ * 2 },    // 6
  { x: -SPACING * 1.5, z: HEAD_PIN_Z + ROW_DZ * 3 },  // 7
  { x: -SPACING / 2,   z: HEAD_PIN_Z + ROW_DZ * 3 },  // 8
  { x:  SPACING / 2,   z: HEAD_PIN_Z + ROW_DZ * 3 },  // 9
  { x:  SPACING * 1.5, z: HEAD_PIN_Z + ROW_DZ * 3 },  // 10
];

// Mittelpunkt des Pin-Decks (für die Kamera-Schwenk nach dem Wurf)
export const DECK_CENTER = { x: 0, z: HEAD_PIN_Z + ROW_DZ * 1.5 };

// Ziel-Pfeile auf der Bahn (7 Stück, klassisch), rein optisch
export const ARROW_Z = 4.2;
export const ARROWS = [-3, -2, -1, 0, 1, 2, 3].map(i => ({
  x: i * 0.19,
  z: ARROW_Z + Math.abs(i) * 0.55, // Chevron: äußere Pfeile weiter weg
}));

export const NUM_FRAMES = 10;
export function fullRack() { return Array(10).fill(true); }

// ============================================================
//  SCORING (reine Funktionen)
//  frames = Array von Frames; jedes Frame = Array von Wurf-Werten
//  (Anzahl umgeworfener Pins pro Wurf).
// ============================================================

// Ist ein einzelnes Frame abgeschlossen?
export function frameComplete(frameIdx, rolls) {
  rolls = rolls || [];
  if (frameIdx < 9) {
    if (rolls.length === 0) return false;
    if (rolls[0] === 10) return true;          // Strike
    return rolls.length >= 2;
  }
  // 10. Frame: 3 Würfe bei Strike/Spare, sonst 2
  if (rolls.length < 2) return false;
  const bonus = rolls[0] === 10 || (rolls[0] + rolls[1]) === 10;
  return bonus ? rolls.length >= 3 : rolls.length >= 2;
}

// Ganzes Spiel fertig?
export function isGameComplete(frames) {
  return frames.length >= NUM_FRAMES && frameComplete(9, frames[9] || []);
}

// Kumulative Frame-Punkte + Gesamtsumme.
// Frames mit noch offenem Bonus (Strike/Spare ohne Folgeschläge) → null.
export function scoreFrames(frames) {
  const flat = [];
  for (const f of (frames || [])) for (const r of (f || [])) flat.push(r);

  const cum = [];
  let i = 0, running = 0, stopped = false;
  for (let f = 0; f < NUM_FRAMES; f++) {
    if (stopped) { cum.push(null); continue; }
    let fs = null, adv = 0;
    if (f < 9) {
      if (flat[i] === 10) {                                   // Strike
        adv = 1;
        if (i + 2 < flat.length) fs = 10 + flat[i + 1] + flat[i + 2];
      } else if (i + 1 < flat.length) {
        const two = flat[i] + flat[i + 1];
        if (two === 10) {                                     // Spare
          adv = 2;
          if (i + 2 < flat.length) fs = 10 + flat[i + 2];
        } else { adv = 2; fs = two; }                         // offenes Frame
      } else { adv = 0; }
    } else {
      const tenth = frames[9] || [];
      if (frameComplete(9, tenth)) fs = tenth.reduce((a, b) => a + b, 0);
      adv = tenth.length;
    }
    if (fs == null) { cum.push(null); stopped = true; i += adv; continue; }
    running += fs; cum.push(running); i += adv;
  }
  return { cum, total: running };
}

// Kürzel für einen Wurf in der Scorecard (X / Spare / Zahl / -)
export function rollSymbol(frameIdx, rollIdx, rolls) {
  const v = rolls[rollIdx];
  if (v == null) return '';
  if (v === 10) return 'X';
  // Spare: zweiter Wurf eines Frames füllt auf 10
  if (rollIdx > 0 && rolls[rollIdx - 1] !== 10 && rolls[rollIdx - 1] + v === 10) return '/';
  if (frameIdx === 9 && rollIdx === 2 && rolls[1] !== 10 && rolls[0] !== 10 && false) return '';
  if (v === 0) return '–';
  return String(v);
}
