/* =====================================================================
   SET-PREVIEW-GENERATOR (headless). Rendert pro Klasse ein Schaubild-SVG:
   der komplett ausgerüstete Avatar im Set + die 7 Set-Teil-Icons.
   Nutzt dieselben prozeduralen Builder wie das Spiel (buildHeroSVG /
   buildItemSVG), damit das Preview 1:1 dem In-Game-Look entspricht.

   Start (mit Firebase-Stub-Loader, da avatar.js → state.js → firebase.js):
     node --import ./adventure/tools/firebase-stub-loader.mjs \
          adventure/tools/gen-set-previews.mjs
   Ausgabe: adventure/assets/set-previews/<classId>-<setId>.svg
   ===================================================================== */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildHeroSVG } from '../js/core/avatar.js';
import { buildItemSVG, elementOf } from '../js/core/item-art.js';
import { SETS, SET_SLOTS } from '../js/data/sets.js';
import { SLOTS } from '../js/data/slots.js';
import { DEFAULT_CHARACTER } from '../js/data/character-options.js';

const OUT = 'adventure/assets/set-previews';
mkdirSync(OUT, { recursive:true });

// Volle Ausrüstung (Set) als minimale Item-Objekte – reicht für buildHeroSVG.
function equipFor(set){
  const eq = {}; Object.keys(SLOTS).forEach(k => eq[k] = null);
  SET_SLOTS.forEach((slotKey, i) => {
    eq[slotKey] = { id:i+1, slotKey, setId:set.id, setSlot:slotKey,
      variant:i, itemType:'set_'+set.themeKey, rarity:'legendaer', stat:120, affixes:{} };
  });
  return eq;
}

// data-URI → rohes SVG.
const rawSvg = uri => decodeURIComponent(uri.slice(uri.indexOf(',')+1));
// Volles SVG als verschachteltes <svg> an Position (x,y) in Größe (w,h).
function nest(svg, x, y, w, h){
  const vb = (svg.match(/viewBox="([^"]+)"/) || [,'0 0 64 64'])[1];
  const inner = svg.slice(svg.indexOf('>')+1, svg.lastIndexOf('</svg>'));
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

const SLOT_LABEL = { kopf:'Kopf', schultern:'Schultern', brust:'Brust', haende:'Hände',
                     beine:'Beine', fuesse:'Füße', umhang:'Umhang' };

function showcase(set){
  const W = 760, H = 420;
  // buildHeroSVG liefert – wie buildItemSVG – eine data-URI → erst dekodieren.
  const heroSvg = rawSvg(buildHeroSVG({ ...DEFAULT_CHARACTER }, 3, { equipped: equipFor(set), hideHelmet:false }));
  // Icon-Grid rechts (4 + 3).
  let icons = '';
  SET_SLOTS.forEach((slotKey, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 300 + col * 112, y = 96 + row * 150;
    const uri = buildItemSVG(SLOTS[slotKey].art, i, 'legendaer', elementOf(i), null, set.material, null, set.themeKey);
    icons += `<rect x="${x}" y="${y}" width="96" height="96" rx="12" fill="#0d1426" stroke="#2a3a5c"/>`+
             nest(rawSvg(uri), x+8, y+8, 80, 80)+
             `<text x="${x+48}" y="${y+114}" fill="#9fb2cd" font-family="Quicksand,sans-serif" font-size="13" text-anchor="middle">${SLOT_LABEL[slotKey]}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`+
    `<rect width="${W}" height="${H}" fill="#070b15"/>`+
    `<rect x="6" y="6" width="${W-12}" height="${H-12}" rx="16" fill="none" stroke="${set.accent}" stroke-opacity="0.5"/>`+
    `<text x="28" y="44" fill="#fff" font-family="Cinzel,serif" font-weight="900" font-size="28">${set.name}</text>`+
    `<text x="28" y="66" fill="${set.accent2}" font-family="Quicksand,sans-serif" font-size="14">${set.classId.toUpperCase()} · Klassen-Set</text>`+
    nest(heroSvg, 28, 80, 220, 320)+
    icons+
    `</svg>`;
}

for(const set of Object.values(SETS)){
  const file = `${OUT}/${set.classId}-${set.id}.svg`;
  writeFileSync(file, showcase(set));
  console.log('wrote', file);
}
console.log('done');
