/* =====================================================================
   AVATAR – prozeduraler SVG-Held aus Geschlecht/Frisur/Haar-/Haut-/
   Augenfarbe. Vektor-Look mit Verläufen, Glanz und sauberer Symmetrie.
   viewBox 200x320 (5:8 Ganzkörper) für feine, symmetrische Bezier-Kurven.
   ===================================================================== */
import { ASSETS } from '../data/tuning.js';
import { DEFAULT_CHARACTER, SKIN_TONE, EYE_DEFAULT } from '../data/character-options.js';
import { state } from './state.js';

const TIER_OUTFIT = ['#6b5a8a','#3f6f9e','#9e6b2e','#b5882a'];
const TIER_TRIM   = ['#9a86c2','#7fb0e0','#e0a85a','#f2cd6b'];

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

export function buildHeroSVG(character, tier){
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
  const cape = t>=2
    ? `<path d="M74 130 L126 130 L144 258 C120 270 80 270 56 258 Z" fill="${shade(trim,0.72)}"/>`+
      `<path d="M100 130 L100 264" stroke="${shade(trim,0.6)}" stroke-width="2" opacity="0.5"/>`
    : '';
  const pauldrons = t>=3 ? mirror(`<ellipse cx="120" cy="134" rx="15" ry="10" fill="url(#tr${uid})"/>`) : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320">`+
    defs + aura + cape + hairBack + body + arms + head + face + hairFront + pauldrons +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function heroSrc(tier){
  if(state && state.character) return buildHeroSVG(state.character, tier);
  return ASSETS + 'char_tier' + tier + '.png';
}
