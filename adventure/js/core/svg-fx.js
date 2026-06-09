/* =====================================================================
   SVG-FX – geteilte, renderer-agnostische SVG-Bausteine für avatar.js
   und item-art.js (Charakter + Item). EINE Quelle der Wahrheit für
   Farb-Mathe, Spiegelung, Material-Paletten, gerichtete Verläufe,
   Mikrotexturen, Schmuck-Primitive und die kanonische Lichtrichtung –
   damit getragene Ausrüstung (Avatar) und Inventar-Icon identisch
   beleuchtet/getönt aussehen.

   Rein prozedurales SVG: kein Build-Step, keine Dependencies, keine
   Bild-Assets. Funktionen sind seiteneffektfrei (außer der bewusst
   zustandsbehafteten Registry-Factory makeGradReg).
   ===================================================================== */

// ---- Farb-Mathe ----------------------------------------------------
// Farbe komponentenweise mit Faktor f skalieren (Highlights f>1, Schatten f<1).
export function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
// Lineare Mischung zweier Farben (t=0 → a, t=1 → b). Für Material-Finishes.
export function mix(a, b, t){
  const na = parseInt(a.slice(1),16), nb = parseInt(b.slice(1),16);
  const lerp = (x,y) => Math.round(x+(y-x)*t);
  const r = lerp((na>>16)&255,(nb>>16)&255);
  const g = lerp((na>>8)&255,(nb>>8)&255);
  const bl= lerp(na&255,nb&255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
}

// ---- Spiegelung ----------------------------------------------------
// Rechte Hälfte an der Achse x=width/2 spiegeln → garantiert symmetrisch.
export const mirrorAt = (frag, width) => frag + `<g transform="translate(${width},0) scale(-1,1)">`+frag+'</g>';
export const mirror200 = frag => mirrorAt(frag, 200);   // Avatar (viewBox 200)
export const mirror64  = frag => mirrorAt(frag, 64);    // Item-Icon (viewBox 64)

// ---- Design-Tokens -------------------------------------------------
// Kanonische Lichtrichtung (oben-links). dirGrad leitet daraus den
// Verlaufswinkel ab, die Filter-Builder (Phase 4) das feDistantLight.
export const LIGHT = { az: 235, el: 55 };

// Rüstungs-Material je Variante (12 Farben) – identisch in beiden Renderern,
// damit Inventar-Icon und getragenes Teil farblich exakt übereinstimmen.
export const ARMOR_MAT = ['#c8d0dc','#aab2be','#4a3526','#3f8f5a','#7a5ca8','#4a465c','#b87333','#e8e0d0','#2f9e63','#b23a3a','#2a4a8a','#d8b24a'];
// Waffen-/Schild-Metalle (12 Varianten); WEAPON_METAL = die ersten 6 (Avatar).
export const METAL        = ['#aab2be','#c8d0dc','#c48e4e','#deb85c','#606678','#4a465c','#b87333','#2b2b34','#3fd0c8','#7a1f2b','#9fb0c8','#d8c06a'];
export const WEAPON_METAL = METAL.slice(0,6);
// Edelstein-Farben für Schmuck.
export const GEM = ['#d23040','#3c6edc','#34be78','#aa5cdc','#ecc446','#8a86a8','#2fd6c0','#e08a2a','#e87aa8','#0e7a4a','#c0e0ff','#b06bff'];
export const GOLD = '#d8b24a', WOOD = '#7a4f2a';

// ---- Element-Hervorhebung (Episch+ Waffen/Schilde) -----------------
// Feuer=rot, Eis=blau. Pro Item festes Element aus der ID (stabil über Reloads).
export const ELEM = {
  fire: { glow:'#ff6a2a', core:'#ffe08a', edge:'#ff3a1a' },
  ice:  { glow:'#5cc8ff', core:'#dff4ff', edge:'#2aa0ff' },
};
export const elementOf = id => (((id|0) % 2)+2)%2 ? 'fire' : 'ice';

// ---- Bewegungsreduktion --------------------------------------------
// prefers-reduced-motion einmal beim Laden auswerten → Animationen statisch.
export const REDUCED_MOTION = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Gerichtete Verläufe -------------------------------------------
// 3-Stop-Verlauf entlang der kanonischen Lichtrichtung: Glanz oben-links →
// Mittelton → Schatten unten-rechts (eine gemeinsame Lichtrichtung überall).
export function dirGrad(id, color){
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">`+
    `<stop offset="0" stop-color="${shade(color,1.22)}"/>`+
    `<stop offset="0.5" stop-color="${color}"/>`+
    `<stop offset="1" stop-color="${shade(color,0.6)}"/></linearGradient>`;
}

// Material-Mikrotextur als Kachel-Muster (Nieten/Ring/Schuppe/Stich/Webung).
// Reine Funktion: liefert die <pattern>-Definition mit fertiger id.
export function texturePatTile(id, type, color){
  const dk = shade(color,0.55), lt = shade(color,1.25);
  if(type === 'platte'){            // Nieten-Reihen
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12">`+
      `<circle cx="3" cy="3" r="1.1" fill="${lt}" opacity="0.45"/><circle cx="3" cy="3" r="1.1" fill="none" stroke="${dk}" stroke-width="0.5" opacity="0.5"/>`+
      `<circle cx="9" cy="9" r="1.1" fill="${lt}" opacity="0.45"/><circle cx="9" cy="9" r="1.1" fill="none" stroke="${dk}" stroke-width="0.5" opacity="0.5"/></pattern>`;
  } else if(type === 'ketten'){     // ineinandergreifendes Ringgeflecht
    const ring = (cx,cy) => `<circle cx="${cx}" cy="${cy}" r="2.4" fill="none" stroke="${dk}" stroke-width="0.9" opacity="0.5"/>`;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="8" height="8">`+
      ring(4,4)+ring(0,0)+ring(8,0)+ring(0,8)+ring(8,8)+`</pattern>`;
  } else if(type === 'schuppen'){   // versetzte Halbschuppen
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="8">`+
      `<path d="M0 8 Q5 -1 10 8" fill="none" stroke="${dk}" stroke-width="1" opacity="0.45"/>`+
      `<path d="M-5 4 Q0 -5 5 4 M5 4 Q10 -5 15 4" fill="none" stroke="${dk}" stroke-width="1" opacity="0.45"/></pattern>`;
  } else if(type === 'leder'){      // Steppstich-Naht
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="13" height="13">`+
      `<line x1="2" y1="6.5" x2="6" y2="6.5" stroke="${dk}" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/></pattern>`;
  }                                  // stoff – feine vertikale Webfalten
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6">`+
    `<line x1="1.5" y1="0" x2="1.5" y2="6" stroke="${dk}" stroke-width="0.7" opacity="0.28"/>`+
    `<line x1="4.5" y1="0" x2="4.5" y2="6" stroke="${lt}" stroke-width="0.6" opacity="0.22"/></pattern>`;
}

// Build-lokale Registry für gerichtete Verläufe + Material-Texturen.
// Dedupliziert pro Build (uid-gebundene IDs); akkumuliert die <defs>-Fragmente.
// Verwendung: const reg = makeGradReg(uid); reg.grad(color); reg.texture(type,color);
//             … später: defs.push(reg.defs())
export function makeGradReg(uid){
  const gReg = new Map(), pReg = new Map();
  let defs = '';
  const grad = color => {
    if(gReg.has(color)) return gReg.get(color);
    const id = 'mg'+gReg.size+uid;
    defs += dirGrad(id, color);
    const url = `url(#${id})`; gReg.set(color, url); return url;
  };
  const texture = (type, color) => {
    const key = type+color;
    if(pReg.has(key)) return pReg.get(key);
    const id = 'mp'+pReg.size+uid;
    defs += texturePatTile(id, type, color);
    const url = `url(#${id})`; pReg.set(key, url); return url;
  };
  return { grad, texture, defs: () => defs };
}

// ---- Schmuck-Primitive ---------------------------------------------
// Flacher Edelstein (Glanzpunkt oben-links).
export const gem = (cx,cy,r,c) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade(c,1.2)}"/>`+
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.65"/>`+
  `<circle cx="${cx-r*0.3}" cy="${cy-r*0.3}" r="${r*0.3}" fill="#fff" opacity="0.8"/>`;

// Mehrzackiger Stern (für Medaillons & Funkel-Glints).
export const star = (cx,cy,ro,ri,pts,fill,op) => {
  let d=''; for(let i=0;i<pts*2;i++){ const r=(i%2)?ri:ro; const a=(Math.PI/pts)*i - Math.PI/2;
    d += (i?'L':'M')+(cx+Math.cos(a)*r).toFixed(1)+' '+(cy+Math.sin(a)*r).toFixed(1)+' '; }
  return `<path d="${d}Z" fill="${fill}"${op!=null?` opacity="${op}"`:''}/>`;
};

// Funkelnder 4-Zacken-Glint mit (optionalem) Twinkle. reduced-motion → statisch.
export const sparkle = (cx,cy,s,delay) => {
  const tw = REDUCED_MOTION ? '' :
    `<animate attributeName="opacity" values="0.15;1;0.15" dur="1.9s" begin="${delay||0}s" repeatCount="indefinite"/>`;
  return `<g opacity="0.9">`+star(cx,cy,s,s*0.32,4,'#fff')+tw+`</g>`;
};
