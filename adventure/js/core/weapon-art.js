/* =====================================================================
   WEAPON-ART – prozedurale, einzigartige Optik der Tribut-Shop-Spezial-
   waffen (data/shopweapons.js, `special`-Schlüssel). EINE Quelle für das
   Inventar/Shop-Icon (item-art.js → buildItemSVG bei gesetztem `special`)
   UND die getragene Waffe am Helden (avatar.js → heldWeapon/Schild).
   Rein additiv & isoliert – wird nur betreten, wenn ein Item/Typ ein
   `special`-Feld trägt.

   Looks (nach den Referenzbildern):
     zwillinge – grün-türkise Sichel-Zwillingsklinge, goldenes Medaillon (Schurke)
     frost     – eisblaue, breite Runenklinge mit Frost-Glow (Verteidiger Haupthand)
     stachel   – hochkant lila Stachel-Plattenschild (Verteidiger Nebenhand)
     inferno   – Feuerstab: gebogene Klingen + glühender Glutkern (Hexer)
     engel     – Engelsstab: goldene Flügel + blau-weißer Schimmer (Heiler)
   ===================================================================== */
import { shade, star, dirGrad, ELEM, GOLD, WOOD, REDUCED_MOTION } from './svg-fx.js';

let SEQ = 0;
const f = n => Math.round(n*10)/10;

// Farbpaletten je Spezialwaffe.
const PAL = {
  zwillinge: { base:'#2fd6a0', dk:'#0d7350', hi:'#a6f2d4', edge:'#08543a' },
  frost:     { base:'#bfe6ff', dk:'#4a86c0', hi:'#ffffff', edge:'#2f6aa0', glow:'#5cc8ff', rune:'#7fe0ff' },
  stachel:   { base:'#6b5e8c', dk:'#332c4c', hi:'#b3a6d6', edge:'#201b32', stud:'#8d7fbd', rivet:'#cfc4ea' },
  inferno:   { wood:'#2c1e18', metal:'#7a4a36', dk:'#3a261d', hi:'#d4a888', glow:'#ff6a2a', core:'#ffd25a', edge:'#ff3a14' },
  engel:     { gold:'#e8c45a', goldDk:'#a8842c', goldHi:'#fff2c4', shaft:'#6f8ccf', shaftHi:'#d3e3ff', orb:'#cfe6ff', glow:'#a9d4ff' },
};

// Mini-Verlaufs-Registry für ein Icon (kollisionsfreie IDs je Build).
function mkReg(uid){
  let defs = '', i = 0; const seen = new Map();
  return {
    grad: c => { if(seen.has(c)) return seen.get(c);
      const id = 'wg'+(i++)+uid; defs += dirGrad(id, c); const u = `url(#${id})`; seen.set(c, u); return u; },
    raw: s => { defs += s; },
    defs: () => defs,
  };
}

/* =====================================================================
   ICONS (64×64) – self-contained Data-URI (wie item-art.js).
   ===================================================================== */
function iconWrap(uid, reg, body){
  const gid = 'wglow'+uid;
  reg.raw(`<filter id="${gid}" x="-50%" y="-50%" width="200%" height="200%">`+
    `<feDropShadow dx="0" dy="0" stdDeviation="2.0" flood-color="#ffd76a" flood-opacity="0.5"/></filter>`);
  const spark = REDUCED_MOTION ? '' :
    `<g opacity="0.9">${star(50,13,3,1,4,'#fff')}<animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${reg.defs()}</defs>`+
    `<g filter="url(#${gid})">${body}</g>${spark}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// grün-türkise Sichelklinge + goldenes Medaillon.
function icon_zwillinge(uid, reg){
  const P = PAL.zwillinge, G = reg.grad(P.base);
  let b = `<ellipse cx="32" cy="28" rx="15" ry="22" fill="${P.glow||P.base}" opacity="0.12"/>`;
  // gebogene Klinge (Spitze oben), leicht sichelförmig
  b += `<path d="M30 50 Q19 33 25 12 Q29 4 36 9 Q43 30 38 50 Z" fill="${G}" stroke="${P.edge}" stroke-width="1"/>`;
  // Barben/Zacken an der Außenkante
  b += `<path d="M25 17 L19 16 L25 20 Z M24 26 L18 26 L25 30 Z M25 36 L20 38 L26 39 Z" fill="${P.dk}"/>`;
  // innerer Glanz
  b += `<path d="M31 47 Q24 32 29 14" stroke="${P.hi}" stroke-width="1.3" fill="none" opacity="0.7"/>`;
  // goldenes Rundmedaillon am Ansatz
  b += `<circle cx="32" cy="50" r="7.5" fill="${GOLD}" stroke="${shade(GOLD,0.65)}" stroke-width="1.2"/>`+
       star(32,50,4.6,1.8,5,'#fff4cf',0.95)+`<circle cx="32" cy="50" r="1.8" fill="#3a2a6a"/>`;
  // Griff
  b += `<rect x="30" y="56" width="4" height="6" rx="1.5" fill="${WOOD}"/>`;
  return iconWrap(uid, reg, b);
}

// eisblaue, breite Runenklinge.
function icon_frost(uid, reg){
  const P = PAL.frost, G = reg.grad(P.base);
  let b = `<ellipse cx="32" cy="26" rx="13" ry="24" fill="${P.glow}" opacity="0.18"/>`;
  // breite Klinge
  b += `<path d="M32 3 L41 16 L40 44 L24 44 L23 16 Z" fill="${G}" stroke="${P.edge}" stroke-width="1.2"/>`;
  // Mittelgrat + Glanz
  b += `<path d="M32 6 L32 44" stroke="${P.hi}" stroke-width="1.4" opacity="0.6"/>`;
  // glühende Runen
  b += `<path d="M29 22 l4 0 m-3 4 l3 3 m-1 5 l-3 3" stroke="${P.rune}" stroke-width="1.3" fill="none" opacity="0.95" stroke-linecap="round"/>`;
  // Parierstange mit kleinen Dornen
  b += `<rect x="18" y="43" width="28" height="5" rx="2" fill="${shade(P.dk,1.1)}" stroke="${P.edge}" stroke-width="1"/>`+
       `<path d="M18 45 l-5 -3 l1 4 Z M46 45 l5 -3 l-1 4 Z" fill="${P.dk}"/>`;
  // Griff + Knauf
  b += `<rect x="30" y="47" width="4" height="11" rx="1.5" fill="${WOOD}"/>`+
       `<circle cx="32" cy="59" r="3.4" fill="${P.glow}" stroke="${P.edge}" stroke-width="1"/>`;
  return iconWrap(uid, reg, b);
}

// hochkant lila Stachel-Plattenschild.
function icon_stachel(uid, reg){
  const P = PAL.stachel, G = reg.grad(P.base);
  let b = '';
  // seitliche Stacheln (3 je Seite)
  for(const y of [16,32,48]){
    b += `<path d="M12 ${y-4} L3 ${y} L12 ${y+4} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="0.8"/>`+
         `<path d="M52 ${y-4} L61 ${y} L52 ${y+4} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="0.8"/>`;
  }
  // Korpus (hochkant, leicht gewölbt)
  b += `<rect x="12" y="5" width="40" height="54" rx="7" fill="${G}" stroke="${P.edge}" stroke-width="2"/>`;
  // Nieten oben & unten
  for(const x of [19,32,45]){
    b += `<circle cx="${x}" cy="11" r="1.8" fill="${P.rivet}"/><circle cx="${x}" cy="53" r="1.8" fill="${P.rivet}"/>`;
  }
  // erhabene Rauten (3×2 Raster)
  for(const cy of [24,40]) for(const cx of [22,32,42]){
    b += `<path d="M${cx} ${cy-5} L${cx+5} ${cy} L${cx} ${cy+5} L${cx-5} ${cy} Z" fill="${P.stud}" stroke="${P.edge}" stroke-width="0.9"/>`+
         `<path d="M${cx} ${cy-2.4} L${cx+2.4} ${cy} L${cx} ${cy+2.4} L${cx-2.4} ${cy} Z" fill="${P.hi}" opacity="0.5"/>`;
  }
  return iconWrap(uid, reg, b);
}

// Feuerstab: dunkler Schaft, gebogene Klingen, Glutkern.
function icon_inferno(uid, reg){
  const P = PAL.inferno;
  let b = `<ellipse cx="32" cy="16" rx="16" ry="15" fill="${P.glow}" opacity="0.22"/>`;
  // Schaft
  b += `<rect x="30" y="20" width="4" height="40" rx="1.5" fill="${reg.grad(P.wood)}"/>`+
       `<rect x="29" y="30" width="6" height="3" rx="1" fill="${P.metal}"/><rect x="29" y="44" width="6" height="3" rx="1" fill="${P.metal}"/>`;
  // gebogene Klingen am Kopf (gespiegelt)
  b += `<path d="M32 18 Q16 14 12 26 Q24 20 31 24 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`+
       `<path d="M32 18 Q48 14 52 26 Q40 20 33 24 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`+
       `<path d="M32 8 L28 16 L36 16 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`;
  // Glutkern (Ring + Kern)
  b += `<circle cx="32" cy="17" r="8" fill="${P.edge}" opacity="0.5"/>`+
       `<circle cx="32" cy="17" r="6" fill="${P.glow}"/>`+
       `<circle cx="32" cy="17" r="3.2" fill="${P.core}"/>`+
       `<circle cx="30" cy="15" r="1.4" fill="#fff" opacity="0.8"/>`;
  // Flammenzungen
  b += `<path d="M32 9 Q30 5 32 2 Q34 5 32 9 Z" fill="${P.core}" opacity="0.9"/>`;
  // Knauf
  b += `<circle cx="32" cy="60" r="3.2" fill="${P.metal}"/>`;
  return iconWrap(uid, reg, b);
}

// Engelsstab: goldene Flügel + blau-weißer Orb, blauer Schaft.
function icon_engel(uid, reg){
  const P = PAL.engel;
  let b = `<ellipse cx="32" cy="16" rx="16" ry="16" fill="${P.glow}" opacity="0.22"/>`;
  // Schaft (blau)
  b += `<rect x="30" y="22" width="4" height="38" rx="1.5" fill="${reg.grad(P.shaft)}"/>`+
       `<rect x="29" y="40" width="6" height="3" rx="1" fill="${P.gold}"/>`;
  // goldene Flügel (gespiegelt)
  const wing = d => `<path d="${d}" fill="${reg.grad(P.gold)}" stroke="${P.goldDk}" stroke-width="0.9"/>`;
  b += wing('M31 16 Q18 6 8 12 Q16 14 13 20 Q22 16 31 21 Z')+
       wing('M33 16 Q46 6 56 12 Q48 14 51 20 Q42 16 33 21 Z');
  // Federlinien
  b += `<path d="M12 13 q5 1 9 4 M51 13 q-5 1 -9 4" stroke="${P.goldHi}" stroke-width="0.8" fill="none" opacity="0.7"/>`;
  // blauer Orb
  b += `<circle cx="32" cy="16" r="6" fill="${P.glow}" opacity="0.5"/>`+
       `<circle cx="32" cy="16" r="4.4" fill="${P.orb}"/>`+
       `<circle cx="32" cy="16" r="2" fill="#fff"/>`;
  // Spitze oben + Knauf unten
  b += `<path d="M32 6 L29 13 L35 13 Z" fill="${P.gold}" stroke="${P.goldDk}" stroke-width="0.8"/>`+
       `<path d="M28 58 L36 58 L34 62 L30 62 Z" fill="${P.gold}"/>`;
  return iconWrap(uid, reg, b);
}

const ICONS = { zwillinge:icon_zwillinge, frost:icon_frost, stachel:icon_stachel, inferno:icon_inferno, engel:icon_engel };

// Öffentliche Icon-Funktion (für item-art.js). art/element/orb derzeit nicht
// nötig – die Optik ist je `special` festgelegt; Parameter für künftige Nutzung.
export function buildSpecialWeaponIcon(special, art, rarityKey, element, orb){
  const fn = ICONS[special];
  if(!fn) return null;
  const uid = '_w'+(SEQ++).toString(36);
  return fn(uid, mkReg(uid));
}

/* =====================================================================
   GETRAGEN (Avatar 200×320) – an den Handpunkt (hx,194) verankert.
   Spiegelt die Wrap-Logik aus avatar.js heldWeapon (tilt/scale/hand).
   ===================================================================== */
function heldWrap(inner, uid, opt, defaultTilt){
  opt = opt || {};
  const hx = opt.hx != null ? opt.hx : 124;
  const SCALE = (opt.scale || 1) * 1.16;   // Legendär-Größe wie reguläre Legendäre
  const grow = s => `<g transform="translate(${hx} 194) scale(${SCALE}) translate(${-hx} -194)">${s}</g>`;
  const tilt = opt.tilt != null ? opt.tilt : defaultTilt;
  const handRect = opt.noHand ? '' : `<rect x="${hx-6}" y="189" width="12" height="10" rx="4" fill="url(#sk${uid})"/>`;
  const tiltWrap = s => opt.noTilt ? s : `<g transform="rotate(${tilt} ${hx} 194)">${s}</g>`;
  return tiltWrap(grow(inner) + handRect);
}

function held_zwillinge(hx, uid){
  const P = PAL.zwillinge;
  let g = `<ellipse cx="${hx}" cy="150" rx="14" ry="40" fill="${P.base}" opacity="0.12"/>`;
  // Griff
  g += `<rect x="${hx-2}" y="184" width="4" height="16" rx="1.5" fill="${WOOD}"/>`;
  // gebogene Klinge (Spitze oben)
  g += `<path d="M${hx-4} 182 Q${hx-15} 150 ${hx-7} 118 Q${hx} 108 ${hx+6} 118 Q${hx+11} 150 ${hx+4} 182 Z" fill="${P.base}" stroke="${P.edge}" stroke-width="1.3"/>`;
  // Barben + Glanz
  g += `<path d="M${hx-7} 130 l-7 -2 l6 5 Z M${hx-8} 146 l-7 0 l6 5 Z M${hx-7} 162 l-6 3 l6 1 Z" fill="${P.dk}"/>`+
       `<path d="M${hx-2} 178 Q${hx-10} 150 ${hx-4} 122" stroke="${P.hi}" stroke-width="1.4" fill="none" opacity="0.7"/>`;
  // goldenes Medaillon am Ansatz
  g += `<circle cx="${hx}" cy="183" r="8" fill="${GOLD}" stroke="${shade(GOLD,0.65)}" stroke-width="1.3"/>`+
       star(hx,183,4.8,1.9,5,'#fff4cf',0.95)+`<circle cx="${hx}" cy="183" r="2" fill="#3a2a6a"/>`;
  return g;
}

function held_frost(hx, uid){
  const P = PAL.frost, E = ELEM.ice;
  let g = `<ellipse cx="${hx}" cy="150" rx="16" ry="48" fill="${E.glow}" opacity="0.20"/>`+
          `<ellipse cx="${hx}" cy="150" rx="9" ry="40" fill="${E.glow}" opacity="0.16"/>`;
  // Griff + Knauf
  g += `<rect x="${hx-2}" y="184" width="4" height="18" rx="1.5" fill="${WOOD}"/>`+
       `<circle cx="${hx}" cy="204" r="3.4" fill="${P.glow}"/>`;
  // breite Klinge
  g += `<path d="M${hx} 110 L${hx+8} 126 L${hx+7} 182 L${hx-7} 182 L${hx-8} 126 Z" fill="${P.base}" stroke="${P.edge}" stroke-width="1.3"/>`+
       `<path d="M${hx} 114 L${hx} 182" stroke="${P.hi}" stroke-width="1.6" opacity="0.6"/>`;
  // glühende Runen
  g += `<path d="M${hx-3} 138 l5 0 m-4 8 l4 4 m-1 8 l-4 4" stroke="${P.rune}" stroke-width="1.6" fill="none" opacity="0.95" stroke-linecap="round"/>`;
  // Parierstange mit Dornen
  g += `<rect x="${hx-13}" y="180" width="26" height="6" rx="2" fill="${shade(P.dk,1.1)}" stroke="${P.edge}" stroke-width="1"/>`+
       `<path d="M${hx-13} 183 l-7 -4 l1 6 Z M${hx+13} 183 l7 -4 l-1 6 Z" fill="${P.dk}"/>`;
  return g;
}

function held_inferno(hx, uid){
  const P = PAL.inferno;
  const oy = 116;
  let g = `<ellipse cx="${hx}" cy="${oy}" rx="20" ry="20" fill="${P.glow}" opacity="0.22"/>`+
          `<ellipse cx="${hx}" cy="${oy}" rx="13" ry="13" fill="${P.glow}" opacity="0.30"/>`;
  // Schaft
  g += `<rect x="${hx-2.5}" y="${oy+6}" width="5" height="${204-(oy+6)}" rx="2.5" fill="${P.wood}"/>`+
       `<rect x="${hx-4}" y="160" width="8" height="3" rx="1" fill="${P.metal}"/>`+
       `<circle cx="${hx}" cy="204" r="3.4" fill="${P.metal}"/>`;
  // gebogene Klingen am Kopf
  g += `<path d="M${hx} ${oy} Q${hx-22} ${oy-6} ${hx-28} ${oy+12} Q${hx-12} ${oy} ${hx-2} ${oy+6} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`+
       `<path d="M${hx} ${oy} Q${hx+22} ${oy-6} ${hx+28} ${oy+12} Q${hx+12} ${oy} ${hx+2} ${oy+6} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`+
       `<path d="M${hx} ${oy-16} L${hx-5} ${oy-4} L${hx+5} ${oy-4} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`;
  // Glutkern
  g += `<circle cx="${hx}" cy="${oy}" r="9" fill="${P.edge}" opacity="0.55"/>`+
       `<circle cx="${hx}" cy="${oy}" r="6.5" fill="${P.glow}"/>`+
       `<circle cx="${hx}" cy="${oy}" r="3.4" fill="${P.core}"/>`+
       `<circle cx="${hx-2}" cy="${oy-2}" r="1.5" fill="#fff" opacity="0.85"/>`;
  return g;
}

function held_engel(hx, uid){
  const P = PAL.engel;
  const oy = 116;
  let g = `<ellipse cx="${hx}" cy="${oy}" rx="20" ry="20" fill="${P.glow}" opacity="0.24"/>`+
          `<ellipse cx="${hx}" cy="${oy}" rx="11" ry="11" fill="#ffffff" opacity="0.20"/>`;
  // blauer Schaft
  g += `<rect x="${hx-2.5}" y="${oy+6}" width="5" height="${204-(oy+6)}" rx="2.5" fill="${P.shaft}"/>`+
       `<rect x="${hx-2}" y="${oy+10}" width="2" height="${188-oy}" fill="${P.shaftHi}" opacity="0.5"/>`+
       `<rect x="${hx-4}" y="160" width="8" height="3" rx="1" fill="${P.gold}"/>`+
       `<path d="M${hx-4} 200 L${hx+4} 200 L${hx+2} 206 L${hx-2} 206 Z" fill="${P.gold}"/>`;
  // goldene Flügel
  const wing = d => `<path d="${d}" fill="${P.gold}" stroke="${P.goldDk}" stroke-width="1"/>`;
  g += wing(`M${hx-2} ${oy} Q${hx-24} ${oy-16} ${hx-40} ${oy-8} Q${hx-26} ${oy-4} ${hx-31} ${oy+6} Q${hx-16} ${oy-2} ${hx-2} ${oy+6} Z`)+
       wing(`M${hx+2} ${oy} Q${hx+24} ${oy-16} ${hx+40} ${oy-8} Q${hx+26} ${oy-4} ${hx+31} ${oy+6} Q${hx+16} ${oy-2} ${hx+2} ${oy+6} Z`);
  g += `<path d="M${hx-34} ${oy-6} q8 2 14 6 M${hx+34} ${oy-6} q-8 2 -14 6" stroke="${P.goldHi}" stroke-width="1" fill="none" opacity="0.7"/>`;
  // Spitze + blauer Orb
  g += `<path d="M${hx} ${oy-18} L${hx-5} ${oy-7} L${hx+5} ${oy-7} Z" fill="${P.gold}" stroke="${P.goldDk}" stroke-width="1"/>`+
       `<circle cx="${hx}" cy="${oy}" r="6" fill="${P.glow}" opacity="0.6"/>`+
       `<circle cx="${hx}" cy="${oy}" r="4.4" fill="${P.orb}"/>`+
       `<circle cx="${hx}" cy="${oy}" r="2" fill="#fff"/>`;
  return g;
}

const HELD = {
  zwillinge: { build: held_zwillinge, tilt: 15 },
  frost:     { build: held_frost,     tilt: 15 },
  inferno:   { build: held_inferno,   tilt: 6  },
  engel:     { build: held_engel,     tilt: 6  },
};

// Getragene Spezialwaffe (Haupthand oder Schurken-Nebenhand-Klinge).
export function buildSpecialHeld(special, uid, opt){
  const h = HELD[special];
  if(!h) return '';
  opt = opt || {};
  const hx = opt.hx != null ? opt.hx : 124;
  return heldWrap(h.build(hx, uid), uid, opt, h.tilt);
}

// Getragener Spezial-Nebenhand-Schild (lila Stachelschild) – an der linken Hand.
export function buildSpecialShield(special, item, uid){
  if(special !== 'stachel') return '';
  const P = PAL.stachel;
  const cx = 72, cy = 178, w = 38, h = 60;
  const L = cx - w/2, T = cy - h/2;
  let g = `<ellipse cx="${cx}" cy="${cy}" rx="${w*0.8}" ry="${h*0.6}" fill="${P.stud}" opacity="0.12"/>`;
  // seitliche Stacheln
  for(const y of [T+12, cy, T+h-12]){
    g += `<path d="M${L} ${y-6} L${L-11} ${y} L${L} ${y+6} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="1"/>`+
         `<path d="M${L+w} ${y-6} L${L+w+11} ${y} L${L+w} ${y+6} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="1"/>`;
  }
  // Korpus
  g += `<rect x="${L}" y="${T}" width="${w}" height="${h}" rx="8" fill="${P.base}" stroke="${P.edge}" stroke-width="2.4"/>`+
       `<rect x="${L+4}" y="${T+4}" width="${w-8}" height="${h-8}" rx="6" fill="none" stroke="${P.hi}" stroke-width="1" opacity="0.4"/>`;
  // Nieten
  for(const x of [cx-11, cx, cx+11]){
    g += `<circle cx="${x}" cy="${T+8}" r="2.2" fill="${P.rivet}"/><circle cx="${x}" cy="${T+h-8}" r="2.2" fill="${P.rivet}"/>`;
  }
  // erhabene Rauten (3×3)
  for(const ry of [cy-16, cy, cy+16]) for(const rx of [cx-10, cx, cx+10]){
    g += `<path d="M${rx} ${ry-6} L${rx+6} ${ry} L${rx} ${ry+6} L${rx-6} ${ry} Z" fill="${P.stud}" stroke="${P.edge}" stroke-width="1"/>`+
         `<path d="M${rx} ${ry-3} L${rx+3} ${ry} L${rx} ${ry+3} L${rx-3} ${ry} Z" fill="${P.hi}" opacity="0.5"/>`;
  }
  return g;
}
