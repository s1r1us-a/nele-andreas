// ============================================================
//  BILLIARD · TISCH- & RACK-DATEN  🎱
//  8-Ball. Koordinaten: Tischbett in der XZ-Ebene, Oberkante y = 0.
//  x = Breite, z = Länge. Maße in "Metern". Reine Daten + Rack-Hilfe.
// ============================================================

export const BALL_R = 0.30;

// Spielfläche (innerhalb der Banden)
export const TABLE = {
  play: { w: 10, l: 20 },     // x-Breite, z-Länge
  ballR: BALL_R,
  pocketR: 0.52,
  cushion: { t: 0.5, h: 0.62 },
  headSpot: { x: 0, z: -5 },   // Cue-Ball-Startpunkt
  footSpot: { x: 0, z: 5 },    // Rack-Spitze
  // 6 Taschen: 4 Ecken + 2 Seitenmitten (alle auf x = ±5)
  pockets: [
    { x: -5, z: -10 }, { x: 5, z: -10 },
    { x: -5, z: 0 }, { x: 5, z: 0 },
    { x: -5, z: 10 }, { x: 5, z: 10 },
  ],
};

// Kugel-Stammdaten: 0 = weiß (Cue), 1–7 Volle, 8 schwarz, 9–15 Halbe
export const BALLS = [
  { id: 0, type: 'cue', color: 0xf7f4ec },
  { id: 1, type: 'solid', color: 0xf2c400 },
  { id: 2, type: 'solid', color: 0x1f49b0 },
  { id: 3, type: 'solid', color: 0xd11f1f },
  { id: 4, type: 'solid', color: 0x6a2a8c },
  { id: 5, type: 'solid', color: 0xe07b1b },
  { id: 6, type: 'solid', color: 0x1f8a4c },
  { id: 7, type: 'solid', color: 0x8c2f1f },
  { id: 8, type: 'eight', color: 0x161616 },
  { id: 9, type: 'stripe', color: 0xf2c400 },
  { id: 10, type: 'stripe', color: 0x1f49b0 },
  { id: 11, type: 'stripe', color: 0xd11f1f },
  { id: 12, type: 'stripe', color: 0x6a2a8c },
  { id: 13, type: 'stripe', color: 0xe07b1b },
  { id: 14, type: 'stripe', color: 0x1f8a4c },
  { id: 15, type: 'stripe', color: 0x8c2f1f },
];

export function ballInfo(id) { return BALLS[id]; }
export function groupOf(id) {
  if (id >= 1 && id <= 7) return 'solids';
  if (id >= 9 && id <= 15) return 'stripes';
  return null; // cue / 8
}

// Frische Aufstellung: Cue am Kopfpunkt, 15 Kugeln im Dreieck am Fußpunkt.
// 8 in der Mitte, hintere Ecken gemischt (gängige Aufstellung).
const RACK_ROWS = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [6, 13, 7, 14, 15],
];

export function initialBalls() {
  const d = 2 * BALL_R + 0.006;          // Kugelabstand
  const rowGap = d * Math.sin(Math.PI / 3); // Reihenabstand (≈0.866·d)
  const out = [{ id: 0, x: TABLE.headSpot.x, z: TABLE.headSpot.z, pocketed: false }];
  RACK_ROWS.forEach((row, i) => {
    const z = TABLE.footSpot.z + i * rowGap;
    row.forEach((id, j) => {
      const x = (j - i / 2) * d;
      out.push({ id, x, z, pocketed: false });
    });
  });
  out.sort((a, b) => a.id - b.id);
  return out;
}
