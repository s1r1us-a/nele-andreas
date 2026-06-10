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

// Illidan-artige Kriegsklinge: stark gebogene Sichel oben + Haken unten,
// mittig am goldenen Hub – grün-türkis.
function icon_zwillinge(uid, reg){
  const P = PAL.zwillinge, G = reg.grad(P.base);
  let b = `<ellipse cx="32" cy="30" rx="17" ry="26" fill="${P.base}" opacity="0.12"/>`;
  // große obere Sichelklinge (kräftige Kurve)
  b += `<path d="M31 50 C20 40 9 28 14 12 C16 4 26 2 31 11 C28 16 26 22 27 30 C29 40 33 44 37 50 Z" fill="${G}" stroke="${P.edge}" stroke-width="1"/>`;
  // Zacken an der Außenkante
  b += `<path d="M14 28 l-6 -1 l5 5 Z M15 18 l-6 1 l5 4 Z M15 38 l-5 3 l5 2 Z" fill="${P.dk}"/>`;
  // innerer Glanz
  b += `<path d="M30 47 C20 37 11 27 16 13" stroke="${P.hi}" stroke-width="1.3" fill="none" opacity="0.75"/>`;
  // unterer Haken (Rückklinge)
  b += `<path d="M34 54 C31 61 25 63 25 63 C29 59 32 57 35 51 Z" fill="${G}" stroke="${P.edge}" stroke-width="0.9"/>`;
  // zentrales goldenes Medaillon (Griffpunkt)
  b += `<circle cx="32" cy="51" r="7" fill="${GOLD}" stroke="${shade(GOLD,0.62)}" stroke-width="1.2"/>`+
       star(32,51,4.4,1.8,5,'#fff4cf',0.95)+`<circle cx="32" cy="51" r="1.8" fill="#3a2a6a"/>`;
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
function heldWrap(inner, uid, opt, defaultTilt, baseScale){
  opt = opt || {};
  const hx = opt.hx != null ? opt.hx : 124;
  // Deutlich größere Spezialwaffen (heroisch). baseScale je Waffe; opt.scale
  // verkleinert nur leicht die Nebenhand.
  const SCALE = (opt.scale || 1) * (baseScale || 1.4);
  const grow = s => `<g transform="translate(${hx} 194) scale(${SCALE}) translate(${-hx} -194)">${s}</g>`;
  const tilt = opt.tilt != null ? opt.tilt : defaultTilt;
  const handRect = opt.noHand ? '' : `<rect x="${hx-6}" y="189" width="12" height="10" rx="4" fill="url(#sk${uid})"/>`;
  const tiltWrap = s => opt.noTilt ? s : `<g transform="rotate(${tilt} ${hx} 194)">${s}</g>`;
  return tiltWrap(grow(inner) + handRect);
}

// Illidan-Kriegsklinge: stark gebogene Sichel-Glefe, MITTIG am goldenen Hub
// gegriffen – große Klinge nach oben, kleinerer Haken nach unten (Hand sitzt im
// Zentrum bei (hx,194)). Wird in der Nebenhand gespiegelt (echtes Paar).
function held_zwillinge(hx, uid){
  const P = PAL.zwillinge;
  let g = `<ellipse cx="${hx}" cy="160" rx="22" ry="58" fill="${P.base}" opacity="0.16"/>`;
  // große obere Sichelklinge (kräftige Auswärts-Kurve, hakt zur Spitze ein)
  g += `<path d="M${hx-3} 190 C${hx-16} 162 ${hx-30} 138 ${hx-26} 104 `+
       `C${hx-24} 92 ${hx-13} 86 ${hx-6} 94 C${hx-12} 100 ${hx-15} 110 ${hx-14} 122 `+
       `C${hx-11} 152 ${hx-2} 172 ${hx+4} 190 Z" fill="${P.base}" stroke="${P.edge}" stroke-width="1.5"/>`;
  // Zacken/Barben an der Außenkante der Oberklinge
  g += `<path d="M${hx-27} 150 l-9 -2 l8 6 Z M${hx-28} 128 l-9 1 l8 5 Z M${hx-24} 168 l-8 3 l8 3 Z" fill="${P.dk}"/>`;
  // innerer Schneiden-Glanz
  g += `<path d="M${hx-2} 186 C${hx-14} 160 ${hx-26} 138 ${hx-22} 108" stroke="${P.hi}" stroke-width="1.7" fill="none" opacity="0.75"/>`;
  // kleinerer unterer Haken (Rückklinge)
  g += `<path d="M${hx+3} 200 C${hx-2} 222 ${hx-13} 232 ${hx-13} 244 `+
       `C${hx-6} 238 ${hx} 228 ${hx+6} 210 Z" fill="${P.base}" stroke="${P.edge}" stroke-width="1.3"/>`;
  // zentraler goldener Hub = Griffpunkt (Hand liegt mittig darüber)
  g += `<circle cx="${hx}" cy="194" r="10" fill="${GOLD}" stroke="${shade(GOLD,0.6)}" stroke-width="1.6"/>`+
       `<circle cx="${hx}" cy="194" r="10" fill="none" stroke="${shade(GOLD,1.25)}" stroke-width="1" opacity="0.7"/>`+
       star(hx,194,5.8,2.3,5,'#fff4cf',0.95)+`<circle cx="${hx}" cy="194" r="2.4" fill="#3a2a6a"/>`;
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
  zwillinge: { build: held_zwillinge, tilt: 12, scale: 1.55 },
  frost:     { build: held_frost,     tilt: 14, scale: 1.55 },
  inferno:   { build: held_inferno,   tilt: 6,  scale: 1.4  },
  engel:     { build: held_engel,     tilt: 6,  scale: 1.4  },
};

// Getragene Spezialwaffe (Haupthand oder Schurken-Nebenhand-Klinge).
export function buildSpecialHeld(special, uid, opt){
  const h = HELD[special];
  if(!h) return '';
  opt = opt || {};
  const hx = opt.hx != null ? opt.hx : 124;
  let inner = h.build(hx, uid);
  // Zwillingsklingen in der Nebenhand (linke Hand, hx<100) spiegeln → echtes
  // Illidan-Paar (Klingen weisen nach außen).
  if(special === 'zwillinge' && hx < 100)
    inner = `<g transform="translate(${2*hx} 0) scale(-1 1)">${inner}</g>`;
  return heldWrap(inner, uid, opt, h.tilt, h.scale);
}

// Getragener Spezial-Nebenhand-Schild (lila Stachel-BOLLWERK) – an der linken
// Hand, bewusst sehr groß (deckt Schulter bis Oberschenkel) & im Vordergrund.
export function buildSpecialShield(special, item, uid){
  if(special !== 'stachel') return '';
  const P = PAL.stachel;
  const cx = 70, cy = 192, w = 72, h = 134;
  const L = cx - w/2, T = cy - h/2, R = L + w, Bm = T + h;
  let g = `<ellipse cx="${cx}" cy="${cy}" rx="${(w*0.85).toFixed(0)}" ry="${(h*0.58).toFixed(0)}" fill="${P.stud}" opacity="0.16"/>`;
  // kräftige seitliche Stacheln (4 je Seite)
  for(const y of [T+18, T+h*0.39, T+h*0.61, Bm-18]){
    g += `<path d="M${L} ${(y-9).toFixed(0)} L${L-18} ${y.toFixed(0)} L${L} ${(y+9).toFixed(0)} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="1.4"/>`+
         `<path d="M${R} ${(y-9).toFixed(0)} L${R+18} ${y.toFixed(0)} L${R} ${(y+9).toFixed(0)} Z" fill="${P.dk}" stroke="${P.edge}" stroke-width="1.4"/>`;
  }
  // Korpus (groß, gewölbt)
  g += `<rect x="${L}" y="${T}" width="${w}" height="${h}" rx="14" fill="${P.base}" stroke="${P.edge}" stroke-width="3.4"/>`+
       `<rect x="${L+7}" y="${T+7}" width="${w-14}" height="${h-14}" rx="10" fill="none" stroke="${P.hi}" stroke-width="1.6" opacity="0.4"/>`;
  // Nieten oben & unten (4)
  for(const x of [cx-21, cx-7, cx+7, cx+21]){
    g += `<circle cx="${x}" cy="${T+12}" r="2.8" fill="${P.rivet}"/><circle cx="${x}" cy="${Bm-12}" r="2.8" fill="${P.rivet}"/>`;
  }
  // erhabene Rauten (3×3 Raster)
  for(const ry of [cy-34, cy, cy+34]) for(const rx of [cx-19, cx, cx+19]){
    g += `<path d="M${rx} ${ry-11} L${rx+11} ${ry} L${rx} ${ry+11} L${rx-11} ${ry} Z" fill="${P.stud}" stroke="${P.edge}" stroke-width="1.3"/>`+
         `<path d="M${rx} ${(ry-5).toFixed(0)} L${rx+5} ${ry} L${rx} ${(ry+5).toFixed(0)} L${rx-5} ${ry} Z" fill="${P.hi}" opacity="0.5"/>`;
  }
  return g;
}
