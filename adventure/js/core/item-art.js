/* =====================================================================
   ITEM-ART – prozedurale SVG-Icons (ersetzt icon_*.png).
   buildItemSVG(art, variant, rarityKey) → Data-URI, viewBox 0 0 64 64.
   - waffe/schild/amulett/ring: variant = Form.
   - Rüstungs-Slots (kopf…umhang): variant = Material (Recolor).
   - Seltenheit als dezenter Glow/Edelstein (Hauptanzeige = Slot-Rahmen).
   ===================================================================== */
import { rarityOf, rarityIndex } from '../data/rarities.js';

function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
const mir = f => f + '<g transform="translate(64,0) scale(-1,1)">'+f+'</g>';

const METAL     = ['#aab2be','#c8d0dc','#c48e4e','#deb85c','#606678','#4a465c','#b87333','#2b2b34','#3fd0c8','#7a1f2b','#9fb0c8','#d8c06a'];
const GEM       = ['#d23040','#3c6edc','#34be78','#aa5cdc','#ecc446','#8a86a8','#2fd6c0','#e08a2a','#e87aa8','#0e7a4a','#c0e0ff','#b06bff'];
const ARMOR_MAT = ['#c8d0dc','#aab2be','#845c38','#3f8f5a','#7a5ca8','#4a465c','#b87333','#e8e0d0','#2f9e63','#b23a3a','#2a4a8a','#d8b24a'];
const GOLD = '#d8b24a', WOOD = '#7a4f2a';

// Element-Hervorhebung für hochstufige Waffen/Schilde (Episch+). Feuer=rot, Eis=blau.
export const ELEM = {
  fire: { glow:'#ff6a2a', core:'#ffe08a', edge:'#ff3a1a' },
  ice:  { glow:'#5cc8ff', core:'#dff4ff', edge:'#2aa0ff' },
};
// Pro Item festes Element aus der ID (kein Speicherfeld nötig, stabil über Reloads).
export const elementOf = id => (((id|0) % 2)+2)%2 ? 'fire' : 'ice';
// Effektstufe nach Seltenheit (gilt jetzt für ALLE Item-Arten):
// 0=kein Effekt (Gewöhnlich/Ungewöhnlich), 1=Selten, 2=Episch, 3=Legendär, 4=Mythisch.
const effLvl = rarityKey => { const ri = rarityIndex(rarityKey); return ri>=5?4:ri>=4?3:ri>=3?2:ri>=2?1:0; };
// Bewegungsreduktion respektieren (Animationen → statisch). Einmal beim Laden ausgewertet.
const REDUCED_MOTION = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)').matches;

let SEQ = 0;
const _cache = new Map();

// Orb-Paletten für Zauberstäbe (orb-Parameter aus itemTypes.js).
const ORB = {
  rot:   { lo:'#ff8888', mid:'#cc1111', dk:'#550000', halo1:'#cc1111', halo2:'#880000', ring:'#ff5555' },
  gruen: { lo:'#aaffbb', mid:'#18a85a', dk:'#064d24', halo1:'#18a85a', halo2:'#0a7a3c', ring:'#4dffa0' },
  blau:  { lo:'#b9a6ff', mid:'#6a3ed0', dk:'#2a1466', halo1:'#6a3ed0', halo2:'#3a1f8c', ring:'#b08bff' },
};

export function buildItemSVG(art, variant, rarityKey, element, orb){
  variant = Math.max(0, variant|0);
  const el = (element==='ice') ? 'ice' : 'fire';
  const eff = effLvl(rarityKey);                                // Seltenheits-Effekt für ALLE Arten
  const elemFx = (art==='waffe' || art==='schild') && eff>0;    // Flammen/Frost nur Waffe/Schild
  const E = ELEM[el];
  const orbKey = ORB[orb] ? orb : 'rot';
  const key = art+'_'+variant+'_'+(rarityKey||'')+'_'+(eff>0?el:'')+(variant===6?'_'+orbKey:'');
  if(_cache.has(key)) return _cache.get(key);

  const rc = (rarityOf(rarityKey) || {}).color || '#9d9d9d';
  const uid = '_'+(SEQ++).toString(36);
  const lg = (id,c,vert=true) =>
    `<linearGradient id="${id}${uid}" x1="0" y1="0" x2="${vert?0:1}" y2="${vert?1:0}">`+
    `<stop offset="0" stop-color="${shade(c,1.25)}"/><stop offset="0.55" stop-color="${c}"/>`+
    `<stop offset="1" stop-color="${shade(c,0.62)}"/></linearGradient>`;
  const U = id => `url(#${id}${uid})`;

  const rgOp = (0.30 + eff*0.14).toFixed(2);   // farbige Seltenheits-Aura, stärker je Stufe
  let defs = `<radialGradient id="rg${uid}" cx="50%" cy="50%" r="50%">`+
    `<stop offset="0" stop-color="${rc}" stop-opacity="${rgOp}"/>`+
    `<stop offset="0.7" stop-color="${rc}" stop-opacity="${(rgOp*0.4).toFixed(2)}"/>`+
    `<stop offset="1" stop-color="${rc}" stop-opacity="0"/></radialGradient>`;
  if(elemFx){
    const op = (0.30 + eff*0.16).toFixed(2);
    defs += `<radialGradient id="eg${uid}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${E.glow}" stop-opacity="${op}"/>`+
      `<stop offset="0.65" stop-color="${E.glow}" stop-opacity="${(op*0.4).toFixed(2)}"/>`+
      `<stop offset="1" stop-color="${E.glow}" stop-opacity="0"/></radialGradient>`;
  }
  if(eff>0){   // echtes Leuchten (Bloom) als Filter um die Item-Silhouette
    const gstd = (1.4 + eff*0.7).toFixed(1);
    const gop  = Math.min(0.95, 0.45 + eff*0.14).toFixed(2);
    defs += `<filter id="glow${uid}" x="-50%" y="-50%" width="200%" height="200%">`+
      `<feDropShadow dx="0" dy="0" stdDeviation="${gstd}" flood-color="${rc}" flood-opacity="${gop}"/></filter>`;
  }
  const glow = `<rect x="0" y="0" width="64" height="64" fill="url(#${elemFx?'eg':'rg'}${uid})"/>`;
  const gem  = (cx,cy,r,c) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade(c,1.2)}"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.65"/>`+
    `<circle cx="${cx-r*0.3}" cy="${cy-r*0.3}" r="${r*0.3}" fill="#fff" opacity="0.8"/>`;
  // Mehrzackiger Stern (für Schmuck-Medaillons & Funkel-Glints).
  const star = (cx,cy,ro,ri,pts,fill,op) => {
    let d=''; for(let i=0;i<pts*2;i++){ const r=(i%2)?ri:ro; const a=(Math.PI/pts)*i - Math.PI/2;
      d += (i?'L':'M')+(cx+Math.cos(a)*r).toFixed(1)+' '+(cy+Math.sin(a)*r).toFixed(1)+' '; }
    return `<path d="${d}Z" fill="${fill}"${op!=null?` opacity="${op}"`:''}/>`;
  };

  // ---- Seltenheits-Effekt-Helfer (ab Selten, alle Arten) ----
  // Akzentfarbe: Legendär = Gold, Mythisch = irisierendes Gold, sonst Seltenheitsfarbe.
  const accentCol = eff>=4 ? '#e6cc80' : (eff>=3 ? '#ffd76a' : rc);
  // Funkelnder 4-Zacken-Glint mit (optionalem) Twinkle.
  const sparkle = (cx,cy,s,delay) => {
    const tw = REDUCED_MOTION ? '' :
      `<animate attributeName="opacity" values="0.15;1;0.15" dur="1.9s" begin="${delay}s" repeatCount="indefinite"/>`;
    return `<g opacity="0.9">`+star(cx,cy,s,s*0.32,4,'#fff')+tw+`</g>`;
  };
  // Strahlenkranz vom Zentrum; ab Legendär langsam rotierend.
  const rays = (n,len,rotateDur) => {
    let r=''; for(let i=0;i<n;i++){ const a=(360/n)*i;
      r += `<rect x="31.3" y="${(32-len).toFixed(1)}" width="1.4" height="${(len*0.55).toFixed(1)}" rx="0.7" fill="${accentCol}" opacity="0.45" transform="rotate(${a} 32 32)"/>`; }
    const an = (rotateDur && !REDUCED_MOTION)
      ? `<animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="${rotateDur}s" repeatCount="indefinite"/>` : '';
    return `<g>${r}${an}</g>`;
  };
  // Diagonaler Licht-Sweep (Shimmer), der über das Item wandert.
  const shimmer = () => {
    defs += `<linearGradient id="sh${uid}" x1="0" y1="0" x2="1" y2="0">`+
      `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.5"/>`+
      `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    if(REDUCED_MOTION) return '';
    return `<rect x="-30" y="-10" width="20" height="84" fill="url(#sh${uid})" transform="rotate(20 32 32)">`+
      `<animate attributeName="x" values="-30;72" dur="2.8s" repeatCount="indefinite"/></rect>`;
  };
  // Mythisch-Krönung: pulsierende Aura + umlaufende Lichtpartikel.
  const mythicCrown = () => {
    const dots = [0,90,180,270].map(a=>`<circle cx="32" cy="5.5" r="1.9" fill="${accentCol}" transform="rotate(${a} 32 32)"/>`).join('');
    const orbit = REDUCED_MOTION ? dots :
      `<g>${dots}<animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="7s" repeatCount="indefinite"/></g>`;
    const pulse = REDUCED_MOTION
      ? `<circle cx="32" cy="32" r="27" fill="none" stroke="${accentCol}" stroke-width="1.6" opacity="0.4"/>`
      : `<circle cx="32" cy="32" r="22" fill="none" stroke="${accentCol}" stroke-width="1.6" opacity="0.6">`+
        `<animate attributeName="r" values="20;29;20" dur="2.6s" repeatCount="indefinite"/>`+
        `<animate attributeName="opacity" values="0.6;0.08;0.6" dur="2.6s" repeatCount="indefinite"/></circle>`;
    return pulse + orbit;
  };

  let body = '';

  if(art==='waffe'){
    const m = METAL[variant % METAL.length];
    defs += lg('m',m) + lg('w',WOOD);
    const grip = `<rect x="30" y="44" width="4" height="12" rx="1.5" fill="${U('w')}"/><circle cx="32" cy="58" r="3.5" fill="${GOLD}"/>`;
    if(variant===0){ // Schwert
      body = `<path d="M32 5 L37 14 L37 42 L27 42 L27 14 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="20" y="41" width="24" height="5" rx="2" fill="${GOLD}"/>`+grip;
    } else if(variant===1){ // Dolch
      body = `<path d="M32 12 L36 19 L35 40 L29 40 L28 19 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="24" y="39" width="16" height="4" rx="2" fill="${GOLD}"/>`+
             `<rect x="30" y="43" width="4" height="11" rx="1.5" fill="${U('w')}"/><circle cx="32" cy="56" r="3" fill="${GOLD}"/>`;
    } else if(variant===2){ // Streitkolben
      body = `<rect x="30" y="22" width="4" height="34" rx="1.5" fill="${U('w')}"/>`+
             mir(`<path d="M32 18 L46 12 L44 20 Z" fill="${shade(m,0.8)}"/>`)+
             `<path d="M32 6 L40 12 L40 22 L24 22 L24 12 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<circle cx="32" cy="58" r="3.5" fill="${GOLD}"/>`;
    } else if(variant===3){ // Axt (einseitiges Blatt)
      body = `<rect x="30" y="8" width="4" height="48" rx="1.5" fill="${U('w')}"/>`+
             `<path d="M33 11 L50 8 Q59 22 50 34 L33 30 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<path d="M37 15 L47 13" stroke="${shade(m,1.25)}" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>`+
             `<circle cx="32" cy="58" r="3" fill="${GOLD}"/>`;
    } else if(variant===4){ // Speer
      body = `<rect x="30" y="12" width="4" height="46" rx="1.5" fill="${U('w')}"/>`+
             `<path d="M32 3 L38 18 L26 18 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="27" y="17" width="10" height="4" rx="1" fill="${GOLD}"/>`;
    } else if(variant===5){ // Kriegshammer
      body = `<rect x="30" y="20" width="4" height="36" rx="1.5" fill="${U('w')}"/>`+
             `<rect x="16" y="8" width="32" height="18" rx="3" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="20" y="11" width="6" height="12" rx="1" fill="${shade(m,1.2)}" opacity="0.6"/>`+
             `<circle cx="32" cy="58" r="3.5" fill="${GOLD}"/>`;
    } else if(variant===7){ // Krummsäbel (gekrümmte Klinge)
      body = `<path d="M30 42 Q21 26 27 9 Q34 7 38 14 Q41 28 35 42 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<path d="M30 40 Q24 26 28 12" stroke="${shade(m,1.25)}" stroke-width="1.2" fill="none" opacity="0.5"/>`+
             `<rect x="22" y="41" width="20" height="4.5" rx="2" fill="${GOLD}"/>`+grip;
    } else if(variant===8){ // Großschwert / Klaymore (breite Klinge)
      body = `<path d="M32 4 L40 17 L40 42 L24 42 L24 17 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<path d="M32 6 L32 42" stroke="${shade(m,1.3)}" stroke-width="1" opacity="0.5"/>`+
             `<rect x="15" y="41" width="34" height="5" rx="2" fill="${GOLD}"/>`+grip;
    } else if(variant===9){ // Sense (Sichelklinge an langem Schaft)
      body = `<rect x="30" y="10" width="4" height="48" rx="1.5" fill="${U('w')}"/>`+
             `<path d="M32 12 Q11 12 9 30 Q22 21 33 22 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<path d="M31 14 Q16 15 12 27" stroke="${shade(m,1.25)}" stroke-width="1.2" fill="none" opacity="0.5"/>`+
             `<circle cx="32" cy="58" r="3" fill="${GOLD}"/>`;
    } else if(variant===10){ // Doppelaxt (gespiegeltes Blatt)
      body = `<rect x="30" y="8" width="4" height="48" rx="1.5" fill="${U('w')}"/>`+
             mir(`<path d="M33 12 Q49 11 51 24 Q49 35 33 32 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`)+
             `<circle cx="32" cy="58" r="3" fill="${GOLD}"/>`;
    } else if(variant===11){ // Glefe (Stangenklinge)
      body = `<rect x="30" y="14" width="4" height="44" rx="1.5" fill="${U('w')}"/>`+
             `<path d="M32 2 Q41 10 39 23 L32 18 L25 23 Q23 10 32 2 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="26" y="20" width="12" height="3.5" rx="1" fill="${GOLD}"/>`+
             `<circle cx="32" cy="58" r="3" fill="${GOLD}"/>`;
    } else if(variant===12){ // Kriegskeule (gestreckter Knauf)
      body = `<rect x="30" y="34" width="4" height="22" rx="1.5" fill="${U('w')}"/>`+
             `<path d="M24 10 Q40 8 40 24 Q40 38 31 38 Q22 36 24 10 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<circle cx="30" cy="17" r="1.8" fill="${shade(m,0.6)}"/><circle cx="34" cy="25" r="1.8" fill="${shade(m,0.6)}"/>`+
             `<circle cx="32" cy="58" r="3.5" fill="${GOLD}"/>`;
    } else { // Schwert (Standard / Fallback)
      body = `<path d="M32 5 L37 14 L37 42 L27 42 L27 14 Z" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="20" y="41" width="24" height="5" rx="2" fill="${GOLD}"/>`+grip;
    }
    if(variant === 6){ // Zauberstab (Orb-Farbe je Stab-Typ)
      const O = ORB[orbKey];
      defs += `<radialGradient id="orbG${uid}" cx="38%" cy="35%" r="60%">`+
              `<stop offset="0" stop-color="${O.lo}"/><stop offset="0.5" stop-color="${O.mid}"/>`+
              `<stop offset="1" stop-color="${O.dk}"/></radialGradient>`;
      body = `<rect x="30" y="20" width="4" height="38" rx="1.5" fill="${U('w')}"/>`+
             `<rect x="28" y="17" width="8" height="5" rx="2" fill="${GOLD}"/>`+
             `<circle cx="32" cy="10" r="11" fill="${O.halo1}" opacity="0.25"/>`+
             `<circle cx="32" cy="10" r="9"  fill="${O.halo2}" opacity="0.45"/>`+
             `<circle cx="32" cy="10" r="7"  fill="url(#orbG${uid})"/>`+
             `<circle cx="32" cy="10" r="7"  fill="none" stroke="${O.ring}" stroke-width="1.5"/>`+
             `<circle cx="29.5" cy="7.5" r="2.5" fill="#fff" opacity="0.55"/>`;
      if(eff > 0){
        const pulseR = 8 + eff * 2;
        body += `<circle cx="32" cy="10" r="${pulseR}" fill="none" stroke="${E.glow}" stroke-width="${eff}" opacity="0.55"/>`;
      }
    } else {
      body += gem(32, variant===5?17:(variant===2?12:46), 2.4, rc);
    }

  } else if(art==='schild'){
    const m = METAL[variant % METAL.length];
    defs += lg('m',m);
    const rim = shade(m,0.55);
    let shape, ring, custom=null;
    if(variant===0)      { shape=`<rect x="16" y="6" width="32" height="50" rx="9"`; ring=`<rect x="12" y="2" width="40" height="58" rx="12" fill="none"`; }
    else if(variant===1) { shape=`<circle cx="32" cy="32" r="24"`;                  ring=`<circle cx="32" cy="32" r="28" fill="none"`; }
    else if(variant===2) { shape=`<circle cx="32" cy="32" r="17"`;                  ring=`<circle cx="32" cy="32" r="21" fill="none"`; }
    else if(variant===3) { shape=`<rect x="17" y="6" width="30" height="50" rx="4"`; ring=`<rect x="13" y="2" width="38" height="58" rx="6" fill="none"`; }
    else if(variant===4) { shape=`<circle cx="32" cy="32" r="23"`;                  ring=`<circle cx="32" cy="32" r="27" fill="none"`; }
    else if(variant===6) { custom='kite'; }
    else if(variant===7) { custom='hex'; }
    else if(variant===8) { custom='spike'; }
    else                 { custom='dragon'; } // Variante 5 (Drache) & Fallback
    if(shape){
      body = shape+` fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`;
      if(variant===1||variant===2||variant===4) body += `<circle cx="32" cy="32" r="${variant===2?12:18}" fill="none" stroke="${rim}" stroke-width="1.5" opacity="0.6"/>`;
      if(variant===4) body += `<circle cx="25" cy="24" r="6" fill="#fff" opacity="0.35"/>`; // Spiegel-Glanz
    } else if(custom==='kite'){   // Tropfen-/Kite-Schild
      body = `<path d="M32 4 Q50 12 48 30 Q46 49 32 60 Q18 49 16 30 Q14 12 32 4 Z" fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`+
             `<path d="M32 10 L32 54" stroke="${rim}" stroke-width="1.5" opacity="0.5"/>`;
    } else if(custom==='hex'){    // Sechseckschild
      body = `<path d="M32 5 L52 18 L52 42 L32 59 L12 42 L12 18 Z" fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`+
             `<path d="M32 14 L44 22 L44 40 L32 50 L20 40 L20 22 Z" fill="none" stroke="${rim}" stroke-width="1.2" opacity="0.5"/>`;
    } else if(custom==='spike'){  // gespikter Rundschild
      body = '';
      for(let i=0;i<8;i++){ const a=(360/8)*i; body += `<rect x="31" y="2" width="2" height="9" fill="${shade(m,0.7)}" transform="rotate(${a} 32 32)"/>`; }
      body += `<circle cx="32" cy="32" r="22" fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`+
              `<circle cx="32" cy="32" r="6" fill="${shade(m,0.7)}"/>`;
    } else {                      // Drache: Heater
      body = `<path d="M12 10 L52 10 L52 30 Q52 50 32 60 Q12 50 12 30 Z" fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`+
             `<path d="M32 14 L46 14 L46 30 Q46 44 32 52 Z" fill="${shade(m,1.1)}" opacity="0.4"/>`;
    }
    body += gem(32,32,4.5, elemFx ? E.glow : rc);   // bei Episch+ Element-Boss
    if(elemFx){                                      // leuchtender Element-Rand
      const rs = ring || `<path d="M9 7 L55 7 L55 30 Q55 53 32 63 Q9 53 9 30 Z" fill="none"`;
      body += rs+` stroke="${E.glow}" stroke-width="3" opacity="0.85"/>`;
    }

  } else if(art==='amulett'){
    const g = GEM[variant % GEM.length];
    defs += lg('g',g);
    const chain = `<path d="M16 12 Q32 30 48 12" stroke="${GOLD}" stroke-width="3" fill="none"/>`;
    if(variant<=5){            // klassisches Rund-Amulett
      body = chain+`<circle cx="32" cy="40" r="13" fill="none" stroke="${GOLD}" stroke-width="4"/>`+gem(32,40,8,g);
      if(variant%2) body += `<circle cx="32" cy="40" r="13" fill="none" stroke="${shade(GOLD,1.2)}" stroke-width="1" opacity="0.7"/>`;
    } else if(variant<=8){     // Tropfen-Anhänger
      body = chain+`<path d="M32 27 Q45 38 32 56 Q19 38 32 27 Z" fill="none" stroke="${GOLD}" stroke-width="4"/>`+gem(32,42,7,g);
    } else {                   // Medaillon mit Stern
      body = chain+`<circle cx="32" cy="40" r="14" fill="none" stroke="${GOLD}" stroke-width="3"/>`+
             star(32,40,9,4,5,shade(g,1.1),0.9)+gem(32,40,5,g);
    }

  } else if(art==='ring'){
    const g = GEM[variant % GEM.length];
    defs += lg('g',g);
    const band = `<ellipse cx="32" cy="40" rx="15" ry="17" fill="none" stroke="${GOLD}" stroke-width="6"/>`+
                 `<ellipse cx="32" cy="40" rx="15" ry="17" fill="none" stroke="${shade(GOLD,0.7)}" stroke-width="2" opacity="0.5"/>`;
    if(variant<=5){            // klassischer Ring, ein Stein oben
      body = band+gem(32,18,9,g);
    } else if(variant<=8){     // Doppelstein-Ring
      body = band+gem(25,17,6,g)+gem(39,17,6,shade(g,1.15));
    } else {                   // Siegelring (flacher Schild)
      body = band+`<rect x="22" y="9" width="20" height="16" rx="3" fill="${shade(g,0.9)}" stroke="${GOLD}" stroke-width="2"/>`+gem(32,17,4,g);
    }

  } else { // ---- Rüstung: variant = Material ----
    const c = ARMOR_MAT[variant % ARMOR_MAT.length];
    defs += lg('a',c);
    const st = shade(c,0.5);
    const A = U('a');
    if(art==='kopf'){            // Helm
      body = `<path d="M16 38 Q16 12 32 12 Q48 12 48 38 L44 38 L44 26 Q44 18 32 18 Q20 18 20 26 L20 38 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<rect x="20" y="36" width="24" height="8" rx="2" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<rect x="30" y="14" width="4" height="26" fill="${st}" opacity="0.5"/>`; // Nasenschutz/Kamm
    } else if(art==='schultern'){ // Schulterplatten
      body = mir(`<path d="M34 22 Q56 22 54 44 Q44 46 34 42 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
                 `<path d="M40 26 Q52 28 50 40" stroke="${shade(c,1.2)}" stroke-width="1.5" fill="none" opacity="0.6"/>`);
    } else if(art==='brust'){     // Brustpanzer
      body = `<path d="M18 16 L46 16 L48 30 Q48 50 32 56 Q16 50 16 30 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<path d="M32 18 L32 54" stroke="${st}" stroke-width="1.5" opacity="0.6"/>`+
             mir(`<path d="M34 22 Q42 30 40 44" stroke="${shade(c,1.2)}" stroke-width="1.5" fill="none" opacity="0.5"/>`);
    } else if(art==='haende'){    // Handschuhe
      body = `<path d="M22 28 L22 18 Q22 14 26 14 L38 14 Q42 14 42 18 L42 30 Q42 50 32 52 Q22 50 22 36 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<rect x="22" y="44" width="20" height="8" rx="2" fill="${shade(c,0.85)}" stroke="${st}" stroke-width="1.2"/>`+
             mir(`<rect x="33" y="18" width="4" height="20" rx="1.5" fill="${st}" opacity="0.4"/>`);
    } else if(art==='beine'){     // Beinschienen
      body = mir(`<path d="M34 12 L44 12 L42 52 L36 52 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
                 `<rect x="35" y="20" width="8" height="4" rx="1" fill="${st}" opacity="0.4"/>`+
                 `<rect x="35" y="34" width="8" height="4" rx="1" fill="${st}" opacity="0.4"/>`);
    } else if(art==='fuesse'){    // Stiefel
      body = `<path d="M22 12 L38 12 L40 40 L52 40 L52 52 L20 52 L20 24 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<rect x="20" y="48" width="32" height="6" rx="2" fill="${shade(c,0.7)}"/>`+
             `<path d="M26 16 L34 16" stroke="${shade(c,1.2)}" stroke-width="1.5" opacity="0.5"/>`;
    } else { // umhang – Umhang
      body = `<path d="M22 12 L42 12 L52 52 Q32 60 12 52 Z" fill="${A}" stroke="${st}" stroke-width="1.5"/>`+
             `<path d="M22 12 Q32 22 42 12" fill="${shade(c,1.2)}" opacity="0.4"/>`+
             `<rect x="20" y="10" width="24" height="6" rx="3" fill="${GOLD}"/>`; // Kragen-Spange
    }
    body += gem(32, art==='kopf'?30:(art==='umhang'?13:48), 2.6, rc);
  }

  // Element-Hervorhebung (nur Waffe/Schild, Episch+): Flammen/Frost / größerer Schild.
  if(elemFx){
    if(art==='schild'){
      const S = [1,1.05,1.10,1.16,1.22][eff] || 1.16;
      body = `<g transform="translate(32,32) scale(${S}) translate(-32,-32)">${body}</g>`;
    } else { // waffe
      body += (el==='fire'
        ? `<path d="M30 6 Q26 12 29 16 Q31 12 31 8 Z" fill="${E.glow}" opacity="0.9"/>`+
          `<path d="M34 9 Q31 15 34 19 Q36 14 36 10 Z" fill="${E.edge}" opacity="0.85"/>`+
          `<path d="M27 17 Q24 22 27 26 Q29 21 29 18 Z" fill="${E.glow}" opacity="0.7"/>`
        : `<path d="M30 8 l3 5 l-3 5 l-3 -5 Z" fill="${E.core}" opacity="0.85"/>`+
          `<path d="M36 15 l2.5 4 l-2.5 4 l-2.5 -4 Z" fill="${E.edge}" opacity="0.8"/>`+
          `<circle cx="26" cy="21" r="1.6" fill="#fff" opacity="0.9"/><circle cx="38" cy="25" r="1.3" fill="#fff" opacity="0.85"/>`);
      if(eff>=4) body += `<circle cx="32" cy="30" r="29" fill="none" stroke="${E.glow}" stroke-width="2" opacity="0.5"/>`;
    }
  }

  // ---- Seltenheits-Effekte (alle Arten, ab Selten eskalierend) ----
  let fx = '';
  if(eff>0){
    body = `<g filter="url(#glow${uid})">${body}</g>`;        // echtes Leuchten (Bloom)
    fx += sparkle(15,15,3,0) + sparkle(49,47,2.6,0.7);        // Selten: Funkeln
    if(eff>=2) fx += sparkle(49,15,2.4,1.2) + rays(12,12, eff>=3 ? 16 : 0);  // Episch: + Strahlen
    if(eff>=3) fx += shimmer();                               // Legendär: + Licht-Sweep
    if(eff>=4) fx += mythicCrown();                           // Mythisch: + Pulse & Partikel
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>`+
    glow + body + fx + `</svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  _cache.set(key, uri);
  return uri;
}
