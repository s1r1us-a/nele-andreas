/* =====================================================================
   ZONE-ART – prozedurale SVG-Hintergründe (ersetzt bg_zone_*.png).
   buildZoneBgSVG(bgIndex) → Data-URI, viewBox 0 0 400 240 (Landscape).
   5 Themen: Wiese, Wald, Höhle, Vulkan, Eis.
   ===================================================================== */

function shade(hex, f){
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,Math.round(((n>>16)&255)*f)));
  const g = Math.max(0,Math.min(255,Math.round(((n>>8)&255)*f)));
  const b = Math.max(0,Math.min(255,Math.round((n&255)*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

const THEMES = [
  { skyTop:'#96c8f0', skyBot:'#cfe8fa', ground:'#5f9646', accent:'#ffe680' }, // 0 Wiese
  { skyTop:'#6f9a8a', skyBot:'#a6c2b0', ground:'#3c6038', accent:'#27431f' }, // 1 Wald
  { skyTop:'#272238', skyBot:'#48405e', ground:'#332d40', accent:'#7a64a6' }, // 2 Höhle
  { skyTop:'#581f1f', skyBot:'#a85636', ground:'#43262a', accent:'#ff7a2a' }, // 3 Vulkan
  { skyTop:'#a8c8e6', skyBot:'#d6e8f6', ground:'#c6dcf0', accent:'#ffffff' }, // 4 Eis
];

const SEQ0 = { n:0 };
const _cache = new Map();

export function buildZoneBgSVG(bgIndex){
  const i = ((bgIndex|0) % THEMES.length + THEMES.length) % THEMES.length;
  if(_cache.has(i)) return _cache.get(i);
  const t = THEMES[i];
  const uid = '_z'+(SEQ0.n++).toString(36);
  const H = 240, W = 400, HZ = 168;
  const hillFar  = shade(t.ground, 1.45);
  const hillNear = shade(t.ground, 1.2);

  const defs =
    `<defs>`+
    `<linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1">`+
      `<stop offset="0" stop-color="${t.skyTop}"/><stop offset="1" stop-color="${t.skyBot}"/></linearGradient>`+
    `<radialGradient id="vig${uid}" cx="50%" cy="42%" r="75%">`+
      `<stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>`+
    `<radialGradient id="glow${uid}" cx="50%" cy="100%" r="70%">`+
      `<stop offset="0" stop-color="${t.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>`+
    `</defs>`;

  const sky = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky${uid})"/>`;
  // ferne Bergkette (zwei Lagen)
  const mtn = (col,base,amp) => {
    let p = `M0 ${base}`;
    for(let x=0; x<=W; x+=80){ p += ` L${x+40} ${base-amp-((x/80)%2)*14} L${x+80} ${base}`; }
    return `<path d="${p} L${W} ${H} L0 ${H} Z" fill="${col}"/>`;
  };
  const mountains = mtn(hillFar, HZ-6, 46) + mtn(hillNear, HZ+4, 30);
  // Boden
  const ground = `<rect x="0" y="${HZ}" width="${W}" height="${H-HZ}" fill="${t.ground}"/>`+
                 `<rect x="0" y="${HZ}" width="${W}" height="5" fill="${shade(t.ground,1.3)}"/>`;

  let acc = '';
  if(i===0){ // Wiese: Sonne + Blumen
    acc += `<circle cx="330" cy="48" r="26" fill="${t.accent}" opacity="0.85"/>`+
           `<circle cx="330" cy="48" r="40" fill="${t.accent}" opacity="0.2"/>`;
    for(let k=0;k<10;k++){ const x=20+k*40, y=190+((k*53)%34);
      acc += `<g><circle cx="${x}" cy="${y}" r="3.5" fill="${['#ff7eae','#fff1a8','#9ad0ff'][k%3]}"/><circle cx="${x}" cy="${y}" r="1.4" fill="#ffd24a"/></g>`; }
  } else if(i===1){ // Wald: Bäume
    for(let k=0;k<7;k++){ const x=24+k*56, s=18+((k*37)%10);
      acc += `<rect x="${x-3}" y="${HZ-4}" width="6" height="16" fill="#4a3320"/>`+
             `<path d="M${x} ${HZ-4-s*1.7} L${x-s} ${HZ-2} L${x+s} ${HZ-2} Z" fill="${shade('#3c6038',0.85)}"/>`+
             `<path d="M${x} ${HZ-12-s*1.7} L${x-s*0.7} ${HZ-12} L${x+s*0.7} ${HZ-12} Z" fill="${shade('#3c6038',1.05)}"/>`; }
  } else if(i===2){ // Höhle: Stalaktiten + Kristalle
    for(let k=0;k<9;k++){ const x=18+k*44, h=18+((k*61)%34);
      acc += `<path d="M${x-8} 0 L${x+8} 0 L${x} ${h} Z" fill="${hillNear}"/>`; }
    for(let k=0;k<5;k++){ const x=40+k*80, y=HZ+22;
      acc += `<path d="M${x} ${y-18} L${x+6} ${y} L${x} ${y+8} L${x-6} ${y} Z" fill="${t.accent}" opacity="0.85"/>`+
             `<path d="M${x} ${y-18} L${x+6} ${y} L${x} ${y+8} L${x-6} ${y} Z" fill="none" stroke="#fff" stroke-opacity="0.4"/>`; }
  } else if(i===3){ // Vulkan: Lavaglühen + Risse
    acc += `<rect x="0" y="${HZ-30}" width="${W}" height="${H-HZ+30}" fill="url(#glow${uid})"/>`;
    for(let k=0;k<6;k++){ const x=30+k*64;
      acc += `<path d="M${x} ${H} L${x+10} ${HZ+24} L${x+4} ${HZ+10}" stroke="${t.accent}" stroke-width="3" fill="none" opacity="0.85" stroke-linecap="round"/>`; }
    acc += `<ellipse cx="200" cy="${HZ}" rx="120" ry="14" fill="${t.accent}" opacity="0.35"/>`;
  } else { // Eis: Schneehauben + Flocken
    acc += `<path d="M0 ${HZ-6} L60 ${HZ-46} L96 ${HZ-26} L150 ${HZ-58} L200 ${HZ-28} L260 ${HZ-52} L320 ${HZ-24} L400 ${HZ-44} L400 ${HZ} L0 ${HZ} Z" fill="#ffffff" opacity="0.85"/>`;
    for(let k=0;k<26;k++){ const x=(k*73)%W, y=(k*41)%150;
      acc += `<circle cx="${x}" cy="${y}" r="1.8" fill="#ffffff" opacity="0.8"/>`; }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`+
    defs + sky + mountains + ground + acc + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#vig${uid})"/>` + `</svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  _cache.set(i, uri);
  return uri;
}
