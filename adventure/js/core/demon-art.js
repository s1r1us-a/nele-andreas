/* =====================================================================
   DEMON-ART – prozedurales SVG der Teufelswache (Hexer-Beschwörung).
   Ganzkörper-Charakter im Stil von boss-art.js / avatar.js: fel-grüner
   „Felguard"-Dämon mit Hörnern, Fängen, Klauen, Schweif und gefalteten
   Flügeln. viewBox 0 0 200 320 (volle Figur wie der Held), frontal &
   symmetrisch über mirror(). Rückgabe als data:image/svg+xml-URI, gecacht.
   ===================================================================== */

function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
// Rechte Hälfte an x=100 spiegeln → garantiert symmetrisch.
const mirror = f => f + '<g transform="translate(200,0) scale(-1,1)">'+f+'</g>';

// Fel-Palette
const BASE = '#5fae3a';                 // fel-grüne Haut
const HI   = shade(BASE,1.30);          // Glanzlicht
const MID  = shade(BASE,0.82);          // Mittelton
const LO   = shade(BASE,0.55);          // Schatten
const GLOW = '#9bff5a';                 // Fel-Glühen
const EYE  = '#bfff5a';                 // glühende Augen
const HORN = '#d9c7a0';                 // Hörner/Fänge/Klauen (Knochen)
const HORNLO = shade(HORN,0.7);
const CLAW = '#2a1d10';                 // dunkle Krallenspitzen
const BELLY = shade(BASE,0.9);          // Bauchplatten (heller)

let _uri = null;

export function buildDemonSVG(){
  if(_uri) return _uri;

  const gradId = 'dg', auraId = 'da', wingId = 'dw';
  const defs =
    `<defs>`+
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${HI}"/><stop offset="0.5" stop-color="${BASE}"/><stop offset="1" stop-color="${LO}"/></linearGradient>`+
    `<linearGradient id="${wingId}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${shade(LO,1.1)}"/><stop offset="1" stop-color="${shade(LO,0.7)}"/></linearGradient>`+
    `<radialGradient id="${auraId}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${GLOW}" stop-opacity="0.45"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient>`+
    `</defs>`;
  const G = `url(#${gradId})`;

  // Fel-Aura hinter der Figur + Boden-Schatten.
  const aura   = `<ellipse cx="100" cy="170" rx="98" ry="120" fill="url(#${auraId})"/>`;
  const shadow = `<ellipse cx="100" cy="306" rx="62" ry="12" fill="#000" opacity="0.30"/>`;

  // Glühendes Auge (rechts) – gespiegelt.
  const glowEye = (cx,cy,r) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${r+3}" ry="${r+2}" fill="${EYE}" opacity="0.5"/>`+
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r*1.1}" fill="${EYE}"/>`+
    `<ellipse cx="${cx}" cy="${cy+1}" rx="${r*0.4}" ry="${r*0.7}" fill="#14310a"/>`;

  // ---- Aufgespannte Dämonen-/Fledermausflügel hinter den Schultern (gespiegelt) ----
  const wings =
    mirror(
      // Flügel-Arm (oberer Knochen)
      `<path d="M120 146 Q160 120 196 96" stroke="${HORNLO}" stroke-width="5" fill="none" stroke-linecap="round"/>`+
      // Membran mit drei Bögen zwischen den Fingerknochen
      `<path d="M120 146 Q162 118 196 96 Q198 120 182 138 Q190 150 176 168 Q184 182 166 196 Q160 176 144 174 Q150 158 130 160 Z" `+
        `fill="url(#${wingId})" stroke="${LO}" stroke-width="2" stroke-linejoin="round" opacity="0.96"/>`+
      // Fingerknochen-Rippen
      `<path d="M120 146 Q156 132 182 138 M120 150 Q150 150 176 168 M122 156 Q146 162 166 196" stroke="${HORNLO}" stroke-width="2.5" fill="none" opacity="0.8"/>`+
      // Krallen an den Flügelspitzen
      `<path d="M196 96 l9 -7 -3 12 Z" fill="${HORN}"/>`+
      `<path d="M182 138 l9 -2 -7 8 Z" fill="${HORN}"/>`+
      `<path d="M176 168 l9 1 -8 7 Z" fill="${HORN}"/>`
    );

  // ---- Schweif (hinter dem Körper, eine Seite) ----
  const tail =
    `<path d="M124 250 Q168 268 170 226 Q160 240 150 232 Q160 252 132 248 Z" fill="${MID}" stroke="${LO}" stroke-width="2" stroke-linejoin="round"/>`+
    `<path d="M170 226 q10 -4 6 -16 q-2 10 -12 8 Z" fill="${HORNLO}"/>`;  // Pfeil-Spitze

  // ---- Beine: digitigrad mit Hufen/Krallen (gespiegelt) ----
  const legs =
    mirror(
      `<path d="M92 236 Q108 240 110 270 L112 292 Q100 298 90 292 L88 268 Q86 244 92 236 Z" fill="${G}" stroke="${LO}" stroke-width="2"/>`+
      `<path d="M86 292 q14 0 28 0 l-2 12 q-12 4 -24 0 Z" fill="${MID}"/>`+              // Huf
      `<path d="M88 304 l5 8 5 -8 Z" fill="${CLAW}"/><path d="M100 304 l5 8 5 -8 Z" fill="${CLAW}"/>` // Krallen
    );

  // ---- Torso: muskulös, mit helleren Bauchplatten ----
  const torso =
    `<path d="M66 150 Q100 132 134 150 Q142 196 122 238 Q100 248 78 238 Q58 196 66 150 Z" fill="${G}" stroke="${LO}" stroke-width="2" stroke-linejoin="round"/>`+
    `<path d="M86 176 Q100 170 114 176 L112 220 Q100 228 88 220 Z" fill="${BELLY}" opacity="0.85"/>`+ // Bauchplatten
    `<path d="M92 184 h16 M91 196 h18 M92 208 h16" stroke="${LO}" stroke-width="2" opacity="0.6"/>`+   // Bauch-Linien
    // Brustmuskel-Andeutung
    mirror(`<path d="M100 158 Q116 158 122 172 Q110 168 100 172 Z" fill="${HI}" opacity="0.5"/>`);

  // ---- Arme mit geballten Klauenfäusten (gespiegelt) ----
  const arms =
    mirror(
      `<path d="M132 158 Q160 168 158 206 Q156 226 142 232 Q150 210 144 192 Q140 172 126 168 Z" fill="${G}" stroke="${LO}" stroke-width="2" stroke-linejoin="round"/>`+
      `<ellipse cx="149" cy="236" rx="20" ry="19" fill="${MID}" stroke="${LO}" stroke-width="2"/>`+      // Faust
      `<ellipse cx="149" cy="234" rx="11" ry="9" fill="${HI}" opacity="0.35"/>`+                         // Faust-Glanz
      `<path d="M132 232 l-6 -10 7 7 Z M141 224 l-3 -12 6 8 Z M151 223 l1 -12 5 10 Z M161 227 l6 -9 1 11 Z" fill="${HORN}"/>`+ // Krallen
      `<path d="M138 158 Q126 150 116 152" stroke="${HI}" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>`+ // Schulter-Glanz
      // breite Schulter/Pauldron-Knochenspitze
      `<path d="M132 152 q18 -10 30 2 q-16 -2 -24 8 Z" fill="${LO}"/>`+
      `<path d="M158 150 l9 -7 -4 12 Z" fill="${HORNLO}"/>`
    );

  // ---- Hals + Kopf mit Hörnern, Augen, Fängen ----
  const head =
    `<path d="M88 134 q12 8 24 0 l-2 16 q-10 6 -20 0 Z" fill="${MID}"/>`+                 // Hals
    `<ellipse cx="100" cy="108" rx="34" ry="31" fill="${G}"/>`+                            // Kopf
    `<path d="M72 104 Q100 92 128 104" stroke="${HI}" stroke-width="2.5" fill="none" opacity="0.5"/>`+ // Stirn-Glanz
    // geschwungene Hörner (gespiegelt)
    mirror(
      `<path d="M120 92 Q150 64 150 30 Q138 56 124 70 Q130 86 120 92 Z" fill="${HORN}" stroke="${HORNLO}" stroke-width="1.5" stroke-linejoin="round"/>`+
      `<path d="M132 78 q10 -8 14 -22 q-2 12 -10 18 Z" fill="#fff" opacity="0.3"/>`
    )+
    // markante Brauen
    mirror(`<path d="M104 100 Q116 94 128 102" stroke="${LO}" stroke-width="5" fill="none" stroke-linecap="round"/>`)+
    mirror(glowEye(116,108,6))+
    // grinsendes Maul + Fänge
    `<path d="M82 122 Q100 134 118 122 Q100 130 82 122 Z" fill="#1c0f0f"/>`+
    mirror(`<path d="M108 122 L112 134 L116 122 Z" fill="${HORN}"/>`)+                      // untere Fänge
    mirror(`<path d="M104 121 L106 113 L110 121 Z" fill="${HORN}"/>`);                      // obere Fänge

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">`+
      defs + aura + shadow +
      wings + tail + legs + torso + arms + head +
    `</svg>`;
  _uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  return _uri;
}
