/* =====================================================================
   CHARAKTER: XP/Level, Gesamt-Stats, abgeleitete Kampfwerte.
   ===================================================================== */
import { COMBAT } from '../data/tuning.js';
import { AFFIX_DEFS, AFFIX_KEYS } from '../data/affixes.js';
import { classOf, damageSchool } from '../data/classes.js';
import { applyTalents, talentPointEntitlement } from '../data/talents.js';
import { state } from './state.js';
import { powerOfBundle } from './items.js';
import { applySetBonuses } from './sets.js';
import { toast } from '../ui/dom.js';
import { awardAccountXp } from './account-xp.js';

// ---- XP / Level -----------------------------------------------------
// Steilere Levelkosten (grind-lastig). Basis 40→100, Exponent 1.55→1.8.
export function xpForLevel(n){ return Math.round(100 * Math.pow(n, 1.8)); }
export function levelFromTotal(totalXp){
  let total = Number(totalXp)||0, level = 1, cum = 0;
  while(cum + xpForLevel(level) <= total){ cum += xpForLevel(level); level++; if(level>=9999) break; }
  return level;
}
export function xpInLevel(totalXp, level){
  let total = Number(totalXp)||0, cum = 0;
  for(let i=1;i<level;i++) cum += xpForLevel(i);
  return total - cum;
}
export function levelBonus(level){
  const l = Math.max(0, (level||1) - 1);
  return { hp: l*10, dmg: l*1.5, armor: l*1 };
}
export function gainXp(amount){
  amount = Math.max(0, Math.round(amount||0));
  if(!amount) return 0;
  // Dieselbe XP zusätzlich der projektweiten Account-XP gutschreiben
  // (Profil-Level). Floating-/Level-Up-Feedback läuft über xp-helper-Events.
  awardAccountXp(amount);
  const oldLevel = state.level || 1;
  state.xp = (state.xp||0) + amount;
  const newLevel = levelFromTotal(state.xp);
  if(newLevel > oldLevel){
    state.level = newLevel;
    const lb = levelBonus(newLevel);
    // Bis zum letzten Baum-Talent alle 5 Level, danach jedes Level 1 Talentpunkt.
    if(state.character){
      const cid = state.character.classId;
      const gained = talentPointEntitlement(newLevel, cid) - talentPointEntitlement(oldLevel, cid);
      if(gained > 0) state.character.talentPoints = (state.character.talentPoints || 0) + gained;
    }
    toast('⭐ Level '+newLevel+'! +'+(lb.hp)+' HP · +'+Math.round(lb.dmg)+' Schaden · +'+lb.armor+' Rüstung');
  }
  return amount;
}

// ---- Gesamt-Stats ---------------------------------------------------
const SUM_KEYS = ['armor','damage','critPhys','critMagic','critDamage','maxHp','attackSpeed',
                  'lifesteal','dodge','block','versatility','thorns'];
export function recomputeTotals(){
  const b = {}; SUM_KEYS.forEach(k => b[k] = 0);
  for(const it of Object.values(state.equipped)){
    if(!it) continue;
    if(it.statType==='armor') b.armor += it.stat; else b.damage += it.stat;
    const a = it.affixes || {};
    for(const k of AFFIX_KEYS) b[k] += a[k] || 0;
  }
  // Caps gegen Degeneration
  b.critPhys    = Math.min(0.60, b.critPhys);
  b.critMagic   = Math.min(0.60, b.critMagic);
  b.attackSpeed = Math.min(0.60, b.attackSpeed);
  b.lifesteal   = Math.min(AFFIX_DEFS.lifesteal.cap, b.lifesteal);
  b.dodge       = Math.min(AFFIX_DEFS.dodge.cap, b.dodge);
  b.versatility = Math.max(0, b.versatility);
  // Charakter-Level: dauerhafte Boni oben drauf
  const lb = levelBonus(state.level);
  b.armor += lb.armor; b.damage += lb.dmg; b.maxHp += lb.hp;
  // Talentbaum-Effekte (no-op solange Talente leer sind).
  applyTalents(state, b);
  // Klassen-Set-Boni (additiv, isoliert in core/sets.js) – nutzt vorhandene
  // Stat-Keys, fließt darum automatisch in Kampf + Fähigkeiten.
  applySetBonuses(state, b);
  b.power = powerOfBundle(b);
  return b;
}

// ---- Abgeleitete Kampfwerte (eine Quelle für UI & Bosskampf) -------
export function heroCombat(t){
  const cls = classOf(state);
  const school = cls.damageSchool;                 // 'magisch' | 'physisch'
  const activeCrit = school==='magisch' ? (t.critMagic||0) : (t.critPhys||0);
  const maxHp = COMBAT.heroBaseHp + t.armor*COMBAT.heroHpPerArmor + t.maxHp;
  const atk = Math.round((COMBAT.heroBaseAtk + t.damage) * (1 + (t.versatility||0)) * cls.dmgMult);
  const critChance = COMBAT.heroBaseCrit + activeCrit;
  const critMult = COMBAT.heroBaseCritMult + t.critDamage;
  const interval = Math.max(COMBAT.swingMinMs, COMBAT.swingBaseMs * (1 - t.attackSpeed));
  const swingsPerSec = 1000 / interval;
  const avgSwing = atk * (1 + critChance*(critMult-1));
  const dps = avgSwing * swingsPerSec;
  const dmgReduction = t.armor*COMBAT.armorReduction + (t.block||0);
  return { maxHp, atk, critChance, critMult, interval, swingsPerSec, dps, dmgReduction,
           school, critPhys: t.critPhys||0, critMagic: t.critMagic||0,
           lifesteal: (t.lifesteal||0) * cls.healMult, dodge: t.dodge||0,
           versatility: t.versatility||0, thorns: t.thorns||0 };
}

export function heroTier(power){
  if(power >= 600) return 3;
  if(power >= 250) return 2;
  if(power >= 80)  return 1;
  return 0;
}
export const TIER_NAME = ['Abenteurer','Krieger','Held','Legende'];
