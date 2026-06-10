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
import { shade, mirror64, dirGrad, star, facetGem, REDUCED_MOTION } from './svg-fx.js';

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
  // ── Zweit-Sets (deutlich abgehoben, „next level" mit Animationen) ──
  azure:       { base:'#0f1622', base2:'#080c14', metal:'#16202c', plate:'#13202e',
                 accent:'#3aa6ff', accent2:'#cfe8ff', glow:'#1e74ff', edge:'#0c2f52', emissive:'#8fd4ff' },
  astral:      { base:'#130f2a', base2:'#090717', metal:'#211a40', plate:'#1b1636',
                 accent:'#8a6cff', accent2:'#cfe0ff', glow:'#6a40ff', edge:'#241a55', emissive:'#a9c8ff' },
  storm:       { base:'#0c1420', base2:'#060b13', metal:'#15212d', plate:'#121e2a',
                 accent:'#4fe6ff', accent2:'#e6ffff', glow:'#16b0ff', edge:'#0a3346', emissive:'#8af0ff' },
  verdant:     { base:'#11241a', base2:'#08130d', metal:'#1c3b28', plate:'#173322',
                 accent:'#5fe07a', accent2:'#ffe98c', glow:'#46e070', edge:'#0e4a2a', emissive:'#9bffb0' },
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
// Echtes Neon-„Bloom": die Quelle wird unscharf verdoppelt und über sich selbst
// gelegt → weiches, sattes Leuchten (statt flacher Farbe). Für emissive Lagen.
export function setBloomFilter(id, strength){
  const s = strength || 2.6;
  return `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%">`+
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${s}" result="b"/>`+
    `<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
// Kleine Runen-/Glyphenmarken auf einer Ellipsenbahn (für den Bodenkreis).
function runeMarks(rx, ry, color){
  let m = ''; const n = 10;
  for(let i=0;i<n;i++){ const a = (Math.PI*2/n)*i, x = Math.cos(a)*rx, y = Math.sin(a)*ry;
    m += `<circle cx="${f(x)}" cy="${f(y)}" r="${i%2?1.2:1.9}" fill="${color}" opacity="0.8"/>`; }
  return m;
}

/* ---------------------------------------------------------------------
   PART-BUILDER (koordinaten-parametrisch → in 64er-Icon UND 200er-Avatar
   nutzbar). Jeweils EIN rechtes/oberes Element; der Aufrufer spiegelt.
   cx,cy = Ankerpunkt, s = Skalierung (1 ≈ Icon-Maßstab).
   --------------------------------------------------------------------- */

// Eine Schulter-Verzierung (zeigt nach oben-außen, +x = außen). Bewusst
// ausladend & mehrlagig: weicher Glow → Spike-Fächer → Pauldron-Sockel →
// glühende Akzent-Kerne/Flammen obendrauf (Theme-spezifisch).
export function setShoulder(themeKey, cx, cy, s){
  const P = setPalette(themeKey);
  const _u = (_seq++).toString(36);
  const hi = shade(P.plate,1.3), dk = shade(P.plate,0.62);
  // weicher Set-Glow hinter der Schulter (ohne Filter → überall lauffähig)
  const glow = `<ellipse cx="3" cy="-8" rx="22" ry="17" fill="${P.glow}" opacity="0.14"/>`;
  // mehrlagiger Pauldron-Sockel (Verlauf per shade-Schichten)
  // Kantiger, facettierter Pauldron (scharfe Ecken/Miter, spitze Außenkante).
  const cap =
    `<path d="M-16 9 L-18 -6 L-6 -15 L10 -16 L25 -9 L29 3 L21 16 L4 19 L-10 16 Z" fill="${dk}" stroke="${P.edge}" stroke-width="1.6" stroke-linejoin="miter"/>`+
    `<path d="M-14 8 L-15 -4 L-4 -12 L10 -13 L22 -7 L25 2 L18 13 L4 16 L-9 13 Z" fill="${P.plate}"/>`+
    `<path d="M-4 -12 L10 -13 L22 -7 L11 -2 L-2 -4 Z" fill="${hi}" opacity="0.55"/>`+
    `<path d="M-2 -4 L4 16 M11 -2 L18 13" fill="none" stroke="${shade(P.plate,0.5)}" stroke-width="0.9" opacity="0.6"/>`+
    `<path d="M-9 13 L-2 -4 L11 -2 L25 2" fill="none" stroke="${P.accent}" stroke-width="1.3" opacity="0.9"/>`;

  // Theme-spezifischer, weit aufgefächerter Aufbau.
  let behind = '', front = '';
  if(themeKey === 'holy'){
    // breit aufgefächerte Federflügel (weich) statt Metallspikes
    behind =
      bladeSpike(0,-6,-152,34,15,P.base,P.edge,9)+
      bladeSpike(2,-7,-126,40,17,'#ffffff',P.edge,10)+
      bladeSpike(3,-8,-96,44,18,P.base,P.edge,9)+
      bladeSpike(6,-7,-62,40,17,'#ffffff',P.edge,10)+
      bladeSpike(9,-6,-32,34,15,P.base,P.edge,9);
    front =
      `<path d="M3 -8 Q2 -26 1 -46" stroke="${P.accent}" stroke-width="1.3" fill="none" opacity="0.7"/>`+
      `<path d="M-18 -28 Q3 -44 24 -28" fill="none" stroke="${P.accent2}" stroke-width="2" opacity="0.9"/>`+
      star(3,-30,4,1.5,4,'#fff',0.9);
  } else if(themeKey === 'azure'){
    // 🔥 Brennende Schultern – Stahl-Klingenflügel rahmen blau-weiße Höllenflamme
    behind = bladeSpike(3,-6,-150,30,8,P.metal,P.edge,7)+bladeSpike(3,-6,-120,38,9,P.metal,P.edge,8)+
             bladeSpike(3,-6,-60,38,9,P.metal,P.edge,-8)+bladeSpike(3,-6,-30,30,8,P.metal,P.edge,-7)+
             bladeSpike(3,-6,-120,38,3,P.accent,null,8)+bladeSpike(3,-6,-60,38,3,P.accent,null,-8)+
             `<ellipse cx="3" cy="-12" rx="22" ry="18" fill="${P.glow}" opacity="0.22"/>`;
    const flame = (x,h,d) => {
      const tall  = flameTongue(x,-12,h,P.glow,P.accent2);
      const small = flameTongue(x,-12,h*0.58,P.glow,P.accent2);
      if(REDUCED_MOTION) return tall;
      return `<g>${tall}<animate attributeName="opacity" values="1;0.25;1;0.6;1" dur="0.7s" begin="${d}s" repeatCount="indefinite"/></g>`+
             `<g>${small}<animate attributeName="opacity" values="0.3;1;0.4;1;0.3" dur="0.7s" begin="${d}s" repeatCount="indefinite"/></g>`;
    };
    front = flame(-9,16,0)+flame(-1,22,0.18)+flame(7,26,0.07)+flame(15,17,0.24)+flame(2,13,0.32);
    if(!REDUCED_MOTION) front +=
      `<circle cx="4" cy="-22" r="1.3" fill="${P.accent2}"><animate attributeName="cy" values="-16;-40" dur="1.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.7s" repeatCount="indefinite"/></circle>`+
      `<circle cx="-6" cy="-18" r="1" fill="${P.emissive}"><animate attributeName="cy" values="-14;-34" dur="2.1s" begin="0.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="2.1s" begin="0.5s" repeatCount="indefinite"/></circle>`;
  } else if(themeKey === 'astral'){
    // 🪐 Schwebende Kristallscherben + umkreisende Orbs über der Schulter
    const shard = (x,y,sz,rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 ${-sz} L${f(sz*0.5)} 0 L0 ${sz} L${f(-sz*0.5)} 0 Z" fill="${P.metal}" stroke="${P.accent}" stroke-width="0.8"/><path d="M0 ${-sz} L0 ${sz}" stroke="${P.accent2}" stroke-width="0.6" opacity="0.7"/></g>`;
    behind = shard(-15,-9,9,-22)+shard(19,-12,10,20)+shard(3,-23,8,4)+shard(-6,-19,6,-40)+
             `<ellipse cx="3" cy="-14" rx="22" ry="18" fill="${P.glow}" opacity="0.20"/>`;
    const orb = (x,y,r,d,b) => {
      const g = `<circle cx="${x}" cy="${y}" r="${r+3}" fill="${P.glow}" opacity="0.4"/>`+
                `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.accent2}"/>`+
                `<circle cx="${f(x-r*0.3)}" cy="${f(y-r*0.3)}" r="${f(r*0.4)}" fill="#fff" opacity="0.85"/>`;
      if(REDUCED_MOTION) return g;
      return `<g>${g}<animateTransform attributeName="transform" type="translate" values="0 0;1.6 -3.5;0 0;-1.6 -3.5;0 0" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`+
             `<animate attributeName="opacity" values="0.85;1;0.85" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></g>`;
    };
    front = orb(-9,-22,3.0,3.4,0)+orb(5,-30,4.2,4.0,0.6)+orb(16,-21,2.6,3.0,1.1);
    if(!REDUCED_MOTION){
      const tw = (x,y,b)=>`<g>${star(x,y,2.4,0.9,4,'#fff',0.9)}<animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" begin="${b}s" repeatCount="indefinite"/></g>`;
      front += tw(-2,-16,0)+tw(11,-31,0.7)+tw(-12,-26,1.2);
    }
  } else if(themeKey === 'storm'){
    // ⚡ Nach hinten gepfeilte Sturmhörner + knisternde Blitzbögen
    behind = bladeSpike(3,-6,-145,32,7,P.metal,P.edge,9)+bladeSpike(3,-6,-35,32,7,P.metal,P.edge,-9)+
             bladeSpike(3,-6,-112,26,5,P.metal,P.edge,7)+bladeSpike(3,-6,-68,26,5,P.metal,P.edge,-7)+
             `<ellipse cx="3" cy="-11" rx="21" ry="17" fill="${P.glow}" opacity="0.18"/>`;
    const bolt = (d,dur,b) => REDUCED_MOTION
      ? `<path d="${d}" stroke="${P.accent2}" stroke-width="1.6" fill="none"/>`
      : `<g><path d="${d}" stroke="${P.accent}" stroke-width="3.4" fill="none" opacity="0.5"/>`+
        `<path d="${d}" stroke="${P.accent2}" stroke-width="1.7" fill="none"/>`+
        `<animate attributeName="opacity" values="0;0;1;0;0.8;0;0" dur="${dur}s" begin="${b}s" repeatCount="indefinite"/></g>`;
    front = bolt('M2 -12 L-4 -21 L3 -27 L-2 -36',1.4,0)+
            bolt('M9 -9 L15 -19 L9 -25 L16 -34',1.7,0.45)+
            bolt('M-7 -9 L-12 -17 L-6 -23',1.1,0.9);
    front += `<circle cx="3" cy="-12" r="2.4" fill="${P.accent2}" opacity="0.9"/>`;
    if(!REDUCED_MOTION) front += `<circle cx="3" cy="-12" r="4" fill="none" stroke="${P.accent}" stroke-width="1"><animate attributeName="r" values="2;7" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="1.4s" repeatCount="indefinite"/></circle>`;
  } else if(themeKey === 'verdant'){
    // 🍃 Ast-Geweih mit Knospen + schwebende Blätter + pulsierendes Erblühen
    behind = bladeSpike(3,-6,-150,26,4,P.metal,P.edge,12)+bladeSpike(3,-6,-30,26,4,P.metal,P.edge,-12)+
             bladeSpike(3,-6,-122,20,3.4,P.metal,P.edge,10)+bladeSpike(3,-6,-58,20,3.4,P.metal,P.edge,-10)+
             `<circle cx="-13" cy="-23" r="2" fill="${P.accent2}"/><circle cx="17" cy="-25" r="2" fill="${P.accent2}"/>`+
             `<ellipse cx="3" cy="-10" rx="21" ry="17" fill="${P.glow}" opacity="0.16">`+(REDUCED_MOTION?'':`<animate attributeName="opacity" values="0.10;0.24;0.10" dur="3.2s" repeatCount="indefinite"/>`)+`</ellipse>`;
    front = `<path d="M-10 4 Q-2 -10 12 -8" fill="none" stroke="${P.accent}" stroke-width="1.4" opacity="0.8"/>`+
            `<path d="M-3 -2 q-4 -5 0 -9 q4 4 0 9 Z" fill="${P.accent}"/>`+
            `<path d="M7 -3 q4 -5 0 -10 q-4 5 0 10 Z" fill="${shade(P.accent,1.15)}"/>`+
            `<circle cx="2" cy="-4" r="2.2" fill="${P.accent2}"/>`;
    const petal = (x,y,fill,d,b) => {
      const sh = `<path d="M${x} ${y} q3 -4 0 -9 q-3 5 0 9 Z" fill="${fill}"/>`;
      if(REDUCED_MOTION) return sh;
      return `<g>${sh}<animateTransform attributeName="transform" type="translate" values="0 0;-2 -10;-4 -22" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`+
             `<animate attributeName="opacity" values="1;1;0" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></g>`;
    };
    front += petal(-6,-14,P.accent2,3.4,0)+petal(8,-16,P.accent,4.0,0.6)+petal(2,-12,P.emissive,3.0,1.2);
  } else {
    // breiter Spike-Fächer (5 Hauptklingen) – weit ausladend
    const fan = [ {a:-152,l:36,w:7.5},{a:-124,l:43,w:9},{a:-94,l:47,w:11},{a:-60,l:43,w:9.5},{a:-30,l:36,w:8} ];
    let spikes='', cores='';
    for(const k of fan){
      spikes += bladeSpike(3,-8,k.a,k.l,k.w, P.metal, P.edge, 4);
      cores  += bladeSpike(3,-8,k.a,k.l,k.w*0.34, P.accent, null, 4);
    }
    // kleine Sekundärspikes in den Lücken
    spikes += bladeSpike(-1,-6,-108,20,4.5,P.plate,P.edge,3)+bladeSpike(8,-6,-46,18,4.5,P.plate,P.edge,3);
    behind = spikes;
    front = cores;
    if(themeKey === 'molten'){
      front += flameTongue(3,-54,13,P.glow,P.accent2)+flameTongue(-16,-42,9,P.glow,P.accent2)+
               flameTongue(20,-42,9,P.glow,P.accent2)+flameTongue(-30,-26,7,P.glow,P.accent2)+flameTongue(33,-26,7,P.glow,P.accent2)+
               `<path d="M-9 1 L-3 -7 M3 3 L8 -6 M12 0 L17 -8" stroke="${P.emissive}" stroke-width="1.1" opacity="0.75" stroke-linecap="round"/>`;
    } else if(themeKey === 'bloodshadow'){
      front += bladeSpike(3,-8,-168,42,6,P.plate,P.edge,3)+bladeSpike(3,-8,-168,42,2,P.accent,null,3)+
               bladeSpike(3,-8,-12,38,6,P.plate,P.edge,-3)+bladeSpike(3,-8,-12,38,2,P.accent,null,-3)+
               `<path d="M-13 5 Q3 11 18 5" fill="none" stroke="${P.glow}" stroke-width="1.1" opacity="0.6"/>`;
    } else if(themeKey === 'void'){
      // Gabelungen an den äußeren Geweihspitzen + schwebende Rune
      front += bladeSpike(-11,-34,-150,16,3.4,P.metal,P.edge,3)+bladeSpike(16,-30,-44,16,3.4,P.metal,P.edge,3)+
               bladeSpike(-2,-40,-118,13,3,P.metal,P.edge,3)+bladeSpike(9,-40,-66,13,3,P.metal,P.edge,3)+
               `<circle cx="4" cy="-16" r="3.4" fill="${P.glow}"/><circle cx="4" cy="-16" r="1.6" fill="#fff"/>`+
               star(4,-16,5.5,2,4,P.accent2,0.85);
    }
  }
  // Lauflicht-Trim: fließende Energie-Linie entlang der Pauldron-Oberkante.
  const trim = REDUCED_MOTION ? '' :
    `<path d="M-13 3 Q-16 -10 4 -12 Q20 -12 22 3" fill="none" stroke="${P.emissive}" stroke-width="1.5" opacity="0.9" stroke-dasharray="6 11" stroke-linecap="round"><animate attributeName="stroke-dashoffset" values="34;0" dur="2.2s" repeatCount="indefinite"/></path>`;
  const bid = 'shb'+_u;
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})"><defs>${setBloomFilter(bid,2.2)}</defs>`+
         `${glow}${behind}${cap}${trim}<g filter="url(#${bid})">${front}</g></g>`;
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
  } else if(themeKey === 'azure'){
    g = flameTongue(-4,2,11,P.glow,P.accent2)+flameTongue(4,2,11,P.glow,P.accent2)+flameTongue(0,1,15,P.glow,P.accent2);
    if(!REDUCED_MOTION) g = `<g>${g}<animate attributeName="opacity" values="0.7;1;0.6;1;0.7" dur="0.7s" repeatCount="indefinite"/></g>`;
  } else if(themeKey === 'astral'){
    const o = (x,d) => `<g><circle cx="${x}" cy="-7" r="2.4" fill="${P.glow}" opacity="0.5"/><circle cx="${x}" cy="-7" r="1.7" fill="${P.accent2}"/>`+
      (REDUCED_MOTION?'':`<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/>`)+`</g>`;
    g = `<path d="M-9 -6 Q0 -13 9 -6" fill="none" stroke="${P.accent}" stroke-width="1.2" opacity="0.6"/>`+o(-6,0)+o(0,0.4)+o(6,0.8);
  } else if(themeKey === 'storm'){
    const z = (d,b) => REDUCED_MOTION?`<path d="${d}" stroke="${P.accent2}" stroke-width="1.4" fill="none"/>`:
      `<g><path d="${d}" stroke="${P.accent2}" stroke-width="1.5" fill="none"/><animate attributeName="opacity" values="0;1;0;1;0" dur="1.3s" begin="${b}s" repeatCount="indefinite"/></g>`;
    g = z('M-4 2 L-7 -6 L-3 -10',0)+z('M4 2 L7 -6 L3 -10',0.4)+`<circle cx="0" cy="0" r="1.8" fill="${P.accent2}"/>`;
  } else if(themeKey === 'verdant'){
    g = `<path d="M-7 2 q-3 -8 0 -13 q3 6 0 13 Z" fill="${P.accent}"/>`+
        `<path d="M7 2 q3 -8 0 -13 q-3 6 0 13 Z" fill="${shade(P.accent,1.15)}"/>`+
        `<path d="M0 1 q-2 -9 0 -15 q2 6 0 15 Z" fill="${P.accent2}"/>`+
        `<circle cx="0" cy="-2" r="1.8" fill="${P.emissive}"/>`;
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
  } else if(themeKey === 'azure'){
    g = flameTongue(0,7,15,P.glow,P.accent2)+`<circle cx="0" cy="2" r="2.4" fill="${P.accent2}"/>`+
        `<circle cx="0" cy="0" r="9" fill="none" stroke="${P.accent}" stroke-width="1" opacity="0.6"/>`;
  } else if(themeKey === 'astral'){
    g = `<circle cx="0" cy="0" r="9" fill="none" stroke="${P.accent2}" stroke-width="1" opacity="0.7"/>`+
        facetGem(0,0,4.5,P.accent)+
        `<ellipse cx="0" cy="0" rx="9" ry="3.4" fill="none" stroke="${P.accent2}" stroke-width="1" opacity="0.7" transform="rotate(-20)"/>`+
        `<g><circle cx="9" cy="0" r="1.6" fill="${P.accent2}"/>`+(REDUCED_MOTION?'':`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/>`)+`</g>`;
  } else if(themeKey === 'storm'){
    g = `<circle cx="0" cy="0" r="8.5" fill="none" stroke="${P.accent}" stroke-width="1" opacity="0.6"/>`+
        `<path d="M2 -8 L-3 -1 L1 -1 L-2 8 L5 -2 L1 -2 Z" fill="${P.accent2}"/>`;
  } else if(themeKey === 'verdant'){
    g = `<circle cx="0" cy="0" r="9" fill="none" stroke="${P.accent}" stroke-width="1" opacity="0.6"/>`+
        `<path d="M0 8 L0 -3" stroke="${shade(P.accent,0.8)}" stroke-width="1.2"/>`+
        `<path d="M0 1 q-6 -2 -7 -8 q6 1 7 8 Z" fill="${P.accent}"/>`+
        `<path d="M0 -1 q6 -2 7 -8 q-6 1 -7 8 Z" fill="${shade(P.accent,1.15)}"/>`+
        `<path d="M0 -3 q-2 -6 0 -9 q2 3 0 9 Z" fill="${P.accent2}"/>`;
  } else {
    g = star(0,0,7,3,8,P.accent2)+`<circle cx="0" cy="0" r="3" fill="${P.accent}"/>`+
        `<circle cx="0" cy="0" r="9" fill="none" stroke="${P.accent}" stroke-width="1" opacity="0.6"/>`;
  }
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})">${g}</g>`;
}

// Themen-spezifisches Rückenteil hinter der Figur (200×320-Koords).
function backPiece(themeKey, P){
  const anim = !REDUCED_MOTION;
  if(themeKey === 'azure'){
    const wing = d => `<path d="M100 150 Q${100+d*54} 120 ${100+d*46} 68 Q${100+d*30} 108 ${100+d*15} 132 Z" fill="${P.glow}" opacity="0.5"/>`+
      `<path d="M100 150 Q${100+d*44} 122 ${100+d*38} 82 Q${100+d*25} 110 ${100+d*13} 132 Z" fill="${P.accent2}" opacity="0.45"/>`;
    const g = wing(-1)+wing(1);
    return anim ? `<g>${g}<animate attributeName="opacity" values="0.85;1;0.7;1;0.85" dur="0.9s" repeatCount="indefinite"/></g>` : g;
  }
  if(themeKey === 'astral'){
    const ring = `<ellipse cx="0" cy="0" rx="58" ry="20" fill="none" stroke="${P.accent}" stroke-width="2" opacity="0.55"/>`+
                 `<ellipse cx="0" cy="0" rx="42" ry="13" fill="none" stroke="${P.accent2}" stroke-width="1.2" opacity="0.5"/>`;
    const stars = [0,72,144,216,288].map(a=>`<circle cx="${f(Math.cos(a*Math.PI/180)*50)}" cy="${f(Math.sin(a*Math.PI/180)*17)}" r="1.6" fill="#fff"/>`).join('');
    const disc = `<g transform="rotate(-18)">${ring}${anim?`<g>${stars}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/></g>`:stars}</g>`;
    return `<g transform="translate(100 140)"><circle cx="0" cy="0" r="16" fill="${P.glow}" opacity="0.4"/>${disc}</g>`;
  }
  if(themeKey === 'storm'){
    const cloud = `<g fill="${shade(P.metal,1.2)}" opacity="0.88"><ellipse cx="78" cy="120" rx="20" ry="12"/><ellipse cx="100" cy="113" rx="26" ry="15"/><ellipse cx="124" cy="120" rx="20" ry="12"/></g>`;
    const bolt = (d,b)=>anim?`<path d="${d}" stroke="${P.accent2}" stroke-width="2" fill="none"><animate attributeName="opacity" values="0;0;1;0;0;0" dur="1.6s" begin="${b}s" repeatCount="indefinite"/></path>`:`<path d="${d}" stroke="${P.accent2}" stroke-width="2" fill="none" opacity="0.7"/>`;
    return `<g><ellipse cx="100" cy="118" rx="40" ry="20" fill="${P.glow}" opacity="0.18"/>${cloud}${bolt('M92 128 L86 140 L94 140 L88 156',0)+bolt('M112 128 L106 138 L113 138 L107 152',0.7)}</g>`;
  }
  if(themeKey === 'verdant'){
    const branch = d => `<path d="M100 156 Q${100+d*40} 150 ${100+d*52} 100 Q${100+d*54} 78 ${100+d*44} 70" fill="none" stroke="${shade(P.metal,1.1)}" stroke-width="3" opacity="0.9"/>`+
      `<circle cx="${100+d*52}" cy="98" r="3" fill="${P.accent}"/><circle cx="${100+d*48}" cy="76" r="3.4" fill="${P.accent2}"/><circle cx="${100+d*44}" cy="70" r="2.6" fill="${P.emissive}"/>`;
    return `<g><ellipse cx="100" cy="120" rx="46" ry="40" fill="${P.glow}" opacity="0.14"/>${branch(-1)+branch(1)}</g>`;
  }
  // Standard (alte Sets): weiche Lichtschwingen
  const ray = d => `<path d="M100 150 L${100+d*52} 96 L${100+d*40} 150 Z" fill="${P.glow}" opacity="0.4"/>`+
    `<path d="M100 152 L${100+d*40} 110 L${100+d*30} 150 Z" fill="${P.accent2}" opacity="0.35"/>`;
  return ray(-1)+ray(1);
}

/* ---------------------------------------------------------------------
   SET-MAKRO-EFFEKTE (Avatar) – Aura + rotierender Bodenkreis + Rückenteil,
   skaliert mit der Set-Vollständigkeit (lvl 1..4 ≈ 2/4/6/7 Teile). Wird hinter
   die Figur gelegt. Reiner Schau-Effekt; kein Einfluss auf Stats/Logik.
   --------------------------------------------------------------------- */
export function setMacroFX(themeKey, lvl, gender){
  if(!themeKey || lvl <= 0) return '';
  const P = setPalette(themeKey);
  const _u = (_seq++).toString(36);
  const footY = gender==='w' ? 312 : gender==='m' ? 282 : 304;
  // Aura (ab 2 Teilen): weicher, nach außen transparent auslaufender Schein
  // (Radialverlauf statt harter Ellipse → KEIN „Ei"-Umriss). Pulsiert dezent.
  const ac = (0.14+lvl*0.025).toFixed(3);
  let s = `<defs>${setBloomFilter('mb'+_u, 3)}`+
    `<radialGradient id="ag${_u}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${P.glow}" stop-opacity="${ac}"/>`+
      `<stop offset="0.5" stop-color="${P.glow}" stop-opacity="${(ac*0.35).toFixed(3)}"/>`+
      `<stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></radialGradient></defs>`;
  s += `<ellipse cx="100" cy="176" rx="${64+lvl*5}" ry="${108+lvl*7}" fill="url(#ag${_u})">`+
       (REDUCED_MOTION?'':`<animate attributeName="opacity" values="0.7;1;0.7" dur="3.6s" repeatCount="indefinite"/>`)+`</ellipse>`;
  // Bodenkreis (ab 4 Teilen): rotierender Runenring auf Fußhöhe
  if(lvl >= 2){
    const rx = 52+lvl*4, ry = 14+lvl*1.5;
    const ring = `<ellipse cx="0" cy="0" rx="${rx}" ry="${f(ry)}" fill="none" stroke="${P.accent}" stroke-width="2" opacity="0.7"/>`+
                 `<ellipse cx="0" cy="0" rx="${rx-9}" ry="${f(ry-3)}" fill="none" stroke="${P.accent2}" stroke-width="1" opacity="0.5"/>`+runeMarks(rx,ry,P.accent2);
    s += `<g transform="translate(100 ${footY})" filter="url(#mb${_u})">`+
         (REDUCED_MOTION?ring:`<g>${ring}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite"/></g>`)+`</g>`;
  }
  // Rückenteil (ab 6 Teilen): themen-spezifisch hinter der Figur, mit Bloom
  if(lvl >= 3) s += `<g filter="url(#mb${_u})">${backPiece(themeKey, P)}</g>`;
  return s;
}

/* ---------------------------------------------------------------------
   ICON (64×64) – komplettes, deutlich abgehobenes Set-Icon je Slot-art.
   Wird von item-art.js (buildItemSVG) bei gesetztem setTheme delegiert.
   --------------------------------------------------------------------- */
export function buildSetIcon(art, themeKey, rarityKey, material){
  const P = setPalette(themeKey);
  const heavyHead  = material === 'platte';                       // Helm vs. Kapuze
  const heavyChest = material === 'platte' || material === 'leder'; // Panzer vs. Robe
  const uid = '_s'+(_seq++).toString(36);
  const gid = 'sg'+uid, plg = 'pl'+uid, acg = 'ac'+uid;
  let defs = setGlowFilter(gid, P.glow, 2.6)+dirGrad(plg, P.plate)+dirGrad(acg, P.accent);
  const G = `url(#${gid})`, PL = `url(#${plg})`, AC = `url(#${acg})`;
  const aura = `<rect x="0" y="0" width="64" height="64" fill="${P.glow}" opacity="0.10"/>`;
  let body = '';

  if(art === 'schultern'){
    body = mirror64(setShoulder(themeKey, 19, 48, 0.78));
  } else if(art === 'kopf'){
    // Themen-Helm (Platte) / Kapuze (Stoff/Leder) + Aufsatz
    if(heavyHead){
      body = `<path d="M18 40 Q14 14 32 12 Q50 14 46 40 L46 48 Q39 53 32 53 Q25 53 18 48 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`+
             `<rect x="29" y="30" width="6" height="16" rx="3" fill="${P.glow}" opacity="0.9"/>`+
             setHelmCrest(themeKey, 32, 14, 1.25);
    } else {
      const hood = `<path d="M32 8 Q52 12 53 38 Q54 50 46 56 L41 53 Q47 40 45 30 Q41 18 32 16 Q23 18 19 30 Q17 40 23 53 L18 56 Q10 50 11 38 Q12 12 32 8 Z" fill="${PL}" stroke="${P.edge}" stroke-width="1.5"/>`;
      const inner = `<path d="M24 26 Q32 22 40 26 Q42 40 38 50 Q32 54 26 50 Q22 40 24 26 Z" fill="${P.base2}" opacity="0.85"/>`;
      body = hood + inner + setHelmCrest(themeKey, 32, 30, 1.15)+
             `<path d="M22 30 Q32 25 42 30" fill="none" stroke="${P.accent}" stroke-width="1.2" opacity="0.7"/>`;
    }
  } else if(art === 'brust'){
    if(heavyChest){
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
