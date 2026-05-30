/* =====================================================================
   AVATAR – prozeduraler SVG-Held aus Geschlecht/Frisur/Haar-/Haut-/
   Augenfarbe. Vektor-Look mit Verläufen, Glanz und sauberer Symmetrie.
   viewBox 200x320 (5:8 Ganzkörper) für feine, symmetrische Bezier-Kurven.
   ===================================================================== */
import { ASSETS } from '../data/tuning.js';
import { DEFAULT_CHARACTER, SKIN_TONE, EYE_DEFAULT } from '../data/character-options.js';
import { rarityIndex } from '../data/rarities.js';
import { ELEM, elementOf } from './item-art.js';
import { typeOf } from '../data/itemTypes.js';
import { state } from './state.js';

// Element-Effektstufe nach Seltenheit: 0=<Episch, 1=Episch, 2=Legendär, 3=Mythisch.
const armorLvl = rk => { const r = rarityIndex(rk); return r>=5?3:r>=4?2:r>=3?1:0; };

const TIER_OUTFIT = ['#6b5a8a','#3f6f9e','#9e6b2e','#b5882a'];
const TIER_TRIM   = ['#9a86c2','#7fb0e0','#e0a85a','#f2cd6b'];
// Waffen-Metalle je Variante (analog item-art.js) für die getragene Waffe.
const WEAPON_METAL = ['#aab2be','#c8d0dc','#c48e4e','#deb85c','#606678','#4a465c'];
const WOOD = '#7a4f2a', GOLD = '#d8b24a';
// Kugel-Paletten für Zauberstäbe (orb: rot/blau/gruen) – hell/mittel/dunkel/Glow.
const ORB_PAL = {
  rot:   { hi:'#ffd0d0', mid:'#ff3b3b', lo:'#7a0d0d', glow:'#ff5a3c' },
  blau:  { hi:'#cfe6ff', mid:'#3aa0ff', lo:'#0a3a73', glow:'#58a6ff' },
  gruen: { hi:'#d6ffe0', mid:'#37d67a', lo:'#0c5a2c', glow:'#4dff86' },
};
// Rüstungs-Material je Variante (analog item-art.js ARMOR_MAT).
const ARMOR_MAT = ['#c8d0dc','#aab2be','#845c38','#3f8f5a','#7a5ca8','#4a465c'];
const matOf = it => ARMOR_MAT[(((it && it.variant)|0) % 6 + 6) % 6];

// Farbe komponentenweise mit Faktor f skalieren (Highlights f>1, Schatten f<1).
function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
// Rechte Hälfte an der Achse x=100 spiegeln → garantiert symmetrisch.
const mirror = frag => frag + '<g transform="translate(200,0) scale(-1,1)">'+frag+'</g>';

// Eindeutige Gradient-IDs pro Build (mehrere Avatare rendern gleichzeitig).
let GRAD_SEQ = 0;

// Getragene Waffe in der rechten Hand (Handkreis bei cx=124, cy=194), Klinge nach oben.
function heldWeapon(item, uid){
  if(!item || typeof item.variant !== 'number') return '';
  const v = ((item.variant|0)%6+6)%6;
  const lvl = armorLvl(item.rarity);            // Episch+ → Element-Glow
  const el = elementOf(item.id), E = ELEM[el];
  const m = WEAPON_METAL[v], md = shade(m,0.55), mh = shade(m,1.25);
  const hx = 124;
  // Zauberstab: langer Stab mit leuchtender Kugel oben (Farbe je nach Stab-Typ).
  const ty = typeOf(item);
  if(ty && ty.material === 'zauberstab'){
    const P = ORB_PAL[ty.orb] || ORB_PAL.rot;
    const oy = 112;                                   // Höhe der Kugel
    const pole = `<rect x="${hx-2.5}" y="${oy}" width="5" height="${204-oy}" rx="2.5" fill="${WOOD}"/>`+
                 `<rect x="${hx-2.5}" y="${oy+4}" width="2" height="${198-oy}" fill="${shade(WOOD,1.3)}" opacity="0.5"/>`+
                 `<rect x="${hx-5}" y="${oy+6}" width="10" height="5" rx="2" fill="${GOLD}"/>`;  // Fassung
    const glow = `<circle cx="${hx}" cy="${oy}" r="18" fill="${P.glow}" opacity="0.30"/>`+
                 `<circle cx="${hx}" cy="${oy}" r="12" fill="${P.glow}" opacity="0.35"/>`;
    const orb  = `<circle cx="${hx}" cy="${oy}" r="9" fill="${P.mid}" stroke="${P.lo}" stroke-width="1"/>`+
                 `<circle cx="${hx-3}" cy="${oy-3}" r="3.4" fill="${P.hi}" opacity="0.9"/>`;
    const hand = `<rect x="${hx-6}" y="189" width="12" height="10" rx="4" fill="url(#sk${uid})"/>`;
    return glow + pole + orb + hand;
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
  } else {              // Kriegshammer
    w = `<rect x="${hx-2}" y="150" width="4" height="52" rx="1.5" fill="${WOOD}"/>`+
        `<rect x="${hx-15}" y="128" width="30" height="18" rx="3" fill="${m}" stroke="${md}" stroke-width="1"/>`+
        `<rect x="${hx-12}" y="131" width="6" height="12" rx="1" fill="${mh}" opacity="0.5"/>`+
        `<circle cx="${hx}" cy="204" r="3.2" fill="${GOLD}"/>`;
  }
  // Element-Halo hinter der Waffe (Episch+), Größe nach Stufe.
  let halo = '';
  if(lvl>0){
    halo = `<ellipse cx="${hx}" cy="158" rx="${12+lvl*5}" ry="${48+lvl*6}" fill="${E.glow}" opacity="${(0.16+lvl*0.07).toFixed(2)}"/>`;
    if(lvl>=3) halo += `<ellipse cx="${hx}" cy="150" rx="9" ry="34" fill="${E.core}" opacity="0.35"/>`;
  }
  // Haut-„Finger" über den Griff → wirkt gegriffen.
  return halo + w + `<rect x="${hx-6}" y="189" width="12" height="10" rx="4" fill="url(#sk${uid})"/>`;
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
  const t = Math.max(0, Math.min(3, tier|0));
  const outfit = TIER_OUTFIT[t] || TIER_OUTFIT[0];
  const trim   = TIER_TRIM[t]   || TIER_TRIM[0];
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
    `<linearGradient id="ou${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${shade(outfit,1.16)}"/><stop offset="0.55" stop-color="${outfit}"/><stop offset="1" stop-color="${outfitSh}"/></linearGradient>`+
    `<linearGradient id="tr${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${shade(trim,1.1)}"/><stop offset="1" stop-color="${shade(trim,0.8)}"/></linearGradient>`+
    `<radialGradient id="au${uid}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${shade(trim,1.2)}" stop-opacity="0.45"/><stop offset="1" stop-color="${trim}" stop-opacity="0"/></radialGradient>`+
    `</defs>`;

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

  // Umhang (sonst Tier-Cape)
  const um = eq.umhang;
  const cloak = um
    ? `<path d="M74 130 L126 130 L146 264 C120 278 80 278 54 264 Z" fill="${matOf(um)}" stroke="${shade(matOf(um),0.5)}" stroke-width="2" stroke-linejoin="round"/>`+
      `<path d="M100 130 L100 268" stroke="${shade(matOf(um),0.7)}" stroke-width="2" opacity="0.5"/>`
    : tierCape;

  // Beinschienen (Mann/Divers; beim Kleid verdeckt)
  const bn = eq.beine; let beine = '';
  if(bn){ const c=matOf(bn), cs=shade(c,0.5);
    if(gender==='m') beine = mirror(`<path d="M103 192 L123 192 L120 266 L106 266 Z" fill="${c}" stroke="${cs}" stroke-width="1.5"/><rect x="106" y="208" width="14" height="3" fill="${cs}" opacity="0.5"/>`);
    else if(gender==='d') beine = mirror(`<path d="M102 238 L120 238 L116 290 L106 290 Z" fill="${c}" stroke="${cs}" stroke-width="1.5"/>`);
  }

  // Brustpanzer
  const br = eq.brust; let brust = '';
  if(br){ const c=matOf(br), cs=shade(c,0.5), ch=shade(c,1.2);
    if(gender==='w')
      brust = `<path d="M100 126 L120 132 C124 150 120 172 113 182 C108 186 92 186 87 182 C80 172 76 150 80 132 Z" fill="${c}" stroke="${cs}" stroke-width="2" stroke-linejoin="round"/>`+
              `<path d="M100 130 L100 182" stroke="${cs}" stroke-width="1.5" opacity="0.6"/>`+
              `<ellipse cx="92" cy="148" rx="6" ry="9" fill="${ch}" opacity="0.4"/>`;
    else
      brust = `<path d="M100 126 L124 132 C128 150 126 174 122 186 L78 186 C74 174 72 150 76 132 Z" fill="${c}" stroke="${cs}" stroke-width="2" stroke-linejoin="round"/>`+
              `<path d="M100 130 L100 186" stroke="${cs}" stroke-width="1.5" opacity="0.6"/>`+
              `<ellipse cx="90" cy="150" rx="7" ry="10" fill="${ch}" opacity="0.4"/>`;
  }

  // Stiefel
  const fu = eq.fuesse; let fuesse = '';
  if(fu){ const c=matOf(fu), cs=shade(c,0.5);
    if(gender==='w') fuesse = mirror(`<ellipse cx="114" cy="305" rx="11" ry="6" fill="${c}" stroke="${cs}" stroke-width="1.2"/>`);
    else if(gender==='m') fuesse = `<rect x="102" y="261" width="22" height="17" rx="5" fill="${c}" stroke="${cs}" stroke-width="1.2"/><rect x="76" y="261" width="22" height="17" rx="5" fill="${c}" stroke="${cs}" stroke-width="1.2"/>`;
    else fuesse = `<rect x="104" y="285" width="18" height="15" rx="4" fill="${c}" stroke="${cs}" stroke-width="1.2"/><rect x="78" y="285" width="18" height="15" rx="4" fill="${c}" stroke="${cs}" stroke-width="1.2"/>`;
  }

  // Handschuhe
  const ha = eq.haende;
  const gloves = ha
    ? mirror(`<circle cx="124" cy="194" r="9" fill="${matOf(ha)}" stroke="${shade(matOf(ha),0.5)}" stroke-width="1.2"/><rect x="116" y="186" width="16" height="7" rx="2" fill="${matOf(ha)}" stroke="${shade(matOf(ha),0.5)}" stroke-width="1"/>`)
    : '';

  // Schild am linken Arm (Episch+ → größer + leuchtend)
  const sc = eq.schild; let schild = '';
  if(sc){ const v=(((sc.variant|0)%6)+6)%6, m=WEAPON_METAL[v], ms=shade(m,0.5), mh=shade(m,1.2), cx=72, cy=180;
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

  // Schulterplatten (sonst Tier-Pauldrons)
  const shp_ = eq.schultern;
  const pauldronG = shp_
    ? mirror(`<ellipse cx="120" cy="133" rx="16" ry="11" fill="${matOf(shp_)}" stroke="${shade(matOf(shp_),0.5)}" stroke-width="1.5"/><ellipse cx="120" cy="131" rx="9" ry="5" fill="${shade(matOf(shp_),1.2)}" opacity="0.5"/>`)
    : tierPauldrons;

  // Voller Helm (verdeckt Haare; nur wenn angelegt UND nicht ausgeblendet)
  const kp = eq.kopf; let helm = '';
  if(kp && !hideHelmet){ const c=matOf(kp), cs=shade(c,0.5), ch=shade(c,1.2);
    helm = `<path d="M64 80 Q60 40 100 40 Q140 40 136 80 L136 86 L64 86 Z" fill="${c}" stroke="${cs}" stroke-width="2" stroke-linejoin="round"/>`+
           `<rect x="64" y="84" width="72" height="8" rx="3" fill="${shade(c,0.85)}" stroke="${cs}" stroke-width="1.5"/>`+
           `<rect x="97" y="84" width="6" height="22" rx="1" fill="${cs}"/>`+
           `<rect x="78" y="74" width="16" height="6" rx="3" fill="#160d12" opacity="0.85"/>`+
           `<rect x="106" y="74" width="16" height="6" rx="3" fill="#160d12" opacity="0.85"/>`+
           `<ellipse cx="88" cy="56" rx="10" ry="6" fill="${ch}" opacity="0.4"/>`;
  }

  const weaponG = heldWeapon(eq.waffe, uid);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">`+
    defs + aura + cloak + hairBack + body + beine + brust + fuesse + arms + gloves + schild +
    pauldronG + head + face + hairFront + helm + weaponG +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function heroSrc(tier){
  if(state && state.character)
    return buildHeroSVG(state.character, tier, {
      equipped: state.equipped || {},
      hideHelmet: !!(state.settings && state.settings.hideHelmet),
    });
  return ASSETS + 'char_tier' + tier + '.png';
}
