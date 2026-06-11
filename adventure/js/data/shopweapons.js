/* =====================================================================
   SPEZIAL-WAFFEN (Tribut-Shop). REIN ADDITIV. Sechs klassengebundene
   Legendär-Waffen mit eigener, prozeduraler Optik (core/weapon-art.js),
   die beim Set-Händler (ui/setshop.js) gegen Tribut-Siegel gekauft werden
   (Einmalkauf je Waffe, analog Set-Teilen).

   Jeder Eintrag dient DOPPELT:
   - als Katalog-Eintrag (wird in data/itemTypes.js in die passende Slot-Liste
     gehängt → typeOf/materialOf/canEquip/ensureItemSprite funktionieren ohne
     Sonderfälle). `shop:true` schließt ihn vom Zufalls-Drop aus (pickItemType).
   - als Shop-/Kauf-Definition (classId, cost, fixedAffixes) für core/shopweapons.js.

   Werte orientieren sich am jeweiligen Klassenset (data/sets.js): Legendär,
   gleiche ilvl-Skalierung (setPieceIlvl) und feste Affixe aus dem Set-Profil.

   `special` = Optik-Schlüssel (core/weapon-art.js). `variant` ist nur ein
   Fallback-Silhouette-Index, falls die Spezial-Optik nicht greift.
   Reine Daten (keine core-Importe) → von Daten- & Renderer-Schicht importierbar.
   ===================================================================== */

export const SHOP_WEAPONS = [
  // 🗡️ SCHURKE – Zwillingsklingen (grün/türkis, goldenes Medaillon). Haupt- & Nebenhand.
  //    Werte am „Blutschatten"-Set orientiert (critDamage/attackSpeed/critPhys).
  { key:'zwillingsklinge_haupt', classId:'schurke', slotKey:'waffe',
    name:'Zwillingsklinge', g:'f', cost:125,
    art:'waffe', special:'zwillinge_mainhand', variant:7, statType:'damage', cat:'waffen', shop:true,
    statMult:1.00, affixBias:{ critDamage:4, attackSpeed:3, critPhys:2 }, flavorAffix:'critDamage',
    fixedAffixes:['critDamage','attackSpeed','critPhys'] },
  { key:'zwillingsklinge_neben', classId:'schurke', slotKey:'schild',
    name:'Zwillingsklinge (Nebenhand)', g:'f', cost:125,
    art:'waffe', special:'zwillinge_offhand', variant:7, statType:'damage', cat:'waffen', affixGroup:'waffe', shop:true,
    statMult:0.66, affixBias:{ attackSpeed:5, critDamage:3, critPhys:2 }, flavorAffix:'attackSpeed',
    fixedAffixes:['attackSpeed','critDamage','critPhys'] },

  // 🛡️ VERTEIDIGER – Frosthauch (eisblaue Runenklinge) + Stachelbollwerk (lila Stachelschild).
  //    Werte am „Höllenwächter"-Set orientiert (Schaden bzw. armor/block/thorns).
  { key:'frostklinge', classId:'verteidiger', slotKey:'waffe',
    name:'Frosthauch', g:'m', cost:125, element:'ice',
    art:'waffe', special:'frost', variant:8, statType:'damage', cat:'waffen', shop:true,
    statMult:1.10, affixBias:{ damage:4, critDamage:3, versatility:2 }, flavorAffix:'damage',
    fixedAffixes:['damage','critDamage','versatility'] },
  { key:'stachelbollwerk', classId:'verteidiger', slotKey:'schild',
    name:'Stachelbollwerk', g:'n', cost:125,
    art:'schild', special:'stachel', variant:8, statType:'armor', cat:'waffen', shop:true,
    statMult:1.30, affixBias:{ armor:5, block:3, thorns:2 }, flavorAffix:'armor',
    fixedAffixes:['armor','block','thorns'] },

  // 🔮 HEXER – Infernostab (Feuerstab, gebogene Klingen, oranger Glut-Glow).
  //    Werte am „Leerenfürst"-Set orientiert (critMagic/critDamage/lifesteal).
  { key:'infernostab', classId:'hexer', slotKey:'waffe',
    name:'Infernostab', g:'m', cost:125, element:'fire',
    art:'waffe', special:'inferno', variant:6, material:'zauberstab', orb:'rot', statType:'damage', cat:'waffen', shop:true,
    statMult:1.00, affixBias:{ critMagic:5, critDamage:3, lifesteal:2 }, flavorAffix:'critMagic',
    fixedAffixes:['critMagic','critDamage','lifesteal'] },
  // 🔮 HEXER – Nebenhand „Infernoherz" (dunkle Glutkugel, passend zum Infernostab).
  { key:'infernoorb', classId:'hexer', slotKey:'schild',
    name:'Infernoherz', g:'n', cost:125, element:'fire',
    art:'orb', special:'infernoorb', variant:0, material:'kugel', orb:'rot', statType:'damage', cat:'waffen', affixGroup:'kugel', shop:true,
    statMult:0.62, affixBias:{ critMagic:4, lifesteal:3, critDamage:2 }, flavorAffix:'critMagic',
    fixedAffixes:['critMagic','lifesteal','critDamage'] },

  // ✨ HEILER – Engelsstab (goldene Flügel, blau-weißer Schimmer).
  //    Werte am „Morgenröte"-Set orientiert (maxHp/versatility/critMagic).
  { key:'engelsstab', classId:'heiler', slotKey:'waffe',
    name:'Engelsstab', g:'m', cost:125, element:'ice',
    art:'waffe', special:'engel', variant:6, material:'zauberstab', orb:'blau', statType:'damage', cat:'waffen', shop:true,
    statMult:0.95, affixBias:{ maxHp:4, versatility:3, critMagic:2 }, flavorAffix:'maxHp',
    fixedAffixes:['maxHp','versatility','critMagic'] },
  // ✨ HEILER – Nebenhand „Seraphsphäre" (strahlende Lichtkugel, passend zum Engelsstab).
  { key:'engelsorb', classId:'heiler', slotKey:'schild',
    name:'Seraphsphäre', g:'f', cost:125, element:'ice',
    art:'orb', special:'engelsorb', variant:0, material:'kugel', orb:'blau', statType:'damage', cat:'waffen', affixGroup:'kugel', shop:true,
    statMult:0.60, affixBias:{ maxHp:4, versatility:3, critMagic:2 }, flavorAffix:'maxHp',
    fixedAffixes:['maxHp','versatility','critMagic'] },
];

export const shopWeaponById = key => SHOP_WEAPONS.find(w => w.key === key) || null;
export const shopWeaponsForClass = classId => SHOP_WEAPONS.filter(w => w.classId === classId);
