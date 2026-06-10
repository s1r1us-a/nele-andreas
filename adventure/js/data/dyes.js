/* =====================================================================
   FARBSTOFFE (Färberei). Feste Palette benannter Farben – jede Farbe wird
   einzeln gezählt (analog zu data/materials.js). Mit einem Farbstoff lässt
   sich ein RÜSTUNGSTEIL einfärben; Rüstungs-Icons (und der Avatar) beziehen
   ihre Farbe aus EINEM Hex-Wert (ARMOR_MAT[variant]), daher reicht ein
   Override-Hex pro Item (item.dye → Farbstoff-Key) zum Umfärben.
   ===================================================================== */

// Reihenfolge = Anzeige-Reihenfolge in der Bestandsleiste/Palette.
export const DYES = [
  { key:'rubinrot',    name:'Rubinrot',       color:'#c0392b' },
  { key:'karmesin',    name:'Karmesinrot',    color:'#7d1f2b' },
  { key:'bernstein',   name:'Bernstein',      color:'#d98026' },
  { key:'gold',        name:'Goldgelb',       color:'#e8b730' },
  { key:'sand',        name:'Sandbeige',      color:'#cdb487' },
  { key:'schoko',      name:'Schokobraun',    color:'#5a3a22' },
  { key:'smaragd',     name:'Smaragdgrün',    color:'#1f9e5a' },
  { key:'wald',        name:'Waldgrün',       color:'#2f5d34' },
  { key:'tuerkis',     name:'Türkis',         color:'#1bb6a0' },
  { key:'saphir',      name:'Saphirblau',     color:'#2a6fd6' },
  { key:'mitternacht', name:'Mitternachtsblau', color:'#1f2a5c' },
  { key:'amethyst',    name:'Amethyst',       color:'#8e44ad' },
  { key:'magenta',     name:'Magenta',        color:'#c0398f' },
  { key:'rose',        name:'Roségold',       color:'#e58fa0' },
  { key:'schiefer',    name:'Schiefergrau',   color:'#54606b' },
  { key:'stahl',       name:'Stahlblau',      color:'#8aa0b4' },
  { key:'onyx',        name:'Onyxschwarz',    color:'#23262b' },
  { key:'schnee',      name:'Schneeweiß',     color:'#eef1f5' },
];
export const DYE_KEYS = DYES.map(d => d.key);
export const DYE_BY_KEY = Object.fromEntries(DYES.map(d => [d.key, d]));

// Leerer Farbstoff-Bestand (für freshState / Migration).
export function blankDyes(){
  const o = {}; for(const k of DYE_KEYS) o[k] = 0; return o;
}

// Nur Rüstung ist färbbar (diese Slots beziehen ihre Farbe aus ARMOR_MAT).
// Set-Teile sind GRUNDSÄTZLICH ausgenommen: ihr Look gehört fest zum Set (eigenes
// Theme, das Sprite ignoriert ohnehin den Farbstoff) → sie lassen sich nie
// einfärben. Erkennbar an item.setId (von createSetPiece gesetzt).
export const DYEABLE_SLOTS = ['kopf','schultern','brust','haende','beine','fuesse','umhang'];
export function isDyeable(item){ return !!item && !item.setId && DYEABLE_SLOTS.includes(item.slotKey); }

// Override-Hex eines Items aus seinem gespeicherten Farbstoff-Key (oder null).
export function dyeColorOf(item){
  return (item && item.dye && DYE_BY_KEY[item.dye]) ? DYE_BY_KEY[item.dye].color : null;
}

// Lesbare Textfarbe eines Farbstoffs auf dunklem Karten-/Tooltip-Hintergrund:
// Farbton bleibt erhalten, sehr dunkle Farben (z. B. Onyxschwarz) werden Richtung
// Weiß aufgehellt, bis sie ausreichend Kontrast haben. Helle Farben unverändert.
export function dyeTextColor(hex){
  const n = parseInt(hex.slice(1),16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  const lum = (0.299*r + 0.587*g + 0.114*b)/255;   // wahrgenommene Helligkeit
  if(lum >= 0.5) return hex;
  const t = (0.5 - lum) * 1.6;                      // je dunkler, desto mehr Weiß
  const up = x => Math.round(x + (255-x)*t);
  return '#'+((1<<24)+(up(r)<<16)+(up(g)<<8)+up(b)).toString(16).slice(1);
}

// Zufalls-Drop: liefert mit zonenabhängiger Wahrscheinlichkeit einen Farbstoff-Key
// (sonst null). Chance steigt leicht mit der Zone, gedeckelt.
const DYE_DROP_BASE = 0.18;   // Grund-Chance je Boss-Kill
const DYE_DROP_PER_ZONE = 0.015;
const DYE_DROP_CAP = 0.40;
export function dyeDropChance(zone){
  return Math.min(DYE_DROP_CAP, DYE_DROP_BASE + Math.max(0, zone|0) * DYE_DROP_PER_ZONE);
}
export function rollDyeDrop(zone){
  if(Math.random() >= dyeDropChance(zone)) return null;
  return DYE_KEYS[Math.floor(Math.random() * DYE_KEYS.length)];
}
