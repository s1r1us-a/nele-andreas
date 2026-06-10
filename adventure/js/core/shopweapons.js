/* =====================================================================
   SPEZIAL-WAFFEN-LOGIK (additiv & isoliert, analog core/sets.js).
   Erzeugt & verkauft die Tribut-Shop-Spezialwaffen (data/shopweapons.js):
   Legendär, ilvl-Skalierung wie Set-Teile (setPieceIlvl), feste Affixe aus
   dem jeweiligen Klassenset-Profil. Einmalkauf je Waffe.
   Beschaffung läuft über die Set-Händler-UI (ui/setshop.js).
   ===================================================================== */
import { BASE_STAT, ILVL_K } from '../data/tuning.js';
import { rarityOf } from '../data/rarities.js';
import { classOf } from '../data/classes.js';
import { SHOP_WEAPONS, shopWeaponById, shopWeaponsForClass } from '../data/shopweapons.js';
import { state, nextItemId, saveState } from './state.js';
import { fixedSetAffixes, ensureItemSprite, giveLoot } from './items.js';
import { getSetTokens, spendSetTokens, setPieceIlvl } from './sets.js';
import { buildItemSVG, elementOf } from './item-art.js';

export { shopWeaponsForClass };

// Primärwert einer Spezialwaffe – identische Mathematik wie Set-Teile/Items.
function shopWeaponStat(def, ilvl, rarity){
  return Math.max(1, Math.round(BASE_STAT[def.statType] * rarity.mult * (1 + ilvl*ILVL_K) * (def.statMult ?? 1)));
}

// Erzeugt das fertige Legendär-Item zu einer Shop-Waffen-Definition.
export function createShopWeapon(def, ilvl){
  if(!def) return null;
  ilvl = Math.max(1, ilvl|0);
  const rarity = rarityOf('legendaer');
  const id = nextItemId();
  const it = {
    id, slotKey:def.slotKey, cat:def.cat || 'waffen', statType:def.statType,
    rarity:'legendaer', ilvl, stat: shopWeaponStat(def, ilvl, rarity),
    variant:def.variant|0, itemType:def.key, quality:100,
    affixes: fixedSetAffixes(def.fixedAffixes, ilvl, rarity),
    proc: null,
    shopWeapon: def.key,
    name: def.name,
    sprite: buildItemSVG(def.art, def.variant|0, 'legendaer', def.element || elementOf(id),
                         def.orb, def.material, null, null, def.special),
  };
  return it;
}

// Vorschau-Item OHNE Kauf/State-Mutation (für den Tooltip im Shop).
export function previewShopWeapon(def, ilvl){
  if(!def) return null;
  ilvl = Math.max(1, ilvl|0);
  const rarity = rarityOf('legendaer');
  return {
    id: 'shopweaponpreview_'+def.key,
    slotKey:def.slotKey, cat:def.cat || 'waffen', statType:def.statType,
    rarity:'legendaer', ilvl, stat: shopWeaponStat(def, ilvl, rarity),
    variant:def.variant|0, itemType:def.key, quality:100,
    affixes: fixedSetAffixes(def.fixedAffixes, ilvl, rarity), proc:null,
    shopWeapon:def.key, name:def.name, preview:true,
  };
}

// Besitzt der Spielstand diese Spezialwaffe bereits (Inventar/ausstehend/angelegt)?
export function ownsShopWeapon(s, key){
  s = s || state;
  const has = arr => Array.isArray(arr) && arr.some(it => it && it.shopWeapon === key);
  if(has(s.inventory) || has(s.pendingLoot)) return true;
  const eq = s.equipped || {};
  return Object.keys(eq).some(k => { const it = eq[k]; return it && it.shopWeapon === key; });
}

// Kauf beim Set-Händler gegen Tribut-Siegel. Rückgabe wie buySetPiece.
// { ok:true, item } | { ok:false, reason:'badkey'|'class'|'owned'|'tokens' }.
export function buyShopWeapon(key){
  const def = shopWeaponById(key);
  if(!def) return { ok:false, reason:'badkey' };
  if(classOf(state).id !== def.classId) return { ok:false, reason:'class' };
  if(ownsShopWeapon(state, key)) return { ok:false, reason:'owned' };
  if(getSetTokens() < def.cost) return { ok:false, reason:'tokens' };
  const item = createShopWeapon(def, setPieceIlvl(state));
  if(!item) return { ok:false, reason:'badkey' };
  if(!spendSetTokens(def.cost)) return { ok:false, reason:'tokens' };
  ensureItemSprite(item);
  giveLoot(state, item);
  saveState();
  return { ok:true, item };
}
