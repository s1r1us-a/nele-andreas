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
const ANIM = !REDUCED_MOTION;   // Animationen nur ohne Bewegungsreduktion

// Farbpaletten je Spezialwaffe.
const PAL = {
  zwillinge: { base:'#2fd6a0', dk:'#0d7350', hi:'#a6f2d4', edge:'#08543a' },
  frost:     { base:'#bfe6ff', dk:'#4a86c0', hi:'#ffffff', edge:'#2f6aa0', glow:'#5cc8ff', rune:'#7fe0ff' },
  stachel:   { base:'#6b5e8c', dk:'#332c4c', hi:'#b3a6d6', edge:'#201b32', stud:'#8d7fbd', rivet:'#cfc4ea' },
  inferno:   { wood:'#140d09', metal:'#33200f', dk:'#180f08', hi:'#6e4a32', glow:'#b8300c', core:'#ff5a16', edge:'#4a1003', smoke:'#0d0907' },
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

function twinBladeDefs(prefix){
  return `<filter id="${prefix}-fel-glow" x="-50%" y="-50%" width="200%" height="200%">`+
    `<feGaussianBlur stdDeviation="18" result="blur1"/><feGaussianBlur stdDeviation="35" result="blur2"/>`+
    `<feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`+
    `<filter id="${prefix}-gem-glow" x="-30%" y="-30%" width="160%" height="160%">`+
    `<feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`+
    `<linearGradient id="${prefix}-blade-base" x1="100%" y1="50%" x2="0%" y2="50%">`+
    `<stop offset="0%" stop-color="#0a4d00"/><stop offset="70%" stop-color="#1cfc03"/><stop offset="100%" stop-color="#a3ff00"/></linearGradient>`+
    `<linearGradient id="${prefix}-blade-core" x1="100%" y1="50%" x2="0%" y2="50%">`+
    `<stop offset="0%" stop-color="#1cfc03" opacity="0"/><stop offset="80%" stop-color="#bfff80"/><stop offset="100%" stop-color="#ffffff"/></linearGradient>`+
    `<linearGradient id="${prefix}-gold-trim" x1="0%" y1="0%" x2="100%" y2="100%">`+
    `<stop offset="0%" stop-color="#ffea99"/><stop offset="40%" stop-color="#d4af37"/><stop offset="100%" stop-color="#665211"/></linearGradient>`+
    `<linearGradient id="${prefix}-dark-metal" x1="0%" y1="0%" x2="100%" y2="100%">`+
    `<stop offset="0%" stop-color="#3a3a3a"/><stop offset="50%" stop-color="#1a1a1a"/><stop offset="100%" stop-color="#050505"/></linearGradient>`+
    `<linearGradient id="${prefix}-silver-spike" x1="0%" y1="0%" x2="100%" y2="100%">`+
    `<stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#a0a0a0"/><stop offset="100%" stop-color="#333333"/></linearGradient>`;
}

function twinBladeBody(prefix){
  return `<g id="${prefix}-top-section">`+
    `<path d="M 370,600 L 350,540 L 290,500 L 330,470 C 260,380 220,230 110,80 C 290,160 460,330 490,470 L 440,490 L 460,520 C 450,550 410,580 370,600 Z" fill="#1cfc03" filter="url(#${prefix}-fel-glow)" opacity="0.7"/>`+
    `<path d="M 370,600 L 350,540 L 290,500 L 330,470 C 260,380 220,230 110,80 C 290,160 460,330 490,470 L 440,490 L 460,520 C 450,550 410,580 370,600 Z" fill="url(#${prefix}-blade-base)"/>`+
    `<path d="M 360,580 L 340,530 L 305,500 L 335,480 C 275,400 240,260 145,120 C 295,190 435,340 465,460 L 425,480 L 440,505 C 435,530 405,555 370,570 Z" fill="url(#${prefix}-blade-core)"/>`+
    `<path d="M 390,620 C 490,510 470,360 210,210 C 290,300 310,390 280,480 L 310,505 L 290,545 L 350,600 Z" fill="url(#${prefix}-dark-metal)" stroke="url(#${prefix}-gold-trim)" stroke-width="4" stroke-linejoin="round"/>`+
    `<path d="M 370,610 C 440,530 430,420 250,300 C 310,370 320,440 295,505 L 340,580 Z" fill="#1f1f1f" stroke="url(#${prefix}-gold-trim)" stroke-width="2"/></g>`+
    `<g id="${prefix}-bottom-section">`+
    `<path d="M 370,800 L 350,860 L 290,900 L 330,930 C 260,1020 220,1170 110,1320 C 290,1240 460,1070 490,930 L 440,910 L 460,880 C 450,850 410,820 370,800 Z" fill="#1cfc03" filter="url(#${prefix}-fel-glow)" opacity="0.7"/>`+
    `<path d="M 370,800 L 350,860 L 290,900 L 330,930 C 260,1020 220,1170 110,1320 C 290,1240 460,1070 490,930 L 440,910 L 460,880 C 450,850 410,820 370,800 Z" fill="url(#${prefix}-blade-base)"/>`+
    `<path d="M 360,820 L 340,870 L 305,900 L 335,920 C 275,1000 240,1140 145,1280 C 295,1210 435,1060 465,940 L 425,920 L 440,895 C 435,870 405,845 370,830 Z" fill="url(#${prefix}-blade-core)"/>`+
    `<path d="M 390,780 C 490,890 470,1040 210,1190 C 290,1100 310,1010 280,920 L 310,895 L 290,855 L 350,800 Z" fill="url(#${prefix}-dark-metal)" stroke="url(#${prefix}-gold-trim)" stroke-width="4" stroke-linejoin="round"/>`+
    `<path d="M 370,790 C 440,870 430,980 250,1100 C 310,1030 320,960 295,895 L 340,820 Z" fill="#1f1f1f" stroke="url(#${prefix}-gold-trim)" stroke-width="2"/></g>`+
    `<g id="${prefix}-center-guard">`+
    `<polygon points="260,700 310,580 430,580 490,650 540,700 490,750 430,820 310,820" fill="url(#${prefix}-dark-metal)" stroke="url(#${prefix}-gold-trim)" stroke-width="5" stroke-linejoin="round"/>`+
    `<polygon points="340,700 370,620 440,620 470,700 440,780 370,780" fill="#141414" stroke="url(#${prefix}-gold-trim)" stroke-width="3" stroke-linejoin="round"/>`+
    `<polygon points="390,660 410,680 310,610 330,670" fill="url(#${prefix}-silver-spike)" stroke="#000" stroke-width="2"/>`+
    `<polygon points="390,740 410,720 310,790 330,730" fill="url(#${prefix}-silver-spike)" stroke="#000" stroke-width="2"/>`+
    `<polygon points="420,700 430,680 520,700 430,720" fill="url(#${prefix}-silver-spike)" stroke="#000" stroke-width="2"/>`+
    `<path d="M 330,600 Q 380,640 450,600" fill="none" stroke="url(#${prefix}-gold-trim)" stroke-width="2"/>`+
    `<path d="M 330,800 Q 380,760 450,800" fill="none" stroke="url(#${prefix}-gold-trim)" stroke-width="2"/>`+
    `<polygon points="410,650 425,685 465,685 435,710 445,745 410,725 375,745 385,710 355,685 395,685" fill="#050505" stroke="url(#${prefix}-gold-trim)" stroke-width="2" stroke-linejoin="round"/>`+
    `<circle cx="410" cy="705" r="16" fill="#a3ff00" filter="url(#${prefix}-gem-glow)"/>`+
    `<circle cx="410" cy="705" r="6" fill="#ffffff"/></g>`;
}

function twinBladeContent(prefix, offhand){
  const body = twinBladeBody(prefix);
  return `<defs>${twinBladeDefs(prefix)}</defs>`+(offhand ? `<g transform="translate(800, 0) scale(-1, 1)">${body}</g>` : body);
}

function twinBladeSVG(prefix, offhand){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1400">${twinBladeContent(prefix, offhand)}</svg>`;
}

function twinBladeIcon(prefix, offhand){
  return 'data:image/svg+xml,' + encodeURIComponent(twinBladeSVG(prefix, offhand));
}

function icon_zwillinge(uid, reg){ return twinBladeIcon('tw-mh'+uid, false); }
function icon_zwillinge_mainhand(uid, reg){ return twinBladeIcon('tw-mh'+uid, false); }
function icon_zwillinge_offhand(uid, reg){ return twinBladeIcon('tw-oh'+uid, true); }

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
  let b = `<ellipse cx="32" cy="16" rx="18" ry="17" fill="${P.smoke}" opacity="0.55"/>`+
          `<ellipse cx="32" cy="16" rx="13" ry="12" fill="${P.glow}" opacity="0.18"/>`;
  // Schaft
  b += `<rect x="30" y="20" width="4" height="40" rx="1.5" fill="${reg.grad(P.wood)}"/>`+
       `<rect x="29" y="30" width="6" height="3" rx="1" fill="${P.metal}"/><rect x="29" y="44" width="6" height="3" rx="1" fill="${P.metal}"/>`;
  // gebogene Klingen am Kopf (gespiegelt)
  b += `<path d="M32 18 Q16 14 12 26 Q24 20 31 24 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`+
       `<path d="M32 18 Q48 14 52 26 Q40 20 33 24 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`+
       `<path d="M32 8 L28 16 L36 16 Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1"/>`;
  // verglimmender Glutkern (dunkle Fassung → tiefes Ember, kleiner heißer Kern)
  b += `<circle cx="32" cy="17" r="8.5" fill="${P.dk}"/>`+
       `<circle cx="32" cy="17" r="6.4" fill="${P.edge}" opacity="0.8"/>`+
       `<circle cx="32" cy="17" r="4.2" fill="${P.glow}"/>`+
       `<circle cx="32" cy="17" r="2.1" fill="${P.core}"/>`+
       `<circle cx="30.6" cy="15.6" r="1" fill="#ffb070" opacity="0.65"/>`;
  // dunkle Flammenzunge (gedämpft)
  b += `<path d="M32 9 Q30 5 32 2 Q34 5 32 9 Z" fill="${P.glow}" opacity="0.85"/>`;
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

// Nebenhand „Infernoherz" (Hexer): dunkle Glutkugel in verkohlter Klauenfassung.
function icon_infernoorb(uid, reg){
  const P = PAL.inferno;
  let b = `<ellipse cx="32" cy="34" rx="20" ry="20" fill="${P.smoke}" opacity="0.55"/>`;
  // verkohlte Klauen-Fassung
  b += `<path d="M14 30 Q9 45 17 53 M50 30 Q55 45 47 53 M32 50 L32 60" stroke="${P.metal}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  // Glutsphäre (dunkle Fassung → tiefes Ember → heißer Kern)
  b += `<circle cx="32" cy="34" r="16" fill="${P.dk}"/>`+
       `<circle cx="32" cy="34" r="13" fill="${P.edge}" opacity="0.78"/>`+
       `<circle cx="32" cy="34" r="9" fill="${P.glow}"/>`+
       `<circle cx="32" cy="34" r="4.4" fill="${P.core}"/>`+
       `<circle cx="29" cy="31" r="1.5" fill="#ffb070" opacity="0.7"/>`;
  // Glutrisse + Flammenzungen
  b += `<path d="M32 22 l-2 8 M44 34 l-7 1 M30 46 l1 -7" stroke="${P.core}" stroke-width="1" opacity="0.7" fill="none"/>`;
  b += `<path d="M32 18 Q29 12 32 6 Q35 12 32 18 Z M23 23 Q21 18 23 13 Q26 18 23 23 Z M41 23 Q43 18 41 13 Q38 18 41 23 Z" fill="${P.glow}" opacity="0.82"/>`;
  return iconWrap(uid, reg, b);
}

// Nebenhand „Seraphsphäre" (Heiler): strahlende Lichtkugel mit goldenen Flügeln.
function icon_engelsorb(uid, reg){
  const P = PAL.engel;
  let b = `<ellipse cx="32" cy="33" rx="21" ry="21" fill="${P.glow}" opacity="0.30"/>`;
  const wing = d => `<path d="${d}" fill="${reg.grad(P.gold)}" stroke="${P.goldDk}" stroke-width="0.8"/>`;
  b += wing('M22 31 Q9 22 2 29 Q11 30 7 36 Q15 31 22 35 Z')+
       wing('M42 31 Q55 22 62 29 Q53 30 57 36 Q49 31 42 35 Z');
  // Lichtsphäre + Goldring
  b += `<circle cx="32" cy="33" r="14" fill="${P.glow}" opacity="0.5"/>`+
       `<circle cx="32" cy="33" r="11" fill="${P.orb}"/>`+
       `<circle cx="32" cy="33" r="6" fill="#eaf4ff"/>`+
       `<circle cx="32" cy="33" r="14" fill="none" stroke="${P.gold}" stroke-width="1.7"/>`+
       `<circle cx="28.5" cy="29.5" r="2.4" fill="#fff"/>`;
  // innerer Lichtstern + Halo oben
  b += star(32,33,5,2,5,'#ffffff',0.5)+`<path d="M32 13 L30 18 L34 18 Z" fill="${P.gold}"/>`;
  return iconWrap(uid, reg, b);
}

const ICONS = { zwillinge:icon_zwillinge, zwillinge_mainhand:icon_zwillinge_mainhand, zwillinge_offhand:icon_zwillinge_offhand,
                frost:icon_frost, stachel:icon_stachel, inferno:icon_inferno, engel:icon_engel,
                infernoorb:icon_infernoorb, engelsorb:icon_engelsorb };

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

function heldTwinBlade(hx, uid, offhand){
  const prefix = (offhand ? 'tw-oh-held' : 'tw-mh-held') + uid;
  const gripX = offhand ? 390 : 410;
  const gripY = 705;
  return `<g transform="translate(${hx} 194) scale(0.138) translate(${-gripX} ${-gripY})">`+
    twinBladeContent(prefix, offhand)+
    `</g>`;
}

// Neue Zwillingsklingen: das SVG-Medaillon sitzt exakt auf dem Handpunkt
// (hx,194), damit der Avatar die Warglaive mittig im Griff hält.
function held_zwillinge(hx, uid){ return heldTwinBlade(hx, uid, hx < 100); }
function held_zwillinge_mainhand(hx, uid){ return heldTwinBlade(hx, uid, false); }
function held_zwillinge_offhand(hx, uid){ return heldTwinBlade(hx, uid, true); }

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
  let g = `<ellipse cx="${hx}" cy="${oy}" rx="24" ry="26" fill="${P.smoke}" opacity="0.6"/>`+
          `<ellipse cx="${hx}" cy="${oy}" rx="18" ry="18" fill="${P.glow}" opacity="0.15"/>`+
          `<ellipse cx="${hx}" cy="${oy}" rx="11" ry="11" fill="${P.glow}" opacity="0.22"/>`;
  // Schaft
  g += `<rect x="${hx-2.5}" y="${oy+6}" width="5" height="${204-(oy+6)}" rx="2.5" fill="${P.wood}"/>`+
       `<rect x="${hx-4}" y="160" width="8" height="3" rx="1" fill="${P.metal}"/>`+
       `<circle cx="${hx}" cy="204" r="3.4" fill="${P.metal}"/>`;
  // gebogene Klingen am Kopf
  g += `<path d="M${hx} ${oy} Q${hx-22} ${oy-6} ${hx-28} ${oy+12} Q${hx-12} ${oy} ${hx-2} ${oy+6} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`+
       `<path d="M${hx} ${oy} Q${hx+22} ${oy-6} ${hx+28} ${oy+12} Q${hx+12} ${oy} ${hx+2} ${oy+6} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`+
       `<path d="M${hx} ${oy-16} L${hx-5} ${oy-4} L${hx+5} ${oy-4} Z" fill="${P.metal}" stroke="${P.dk}" stroke-width="1.2"/>`;
  // verglimmender Glutkern: dunkle Fassung, tiefes Ember, kleiner heißer Kern
  g += `<circle cx="${hx}" cy="${oy}" r="10" fill="${P.dk}"/>`+
       `<circle cx="${hx}" cy="${oy}" r="7.4" fill="${P.edge}" opacity="0.82"/>`+
       `<circle cx="${hx}" cy="${oy}" r="5" fill="${P.glow}"/>`+
       `<circle cx="${hx}" cy="${oy}" r="2.6" fill="${P.core}"/>`+
       `<circle cx="${hx-1.6}" cy="${oy-1.6}" r="1.1" fill="#ffb070" opacity="0.6"/>`;
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

// tilt: stärker nach außen gekippt → Klingen/Köpfe weg vom Gesicht.
const HELD = {
  zwillinge: { build: held_zwillinge, tilt: 27, scale: 1.0 },
  zwillinge_mainhand: { build: held_zwillinge_mainhand, tilt: 27, scale: 1.0 },
  zwillinge_offhand: { build: held_zwillinge_offhand, tilt: -27, scale: 1.12 },
  frost:     { build: held_frost,     tilt: 22, scale: 1.5 },
  inferno:   { build: held_inferno,   tilt: 18, scale: 1.4 },
  engel:     { build: held_engel,     tilt: 18, scale: 1.4 },
};

// Getragene Spezialwaffe (Haupthand oder Schurken-Nebenhand-Klinge).
export function buildSpecialHeld(special, uid, opt){
  const h = HELD[special];
  if(!h) return '';
  opt = opt || {};
  const hx = opt.hx != null ? opt.hx : 124;
  const heldOpt = Object.assign({}, opt);
  if(special === 'zwillinge_mainhand' || special === 'zwillinge_offhand' || special === 'zwillinge'){
    heldOpt.tilt = special === 'zwillinge' && hx < 100 ? -27 : h.tilt;
  }
  let inner = h.build(hx, uid);
  return heldWrap(inner, uid, heldOpt, h.tilt, h.scale);
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

/* ---- Getragene Spezial-Nebenhand-KUGELN (Heiler/Hexer) -----------------
   Schweben an der linken Hand (cx,cy). Eigene, abgehobene Optik passend zum
   jeweiligen Spezial-Stab. Sanftes Schweben/Pulsieren wie offhandOrb. */
function held_infernoorb(cx, cy, uid){
  const P = PAL.inferno;
  const pulse = ANIM ? `<animate attributeName="opacity" values="0.5;0.74;0.5" dur="2.6s" repeatCount="indefinite"/>` : '';
  let g = `<ellipse cx="${cx}" cy="${cy}" rx="22" ry="22" fill="${P.smoke}" opacity="0.55"/>`+
          `<circle cx="${cx}" cy="${cy}" r="18" fill="${P.glow}" opacity="0.16">${pulse}</circle>`;
  // verkohlte Klauen-Fassung
  g += `<path d="M${cx-13} ${cy+3} Q${cx-17} ${cy+16} ${cx-8} ${cy+21} M${cx+13} ${cy+3} Q${cx+17} ${cy+16} ${cx+8} ${cy+21}" stroke="${P.metal}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  // Glutsphäre
  g += `<circle cx="${cx}" cy="${cy}" r="14" fill="${P.dk}"/>`+
       `<circle cx="${cx}" cy="${cy}" r="11" fill="${P.edge}" opacity="0.78"/>`+
       `<circle cx="${cx}" cy="${cy}" r="7.5" fill="${P.glow}"/>`+
       `<circle cx="${cx}" cy="${cy}" r="3.8" fill="${P.core}"/>`+
       `<circle cx="${cx-2.5}" cy="${cy-2.5}" r="1.4" fill="#ffb070" opacity="0.7"/>`;
  // Glutrisse + Flammenzunge oben
  g += `<path d="M${cx} ${cy-10} l-2 7 M${cx+10} ${cy} l-6 1 M${cx-3} ${cy+10} l1 -6" stroke="${P.core}" stroke-width="1.1" opacity="0.7" fill="none"/>`+
       `<path d="M${cx} ${cy-15} Q${cx-3} ${cy-22} ${cx} ${cy-28} Q${cx+3} ${cy-22} ${cx} ${cy-15} Z" fill="${P.glow}" opacity="0.8"/>`;
  return ANIM
    ? `<g>${g}<animateTransform attributeName="transform" type="translate" values="0 0;0 -2.6;0 0" dur="3.4s" repeatCount="indefinite"/></g>`
    : g;
}

function held_engelsorb(cx, cy, uid){
  const P = PAL.engel;
  const pulse = ANIM ? `<animate attributeName="opacity" values="0.22;0.42;0.22" dur="2.8s" repeatCount="indefinite"/>` : '';
  let g = `<circle cx="${cx}" cy="${cy}" r="21" fill="${P.glow}" opacity="0.22">${pulse}</circle>`+
          `<circle cx="${cx}" cy="${cy}" r="13" fill="#ffffff" opacity="0.16"/>`;
  // goldene Flügel
  const wing = d => `<path d="${d}" fill="${P.gold}" stroke="${P.goldDk}" stroke-width="1"/>`;
  g += wing(`M${cx-9} ${cy-2} Q${cx-26} ${cy-13} ${cx-41} ${cy-5} Q${cx-28} ${cy-2} ${cx-33} ${cy+7} Q${cx-22} ${cy-1} ${cx-9} ${cy+4} Z`)+
       wing(`M${cx+9} ${cy-2} Q${cx+26} ${cy-13} ${cx+41} ${cy-5} Q${cx+28} ${cy-2} ${cx+33} ${cy+7} Q${cx+22} ${cy-1} ${cx+9} ${cy+4} Z`);
  g += `<path d="M${cx-35} ${cy-7} q8 2 14 6 M${cx+35} ${cy-7} q-8 2 -14 6" stroke="${P.goldHi}" stroke-width="1" fill="none" opacity="0.7"/>`;
  // Lichtsphäre + Goldring
  g += `<circle cx="${cx}" cy="${cy}" r="13" fill="${P.orb}"/>`+
       `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${P.gold}" stroke-width="1.8"/>`+
       `<circle cx="${cx}" cy="${cy}" r="6.5" fill="#eaf4ff"/>`+
       `<circle cx="${cx-4}" cy="${cy-4}" r="2.6" fill="#fff" opacity="0.85"/>`+
       star(cx, cy-20, 4.5, 1.8, 5, '#ffffff', 0.8);
  return ANIM
    ? `<g>${g}<animateTransform attributeName="transform" type="translate" values="0 0;0 -2.6;0 0" dur="3.6s" repeatCount="indefinite"/></g>`
    : g;
}

// Dispatcher für getragene Spezial-Nebenhand-Kugeln (linke Hand bei 74,174).
export function buildSpecialOffhandOrb(special, item, uid){
  if(special === 'infernoorb') return held_infernoorb(74, 174, uid);
  if(special === 'engelsorb')  return held_engelsorb(74, 174, uid);
  return '';
}
