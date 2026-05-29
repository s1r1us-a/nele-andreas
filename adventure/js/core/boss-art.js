/* =====================================================================
   BOSS-ART – prozedurale SVG-Monster (ersetzt boss_*.png).
   5 Archetypen (spr 0–4) × 10 Gebietsfarben (area) + Mechanik-Glühen.
   viewBox 0 0 200 200, symmetrisch/frontal (Kampf-Flip scaleX(-1) unsichtbar).
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

// Gebiets-Grundfarben (Index = area 0–9).
const ZONE_PAL = [
  '#5fa84a', // 0 Blühende Wiesen – grün
  '#3f6b3a', // 1 Dunkelwald – dunkelgrün
  '#7a6f63', // 2 Tiefe Höhlen – graubraun
  '#b23a2a', // 3 Vulkanschlund – rot
  '#6fb0d8', // 4 Frostgipfel – eisblau
  '#2f9c93', // 5 Versunkene Tiefen – türkis
  '#6b4a8f', // 6 Schattenreich – violett
  '#c87a3a', // 7 Aschewüste – orange
  '#c9a94e', // 8 Himmelszitadelle – gold
  '#7a3aa0', // 9 Die Leere – tiefviolett
];
const BONE = '#ece3cf';

let SEQ = 0;
const _cache = new Map();

export function buildBossSVG(boss){
  const spr  = ((boss && boss.spr) | 0) % 5;
  const area = Math.max(0, Math.min(9, (boss && boss.area) | 0));
  const mech = (boss && boss.mechColor) || '#ff5a3c';
  const vi   = ((boss && boss.zone) | 0) % 6;       // Variations-Bucket
  const key  = spr+'_'+area+'_'+mech+'_'+vi;
  if(_cache.has(key)) return _cache.get(key);

  const base = ZONE_PAL[area];
  const hi = shade(base,1.24), lo = shade(base,0.6), mid = shade(base,0.8);
  const uid = '_'+(SEQ++).toString(36);
  const gradId = 'bg'+uid, mechId = 'mg'+uid;

  const defs =
    `<defs>`+
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${hi}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`+
    `<radialGradient id="${mechId}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${mech}" stop-opacity="0.55"/><stop offset="1" stop-color="${mech}" stop-opacity="0"/></radialGradient>`+
    `</defs>`;
  const aura = `<ellipse cx="100" cy="110" rx="96" ry="92" fill="url(#${mechId})"/>`;
  const shadow = `<ellipse cx="100" cy="184" rx="58" ry="10" fill="#000" opacity="0.28"/>`;
  const G = `url(#${gradId})`;
  // Glühendes Auge (rechts), wird gespiegelt.
  const glowEye = (cx,cy,r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r+2}" fill="${mech}" opacity="0.5"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r*0.6}" fill="${mech}"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r*0.28}" fill="#160d12"/>`;

  let mon = '';
  if(spr===0){ // ---- Goblin / Brute ----
    const ear = 14 + vi*3;
    mon =
      mirror(`<path d="M132 64 L${150+ear} ${44-ear*0.4} L150 86 Z" fill="${mid}"/>`)+ // Ohren
      `<ellipse cx="100" cy="126" rx="58" ry="50" fill="${G}"/>`+                       // Körper
      mirror(`<ellipse cx="150" cy="138" rx="17" ry="19" fill="${G}"/>`)+               // Fäuste
      `<ellipse cx="100" cy="80" rx="48" ry="43" fill="${G}"/>`+                        // Kopf
      mirror(`<path d="M104 58 Q120 56 134 64" stroke="${lo}" stroke-width="5" fill="none" stroke-linecap="round"/>`)+ // Brauen
      mirror(glowEye(120,78,9))+
      `<path d="M76 100 Q100 118 124 100" stroke="#3a1c1c" stroke-width="5" fill="none" stroke-linecap="round"/>`+ // Mund
      mirror(`<path d="M112 104 L117 120 L122 104 Z" fill="${BONE}"/>`);                 // Hauer
  } else if(spr===1){ // ---- Spinne ----
    const legs = `M120 96 Q156 78 176 ${52-vi*2}`;
    mon =
      mirror(`<path d="${legs}" stroke="${mid}" stroke-width="7" fill="none" stroke-linecap="round"/>`)+
      mirror(`<path d="M122 108 Q160 100 184 92" stroke="${mid}" stroke-width="7" fill="none" stroke-linecap="round"/>`)+
      mirror(`<path d="M122 120 Q158 124 182 134" stroke="${mid}" stroke-width="7" fill="none" stroke-linecap="round"/>`)+
      mirror(`<path d="M118 130 Q150 146 170 168" stroke="${mid}" stroke-width="7" fill="none" stroke-linecap="round"/>`)+
      `<ellipse cx="100" cy="128" rx="48" ry="42" fill="${G}"/>`+                        // Hinterleib
      `<ellipse cx="100" cy="84" rx="32" ry="28" fill="${shade(base,0.9)}"/>`+           // Kopf
      mirror(glowEye(112,80,6))+ mirror(glowEye(122,90,4))+
      (vi>2 ? mirror(glowEye(104,72,4)) : '')+
      mirror(`<path d="M92 98 L88 112 L98 102 Z" fill="${BONE}"/>`);                      // Fänge
  } else if(spr===2){ // ---- Troll / Riese ----
    const horn = 18 + vi*4;
    mon =
      mirror(`<path d="M120 52 Q${134+horn} ${36-horn*0.5} ${128+horn*0.4} 58 Q126 50 120 52 Z" fill="${BONE}"/>`)+ // Hörner
      `<path d="M52 176 Q44 120 70 96 L130 96 Q156 120 148 176 Z" fill="${G}"/>`+        // massiger Körper
      mirror(`<ellipse cx="150" cy="150" rx="21" ry="24" fill="${G}"/>`)+                // riesige Fäuste
      `<ellipse cx="100" cy="78" rx="44" ry="40" fill="${G}"/>`+                         // Kopf
      mirror(glowEye(118,74,8))+
      `<path d="M78 98 Q100 108 122 98 L122 104 Q100 116 78 104 Z" fill="#2a1414"/>`+    // Maul
      mirror(`<rect x="108" y="100" width="7" height="11" rx="1.5" fill="${BONE}"/>`);    // Zähne (Unterbiss)
  } else if(spr===3){ // ---- Drache ----
    const wing = 24 + vi*4;
    mon =
      mirror(`<path d="M118 96 L${176+wing*0.2} ${66-wing} L184 124 L132 132 Z" fill="${mid}"/>`)+ // Flügel
      mirror(`<path d="M132 110 L176 ${96-wing*0.3} L178 122 Z" fill="${lo}"/>`)+         // Flügel-Detail
      `<ellipse cx="100" cy="130" rx="40" ry="44" fill="${G}"/>`+                        // Körper
      `<ellipse cx="100" cy="138" rx="22" ry="30" fill="${hi}" opacity="0.8"/>`+         // heller Bauch
      `<path d="M100 150 Q70 178 40 184 Q66 168 78 146 Z" fill="${G}"/>`+                // Schweif
      `<ellipse cx="100" cy="72" rx="30" ry="26" fill="${G}"/>`+                         // Kopf
      `<path d="M100 78 Q124 80 122 96 L78 96 Q76 80 100 78 Z" fill="${mid}"/>`+         // Schnauze
      mirror(`<path d="M114 50 Q126 34 122 54 Z" fill="${BONE}"/>`)+                      // Hörner
      mirror(glowEye(112,68,6))+
      `<path d="M86 92 Q100 100 114 92" stroke="#2a1414" stroke-width="3" fill="none" stroke-linecap="round"/>`+ // Maul
      `<ellipse cx="100" cy="100" rx="7" ry="5" fill="${mech}" opacity="0.85"/>`;        // Feuer-Hauch
  } else { // ---- Golem / Kristall ----
    const spike = 22 + vi*5;
    mon =
      mirror(`<path d="M138 86 L${156+spike*0.3} ${56-spike} L150 92 Z" fill="${hi}"/>`)+ // Kristall-Spikes
      `<path d="M58 92 L142 92 L154 174 L46 174 Z" fill="${G}" stroke="${lo}" stroke-width="3" stroke-linejoin="round"/>`+ // Block-Körper
      mirror(`<rect x="150" y="98" width="18" height="56" rx="3" fill="${G}" stroke="${lo}" stroke-width="2"/>`)+ // Block-Arme
      `<rect x="76" y="46" width="48" height="46" rx="5" fill="${mid}" stroke="${lo}" stroke-width="3"/>`+ // Kopf-Block
      mirror(`<rect x="106" y="64" width="13" height="8" rx="2" fill="${mech}"/>`)+       // Augenschlitze
      mirror(`<circle cx="113" cy="68" r="6" fill="${mech}" opacity="0.45"/>`)+
      `<circle cx="100" cy="128" r="14" fill="${mech}" opacity="0.35"/>`+                 // glühender Kern
      `<circle cx="100" cy="128" r="8" fill="${mech}"/>`+
      `<path d="M100 96 L100 174" stroke="${lo}" stroke-width="2" opacity="0.5"/>`;       // Riss
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">`+
    defs + aura + shadow + mon + `</svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  _cache.set(key, uri);
  return uri;
}
