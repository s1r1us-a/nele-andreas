/* =====================================================================
   AVATAR – prozeduraler SVG-Held aus Geschlecht/Frisur/Haar-/Haut-/
   Augenfarbe. Vektor-Look mit Verläufen, Glanz und sauberer Symmetrie.
   viewBox 200x320 (5:8 Ganzkörper) für feine, symmetrische Bezier-Kurven.
   ===================================================================== */
import { ASSETS } from '../data/tuning.js';
import { DEFAULT_CHARACTER, SKIN_TONE, EYE_DEFAULT } from '../data/character-options.js';
import { rarityIndex } from '../data/rarities.js';
import { ELEM, elementOf, shade, mirror200 as mirror, ARMOR_MAT, WEAPON_METAL,
         GOLD, WOOD, makeGradReg, materialFilter, softShadowFilter, rimLightFilter,
         engraving, REDUCED_MOTION } from './svg-fx.js';

// Animationen nur, wenn der Nutzer keine Bewegungsreduktion wünscht.
const ANIM = !REDUCED_MOTION;
import { typeOf } from '../data/itemTypes.js';
import { dyeColorOf } from '../data/dyes.js';
import { setOf, setThemeOf } from '../data/sets.js';
import { setShoulder, setHelmCrest, setChestEmblem, setBaseColor, setPalette, setMacroFX } from './set-art.js';
import { buildSpecialHeld, buildSpecialShield, buildSpecialOffhandOrb } from './weapon-art.js';
import { state } from './state.js';

// Element-Effektstufe nach Seltenheit: 0=<Episch, 1=Episch, 2=Legendär, 3=Mythisch.
const armorLvl = rk => { const r = rarityIndex(rk); return r>=5?3:r>=4?2:r>=3?1:0; };

const TIER_OUTFIT = ['#6b5a8a','#3f6f9e','#9e6b2e','#b5882a'];
const TIER_TRIM   = ['#9a86c2','#7fb0e0','#e0a85a','#f2cd6b'];
// WEAPON_METAL/WOOD/GOLD kommen aus svg-fx.js (geteilt mit item-art.js).
// Kugel-Paletten für Zauberstäbe (orb: rot/blau/gruen) – hell/mittel/dunkel/Glow.
const ORB_PAL = {
  rot:   { hi:'#ffd0d0', mid:'#ff3b3b', lo:'#7a0d0d', glow:'#ff5a3c' },
  blau:  { hi:'#cfe6ff', mid:'#3aa0ff', lo:'#0a3a73', glow:'#58a6ff' },
  gruen: { hi:'#d6ffe0', mid:'#37d67a', lo:'#0c5a2c', glow:'#4dff86' },
};
// ARMOR_MAT (12 Farben) kommt aus svg-fx.js – IDENTISCH zwischen Avatar & Icon,
// damit Inventar-Icon und getragenes Teil farblich exakt übereinstimmen.
// Farbstoff (item.dye) überschreibt die Material-Standardfarbe → getragenes Teil
// am Avatar färbt sich exakt wie das Inventar-Icon.
// Set-Items überschreiben die Farbe mit ihrer Theme-Basisfarbe (Glut/Blut/Leere/Licht),
// damit das getragene Teil sofort als Set erkennbar ist.
const matOf = it => (setThemeOf(it) ? setBaseColor(setThemeOf(it)) : null) || dyeColorOf(it) || ARMOR_MAT[(((it && it.variant)|0) % ARMOR_MAT.length + ARMOR_MAT.length) % ARMOR_MAT.length];
// Textur-Typ eines Rüstungsteils aus dem Item-Typ ableiten: Spezial-Keys
// (Ketten/Schuppen) erhalten ein eigenes Muster, sonst nach Materialklasse.
function textureOf(it){
  const t = typeOf(it), k = (t && t.key) || '', m = (t && t.material) || 'platte';
  if(k === 'ketten') return 'ketten';
  if(k === 'schuppen' || k === 'drachenschuppe') return 'schuppen';
  return (m === 'stoff' || m === 'leder' || m === 'platte') ? m : 'platte';
}

// shade() & mirror() (mirror200) kommen aus svg-fx.js (geteilt mit item-art.js).

// Eindeutige Gradient-IDs pro Build (mehrere Avatare rendern gleichzeitig).
let GRAD_SEQ = 0;

// Getragene Waffe in einer Hand (Standard: rechte Hand, Handkreis cx=124, cy=194),
// Klinge nach oben. `opt` erlaubt das Wiederverwenden für die linke Nebenhand:
//   opt.hx = Hand-X (z. B. 76 für links), opt.tilt = Neigung, opt.scale = Grundgröße.
function heldWeapon(item, uid, opt){
  if(!item || typeof item.variant !== 'number') return '';
  opt = opt || {};
  const v = ((item.variant|0)%13+13)%13;        // 0..12 (analog item-art.js)
  const lvl = armorLvl(item.rarity);            // Episch+ → Element-Glow
  // opt.element erlaubt das Übersteuern (Waffen-Ebene ohne echtes Item-id).
  const el = (opt.element==='ice'||opt.element==='fire') ? opt.element : elementOf(item.id), E = ELEM[el];
  const m = WEAPON_METAL[v % WEAPON_METAL.length], md = shade(m,0.55), mh = shade(m,1.25);
  const hx = opt.hx != null ? opt.hx : 124;
  // Größe nach Seltenheit: Legendär (lvl2) & Mythisch (lvl3) sind deutlich
  // größer als normale Waffen; skaliert um den Handpunkt, damit die Hand sitzt.
  // opt.scale verkleinert Zweitwaffen (Nebenhand) gegenüber der Hauptwaffe.
  const SCALE = ([1, 1, 1.16, 1.32][lvl] || 1) * (opt.scale || 1);
  const grow = inner => SCALE!==1 ? `<g transform="translate(${hx} 194) scale(${SCALE}) translate(${-hx} -194)">${inner}</g>` : inner;
  const ty = opt.ty || typeOf(item);
  // Spezial-Waffe (Tribut-Shop): komplett eigene, am Handpunkt verankerte Optik.
  const sp = ty && ty.special;
  if(sp) return buildSpecialHeld(sp, uid, Object.assign({}, opt, { element: ty.element, orb: ty.orb }));
  // Waffe natürlicher halten: leicht von der Körpermitte weg kippen (Drehpunkt =
  // Handkreis hx,194). Zauberstab bleibt aufrechter, damit die Kugel oben bleibt.
  const tilt = (ty && ty.material === 'zauberstab') ? 6 : (opt.tilt != null ? opt.tilt : 15);
  // opt.noTilt: aufrecht zeichnen (für die separat animierte Waffen-Ebene, die ihre
  // Ruhe-/Schwung-Drehung extern per CSS um den Griff bekommt).
  const tiltWrap = inner => opt.noTilt ? inner : `<g transform="rotate(${tilt} ${hx} 194)">${inner}</g>`;
  // opt.noHand: Hand-Rechteck weglassen (die Hand bleibt am Körper-Sprite).
  const handRect = opt.noHand ? '' : `<rect x="${hx-6}" y="189" width="12" height="10" rx="4" fill="url(#sk${uid})"/>`;
  // Zauberstab: langer Stab mit leuchtender Kugel oben (Farbe je nach Stab-Typ).
  if(ty && ty.material === 'zauberstab'){
    const P = ORB_PAL[ty.orb] || ORB_PAL.rot;
    const oy = 112;                                   // Höhe der Kugel
    const pole = `<rect x="${hx-2.5}" y="${oy}" width="5" height="${204-oy}" rx="2.5" fill="${WOOD}"/>`+
                 `<rect x="${hx-2.5}" y="${oy+4}" width="2" height="${198-oy}" fill="${shade(WOOD,1.3)}" opacity="0.5"/>`+
                 `<rect x="${hx-5}" y="${oy+6}" width="10" height="5" rx="2" fill="${GOLD}"/>`;  // Fassung
    // Äußerer Glow pulsiert (Radius + Opazität atmen) – Stab-Kugel „lebt".
    const orbPulse = ANIM
      ? `<animate attributeName="r" values="18;21;18" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.30;0.12;0.30" dur="2.8s" repeatCount="indefinite"/>`
      : '';
    let glow = `<circle cx="${hx}" cy="${oy}" r="18" fill="${P.glow}" opacity="0.30">${orbPulse}</circle>`+
               `<circle cx="${hx}" cy="${oy}" r="12" fill="${P.glow}" opacity="0.35"/>`;
    // Legendär/Mythisch: zusätzlicher, weicher Außen-Glow um die Kugel.
    if(lvl>0) glow = `<circle cx="${hx}" cy="${oy}" r="${22+lvl*4}" fill="${P.glow}" opacity="${(0.15+lvl*0.06).toFixed(2)}"/>`+glow;
    const orb  = `<circle cx="${hx}" cy="${oy}" r="9" fill="${P.mid}" stroke="${P.lo}" stroke-width="1"/>`+
                 `<circle cx="${hx-3}" cy="${oy-3}" r="3.4" fill="${P.hi}" opacity="0.9"/>`;
    return tiltWrap(grow(glow + pole + orb) + handRect);
  }
  const grip = `<rect x="${hx-2}" y="186" width="4" height="16" rx="1.5" fill="${WOOD}"/>`+
               `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  let w = '';
  if(v===0){            // Schwert
    w = `<rect x="${hx-9}" y="182" width="18" height="4" rx="1.5" fill="${GOLD}"/>`+
        `<path d="M${hx} 120 L${hx+4} 128 L${hx+4} 182 L${hx-4} 182 L${hx-4} 128 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-1.5}" y="128" width="2" height="52" fill="${mh}" opacity="0.5"/>`+ grip;
  } else if(v===1){     // Dolch
    w = `<rect x="${hx-7}" y="183" width="14" height="3.5" rx="1.5" fill="${GOLD}"/>`+
        `<path d="M${hx} 144 L${hx+4} 150 L${hx+3} 183 L${hx-3} 183 L${hx-4} 150 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+ grip;
  } else if(v===2){     // Streitkolben
    w = `<rect x="${hx-2}" y="150" width="4" height="52" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx} 127 L${hx-4} 135 L${hx+4} 135 Z" fill="${md}"/>`+
        `<path d="M${hx-12} 140 L${hx-3} 136 L${hx-3} 144 Z" fill="${md}"/>`+
        `<path d="M${hx+12} 140 L${hx+3} 136 L${hx+3} 144 Z" fill="${md}"/>`+
        `<circle cx="${hx}" cy="140" r="11" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<circle cx="${hx-3}" cy="137" r="3" fill="${mh}" opacity="0.6"/>`+
        `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  } else if(v===3){     // Axt
    w = `<rect x="${hx-2}" y="124" width="4" height="78" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx+1} 128 L${hx+18} 124 Q${hx+27} 139 ${hx+18} 153 L${hx+1} 149 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  } else if(v===4){     // Speer
    w = `<rect x="${hx-2}" y="126" width="4" height="76" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx} 111 L${hx+6} 128 L${hx-6} 128 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-5}" y="127" width="10" height="3" rx="1" fill="${GOLD}"/>`+
        `<circle cx="${hx}" cy="204" r="3" fill="${GOLD}"/>`;
  } else if(v===5){     // Kriegshammer
    w = `<rect x="${hx-2}" y="150" width="4" height="52" rx="1.5" fill="${WOOD}"/>`+
        `<rect x="${hx-15}" y="128" width="30" height="18" rx="3" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-12}" y="131" width="6" height="12" rx="1" fill="${mh}" opacity="0.5"/>`+
        `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  } else if(v===7){     // Krummsäbel (gekrümmte Klinge)
    w = `<rect x="${hx-7}" y="182" width="14" height="4" rx="1.5" fill="${GOLD}"/>`+
        `<path d="M${hx-3} 182 Q${hx-15} 150 ${hx-7} 120 Q${hx+1} 116 ${hx+5} 126 Q${hx+9} 156 ${hx+3} 182 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<path d="M${hx-1} 178 Q${hx-10} 150 ${hx-4} 126" stroke="${mh}" stroke-width="1.2" fill="none" opacity="0.5"/>`+ grip;
  } else if(v===8){     // Großschwert (breite, lange Klinge)
    w = `<rect x="${hx-12}" y="181" width="24" height="5" rx="2" fill="${GOLD}"/>`+
        `<path d="M${hx} 112 L${hx+6} 124 L${hx+6} 181 L${hx-6} 181 L${hx-6} 124 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-1.5}" y="124" width="3" height="56" fill="${mh}" opacity="0.5"/>`+ grip;
  } else if(v===9){     // Sense (Sichelklinge an langem Schaft)
    w = `<rect x="${hx-2}" y="120" width="4" height="82" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx+1} 122 Q${hx-26} 121 ${hx-31} 143 Q${hx-15} 132 ${hx+2} 134 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<path d="M${hx-1} 125 Q${hx-19} 126 ${hx-25} 140" stroke="${mh}" stroke-width="1.2" fill="none" opacity="0.5"/>`+
        `<circle cx="${hx}" cy="204" r="3" fill="${GOLD}"/>`;
  } else if(v===10){    // Doppelaxt (beidseitiges Blatt)
    w = `<rect x="${hx-2}" y="124" width="4" height="78" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx+1} 128 L${hx+17} 124 Q${hx+25} 138 ${hx+17} 152 L${hx+1} 148 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<path d="M${hx-1} 128 L${hx-17} 124 Q${hx-25} 138 ${hx-17} 152 L${hx-1} 148 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<circle cx="${hx}" cy="204" r="3" fill="${GOLD}"/>`;
  } else if(v===11){    // Glefe (Stangenklinge)
    w = `<rect x="${hx-2}" y="126" width="4" height="76" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx} 108 Q${hx+11} 120 ${hx+7} 136 L${hx} 129 L${hx-7} 136 Q${hx-11} 120 ${hx} 108 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-5}" y="131" width="10" height="3.5" rx="1" fill="${GOLD}"/>`+
        `<circle cx="${hx}" cy="204" r="3" fill="${GOLD}"/>`;
  } else if(v===12){    // Kriegskeule (gestreckter, genoppter Knauf)
    w = `<rect x="${hx-2}" y="150" width="4" height="52" rx="1.5" fill="${WOOD}"/>`+
        `<path d="M${hx-9} 122 Q${hx+9} 120 ${hx+9} 142 Q${hx+9} 156 ${hx} 156 Q${hx-9} 154 ${hx-9} 122 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<circle cx="${hx-3}" cy="132" r="1.8" fill="${md}"/><circle cx="${hx+3}" cy="143" r="1.8" fill="${md}"/>`+
        `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  } else {              // Fallback (inkl. v6) → Schwert
    w = `<rect x="${hx-9}" y="182" width="18" height="4" rx="1.5" fill="${GOLD}"/>`+
        `<path d="M${hx} 120 L${hx+4} 128 L${hx+4} 182 L${hx-4} 182 L${hx-4} 128 Z" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-1.5}" y="128" width="2" height="52" fill="${mh}" opacity="0.5"/>`+ grip;
  }
  // Element-Glow hinter der Waffe (Episch+): mehrlagig, wächst mit Größe/Stufe;
  // heller Kern ab Legendär für einen „coolen" leuchtenden Look.
  let halo = '';
  if(lvl>0){
    const gw = (12+lvl*5)*SCALE, gh = (48+lvl*7)*SCALE;
    const o2 = (0.16+lvl*0.07);
    // Innerer Element-Glow pulsiert dezent in der Opazität (Waffe „brennt"/„friert").
    const haloPulse = ANIM ? `<animate attributeName="opacity" values="${o2.toFixed(2)};${(o2*0.55).toFixed(2)};${o2.toFixed(2)}" dur="2.4s" repeatCount="indefinite"/>` : '';
    halo = `<ellipse cx="${hx}" cy="156" rx="${(gw+7).toFixed(1)}" ry="${(gh+10).toFixed(1)}" fill="${E.glow}" opacity="${(0.09+lvl*0.04).toFixed(2)}"/>`+
           `<ellipse cx="${hx}" cy="156" rx="${gw.toFixed(1)}" ry="${gh.toFixed(1)}" fill="${E.glow}" opacity="${o2.toFixed(2)}">${haloPulse}</ellipse>`;
    if(lvl>=2) halo += `<ellipse cx="${hx}" cy="150" rx="8" ry="${(gh*0.66).toFixed(1)}" fill="${E.core}" opacity="0.40"/>`;
  }
  // Haut-„Finger" über den Griff → wirkt gegriffen.
  return tiltWrap(halo + grow(w) + handRect);
}

// Nebenhand-Kugel (Heiler/Hexer) an der linken Hand – schwebende Magie-Sphäre.
// Farbe aus dem Item-Typ (orb: rot/blau/gruen); Episch+ → größerer Glow.
function offhandOrb(item){
  const P = ORB_PAL[typeOf(item).orb] || ORB_PAL.blau;
  const cx = 74, cy = 174;
  const lvl = armorLvl(item.rarity);
  const r = (11 * ([1, 1.12, 1.26, 1.4][lvl] || 1)).toFixed(1);
  // Pulsierender Glow (Opazität atmet) – nur bei aktiver Bewegung.
  const pulse = ANIM ? `<animate attributeName="opacity" values="${(0.18+lvl*0.06).toFixed(2)};${(0.34+lvl*0.06).toFixed(2)};${(0.18+lvl*0.06).toFixed(2)}" dur="2.6s" repeatCount="indefinite"/>` : '';
  const glow = `<circle cx="${cx}" cy="${cy}" r="${(+r+7).toFixed(1)}" fill="${P.glow}" opacity="${(0.18+lvl*0.06).toFixed(2)}">${pulse}</circle>`+
               `<circle cx="${cx}" cy="${cy}" r="${(+r+3).toFixed(1)}" fill="${P.glow}" opacity="0.34"/>`;
  const sphere = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.mid}" stroke="${P.lo}" stroke-width="1.4"/>`+
                 `<circle cx="${(cx-r*0.32).toFixed(1)}" cy="${(cy-r*0.32).toFixed(1)}" r="${(r*0.3).toFixed(1)}" fill="${P.hi}" opacity="0.75"/>`;
  // Sanftes Schweben der ganzen Kugel (vertikal) um die Hand herum.
  const inner = glow + sphere;
  return ANIM
    ? `<g>${inner}<animateTransform attributeName="transform" type="translate" values="0 0;0 -2.6;0 0" dur="3.4s" repeatCount="indefinite"/></g>`
    : inner;
}

export function buildHeroSVG(character, tier, gear){
  const c = character || DEFAULT_CHARACTER;
  const gender = c.gender || 'w';
  const hairId = c.hairId || 'kurz';
  const hc  = c.hairColor || '#f5d04a';
  const hcd = shade(hc, 0.68);            // Haar-Lowlight
  const hch = shade(hc, 1.18);            // Haar-Glanz
  const brow = shade(hc, 0.58);           // Augenbrauen folgen der Haarfarbe
  const skin = c.skinTone || SKIN_TONE;
  const skinHi = shade(skin, 1.08), skinSh = shade(skin, 0.82);
  const eye = c.eyeColor || EYE_DEFAULT;
  const beardId = c.beardId || 'kein';
  const bc  = c.beardColor || hc;          // Bartfarbe (Standard: Haarfarbe)
  const bcd = shade(bc, 0.68);             // Bart-Lowlight
  const bch = shade(bc, 1.18);             // Bart-Glanz
  const t = Math.max(0, Math.min(3, tier|0));
  // Grundkörper-Tönung: das Grund-Outfit (Robe/Ärmel/Saum/Stiefel) übernimmt
  // IMMER die Farbe des angelegten Brustteils – inkl. Färbung (Färberei) und
  // Set-Basisfarbe (matOf deckt Set/Dye/Material ab). So scheint nie das goldene
  // Tier-Outfit unter der Ausrüstung durch; die Figur wirkt einheitlich.
  // Ohne Brustteil: ersatzweise an ein anderes getragenes Set-Teil; sonst Tier-Farbe.
  const _eq = (gear && gear.equipped) || {};
  const setTint = setThemeOf(_eq.schultern) || setThemeOf(_eq.kopf) || setThemeOf(_eq.beine)
               || setThemeOf(_eq.umhang) || setThemeOf(_eq.haende) || setThemeOf(_eq.fuesse);
  const bodyTint = (_eq.brust ? matOf(_eq.brust) : null) || (setTint ? setBaseColor(setTint) : null);
  const outfit = bodyTint || (TIER_OUTFIT[t] || TIER_OUTFIT[0]);
  const trim   = bodyTint ? shade(outfit, 1.32) : (TIER_TRIM[t] || TIER_TRIM[0]);
  const outfitSh = shade(outfit,0.66);
  const boot = shade(outfit, 0.5);
  const uid = '_'+(GRAD_SEQ++).toString(36);

  // ---- Verläufe -----------------------------------------------------
  const defs =
    `<defs>`+
    `<radialGradient id="sk${uid}" cx="42%" cy="34%" r="78%">`+
      `<stop offset="0" stop-color="${skinHi}"/><stop offset="1" stop-color="${skinSh}"/></radialGradient>`+
    `<linearGradient id="ha${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${hch}"/><stop offset="0.5" stop-color="${hc}"/><stop offset="1" stop-color="${hcd}"/></linearGradient>`+
    `<linearGradient id="bd${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${bch}"/><stop offset="0.55" stop-color="${bc}"/><stop offset="1" stop-color="${bcd}"/></linearGradient>`+
    // Set-Träger: KEIN Aufhellen oben → Kleider/Röcke treffen den dunklen Set-Ton
    // der Hosen (sonst wirken die Röcke heller als der Rest). Ohne Set: wie bisher.
    `<linearGradient id="ou${uid}" x1="0" y1="0" x2="0" y2="1">`+
      (bodyTint
        ? `<stop offset="0" stop-color="${outfitSh}"/><stop offset="0.6" stop-color="${shade(outfit,0.6)}"/><stop offset="1" stop-color="${shade(outfit,0.5)}"/>`
        : `<stop offset="0" stop-color="${shade(outfit,1.16)}"/><stop offset="0.55" stop-color="${outfit}"/><stop offset="1" stop-color="${outfitSh}"/>`)+
      `</linearGradient>`+
    `<linearGradient id="tr${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${shade(trim,1.1)}"/><stop offset="1" stop-color="${shade(trim,0.8)}"/></linearGradient>`+
    `<radialGradient id="au${uid}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${shade(trim,1.2)}" stop-opacity="0.45"/><stop offset="1" stop-color="${trim}" stop-opacity="0"/></radialGradient>`+
    // Bodenschatten (erdet die Figur): dunkel in der Mitte, weich auslaufend.
    `<radialGradient id="gs${uid}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="#000" stop-opacity="0.34"/><stop offset="0.7" stop-color="#000" stop-opacity="0.14"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`+
    `</defs>`;

  // ---- Materialabhängige Verläufe & Muster (lazy, je Build dedupliziert) ----
  // Verläufe/Texturen kommen aus der geteilten Registry (svg-fx.js), damit
  // Avatar und Inventar-Icon identisch getönt sind. IDs tragen die uid des
  // Builds, damit mehrere Avatare gleichzeitig kollisionsfrei rendern.
  const greg = makeGradReg(uid);
  const grad = greg.grad;          // gerichteter 3-Stop-Verlauf (Lichtrichtung)
  const texturePat = greg.texture; // Material-Mikrotextur (Nieten/Ring/Schuppe/…)
  // Rüstungssilhouette mit gerichtetem Verlauf + (optional) Materialtextur +
  // materialabhängigem Licht-Filter (Metallglanz/Lederschimmer; Tuch bleibt matt).
  const armorShape = (d, color, it, sw) => {
    const mat = it ? (typeOf(it).material || 'platte') : 'platte';
    // Set-Teile (Helm/Hände/Beine/Füße/Platte-Brust): KEIN Metall-Glanzfilter –
    // sonst überstrahlt der Specular die Set-Basisfarbe silbern und passt nicht
    // zu den Set-Schultern. Der gerichtete Verlauf trägt die Tönung in Set-Farbe.
    const furl = (it && setOf(it)) ? '' : greg.filter('mat-'+mat, id => materialFilter(id, mat));
    let out = `<path d="${d}" fill="${grad(color)}" stroke="${shade(color,0.5)}" stroke-width="${sw||2}" stroke-linejoin="round"/>`;
    if(it) out += `<path d="${d}" fill="${texturePat(textureOf(it), color)}"/>`;
    return furl ? `<g filter="${furl}">${out}</g>` : out;
  };
  // Bodenschatten-Ellipse, je Geschlecht auf Fußhöhe platziert.
  const groundY = gender==='w' ? 312 : gender==='m' ? 282 : 304;
  const groundShadow = `<ellipse cx="100" cy="${groundY}" rx="46" ry="10" fill="url(#gs${uid})"/>`;

  // ---- Frisur (Front geteilter Pony als gemeinsame Basis) -----------
  const capFringe =
    `<path d="M64 80 C58 46 82 34 100 34 C118 34 142 46 136 80 `+
    `C129 71 122 69 112 73 C107 63 102 61 99 70 C94 62 85 66 81 72 C75 68 70 72 64 80 Z" fill="url(#ha${uid})"/>`+
    `<path d="M82 47 C92 41 108 41 118 47" stroke="${hch}" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"/>`;

  let hairBack = '', hairFront = '';
  if(hairId==='kahl'){
    hairFront = `<ellipse cx="90" cy="58" rx="14" ry="9" fill="#fff" opacity="0.10"/>`;
  } else if(hairId==='lang'){
    // Lange Locken rahmen das Gesicht und fallen hinter die Schultern (symmetrisch).
    hairBack = mirror(`<path d="M132 66 C151 108 153 168 147 214 C141 228 123 226 119 212 C125 168 121 116 115 86 Z" fill="url(#ha${uid})"/>`);
    hairFront = capFringe + `<path d="M100 36 L100 66" stroke="${hcd}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>`;
  } else if(hairId==='pferdeschwanz'){
    hairBack = `<path d="M122 60 C152 66 164 108 152 152 C147 172 132 176 126 162 C140 128 140 96 116 78 Z" fill="url(#ha${uid})"/>`;
    hairFront = capFringe + `<circle cx="126" cy="66" r="6" fill="${hcd}"/>`;
  } else if(hairId==='dutt'){
    hairFront = capFringe +
      `<ellipse cx="100" cy="32" rx="17" ry="14" fill="url(#ha${uid})"/>`+
      `<ellipse cx="100" cy="32" rx="17" ry="14" fill="none" stroke="${hcd}" stroke-width="3"/>`;
  } else if(hairId==='locken'){
    hairBack = `<g fill="${hcd}"><circle cx="66" cy="98" r="12"/><circle cx="134" cy="98" r="12"/>`+
               `<circle cx="58" cy="122" r="10"/><circle cx="142" cy="122" r="10"/></g>`;
    hairFront = `<g fill="url(#ha${uid})"><circle cx="100" cy="38" r="17"/>`+
                `<circle cx="76" cy="48" r="14"/><circle cx="124" cy="48" r="14"/>`+
                `<circle cx="64" cy="66" r="12"/><circle cx="136" cy="66" r="12"/>`+
                `<circle cx="84" cy="60" r="13"/><circle cx="116" cy="60" r="13"/></g>`+
                `<g fill="${hcd}" opacity="0.5"><circle cx="88" cy="46" r="5"/><circle cx="112" cy="46" r="5"/><circle cx="100" cy="56" r="5"/></g>`;
  } else { // kurz
    hairFront = capFringe;
  }

  // ---- Körper (Hals gekürzt, Ausschnitt höher → natürlicher Hals) ---
  let body;
  if(gender==='m'){
    body =
      `<rect x="90" y="106" width="20" height="20" rx="7" fill="url(#sk${uid})"/>`+    // Hals
      `<path d="M100 124 L126 130 C133 150 129 174 126 190 L74 190 C71 150 67 130 74 130 Z" `+
        `fill="url(#ou${uid})" stroke="${shade(outfit,0.45)}" stroke-width="2" stroke-linejoin="round"/>`+
      `<rect x="74" y="180" width="52" height="13" rx="3" fill="url(#tr${uid})"/>`+    // Gürtel
      `<path d="M103 190 L123 190 L120 270 L106 270 Z" fill="${outfitSh}"/>`+          // Bein r
      `<path d="M77 190 L97 190 L94 270 L80 270 Z" fill="${outfitSh}"/>`+              // Bein l
      `<rect x="102" y="262" width="22" height="16" rx="5" fill="${boot}"/>`+          // Stiefel r
      `<rect x="76" y="262" width="22" height="16" rx="5" fill="${boot}"/>`+           // Stiefel l
      `<ellipse cx="100" cy="136" rx="26" ry="8" fill="#fff" opacity="0.10"/>`;
  } else if(gender==='d'){
    // Divers: androgyne gegürtete Tunika bis Mitte Oberschenkel + Leggings + Stiefel
    body =
      `<rect x="90" y="106" width="20" height="20" rx="7" fill="url(#sk${uid})"/>`+    // Hals
      `<path d="M100 124 L124 130 C131 150 122 186 120 214 C119 226 128 232 134 236 `+
        `L66 236 C72 232 81 226 80 214 C78 186 69 150 76 130 Z" `+
        `fill="url(#ou${uid})" stroke="${shade(outfit,0.45)}" stroke-width="2" stroke-linejoin="round"/>`+
      `<rect x="76" y="182" width="48" height="12" rx="3" fill="url(#tr${uid})"/>`+    // Gürtel
      `<path d="M68 232 C84 240 116 240 132 232 L134 238 C116 246 84 246 66 238 Z" fill="url(#tr${uid})"/>`+ // Saum
      `<path d="M102 236 L120 236 L116 292 L106 292 Z" fill="${outfitSh}"/>`+          // Legging r
      `<path d="M98 236 L80 236 L84 292 L94 292 Z" fill="${outfitSh}"/>`+              // Legging l
      `<rect x="104" y="286" width="18" height="14" rx="4" fill="${boot}"/>`+          // Stiefel r
      `<rect x="78" y="286" width="18" height="14" rx="4" fill="${boot}"/>`+           // Stiefel l
      `<ellipse cx="100" cy="136" rx="24" ry="8" fill="#fff" opacity="0.11"/>`;
  } else {
    body =
      `<rect x="91" y="106" width="18" height="20" rx="8" fill="url(#sk${uid})"/>`+   // Hals
      `<path d="M100 124 L123 130 C131 152 116 176 113 196 C113 236 128 274 141 300 `+
        `L59 300 C72 274 87 236 87 196 C84 176 69 152 77 130 Z" `+
        `fill="url(#ou${uid})" stroke="${shade(outfit,0.45)}" stroke-width="2" stroke-linejoin="round"/>`+
      `<path d="M62 296 C84 305 116 305 138 296 L141 302 C116 312 84 312 59 302 Z" fill="url(#tr${uid})"/>`+ // Saum
      `<ellipse cx="100" cy="136" rx="24" ry="8" fill="#fff" opacity="0.12"/>`+        // Schulter-Glanz
      mirror(`<ellipse cx="114" cy="306" rx="10" ry="5" fill="${boot}"/>`);            // Füße
  }

  // ---- Arme (symmetrisch) ------------------------------------------
  const arms = mirror(
    `<path d="M114 134 C129 138 134 166 130 191 C129 200 120 200 118 191 C117 166 113 148 109 138 Z" fill="url(#ou${uid})"/>`+
    `<circle cx="124" cy="194" r="8.5" fill="url(#sk${uid})"/>`);

  // ---- Kopf + Gesicht ----------------------------------------------
  const head =
    `<circle cx="100" cy="78" r="34" fill="url(#sk${uid})" stroke="${shade(skin,0.55)}" stroke-width="1.4"/>`+
    `<path d="M66 80 A34 34 0 0 0 134 80" fill="${skinSh}" opacity="0.18"/>`;
  const eyeR =
    `<ellipse cx="113" cy="81" rx="5" ry="6.4" fill="#fdfdff"/>`+
    `<circle cx="113" cy="82" r="3.6" fill="${eye}"/>`+
    `<circle cx="113" cy="82" r="1.6" fill="#1c1118"/>`+
    `<circle cx="114.6" cy="79.6" r="1.3" fill="#fff"/>`;
  const browR = `<path d="M104 69 Q114 64 123 69" stroke="${brow}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const cheekR = `<ellipse cx="120" cy="93" rx="6.5" ry="4" fill="#ff8da1" opacity="0.22"/>`;
  const face =
    mirror(eyeR) + mirror(browR) + mirror(cheekR)+
    `<path d="M100 84 Q104 91 99 93" stroke="${skinSh}" stroke-width="2" fill="none" stroke-linecap="round"/>`+   // Nase
    `<path d="M89 99 Q100 108 111 99" stroke="#b5566f" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;  // Mund

  // ---- Bart (optional) – natürlicher Vollbart entlang des Kiefers ---
  // Kopf cx=100 cy=78 r=34 → Kinn ~y112, Mund y99-108. Symmetrisch um x=100.
  // Aufbau: Vollbart-Kontur (Koteletten→Kiefer→Kinn) + freie Mundpartie +
  // Schnauzer + feine Strähnen/Glanz, damit nichts flächig/eckig wirkt.
  let beard = '';
  if(beardId !== 'kein'){
    // Gemeinsame innere Oberkante: zieht von den Koteletten über die Wangen
    // bis knapp unter die Mundwinkel und lässt den Mund frei.
    const cheeks = `C125 98 117 103 109 104 C105 110 95 110 91 104 C83 103 75 98 70 87 Z`;
    // Äußere Kontur je Länge (Koteletten bei y87 → Kinn bzw. Bartspitze).
    let outline;
    if(beardId === 'kurz'){            // kurzer, kiefernaher Bart
      outline = `M70 87 C71 102 77 113 88 118 C93 121 107 121 112 118 C123 113 129 102 130 87 `;
    } else if(beardId === 'mittel'){   // voller Bart, etwas über das Kinn
      outline = `M70 87 C70 105 75 121 85 131 C91 138 109 138 115 131 C125 121 130 105 130 87 `;
    } else {                           // langer, weich auslaufender Bart
      outline = `M70 87 C70 109 77 129 83 143 C87 154 92 161 100 163 C108 161 113 154 117 143 C123 129 130 109 130 87 `;
    }
    // Schnauzer: zwei Flügel mit Philtrum-Mulde, sitzt knapp über dem Mund.
    const must = `<path d="M100 100 C96 102 90 101 85 96 C90 95 95 96 100 98 `+
                 `C105 96 110 95 115 96 C110 101 104 102 100 100 Z" fill="url(#bd${uid})"/>`;
    // Feine Strähnen (symmetrisch) – Länge passend zum Bart.
    let strands;
    if(beardId === 'kurz'){
      strands = mirror(`<path d="M82 100 Q86 112 94 119" stroke="${bcd}" stroke-width="1.2" fill="none" opacity="0.30" stroke-linecap="round"/>`);
    } else if(beardId === 'mittel'){
      strands = mirror(`<path d="M80 100 Q85 118 95 130" stroke="${bcd}" stroke-width="1.3" fill="none" opacity="0.30" stroke-linecap="round"/>`)+
                `<path d="M100 109 L100 133" stroke="${bcd}" stroke-width="1.1" fill="none" opacity="0.22" stroke-linecap="round"/>`;
    } else {
      strands = mirror(`<path d="M79 101 Q86 128 96 150" stroke="${bcd}" stroke-width="1.4" fill="none" opacity="0.32" stroke-linecap="round"/>`)+
                mirror(`<path d="M91 108 Q95 132 99 154" stroke="${bcd}" stroke-width="1.0" fill="none" opacity="0.22" stroke-linecap="round"/>`);
    }
    // Sanfter Glanz auf den Wangen (beide Seiten).
    const sheen = mirror(`<path d="M77 95 Q84 101 91 105" stroke="${bch}" stroke-width="1.6" fill="none" opacity="0.26" stroke-linecap="round"/>`);
    beard = `<path d="${outline}${cheeks}" fill="url(#bd${uid})"/>` + sheen + strands + must;
  }

  // ---- Tier-Akzente -------------------------------------------------
  const aura = t>=3 ? `<ellipse cx="100" cy="175" rx="96" ry="150" fill="url(#au${uid})"/>` : '';
  const tierCape = t>=2
    ? `<path d="M74 130 L126 130 L144 258 C120 270 80 270 56 258 Z" fill="${shade(trim,0.72)}"/>`+
      `<path d="M100 130 L100 264" stroke="${shade(trim,0.6)}" stroke-width="2" opacity="0.5"/>`
    : '';
  const tierPauldrons = t>=3 ? mirror(`<ellipse cx="120" cy="134" rx="15" ry="10" fill="url(#tr${uid})"/>`) : '';

  // ---- Angelegte Ausrüstung (nur additiv, materialgetönt) -----------
  const eq = (gear && gear.equipped) || {};
  const hideHelmet = !!(gear && gear.hideHelmet);
  // Sichtbare Kopfbedeckung → Haare ausblenden (kein „Durchglitchen" durch den Helm).
  const helmVisible = !!(eq.kopf && !hideHelmet);

  // Set-Makro-Effekte (Aura/Bodenkreis/Rückenteil) – skaliert mit der Anzahl
  // getragener Teile des dominanten Sets (2/4/6/7 → Stufe 1/2/3/4).
  const _setCounts = {};
  for(const it of Object.values(eq)) if(it && it.setId) _setCounts[it.setId] = (_setCounts[it.setId]||0)+1;
  let _domSet = null, _domN = 0;
  for(const id in _setCounts) if(_setCounts[id] > _domN){ _domN = _setCounts[id]; _domSet = id; }
  const macroTheme = _domSet ? setThemeOf(Object.values(eq).find(it => it && it.setId===_domSet)) : null;
  const setLvl = _domN>=7 ? 4 : _domN>=6 ? 3 : _domN>=4 ? 2 : _domN>=2 ? 1 : 0;
  const macroFX = (macroTheme && setLvl>0) ? setMacroFX(macroTheme, setLvl, gender) : '';

  // Umhang (sonst Tier-Cape)
  const um = eq.umhang;
  const cloak = um
    ? `<path d="M74 130 L126 130 L146 264 C120 278 80 278 54 264 Z" fill="${grad(matOf(um))}" stroke="${shade(matOf(um),0.5)}" stroke-width="2" stroke-linejoin="round"/>`+
      `<path d="M100 130 L100 268" stroke="${shade(matOf(um),0.7)}" stroke-width="2" opacity="0.5"/>`
    : tierCape;

  // Beinschienen (Mann/Divers; beim Kleid verdeckt)
  const bn = eq.beine; let beine = '';
  if(bn){ const c=matOf(bn), cs=shade(c,0.5);
    if(gender==='m') beine = mirror(`<path d="M103 192 L123 192 L120 266 L106 266 Z" fill="${grad(c)}" stroke="${cs}" stroke-width="1.5"/><rect x="106" y="208" width="14" height="3" fill="${cs}" opacity="0.5"/>`);
    else if(gender==='d') beine = mirror(`<path d="M102 238 L120 238 L116 290 L106 290 Z" fill="${grad(c)}" stroke="${cs}" stroke-width="1.5"/>`);
  }

  // Brust (Material bestimmt die Form: Stoff=Robe, Leder=Lederweste,
  // Platte=Brustpanzer). Fallback: Platte. Outline wird – wo möglich – aus
  // einer rechten Hälfte per mirror() gespiegelt (garantierte Symmetrie).
  const br = eq.brust; let brust = '';
  if(br){
    const c=matOf(br), cs=shade(c,0.5), ch=shade(c,1.2), cm=shade(c,0.8);
    const mat = typeOf(br).material || 'platte';
    const female = (gender==='w');
    if(mat === 'stoff'){
      // Robe: V-Ausschnitt oben, breit ausgestellter Saum (~y200), Drapierfalten.
      const flareR = female ? 130 : 134;
      const half = armorShape(`M100 138 L118 128 Q126 132 ${flareR-8} 160 L${flareR} 200 Q112 207 100 206 Z`, c, br);
      brust = mirror(half)+
              `<path d="M82 128 L100 140 L118 128" fill="none" stroke="${cm}" stroke-width="2" opacity="0.8"/>`+
              `<path d="M100 142 L100 204" stroke="${cs}" stroke-width="1.5" opacity="0.5"/>`+
              mirror(`<path d="M112 146 Q118 172 ${flareR-4} 198" fill="none" stroke="${cs}" stroke-width="1.3" opacity="0.4"/>`)+
              `<path d="M86 138 Q92 160 ${(female?70:66)+6} 196" fill="none" stroke="${ch}" stroke-width="1.5" opacity="0.3"/>`;
    } else if(mat === 'leder'){
      // Lederweste/Tunika: anliegend, mittige Kreuzschnürung + unterer Saum.
      if(female)
        brust = armorShape(`M100 126 L119 132 C123 150 119 174 112 184 C107 188 93 188 88 184 C81 174 77 150 81 132 Z`, c, br);
      else
        brust = armorShape(`M100 126 L123 132 C127 150 125 176 121 188 L79 188 C75 176 73 150 77 132 Z`, c, br);
      brust += `<path d="M100 132 L100 ${female?184:188}" stroke="${cs}" stroke-width="1.5" opacity="0.6"/>`+
               mirror(`<path d="M100 140 L108 148 M100 152 L108 160 M100 164 L108 172" stroke="${cm}" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/>`)+
               `<ellipse cx="90" cy="150" rx="6" ry="9" fill="${ch}" opacity="0.35"/>`+
               `<path d="M82 ${female?180:184} Q100 ${female?188:192} 118 ${female?180:184}" fill="none" stroke="${cs}" stroke-width="1.5" opacity="0.5"/>`;
    } else {
      // Platte: Brustpanzer (Verlauf + Nieten-/Schuppen-Textur je Material).
      if(female)
        brust = armorShape(`M100 126 L120 132 C124 150 120 172 113 182 C108 186 92 186 87 182 C80 172 76 150 80 132 Z`, c, br)+
                `<path d="M100 130 L100 182" stroke="${cs}" stroke-width="1.5" opacity="0.6"/>`+
                `<ellipse cx="92" cy="148" rx="6" ry="9" fill="${ch}" opacity="0.4"/>`;
      else
        brust = armorShape(`M100 126 L124 132 C128 150 126 174 122 186 L78 186 C74 174 72 150 76 132 Z`, c, br)+
                `<path d="M100 130 L100 186" stroke="${cs}" stroke-width="1.5" opacity="0.6"/>`+
                `<ellipse cx="90" cy="150" rx="7" ry="10" fill="${ch}" opacity="0.4"/>`;
    }
    // Seltenheits-Filigran (Episch+) auf der Brust – wächst mit der Stufe.
    const blvl = armorLvl(br.rarity);
    // Set-Brustteile: Filigran in der Set-Akzentfarbe (statt Gold) → passt zu den
    // übrigen Set-Teilen. Nicht-Set-Brustteile behalten das goldene Filigran.
    const _bt = setThemeOf(br);
    if(blvl>0) brust += engraving(100, 156, 30, 52, blvl, _bt ? setPalette(_bt).accent : GOLD);
    // Set-Brust-Emblem (Totenkopf / Klinge / Leeren-Juwel / Sonnenmedaillon).
    if(_bt) brust += setChestEmblem(_bt, 100, 150, 2.4);
  }

  // Stiefel
  const fu = eq.fuesse; let fuesse = '';
  if(fu){ const c=matOf(fu), cs=shade(c,0.5);
    if(gender==='w') fuesse = mirror(`<ellipse cx="114" cy="305" rx="11" ry="6" fill="${grad(c)}" stroke="${cs}" stroke-width="1.2"/>`);
    else if(gender==='m') fuesse = `<rect x="102" y="261" width="22" height="17" rx="5" fill="${grad(c)}" stroke="${cs}" stroke-width="1.2"/><rect x="76" y="261" width="22" height="17" rx="5" fill="${grad(c)}" stroke="${cs}" stroke-width="1.2"/>`;
    else fuesse = `<rect x="104" y="285" width="18" height="15" rx="4" fill="${grad(c)}" stroke="${cs}" stroke-width="1.2"/><rect x="78" y="285" width="18" height="15" rx="4" fill="${grad(c)}" stroke="${cs}" stroke-width="1.2"/>`;
  }

  // Handschuhe
  const ha = eq.haende;
  const gloves = ha
    ? mirror(`<circle cx="124" cy="194" r="9" fill="${grad(matOf(ha))}" stroke="${shade(matOf(ha),0.5)}" stroke-width="1.2"/><rect x="116" y="186" width="16" height="7" rx="2" fill="${grad(matOf(ha))}" stroke="${shade(matOf(ha),0.5)}" stroke-width="1"/>`)
    : '';

  // Nebenhand am linken Arm – Form richtet sich nach der Item-Art:
  //   art:'waffe' → Zweitklinge als Klinge in der linken Hand (Schurke),
  //   art:'orb'   → schwebende Magie-Kugel (Heiler/Hexer),
  //   sonst       → klassisches Schild (Episch+ → größer + leuchtend).
  const sc = eq.schild; let schild = '';
  if(sc){
    const art = typeOf(sc).art || 'schild';
    if(art === 'waffe'){
      // Zweitwaffe gespiegelt in die linke Hand (hx=76), leicht nach links
      // gekippt und etwas kleiner als die Hauptwaffe.
      schild = heldWeapon(sc, uid, { hx:76, tilt:-16, scale:0.9 });
    } else if(art === 'orb'){
      // Spezial-Kugel (Tribut-Shop) → eigene Optik, sonst generische Magie-Sphäre.
      schild = typeOf(sc).special ? buildSpecialOffhandOrb(typeOf(sc).special, sc, uid) : offhandOrb(sc);
    } else if(typeOf(sc).special){
      // Spezial-Schild (Tribut-Shop): eigene Optik an der linken Hand.
      schild = buildSpecialShield(typeOf(sc).special, sc, uid);
    } else {
      const v=(((sc.variant|0)%6)+6)%6, m=WEAPON_METAL[v], ms=shade(m,0.5), mh=shade(m,1.2), cx=72, cy=180;
      const lvl = armorLvl(sc.rarity), el = elementOf(sc.id), E = ELEM[el];
      let shp;
      if(v===1||v===4)      shp=`<circle cx="${cx}" cy="${cy}" r="20" fill="${m}" stroke="${ms}" stroke-width="2"/>`;
      else if(v===2)        shp=`<circle cx="${cx}" cy="${cy}" r="15" fill="${m}" stroke="${ms}" stroke-width="2"/>`;
      else if(v===0||v===3) shp=`<rect x="${cx-17}" y="${cy-22}" width="34" height="46" rx="7" fill="${m}" stroke="${ms}" stroke-width="2"/>`;
      else                  shp=`<path d="M${cx-17} ${cy-20} L${cx+17} ${cy-20} L${cx+17} ${cy-2} Q${cx+17} ${cy+18} ${cx} ${cy+26} Q${cx-17} ${cy+18} ${cx-17} ${cy-2} Z" fill="${m}" stroke="${ms}" stroke-width="2"/>`;
      let inner = shp + `<circle cx="${cx}" cy="${cy}" r="4" fill="${mh}"/>`;
      if(lvl>0){
        const S=[1,1.18,1.34,1.5][lvl];
        const halo = `<ellipse cx="${cx}" cy="${cy}" rx="${(24*S).toFixed(1)}" ry="${(27*S).toFixed(1)}" fill="${E.glow}" opacity="${(0.18+lvl*0.08).toFixed(2)}"/>`;
        const rim = `<ellipse cx="${cx}" cy="${cy}" rx="${(22*S).toFixed(1)}" ry="${(25*S).toFixed(1)}" fill="none" stroke="${E.glow}" stroke-width="2.5" opacity="0.6"/>`;
        schild = halo + `<g transform="translate(${cx},${cy}) scale(${S}) translate(${-cx},${-cy})">${inner}</g>` + rim;
      } else schild = inner;
    }
  }

  // Schulterplatten (sonst Tier-Pauldrons). Set-Schultern = großes, abgehobenes
  // Signatur-Ornament (Flammen-Flügel / Klingen / Geweih / Federn) je Theme.
  const shp_ = eq.schultern;
  const _st = shp_ && setThemeOf(shp_);
  const pauldronG = _st
    ? mirror(setShoulder(_st, 140, 124, 1.6))
    : (shp_
      ? mirror(`<ellipse cx="120" cy="133" rx="16" ry="11" fill="${grad(matOf(shp_))}" stroke="${shade(matOf(shp_),0.5)}" stroke-width="1.5"/><ellipse cx="120" cy="131" rx="9" ry="5" fill="${shade(matOf(shp_),1.2)}" opacity="0.5"/>`)
      : tierPauldrons);

  // Kopfbedeckung (verdeckt Haare; nur wenn angelegt UND nicht ausgeblendet).
  // Material bestimmt die Form: Stoff=Kapuze (Gesicht frei), Leder=Lederkappe
  // (Gesicht frei), Platte=geschlossener Ritterhelm (Visier). Fallback: Platte.
  const kp = eq.kopf; let helm = '';
  if(kp && !hideHelmet){
    const c=matOf(kp), cs=shade(c,0.5), ch=shade(c,1.2), cm=shade(c,0.78);
    const mat = (setOf(kp) ? setOf(kp).material : typeOf(kp).material) || 'platte';
    if(mat === 'stoff'){
      // Kapuze: weicher Spitzbogen über dem Kopf (Spitze ~y32), fällt seitlich
      // an den Wangen vorbei bis auf die Schultern (y132). Gesicht bleibt frei.
      helm = armorShape(`M100 32 Q132 34 138 78 Q142 110 128 132 L118 132 Q124 108 120 92 Q116 70 100 66 Q84 70 80 92 Q76 108 82 132 L72 132 Q58 110 62 78 Q68 34 100 32 Z`, c, kp)+
             // Innensaum, der das Gesicht umrandet (dunkler → Tiefe)
             `<path d="M100 66 Q120 70 120 92 Q120 108 116 124 M100 66 Q80 70 80 92 Q80 108 84 124" fill="none" stroke="${cm}" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>`+
             // Faltenlinien je Seite + Spitzen-Glanz
             mirror(`<path d="M130 60 Q134 90 124 126" fill="none" stroke="${cs}" stroke-width="1.5" opacity="0.45"/>`)+
             `<path d="M100 34 Q116 38 120 60" fill="none" stroke="${ch}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>`;
    } else if(mat === 'leder'){
      // Assassinen-Kapuze (Schurke): EIN halbtransparenter Gesichts-Schleier in
      // Helmfarbe füllt das GANZE Gesicht und liegt HINTER der Kapuze → die
      // Kapuzen-Öffnung deckt die Schleier-Kanten ab (keine sichtbaren Kanten).
      // Das Gesicht schimmert getönt durch; kalte Augen-Glints leuchten darüber.
      const veil = `M100 55 Q128 58 128 92 Q128 127 100 135 Q72 127 72 92 Q72 58 100 55 Z`;
      helm = `<path d="${veil}" fill="${c}" opacity="0.55"/>`+
             `<path d="${veil}" fill="${cs}" opacity="0.22"/>`+
             armorShape(`M100 28 Q137 32 141 80 Q144 112 129 134 L116 132 Q124 106 121 90 Q117 66 100 62 Q83 66 79 90 Q76 106 84 132 L71 134 Q56 112 59 80 Q63 32 100 28 Z`, c, kp)+
             // Innensaum, der das Schattengesicht umrandet (Tiefe)
             `<path d="M100 62 Q121 66 121 90 Q121 106 117 124 M100 62 Q79 66 79 90 Q79 106 83 124" fill="none" stroke="${cm}" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>`+
             // Glanznaht + seitliche Falte
             `<path d="M100 30 Q126 36 132 78" fill="none" stroke="${ch}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>`+
             mirror(`<path d="M132 64 Q136 96 126 128" fill="none" stroke="${cs}" stroke-width="1.5" opacity="0.45"/>`)+
             // kalte Augen-Glints leuchten durch den Schleier
             `<ellipse cx="87" cy="81" rx="2.6" ry="1.6" fill="#cfe8ff" opacity="0.85"/>`+
             `<ellipse cx="113" cy="81" rx="2.6" ry="1.6" fill="#cfe8ff" opacity="0.85"/>`;
    } else {
      // Platte: Barbute/Großhelm – gerundete Glocke, mittiger Kamm, Wangenstücke,
      // vertikaler Visierschlitz + Atemschlitz (Gesicht verdeckt).
      helm = armorShape(`M66 82 Q62 40 100 38 Q138 40 134 82 L134 100 Q120 110 100 110 Q80 110 66 100 Z`, c, kp)+
             `<path d="M100 38 Q104 60 100 100 Q96 60 100 38 Z" fill="${ch}" opacity="0.45"/>`+
             `<path d="M74 84 Q72 102 84 108 L84 86 Z" fill="${cs}" opacity="0.5"/>`+
             mirror(`<path d="M126 84 Q128 102 116 108 L116 86 Z" fill="${cs}" opacity="0.5"/>`)+
             `<rect x="97" y="74" width="6" height="26" rx="3" fill="#120b0f" opacity="0.9"/>`+
             `<rect x="86" y="100" width="28" height="4" rx="2" fill="#120b0f" opacity="0.75"/>`+
             `<ellipse cx="86" cy="58" rx="11" ry="6" fill="${ch}" opacity="0.45"/>`+
             `<path d="M72 78 Q100 70 128 78" fill="none" stroke="${cs}" stroke-width="2" opacity="0.6"/>`;
    }
    // Set-Aufsatz (Hörner / Halo / Geweih + glühende Augen) über dem Helm.
    const _kt = setThemeOf(kp);
    if(_kt){
      const pos = _kt==='holy' ? [100,24,2.2] : (_kt==='molten' || _kt==='azure') ? [100,40,2.0] : [100,80,1.7];
      helm += setHelmCrest(_kt, pos[0], pos[1], pos[2]);
    }
  }

  // hideWeapon: Waffe im Sprite weglassen – sie wird in der Arena als separat
  // animierte Waffen-Ebene (buildWeaponLayerSVG) deckungsgleich darübergelegt.
  const weaponG = (gear && gear.hideWeapon) ? '' : heldWeapon(eq.waffe, uid);

  // Zweiter <defs>-Block für die lazy erzeugten Material-Verläufe/-Muster
  // (gefüllt während des Aufbaus oben). Bodenschatten ganz unten im Z-Stapel.
  // ---- Licht & Tiefe: Kontaktschatten + Rim-Light --------------------
  // Aufliegende Teile (Pauldrons, Helm) werfen einen weichen Schatten → Tiefe.
  const csUrl = (pauldronG || helm)
    ? greg.filter('cs', id => softShadowFilter(id, { dy:2.2, blur:2, op:0.34 })) : '';
  const wrapCS = g => (g && csUrl) ? `<g filter="${csUrl}">${g}</g>` : g;
  const pauldronCS = wrapCS(pauldronG);
  const helmCS = wrapCS(helm);
  // Rim-Light an der Körperkante ab Tier ≥ 2 (Held hebt sich vom Hintergrund ab).
  const rimUrl = t>=2 ? greg.filter('rim', id => rimLightFilter(id)) : '';
  const bodyLit = rimUrl ? `<g filter="${rimUrl}">${body}</g>` : body;

  // ---- Animation: Waffen-Sway + Idle-Atmen ---------------------------
  // Waffe wiegt dezent um den Handpunkt (124,194). reduced-motion → statisch.
  const weaponSway = (ANIM && weaponG)
    ? `<g>${weaponG}<animateTransform attributeName="transform" type="rotate" values="-1.5 124 194;1.5 124 194;-1.5 124 194" dur="4.4s" repeatCount="indefinite"/></g>`
    : weaponG;

  const extraDefs = greg.defs();
  const xtra = extraDefs ? `<defs>${extraDefs}</defs>` : '';
  // Idle-Atmen: die ganze Figur (ohne Bodenschatten) wippt minimal vertikal.
  // CSS-@keyframes IM SVG laufen auch im <img>; @media reduced-motion als Fallback,
  // primär verhindert ANIM den Einbau ganz. Keyframe-/Gruppen-ID mit uid (kollisionsfrei).
  const styleBlock = ANIM
    ? `<style>@keyframes hb${uid}{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.3px)}}`+
      `#hero${uid}{animation:hb${uid} 3.8s ease-in-out infinite}`+
      `@media(prefers-reduced-motion:reduce){#hero${uid}{animation:none}}</style>`
    : '';
  // Waffe & Nebenhand (Schild/Zweitklinge) ganz im Vordergrund – werden von
  // Rüstung/Schultern/Helm NICHT verdeckt (zuletzt im Z-Stapel gezeichnet).
  const figure = aura + cloak + (helmVisible ? '' : hairBack) + bodyLit + beine + brust + fuesse + arms + gloves +
    pauldronCS + head + face + beard + (helmVisible ? '' : hairFront) + helmCS + schild + weaponSway;
  const heroGroup = ANIM ? `<g id="hero${uid}">${figure}</g>` : figure;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">`+
    defs + xtra + styleBlock + groundShadow + macroFX + heroGroup +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Memo-Cache: identischer Helden-Zustand → identischer Data-URI-String. Das ist
// für die Animation essenziell: dieselbe URI an img.src zu setzen ist ein No-Op
// (Animation läuft ununterbrochen weiter, statt bei jedem renderAll() neu zu
// starten) – und erspart das teure Neu-Bauen des SVG samt Filtern.
const _heroCache = new Map();
export function heroSrc(tier, opts){
  if(state && state.character){
    const hideHelmet = !!(state.settings && state.settings.hideHelmet);
    const hideWeapon = !!(opts && opts.hideWeapon);
    const key = JSON.stringify([state.character, tier, hideHelmet, hideWeapon, state.equipped || {}]);
    const hit = _heroCache.get(key);
    if(hit) return hit;
    const uri = buildHeroSVG(state.character, tier, { equipped: state.equipped || {}, hideHelmet, hideWeapon });
    if(_heroCache.size > 16) _heroCache.clear();   // selten genutzte Varianten verwerfen
    _heroCache.set(key, uri);
    return uri;
  }
  return ASSETS + 'char_tier' + tier + '.png';
}

// Eigenständige Waffen-Ebene (gleiche viewBox 0 0 200 320 wie der Held) für die
// Kampf-Arena: nur die Waffe am Handpunkt, aufrecht (ohne Tilt/Hand) – die Ruhe-
// neigung und der Schwung kommen extern per CSS-Rotation um den Griff (62%,60.6%).
// `atk` = Deskriptor aus data/attacks.js: { wv, rarity, element, orb, material }.
export function buildWeaponLayerSVG(atk){
  if(!atk || atk.wv == null) return '';
  const element = atk.element === 'ice' ? 'ice' : 'fire';
  const synth = { variant: atk.wv|0, rarity: atk.rarity, id: element==='ice' ? 0 : 1 };
  const ty = { material: atk.material, orb: atk.orb, variant: atk.wv|0 };
  const w = heldWeapon(synth, '_wl', { noTilt:true, noHand:true, ty, element });
  if(!w) return '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">`+ w +`</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
