/* =====================================================================
   AVATAR – SVG aus Geschlecht/Frisur/Haarfarbe gezeichnet.
   ===================================================================== */
import { ASSETS } from '../data/tuning.js';
import { DEFAULT_CHARACTER, SKIN_TONE } from '../data/character-options.js';
import { state } from './state.js';

const TIER_OUTFIT = ['#6b5a8a','#3f6f9e','#9e6b2e','#b5882a'];
const TIER_TRIM   = ['#9a86c2','#7fb0e0','#e0a85a','#f2cd6b'];
function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
export function buildHeroSVG(character, tier){
  const c = character || DEFAULT_CHARACTER;
  const female = c.gender !== 'm';
  const hairId = c.hairId || 'kurz';
  const hc = c.hairColor || '#f5d04a';
  const hcd = shade(hc, 0.7);
  const outfit = TIER_OUTFIT[tier] || TIER_OUTFIT[0];
  const trim   = TIER_TRIM[tier]   || TIER_TRIM[0];
  const skin = SKIN_TONE, skinSh = shade(skin, 0.86);
  const headCx = 50, headCy = 33, headR = 16;
  let hairBack = '', hairFront = '';
  if(hairId==='lang'){
    hairBack = `<path d="M32 30 Q26 60 33 78 L41 76 Q37 52 40 30 Z" fill="${hcd}"/>`+
               `<path d="M68 30 Q74 60 67 78 L59 76 Q63 52 60 30 Z" fill="${hcd}"/>`;
  } else if(hairId==='pferdeschwanz'){
    hairBack = `<path d="M64 22 Q82 28 80 50 Q79 64 70 66 Q76 50 70 34 Z" fill="${hcd}"/>`;
  } else if(hairId==='locken'){
    hairBack = `<g fill="${hcd}"><circle cx="34" cy="44" r="7"/><circle cx="32" cy="56" r="6"/>`+
               `<circle cx="66" cy="44" r="7"/><circle cx="68" cy="56" r="6"/></g>`;
  }
  if(hairId==='kahl'){
    hairFront = '';
  } else if(hairId==='dutt'){
    hairFront = `<path d="M${headCx-headR} ${headCy-2} Q50 ${headCy-headR-6} ${headCx+headR} ${headCy-2} `+
                `Q${headCx+headR-2} ${headCy-12} 50 ${headCy-13} Q${headCx-headR+2} ${headCy-12} ${headCx-headR} ${headCy-2} Z" fill="${hc}"/>`+
                `<circle cx="50" cy="${headCy-headR-3}" r="7" fill="${hc}"/><circle cx="50" cy="${headCy-headR-3}" r="7" fill="none" stroke="${hcd}" stroke-width="1.5"/>`;
  } else if(hairId==='locken'){
    hairFront = `<g fill="${hc}"><circle cx="40" cy="22" r="9"/><circle cx="50" cy="18" r="9"/>`+
                `<circle cx="60" cy="22" r="9"/><circle cx="35" cy="30" r="7"/><circle cx="65" cy="30" r="7"/></g>`;
  } else {
    hairFront = `<path d="M${headCx-headR-1} ${headCy} Q${headCx-headR-1} ${headCy-headR-4} 50 ${headCy-headR-4} `+
                `Q${headCx+headR+1} ${headCy-headR-4} ${headCx+headR+1} ${headCy} `+
                `Q${headCx+headR+1} ${headCy-7} ${headCx+8} ${headCy-8} `+
                `Q50 ${headCy-3} ${headCx-8} ${headCy-8} `+
                `Q${headCx-headR-1} ${headCy-7} ${headCx-headR-1} ${headCy} Z" fill="${hc}"/>`;
  }
  let body;
  if(female){
    body = `<path d="M50 49 L40 56 Q34 78 36 94 L64 94 Q66 78 60 56 Z" fill="${outfit}"/>`+
           `<path d="M36 94 L64 94 L62 99 L38 99 Z" fill="${trim}"/>`+
           `<rect x="46" y="50" width="8" height="8" rx="2" fill="${skin}"/>`;
  } else {
    body = `<path d="M42 50 L58 50 L60 74 L40 74 Z" fill="${outfit}"/>`+
           `<rect x="41" y="74" width="8" height="20" rx="2" fill="${shade(outfit,0.6)}"/>`+
           `<rect x="51" y="74" width="8" height="20" rx="2" fill="${shade(outfit,0.6)}"/>`+
           `<rect x="40" y="60" width="20" height="4" fill="${trim}"/>`+
           `<rect x="46" y="48" width="8" height="6" rx="2" fill="${skin}"/>`;
  }
  const arms = `<rect x="33" y="52" width="7" height="20" rx="3" fill="${outfit}"/>`+
               `<rect x="60" y="52" width="7" height="20" rx="3" fill="${outfit}"/>`+
               `<circle cx="36" cy="74" r="4" fill="${skin}"/><circle cx="64" cy="74" r="4" fill="${skin}"/>`;
  const face = `<circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="${skin}"/>`+
               `<path d="M${headCx-headR} ${headCy+2} A${headR} ${headR} 0 0 0 ${headCx+headR} ${headCy+2}" fill="${skinSh}" opacity="0.25"/>`+
               `<circle cx="44" cy="33" r="2.2" fill="#2a2233"/><circle cx="56" cy="33" r="2.2" fill="#2a2233"/>`+
               `<path d="M45 41 Q50 44 55 41" stroke="#b5728a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`+
    body + arms + hairBack + face + hairFront + `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
export function heroSrc(tier){
  if(state && state.character) return buildHeroSVG(state.character, tier);
  return ASSETS + 'char_tier' + tier + '.png';
}
