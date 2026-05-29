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

const METAL     = ['#aab2be','#c8d0dc','#c48e4e','#deb85c','#606678','#4a465c'];
const GEM       = ['#d23040','#3c6edc','#34be78','#aa5cdc','#ecc446','#8a86a8'];
const ARMOR_MAT = ['#c8d0dc','#aab2be','#845c38','#3f8f5a','#7a5ca8','#4a465c'];
const GOLD = '#d8b24a', WOOD = '#7a4f2a';

// Element-Hervorhebung für hochstufige Waffen/Schilde (Episch+). Feuer=rot, Eis=blau.
export const ELEM = {
  fire: { glow:'#ff6a2a', core:'#ffe08a', edge:'#ff3a1a' },
  ice:  { glow:'#5cc8ff', core:'#dff4ff', edge:'#2aa0ff' },
};
// Pro Item festes Element aus der ID (kein Speicherfeld nötig, stabil über Reloads).
export const elementOf = id => (((id|0) % 2)+2)%2 ? 'fire' : 'ice';
// Effektstufe nach Seltenheit: 0=kein Effekt (<Episch), 1=Episch, 2=Legendär, 3=Mythisch.
const effLvl = rarityKey => { const ri = rarityIndex(rarityKey); return ri>=5?3:ri>=4?2:ri>=3?1:0; };

let SEQ = 0;
const _cache = new Map();

export function buildItemSVG(art, variant, rarityKey, element){
  variant = (variant|0) % 7;
  const el = (element==='ice') ? 'ice' : 'fire';
  const eff = (art==='waffe' || art==='schild') ? effLvl(rarityKey) : 0;
  const E = ELEM[el];
  const key = art+'_'+variant+'_'+(rarityKey||'')+'_'+(eff>0?el:'');
  if(_cache.has(key)) return _cache.get(key);

  const rc = (rarityOf(rarityKey) || {}).color || '#9d9d9d';
  const uid = '_'+(SEQ++).toString(36);
  const lg = (id,c,vert=true) =>
    `<linearGradient id="${id}${uid}" x1="0" y1="0" x2="${vert?0:1}" y2="${vert?1:0}">`+
    `<stop offset="0" stop-color="${shade(c,1.25)}"/><stop offset="0.55" stop-color="${c}"/>`+
    `<stop offset="1" stop-color="${shade(c,0.62)}"/></linearGradient>`;
  const U = id => `url(#${id}${uid})`;

  let defs = `<radialGradient id="rg${uid}" cx="50%" cy="50%" r="50%">`+
    `<stop offset="0" stop-color="${rc}" stop-opacity="0.34"/><stop offset="1" stop-color="${rc}" stop-opacity="0"/></radialGradient>`;
  if(eff>0){
    const op = (0.30 + eff*0.16).toFixed(2);
    defs += `<radialGradient id="eg${uid}" cx="50%" cy="50%" r="50%">`+
      `<stop offset="0" stop-color="${E.glow}" stop-opacity="${op}"/>`+
      `<stop offset="0.65" stop-color="${E.glow}" stop-opacity="${(op*0.4).toFixed(2)}"/>`+
      `<stop offset="1" stop-color="${E.glow}" stop-opacity="0"/></radialGradient>`;
  }
  const glow = `<rect x="0" y="0" width="64" height="64" fill="url(#${eff>0?'eg':'rg'}${uid})"/>`;
  const gem  = (cx,cy,r,c) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade(c,1.2)}"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.65"/>`+
    `<circle cx="${cx-r*0.3}" cy="${cy-r*0.3}" r="${r*0.3}" fill="#fff" opacity="0.8"/>`;

  let body = '';

  if(art==='waffe'){
    const m = METAL[variant];
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
    } else { // Kriegshammer
      body = `<rect x="30" y="20" width="4" height="36" rx="1.5" fill="${U('w')}"/>`+
             `<rect x="16" y="8" width="32" height="18" rx="3" fill="${U('m')}" stroke="${shade(m,0.5)}" stroke-width="1"/>`+
             `<rect x="20" y="11" width="6" height="12" rx="1" fill="${shade(m,1.2)}" opacity="0.6"/>`+
             `<circle cx="32" cy="58" r="3.5" fill="${GOLD}"/>`;
    }
    if(variant === 6){ // Zauberstab
      defs += `<radialGradient id="orbG${uid}" cx="38%" cy="35%" r="60%">`+
              `<stop offset="0" stop-color="#ff8888"/><stop offset="0.5" stop-color="#cc1111"/>`+
              `<stop offset="1" stop-color="#550000"/></radialGradient>`;
      body = `<rect x="30" y="20" width="4" height="38" rx="1.5" fill="${U('w')}"/>`+
             `<rect x="28" y="17" width="8" height="5" rx="2" fill="${GOLD}"/>`+
             `<circle cx="32" cy="10" r="11" fill="#cc1111" opacity="0.25"/>`+
             `<circle cx="32" cy="10" r="9"  fill="#880000" opacity="0.45"/>`+
             `<circle cx="32" cy="10" r="7"  fill="url(#orbG${uid})"/>`+
             `<circle cx="32" cy="10" r="7"  fill="none" stroke="#ff5555" stroke-width="1.5"/>`+
             `<circle cx="29.5" cy="7.5" r="2.5" fill="#fff" opacity="0.55"/>`;
      if(eff > 0){
        const pulseR = 8 + eff * 2;
        body += `<circle cx="32" cy="10" r="${pulseR}" fill="none" stroke="${E.glow}" stroke-width="${eff}" opacity="0.55"/>`;
      }
    } else {
      body += gem(32, variant===5?17:(variant===2?12:46), 2.4, rc);
    }

  } else if(art==='schild'){
    const m = METAL[variant];
    defs += lg('m',m);
    const rim = shade(m,0.55);
    let shape, ring;
    if(variant===0)      { shape=`<rect x="16" y="6" width="32" height="50" rx="9"`; ring=`<rect x="12" y="2" width="40" height="58" rx="12" fill="none"`; }
    else if(variant===1) { shape=`<circle cx="32" cy="32" r="24"`;                  ring=`<circle cx="32" cy="32" r="28" fill="none"`; }
    else if(variant===2) { shape=`<circle cx="32" cy="32" r="17"`;                  ring=`<circle cx="32" cy="32" r="21" fill="none"`; }
    else if(variant===3) { shape=`<rect x="17" y="6" width="30" height="50" rx="4"`; ring=`<rect x="13" y="2" width="38" height="58" rx="6" fill="none"`; }
    else if(variant===4) { shape=`<circle cx="32" cy="32" r="23"`;                  ring=`<circle cx="32" cy="32" r="27" fill="none"`; }
    else                 { shape=null; ring=null; } // Drache: Heater
    if(shape){
      body = shape+` fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`;
      if(variant===1||variant===2||variant===4) body += `<circle cx="32" cy="32" r="${variant===2?12:18}" fill="none" stroke="${rim}" stroke-width="1.5" opacity="0.6"/>`;
      if(variant===4) body += `<circle cx="25" cy="24" r="6" fill="#fff" opacity="0.35"/>`; // Spiegel-Glanz
    } else {
      body = `<path d="M12 10 L52 10 L52 30 Q52 50 32 60 Q12 50 12 30 Z" fill="${U('m')}" stroke="${rim}" stroke-width="3"/>`+
             `<path d="M32 14 L46 14 L46 30 Q46 44 32 52 Z" fill="${shade(m,1.1)}" opacity="0.4"/>`;
    }
    body += gem(32,32,4.5, eff>0 ? E.glow : rc);   // bei Episch+ Element-Boss
    if(eff>0){                                       // leuchtender Element-Rand
      const rs = ring || `<path d="M9 7 L55 7 L55 30 Q55 53 32 63 Q9 53 9 30 Z" fill="none"`;
      body += rs+` stroke="${E.glow}" stroke-width="3" opacity="0.85"/>`;
    }

  } else if(art==='amulett'){
    const g = GEM[variant];
    defs += lg('g',g);
    body = `<path d="M16 12 Q32 30 48 12" stroke="${GOLD}" stroke-width="3" fill="none"/>`+
           `<circle cx="32" cy="40" r="13" fill="none" stroke="${GOLD}" stroke-width="4"/>`+
           gem(32,40,8,g);
    if(variant%2) body += `<circle cx="32" cy="40" r="13" fill="none" stroke="${shade(GOLD,1.2)}" stroke-width="1" opacity="0.7"/>`;

  } else if(art==='ring'){
    const g = GEM[variant];
    defs += lg('g',g);
    body = `<ellipse cx="32" cy="40" rx="15" ry="17" fill="none" stroke="${GOLD}" stroke-width="6"/>`+
           `<ellipse cx="32" cy="40" rx="15" ry="17" fill="none" stroke="${shade(GOLD,0.7)}" stroke-width="2" opacity="0.5"/>`+
           gem(32,18,9,g);

  } else { // ---- Rüstung: variant = Material ----
    const c = ARMOR_MAT[variant];
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

  // Element-Hervorhebung: Waffe = Flammen/Frost-Akzente, Schild = größer.
  if(eff>0){
    if(art==='schild'){
      const S = [1,1.07,1.15,1.23][eff];
      body = `<g transform="translate(32,32) scale(${S}) translate(-32,-32)">${body}</g>`;
    } else { // waffe
      body += (el==='fire'
        ? `<path d="M30 6 Q26 12 29 16 Q31 12 31 8 Z" fill="${E.glow}" opacity="0.9"/>`+
          `<path d="M34 9 Q31 15 34 19 Q36 14 36 10 Z" fill="${E.edge}" opacity="0.85"/>`+
          `<path d="M27 17 Q24 22 27 26 Q29 21 29 18 Z" fill="${E.glow}" opacity="0.7"/>`
        : `<path d="M30 8 l3 5 l-3 5 l-3 -5 Z" fill="${E.core}" opacity="0.85"/>`+
          `<path d="M36 15 l2.5 4 l-2.5 4 l-2.5 -4 Z" fill="${E.edge}" opacity="0.8"/>`+
          `<circle cx="26" cy="21" r="1.6" fill="#fff" opacity="0.9"/><circle cx="38" cy="25" r="1.3" fill="#fff" opacity="0.85"/>`);
      if(eff>=3) body += `<circle cx="32" cy="30" r="29" fill="none" stroke="${E.glow}" stroke-width="2" opacity="0.5"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>`+
    glow + body + `</svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  _cache.set(key, uri);
  return uri;
}
