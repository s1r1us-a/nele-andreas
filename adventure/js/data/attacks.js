/* =====================================================================
   ANGRIFFS-FX-LOGIK (rein, ohne DOM). Bestimmt aus einer Waffe das
   Nahkampf-Profil bzw. den Zauber-Modus + die Parameter fürs Waffen-
   Overlay. Wird von Arena/Duell (combat.js) UND vom Turm (tower.js /
   turm.html) gemeinsam genutzt, damit die Klassifizierung überall gleich ist.
   ===================================================================== */
import { typeOf, materialOf } from './itemTypes.js';
import { elementOf } from '../core/item-art.js';

// Element-Paletten für Spuren, Projektile, Blitze und Einschläge.
export const ATK_ELEM = {
  fire:      { core:'#ffe7b0', mid:'#ff7a2a', edge:'#ff3a1a' },
  ice:       { core:'#eaf8ff', mid:'#5cc8ff', edge:'#2aa0ff' },
  lightning: { core:'#fff6ff', mid:'#c89bff', edge:'#8a4bff' },
  nature:    { core:'#eaffe6', mid:'#48d66a', edge:'#1c9e3c' },
  physical:  { core:'#ffffff', mid:'#e6ecf5', edge:'#aab2be' },
};

// Nahkampf-Profil aus der Waffen-Silhouette (variant 0..12).
export function attackProfileOf(variant){
  switch(((variant|0)%13+13)%13){
    case 2: case 3: case 5: case 10: case 12: return 'overhead'; // Streitkolben/Axt/Hammer/Doppelaxt/Keule
    case 4: case 11: return 'thrust';                            // Speer/Glefe
    case 1: return 'flurry';                                     // Dolch
    default: return 'arc';                                       // Schwert/Säbel/Großschwert/Sense
  }
}

// Zauber-Modus aus dem Stab-Typ: Blitz schlägt SOFORT ein, sonst fliegt ein Projektil.
export function spellOf(item){
  const ty = typeOf(item) || {}; const k = String(ty.key||'').toLowerCase(); const orb = ty.orb || 'rot';
  let element = 'fire', mode = 'projectile';
  if(/blitz|donner|sturm/.test(k))                         { element='lightning'; mode='bolt'; }
  else if(/eis|frost/.test(k))                              { element='ice'; }
  else if(/feuer|flamme|glut|sonne|phoenix|chaos|hoell|daemon|blut/.test(k)) { element='fire'; }
  else if(/natur|gift|ranke|leben|heil|quell|wald|erd|seele|nekro|toten/.test(k)) { element='nature'; }
  else element = orb==='blau' ? 'ice' : (orb==='gruen' ? 'nature' : 'fire');
  return { mode, element };
}

// Angriffs-Beschreibung aus einer Waffe (Nahkampf-Profil ODER Zauber-Spell +
// Overlay-Parameter wv/rarity/orb/material fürs Waffen-SVG). Reine Daten →
// auch netzwerk-serialisierbar (Duell-/Turm-Events).
export function weaponAtk(w){
  if(!w) return { kind:'melee', profile:'arc', element:'physical' };
  if(materialOf(w) === 'zauberstab'){ const sp = spellOf(w); return { kind:'stab', spell:sp, element:sp.element }; }
  const ty = typeOf(w);
  return { kind:'melee', profile:attackProfileOf(ty.variant), element:(elementOf(w.id)==='ice'?'ice':'fire'),
           wv:ty.variant|0, rarity:w.rarity, orb:ty.orb, material:ty.material };
}
