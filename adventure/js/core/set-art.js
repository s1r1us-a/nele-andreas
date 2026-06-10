/* =====================================================================
   SET-ART – prozedurale SVG-Optik der 4 Klassensets. EINE Quelle für
   Inventar-Icon (item-art.js) UND getragenes Teil (avatar.js), damit beide
   identisch aussehen. Rein additiv & isoliert – greift in keine bestehende
   Render-Logik ein; wird nur betreten, wenn ein Item ein `setId` trägt.

   Stil pro Klasse (aus den Referenzbildern):
     molten      (Verteidiger) – Glut-Platte, Hörner, Flammen-Flügelschultern
     bloodshadow (Schurke)     – schwarzes Leder, rote Klingen-Spitzen, Kapuze
     void        (Hexer)       – Leeren-Robe, Geweih-Dornen, glühende Augen
     holy        (Heiler)      – Lichtrobe, Heiligenschein, Federschultern
   ===================================================================== */
import { mirror64, dirGrad, star, facetGem, REDUCED_MOTION } from './svg-fx.js';

const f = n => (Math.round(n*10)/10);

// ---- Paletten -------------------------------------------------------
export const SET_THEME = {
  molten:      { base:'#2c2730', base2:'#161318', metal:'#39231c', plate:'#2a2228',
                 accent:'#ff7a2a', accent2:'#ffd36a', glow:'#ff4a14', edge:'#7a2a10', emissive:'#ffae3a' },
  bloodshadow: { base:'#1b1115', base2:'#0b0608', metal:'#251017', plate:'#1d1418',
                 accent:'#e01f3a', accent2:'#ff6a52', glow:'#ff1f2f', edge:'#5a0f18', emissive:'#ff3a4a' },
  void:        { base:'#241a33', base2:'#110b1b', metal:'#2b2142', plate:'#241b36',
                 accent:'#a24bff', accent2:'#d9b0ff', glow:'#7a2fff', edge:'#3a1f66', emissive:'#c98bff' },
  holy:        { base:'#f3ead4', base2:'#cdb988', metal:'#e7d6a2', plate:'#efe6cf',
                 accent:'#e7b13a', accent2:'#fff4cf', glow:'#ffe89a', edge:'#b9912f', emissive:'#fff1c0' },
};
export const setPalette = themeKey => SET_THEME[themeKey] || SET_THEME.molten;
export const setBaseColor = themeKey => setPalette(themeKey).base;

let _seq = 0;

// ---- Primitive ------------------------------------------------------
// Schlanke, leicht gebogene Klingen-/Dorn-/Federspitze: Basis bei (x,y),
// zeigt in Winkel a (Grad), Länge len, Basisbreite wid. curve>0 = Bogen.
function bladeSpike(x, y, a, len, wid, fill, edge, curve){
  const r = a*Math.PI/180, dx = Math.cos(r), dy = Math.sin(r), px = -dy, py = dx;
  curve = curve || 0;
  const tx = x+dx*len, ty = y+dy*len;
  const mx = x+dx*len*0.55 + px*curve, my = y+dy*len*0.55 + py*curve;
  const b1x = x+px*wid/2, b1y = y+py*wid/2, b2x = x-px*wid/2, b2y = y-py*wid/2;
  return `<path d="M${f(b1x)} ${f(b1y)} Q${f(mx+px*wid*0.25)} ${f(my+py*wid*0.25)} ${f(tx)} ${f(ty)} `+
         `Q${f(mx-px*wid*0.25)} ${f(my-py*wid*0.25)} ${f(b2x)} ${f(b2y)} Z" fill="${fill}"`+
         (edge?` stroke="${edge}" stroke-width="0.7"`:'')+`/>`;
}
// Flammenzunge (zwei geschwungene Stiche) an (x,y), Höhe h.
function flameTongue(x, y, h, glow, core){
  return `<path d="M${f(x)} ${f(y)} Q${f(x-h*0.4)} ${f(y-h*0.5)} ${f(x)} ${f(y-h)} Q${f(x+h*0.4)} ${f(y-h*0.5)} ${f(x)} ${f(y)} Z" fill="${glow}" opacity="0.92"/>`+
         `<path d="M${f(x)} ${f(y-h*0.15)} Q${f(x-h*0.22)} ${f(y-h*0.5)} ${f(x)} ${f(y-h*0.78)} Q${f(x+h*0.22)} ${f(y-h*0.5)} ${f(x)} ${f(y-h*0.15)} Z" fill="${core}" opacity="0.95"/>`;
}
// Weicher Glow-Filter (Bloom) um die Set-Silhouette.
export function setGlowFilter(id, color, strength){
  const s = strength || 2.2;
  return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">`+
    `<feDropShadow dx="0" dy="0" stdDeviation="${s}" flood-color="${color}" flood-opacity="0.85"/></filter>`;
}

/* ---------------------------------------------------------------------
   PART-BUILDER (koordinaten-parametrisch → in 64er-Icon UND 200er-Avatar
   nutzbar). Jeweils EIN rechtes/oberes Element; der Aufrufer spiegelt.
   cx,cy = Ankerpunkt, s = Skalierung (1 ≈ Icon-Maßstab).
   --------------------------------------------------------------------- */

// Eine Schulter-Verzierung (zeigt nach oben-außen, +x = außen).
export function setShoulder(themeKey, cx, cy, s){
  const P = setPalette(themeKey);
  const cap = `<path d="M${-13} ${5} Q${-15} ${-9} ${1} ${-11} Q${16} ${-11} ${17} ${3} Q${15} ${12} ${0} ${12} Q${-10} ${11} ${-13} ${5} Z" `+
              `fill="${P.plate}" stroke="${P.edge}" stroke-width="1.3"/>`+
              `<path d="M${-9} ${-5} Q${0} ${-9} ${11} ${-4}" fill="none" stroke="${P.accent}" stroke-width="1.2" opacity="0.8"/>`;
  let spikes = '';
  if(themeKey === 'molten'){
    spikes = bladeSpike(-4,-6,-108,22,7,P.metal,P.edge,3)+
             bladeSpike(3,-8,-78,30,8,P.plate,P.edge,5)+
             bladeSpike(11,-5,-52,24,7,P.metal,P.edge,5)+
             // glühende Kanten
             bladeSpike(3,-8,-78,30,3.2,P.accent,null,5)+
             bladeSpike(11,-5,-52,24,2.6,P.accent,null,5)+
             flameTongue(3,-34,9,P.glow,P.accent2)+flameTongue(12,-26,7,P.glow,P.accent2)+flameTongue(-5,-25,6,P.glow,P.accent2);
  } else if(themeKey === 'bloodshadow'){
    spikes = bladeSpike(-3,-6,-112,26,5,P.plate,P.edge,2)+
             bladeSpike(4,-8,-82,34,6,P.metal,P.edge,4)+
             bladeSpike(12,-5,-58,28,5,P.plate,P.edge,4)+
             bladeSpike(4,-8,-82,34,2.2,P.accent,null,4)+
             bladeSpike(12,-5,-58,28,2,P.accent,null,4)+
             bladeSpike(-3,-6,-112,26,1.8,P.accent,null,2);
  } else if(themeKey === 'void'){
    // Geweih-Dornen (gegabelt) + Rune
    spikes = bladeSpike(-2,-6,-100,24,4.5,P.plate,P.edge,5)+
             bladeSpike(-6,-18,-128,12,3,P.plate,P.edge,3)+
             bladeSpike(5,-7,-74,30,5,P.metal,P.edge,7)+
             bladeSpike(10,-20,-58,12,3,P.plate,P.edge,4)+
             bladeSpike(5,-7,-74,30,2,P.accent,null,7)+
             `<circle cx="3" cy="-12" r="2.4" fill="${P.glow}"/><circle cx="3" cy="-12" r="1.2" fill="#fff"/>`;
  } else { // holy – Federflügel + Halo-Bogen
    spikes = bladeSpike(-4,-4,-120,20,8,P.base,P.edge,6)+
             bladeSpike(2,-6,-95,26,9,'#ffffff',P.edge,8)+
             bladeSpike(9,-4,-68,22,8,P.base,P.edge,8)+
             // Federkiele
             `<path d="M2 -6 Q1 -16 0 -30" stroke="${P.accent}" stroke-width="1" fill="none" opacity="0.7"/>`+
             `<path d="M-12 -22 Q0 -30 12 -22" fill="none" stroke="${P.accent2}" stroke-width="1.6" opacity="0.85"/>`;
  }
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})">${cap}${spikes}</g>`;
}

// Helm-Aufsatz (Hörner / Kapuzenspitze / Halo) über dem Kopf, zentriert (cx,cy).
export function setHelmCrest(themeKey, cx, cy, s){
  const P = setPalette(themeKey);
  let g = '';
  if(themeKey === 'molten'){
    // Gehörnter Helm-Kamm (symmetrische Hörner, Origin frei → eigene Spiegelung)
    g = bladeSpike(-3,-2,-114,20,5,P.metal,P.edge,6)+bladeSpike(3,-2,-66,20,5,P.metal,P.edge,6)+
        bladeSpike(-3,-2,-114,20,2,P.accent,null,6)+bladeSpike(3,-2,-66,20,2,P.accent,null,6)+
        `<path d="M-6 0 L0 -7 L6 0 Z" fill="${P.accent}" opacity="0.8"/>`;
  } else if(themeKey === 'bloodshadow'){
    g = `<path d="M-9 2 Q0 -14 9 2" fill="none" stroke="${P.accent}" stroke-width="1.6" opacity="0.8"/>`+
        `<ellipse cx="-3.5" cy="0" rx="1.7" ry="1.1" fill="${P.glow}"/><ellipse cx="3.5" cy="0" rx="1.7" ry="1.1" fill="${P.glow}"/>`;
  } else if(themeKey === 'void'){
    g = bladeSpike(-3,-2,-118,14,3,P.plate,P.edge,4)+bladeSpike(3,-2,-62,14,3,P.plate,P.edge,4)+
        `<ellipse cx="-3.5" cy="0.5" rx="2" ry="1.3" fill="${P.glow}"/><ellipse cx="3.5" cy="0.5" rx="2" ry="1.3" fill="${P.glow}"/>`;
  } else { // holy – Heiligenschein aus 3 Lichtkugeln
    const orb = (x,d) => `<g>${star(x,-9,3.4,1.2,4,'#fff')}<circle cx="${x}" cy="-9" r="2.2" fill="${P.accent2}"/>`+
      (REDUCED_MOTION?'':`<animate attributeName="opacity" values="0.7;1;0.7" dur="2.2s" begin="${d}s" repeatCount="indefinite"/>`)+`</g>`;
    g = `<path d="M-11 -8 Q0 -15 11 -8" fill="none" stroke="${P.accent2}" stroke-width="1.4" opacity="0.7"/>`+
        orb(-7,0)+orb(0,0.4)+orb(7,0.8);
  }
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})">${g}</g>`;
}

// Brust-Emblem (Totenkopf / Klinge / Juwel / Sonnenmedaillon).
export function setChestEmblem(themeKey, cx, cy, s){
  const P = setPalette(themeKey);
  let g = '';
  if(themeKey === 'molten'){
    g = `<path d="M0 -6 Q6 -6 6 1 Q6 6 3 8 L3 11 L-3 11 L-3 8 Q-6 6 -6 1 Q-6 -6 0 -6 Z" fill="${P.accent}" opacity="0.92"/>`+
        `<circle cx="-2.4" cy="0.5" r="1.4" fill="#1a0a04"/><circle cx="2.4" cy="0.5" r="1.4" fill="#1a0a04"/>`+
        `<path d="M-1 4 L1 4 L0 7 Z" fill="#1a0a04"/>`;
  } else if(themeKey === 'bloodshadow'){
    g = `<path d="M0 -8 L4 0 L0 10 L-4 0 Z" fill="${P.accent}" opacity="0.9"/>`+
        `<path d="M0 -8 L0 10" stroke="${P.accent2}" stroke-width="1" opacity="0.8"/>`;
  } else if(themeKey === 'void'){
    g = facetGem(0,0,5.5,P.accent)+`<circle cx="0" cy="0" r="8" fill="none" stroke="${P.accent2}" stroke-width="1" opacity="0.7"/>`;
  } else {
    g = star(0,0,7,3,8,P.accent2)+`<circle cx="0" cy="0" r="3" fill="${P.accent}"/>`+
        `<circle cx="0" cy="0" r="9" fill="none" stroke="${P.accent}" stroke-width="1" opacity="0.6"/>`;
  }
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})">${g}</g>`;
}

/* ---------------------------------------------------------------------
   ICON (64×64) – komplettes, deutlich abgehobenes Set-Icon je Slot-art.
   Wird von item-art.js (buildItemSVG) bei gesetztem setTheme delegiert.
   --------------------------------------------------------------------- */
export function buildSetIcon(art, themeKey, rarityKey){
  const P = setPalette(themeKey);
  const uid = '_s'+(_seq++).toString(36);
  const gid = 'sg'+uid, plg = 'pl'+uid, acg = 'ac'+uid;
  let defs = setGlowFilter(gid, P.glow, 2.6)+dirGrad(plg, P.plate)+dirGrad(acg, P.accent);
  const G = `url(#${gid})`, PL = `url(#${plg})`, AC = `url(#${acg})`;
  const aura = `<rect x="0" y="0" width="64" height="64" fill="${P.glow}" opacity="0.10"/>`;
  let body = '';

  if(art === 'schultern'){
    body = mirror64(setShoulder(themeKey, 22, 36, 1.05));
  } else if(art === 'kopf'){
    // Themen-Helm/Kapuze + Aufsatz
    if(themeKey === 'molten'){
      body = `<path d="M18 40 Q14 14 32 12 Q50 14 46 40 L46 48 Q39 53 32 53 Q25 53 18 48 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
             `<rect x="29" y="30" width="6" height="16" rx="3" fill="${P.glow}" opacity="0.9"/>`+
             setHelmCrest('molten', 32, 14, 1.25);
    } else {
      const hood = `<path d="M32 8 Q52 12 53 38 Q54 50 46 56 L41 53 Q47 40 45 30 Q41 18 32 16 Q23 18 19 30 Q17 40 23 53 L18 56 Q10 50 11 38 Q12 12 32 8 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`;
      const inner = `<path d="M24 26 Q32 22 40 26 Q42 40 38 50 Q32 54 26 50 Q22 40 24 26 Z" fill="${P.base2}" opacity="0.85"/>`;
      body = hood + inner + setHelmCrest(themeKey, 32, 30, 1.15)+
             `<path d="M22 30 Q32 25 42 30" fill="none" stroke="${P.accent}" stroke-width="1.2" opacity="0.7"/>`;
    }
  } else if(art === 'brust'){
    if(themeKey === 'molten' || themeKey === 'bloodshadow'){
      body = `<path d="M18 14 L46 14 L48 30 Q48 52 32 58 Q16 52 16 30 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
             `<path d="M32 16 L32 56" stroke="${P.accent}" stroke-width="1.2" opacity="0.6"/>`+
             setChestEmblem(themeKey, 32, 30, 1.25);
    } else { // robe (void/holy)
      body = `<path d="M22 12 L32 20 L42 12 Q50 16 52 34 L54 58 Q32 62 10 58 L12 34 Q14 16 22 12 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
             `<path d="M22 12 L32 22 L42 12" fill="none" stroke="${P.accent}" stroke-width="1.4" opacity="0.8"/>`+
             `<path d="M32 24 L32 60" stroke="${P.accent}" stroke-width="1" opacity="0.5"/>`+
             setChestEmblem(themeKey, 32, 30, 1.2);
    }
  } else if(art === 'umhang'){
    body = `<path d="M22 12 L42 12 L52 54 Q32 60 12 54 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
           `<path d="M22 12 Q32 22 42 12" fill="none" stroke="${P.accent}" stroke-width="1.4" opacity="0.7"/>`+
           `<path d="M32 14 L32 56" stroke="${P.accent}" stroke-width="1" opacity="0.4"/>`+
           setChestEmblem(themeKey, 32, 24, 0.9);
  } else if(art === 'haende'){
    body = `<path d="M22 28 L22 18 Q22 14 26 14 L38 14 Q42 14 42 18 L42 30 Q42 50 32 52 Q22 50 22 36 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
           `<rect x="22" y="44" width="20" height="8" rx="2" fill="${AC}" opacity="0.9"/>`;
    // kleine Knöchel-Spikes
    body += bladeSpike(26,15,-100,10,3,P.metal,P.edge,2)+bladeSpike(32,13,-90,11,3,P.metal,P.edge,2)+bladeSpike(38,15,-80,10,3,P.metal,P.edge,2)+
            bladeSpike(32,13,-90,11,1.4,P.accent,null,2);
  } else if(art === 'beine'){
    body = mirror64(`<path d="M34 12 L44 12 L42 52 L36 52 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
                    `<rect x="35" y="22" width="8" height="4" rx="1" fill="${AC}" opacity="0.8"/>`+
                    `<rect x="35" y="36" width="8" height="4" rx="1" fill="${AC}" opacity="0.8"/>`);
  } else { // fuesse
    body = `<path d="M22 12 L38 12 L40 40 L52 40 L52 52 L20 52 L20 24 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
           `<rect x="20" y="48" width="32" height="6" rx="2" fill="${P.base2}"/>`+
           bladeSpike(24,14,-86,10,3,P.metal,P.edge,2)+bladeSpike(31,14,-86,11,3,P.metal,P.edge,2)+
           bladeSpike(31,14,-86,11,1.4,P.accent,null,2);
  }

  // Akzent-Funkeln (oben) für „edel".
  const spark = REDUCED_MOTION ? '' :
    `<g opacity="0.9">${star(50,15,3,1,4,'#fff')}<animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>`+
    aura + `<g filter="${G}">${body}</g>` + spark + `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
