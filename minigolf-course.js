// ============================================================
//  MINIGOLF · PARCOURS-DATEN  ⛳
//  9 Löcher als 3D-Geometrie-Beschreibung (reine Daten).
//  Koordinatensystem: Boden liegt in der XZ-Ebene, Oberkante bei y = 0.
//  x = Breite, z = Länge (Tee meist bei -z, Loch bei +z), y = Höhe.
//  Maße sind "Meter". Perimeter-Wände erzeugt die Engine automatisch
//  aus `ground`. Hier nur Tee, Loch, innere Wände & Spezialflächen.
// ============================================================

// Feld-Bausteine pro Loch:
//   par      – Soll-Schlagzahl
//   ground   – { w, l }  Bodenmaße (x-Breite, z-Länge)
//   tee      – { x, z }  Abschlagpunkt
//   cup      – { x, z, y? }  Lochposition (y = Höhe der Lochebene, Standard 0)
//   walls    – [{ x, z, w, l, h? }]  solide, achsen-parallele Quader (Standard h = 1.2)
//   bumpers  – [{ x, z, r? }]  runde, stark abprallende Pfosten (Standard r = 0.6)
//   ramps    – [{ x, z, w, l, h, axis:'x'|'z' }]  geneigte Fläche (steigt um h über Länge l)
//   plateaus – [{ x, z, w, l, h }]  erhöhte Plattform (Oberkante bei y = h)
//   water    – [{ x, z, w, l }]  Wasser-Zone → Ball zurück + 1 Strafschlag
//   sand     – [{ x, z, w, l }]  Sand-Zone → starke Bremsung

export const HOLES = [
  // 1 · Gerade Bahn zum Aufwärmen
  {
    par: 2,
    ground: { w: 8, l: 24 },
    tee: { x: 0, z: -10 },
    cup: { x: 0, z: 10 },
    walls: [], bumpers: [], ramps: [], plateaus: [], water: [], sand: [],
  },

  // 2 · Zickzack zwischen zwei Banden
  {
    par: 3,
    ground: { w: 11, l: 26 },
    tee: { x: 0, z: -11 },
    cup: { x: 0, z: 11 },
    walls: [
      { x: -3, z: -3, w: 5, l: 0.8 },
      { x: 3, z: 4, w: 5, l: 0.8 },
    ],
    bumpers: [], ramps: [], plateaus: [], water: [], sand: [],
  },

  // 3 · L-Kurve um einen großen Block
  {
    par: 3,
    ground: { w: 20, l: 20 },
    tee: { x: -6.5, z: -7 },
    cup: { x: 6.5, z: 7 },
    walls: [
      { x: 4, z: -4, w: 12, l: 12 }, // füllt die Ecke → erzwingt L-Korridor
    ],
    bumpers: [], ramps: [], plateaus: [], water: [], sand: [],
  },

  // 4 · Rotor & Bumper – durch die rotierende Stange timen
  {
    par: 3,
    ground: { w: 13, l: 26 },
    tee: { x: 0, z: -11 },
    cup: { x: 0, z: 11 },
    spinners: [{ x: 0, z: 1, length: 6, speed: 1.8 }],
    bumpers: [
      { x: -3, z: -6 }, { x: 3, z: -4 }, { x: -3.5, z: 8 }, { x: 3.5, z: 7 },
    ],
    walls: [], ramps: [], plateaus: [], water: [], sand: [],
  },

  // 5 · Sandbunker in der Mitte
  {
    par: 3,
    ground: { w: 11, l: 26 },
    tee: { x: 0, z: -11 },
    cup: { x: 0, z: 11 },
    sand: [{ x: 0, z: 0, w: 7, l: 7 }],
    walls: [], bumpers: [], ramps: [], plateaus: [], water: [],
  },

  // 6 · Wasserslalom mit Schiebe-Gatter
  {
    par: 4,
    ground: { w: 11, l: 30 },
    tee: { x: 0, z: -13 },
    cup: { x: 0, z: 13 },
    water: [
      { x: -2.8, z: -4, w: 5, l: 6 },
      { x: 2.8, z: 5, w: 5, l: 6 },
    ],
    movers: [{ x: 0, z: 0.5, w: 3, l: 0.9, axis: 'x', range: 3.5, speed: 2.6 }],
    walls: [], bumpers: [], ramps: [], plateaus: [], sand: [],
  },

  // 7 · Rampe hinauf zum erhöhten Loch
  {
    par: 4,
    ground: { w: 10, l: 30 },
    tee: { x: 0, z: -13 },
    cup: { x: 0, z: 11, y: 1.4 },
    ramps: [{ x: 0, z: 3, w: 6, l: 6, h: 1.4, axis: 'z' }],
    plateaus: [{ x: 0, z: 10, w: 9, l: 8, h: 1.4 }],
    walls: [], bumpers: [], water: [], sand: [],
  },

  // 8 · S-Galerie mit beweglichem Gatter
  {
    par: 4,
    ground: { w: 14, l: 26 },
    tee: { x: -4.5, z: -11 },
    cup: { x: 4.5, z: 11 },
    walls: [
      { x: -3.5, z: -5, w: 9, l: 0.8 },
      { x: 3.5, z: 1, w: 9, l: 0.8 },
      { x: -3.5, z: 7, w: 9, l: 0.8 },
    ],
    movers: [{ x: 0, z: -2, w: 3.5, l: 0.8, axis: 'x', range: 4, speed: 3.2 }],
    bumpers: [], ramps: [], plateaus: [], water: [], sand: [],
  },

  // 9 · Finale – Rotor, Bumper, Sand & Bande kombiniert
  {
    par: 5,
    ground: { w: 16, l: 32 },
    tee: { x: 0, z: -14 },
    cup: { x: 0, z: 14 },
    walls: [{ x: -4.5, z: 0, w: 7, l: 0.8 }],
    spinners: [{ x: 0, z: 4, length: 6, speed: 2.2 }],
    bumpers: [
      { x: -4, z: -6 }, { x: 4, z: -3 }, { x: -4, z: 9 },
    ],
    sand: [{ x: 4, z: 8, w: 5, l: 5 }],
    ramps: [], plateaus: [], water: [],
  },
];
