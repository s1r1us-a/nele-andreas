/* =====================================================================
   recPower-KALIBRIERUNG (Boss-Empfehlungen).
   Headless-Simulation der echten Bosskampf-Engine, um die „Empfohlene
   Kampfkraft" (recPower) je Boss an den TATSÄCHLICHEN Kampfausgang zu koppeln.

   Hintergrund (Bug): recPower war ~ maxHp/11 und ignorierte Boss-Angriff,
   Enrage & Mechaniken → die angezeigte Kampfkraft konnte weit über der
   Empfehlung liegen, der Kampf aber trotzdem verloren gehen.

   Ziel-Semantik (mit Nutzer abgestimmt):
     - recPower = Kampfkraft, bei der ein Kampf FAIR (~50 %) ist.
     - Kalibriert auf die SCHWÄCHSTE Klasse (= Maximum über alle Klassen der
       für 50 % nötigen Kampfkraft) → die Empfehlung stimmt für jede Klasse.

   Nutzung (im Repo-Wurzelverzeichnis):
     node adventure/tools/calibrate-recpower.mjs            # nur Bericht
     node adventure/tools/calibrate-recpower.mjs --write    # Werte zurückschreiben
     SAMPLES=800 node adventure/tools/calibrate-recpower.mjs # mehr Genauigkeit

   WICHTIG: Aus core/items.js & core/character.js können wir NICHT importieren
   (DOM-/CDN-Abhängigkeiten). Die reinen Formeln (POWER_W, powerOfBundle,
   affixValue, Primärstat-Roll, recomputeTotals-Caps, heroCombat, exchange())
   sind hier 1:1 nachgebaut und MÜSSEN zu jenen Dateien passen. Alle übrigen
   Balance-Konstanten werden direkt importiert (kein Drift).
   ===================================================================== */
import { readFileSync, writeFileSync } from 'fs';

const { BOSS_DEFS, bossFor, guaranteedRarityIndex } = await import('../js/data/bosses.js');
const { COMBAT, ENDLESS, BASE_STAT, ILVL_K, HEAL_PCT } = await import('../js/data/tuning.js');
const { AFFIX_DEFS, weightedAffixPool } = await import('../js/data/affixes.js');
const { RARITIES, rarityByIndex, rarityIndex } = await import('../js/data/rarities.js');
const { SLOT_KEYS, SLOTS } = await import('../js/data/slots.js');
const { CLASSES } = await import('../js/data/classes.js');
const { ITEM_TYPES } = await import('../js/data/itemTypes.js');

// ---- Konfiguration --------------------------------------------------
const SAMPLES   = parseInt(process.env.SAMPLES || '500', 10);  // Kämpfe je Winrate-Messung
const BIS_ITERS = parseInt(process.env.BIS_ITERS || '20', 10); // Bisektionsschritte über ilvl
const CANDIDATES_PER_SLOT = 3;   // wie viele Drops pro Slot zur Auswahl (autoEquip-greedy)
const TARGET_WR = 0.50;          // „Normal"/recPower = ~50 % Siegrate
const MAX_TURNS = 700;           // Sicherheits-Cap (Enrage beendet Kämpfe lange vorher)
const POTIONS   = 2;             // konservativer Heiltrank-Vorrat je Kampf
const SCOUT_ZONES = 15;          // realistische Gear-Obergrenze: so viele Zonen „vorgegrindet"
const MIN_GROWTH = 1.05;         // glatte Hochrechnung: jeder Boss ≥ 5 % über dem vorigen
const WRITE     = process.argv.includes('--write');

// Realistische ilvl-Obergrenze für einen Boss: Ausrüstung eines Spielers, der
// einige Zonen vorausgegrindet hat (Spiegel der ilvl-Formel aus items.js rollItem).
function ilvlCeil(idx){ const z = idx + SCOUT_ZONES; return Math.round(z*5 + 1 + z*z*0.30); }

// ---- Seedbarer PRNG (mulberry32) -----------------------------------
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Power-Gewichtung (SPIEGEL von items.js POWER_W) ----------------
const POWER_W = {
  armor:1, damage:1.5, maxHp:0.2, critPhys:200, critMagic:200, critDamage:60, attackSpeed:150,
  lifesteal:180, dodge:220, block:1, versatility:200, thorns:0.8,
};
function powerOfBundle(b){
  let p = 0;
  for(const k in POWER_W) p += (b[k]||0) * POWER_W[k];
  return Math.round(p);
}

// ---- Affix-Rolls (SPIEGEL von items.js) ----------------------------
const AFFIX_ROLL_RANGE = {
  gewoehnlich:[0.75,1.25], ungewoehnlich:[0.75,1.25], selten:[0.80,1.25],
  episch:[0.85,1.25], legendaer:[0.90,1.28], mythisch:[0.95,1.30],
};
function affixValue(key, ilvl, rarity, rng){
  const d = AFFIX_DEFS[key];
  const [lo, hi] = AFFIX_ROLL_RANGE[rarity.key] || [0.75,1.25];
  const roll = lo + rng()*(hi-lo);
  let v = (d.base + ilvl*d.perIlvl) * rarity.mult * roll;
  if(d.pct){ v = Math.round(v*1000)/1000; if(d.cap) v = Math.min(d.cap, v); }
  else { v = Math.max(1, Math.round(v)); }
  return v;
}
function removeAll(arr, key){ for(let i=arr.length-1;i>=0;i--) if(arr[i]===key) arr.splice(i,1); }
function affixCountFor(rarityKey, rng){
  switch(rarityKey){
    case 'gewoehnlich': return 0;
    case 'ungewoehnlich': return 1;
    case 'selten': return 2;
    case 'episch': return 2 + (rng()<0.5 ? 1 : 0);
    case 'legendaer': return 3;
    case 'mythisch': return 4;
    default: return 0;
  }
}
function rollAffixes(slotKey, ilvl, rarity, itype, rng){
  let n = affixCountFor(rarity.key, rng);
  const pool = weightedAffixPool(slotKey, itype).slice();
  const out = {};
  if(itype && itype.flavorAffix && rarityIndex(rarity.key) >= 3 && pool.includes(itype.flavorAffix) && n > 0){
    out[itype.flavorAffix] = affixValue(itype.flavorAffix, ilvl, rarity, rng);
    removeAll(pool, itype.flavorAffix);
    n--;
  }
  for(let i=0; i<n && pool.length; i++){
    const k = pool[Math.floor(rng()*pool.length)];
    out[k] = affixValue(k, ilvl, rarity, rng);
    removeAll(pool, k);
  }
  return out;
}

// ---- Item-Generierung & itemPower (SPIEGEL von items.js) ------------
const ARMOR_MATS = ['stoff','leder','platte'];
function artOf(slotKey){ return SLOTS[slotKey] ? SLOTS[slotKey].art : null; }
function canUseType(slotKey, t, cls){
  if(slotKey==='schild') return cls.id==='verteidiger';
  if(slotKey==='waffe'){
    const isStaff = t.material==='zauberstab';
    return cls.damageSchool==='magisch' ? isStaff : !isStaff;
  }
  if(t.material && ARMOR_MATS.includes(t.material)) return cls.allowedMaterials.includes(t.material);
  return true; // Schmuck / materiallos
}
function usableTypes(slotKey, cls){
  const list = ITEM_TYPES[artOf(slotKey)] || [];
  return list.filter(t => canUseType(slotKey, t, cls));
}
function pickType(types, rng){
  let total = 0;
  for(const t of types) total += (t.weight > 0 ? t.weight : 6);
  let r = rng() * total;
  for(const t of types){ r -= (t.weight > 0 ? t.weight : 6); if(r < 0) return t; }
  return types[types.length-1];
}
function rollItem(slotKey, ilvl, rarity, types, rng){
  const slot = SLOTS[slotKey];
  const itype = pickType(types, rng);
  const quality = 0.80 + rng()*0.40;
  const stat = Math.max(1, Math.round(BASE_STAT[slot.statType] * rarity.mult * (1 + ilvl*ILVL_K) * quality * (itype.statMult ?? 1)));
  return { slotKey, statType: slot.statType, stat, affixes: rollAffixes(slotKey, ilvl, rarity, itype, rng) };
}
// itemPower: spiegelt items.js (Procs ausgelassen → minimal konservativ).
function itemPower(it){
  if(!it) return 0;
  const b = {};
  if(it.statType==='armor') b.armor = (b.armor||0) + it.stat; else b.damage = (b.damage||0) + it.stat;
  for(const [k,v] of Object.entries(it.affixes||{})) b[k] = (b[k]||0) + v;
  return powerOfBundle(b);
}

// ---- recomputeTotals-Caps (SPIEGEL von character.js) ---------------
function applyCaps(b){
  b.critPhys    = Math.min(0.60, b.critPhys||0);
  b.critMagic   = Math.min(0.60, b.critMagic||0);
  b.attackSpeed = Math.min(0.60, b.attackSpeed||0);
  b.lifesteal   = Math.min(AFFIX_DEFS.lifesteal.cap, b.lifesteal||0);
  b.dodge       = Math.min(AFFIX_DEFS.dodge.cap, b.dodge||0);
  b.versatility = Math.min(AFFIX_DEFS.versatility.cap, b.versatility||0);
}
function levelBonus(level){ const l = Math.max(0,(level||1)-1); return { hp:l*10, dmg:l*1.5, armor:l*1 }; }

// ---- Referenz-Build (autoEquip-greedy) je Klasse/ilvl --------------
const SUM_KEYS = ['armor','damage','critPhys','critMagic','critDamage','maxHp','attackSpeed',
                  'lifesteal','dodge','block','versatility','thorns'];
function buildGear(cls, ilvl, rarity, level, rng){
  const b = {}; SUM_KEYS.forEach(k => b[k]=0);
  for(const slotKey of SLOT_KEYS){
    const types = usableTypes(slotKey, cls);
    if(!types.length) continue;            // z. B. Schild für Nicht-Verteidiger → leer
    let best = null, bestP = 0;
    for(let c=0;c<CANDIDATES_PER_SLOT;c++){
      const it = rollItem(slotKey, ilvl, rarity, types, rng);
      const p = itemPower(it);
      if(!best || p > bestP){ best = it; bestP = p; }
    }
    if(best.statType==='armor') b.armor += best.stat; else b.damage += best.stat;
    for(const [k,v] of Object.entries(best.affixes)) b[k] = (b[k]||0) + v;
  }
  applyCaps(b);
  const lb = levelBonus(level);
  b.armor += lb.armor; b.damage += lb.dmg; b.maxHp += lb.hp;
  b.power = powerOfBundle(b);
  return b;
}

// ---- heroCombat (SPIEGEL von character.js) -------------------------
function heroCombat(t, cls){
  const school = cls.damageSchool;
  const activeCrit = school==='magisch' ? (t.critMagic||0) : (t.critPhys||0);
  const maxHp = COMBAT.heroBaseHp + t.armor*COMBAT.heroHpPerArmor + (t.maxHp||0);
  const atk = Math.round((COMBAT.heroBaseAtk + t.damage) * (1 + (t.versatility||0)) * cls.dmgMult);
  const critChance = COMBAT.heroBaseCrit + activeCrit;
  const critMult = COMBAT.heroBaseCritMult + (t.critDamage||0);
  const interval = Math.max(COMBAT.swingMinMs, COMBAT.swingBaseMs * (1 - (t.attackSpeed||0)));
  return { maxHp, atk, critChance, critMult, interval,
           lifesteal:(t.lifesteal||0)*cls.healMult, dodge:t.dodge||0,
           versatility:t.versatility||0, thorns:t.thorns||0,
           armor:t.armor, block:t.block||0 };
}

// ---- Bosskampf-Simulation (SPIEGEL der exchange()-Schleife) --------
function simulateFight(bundle, cls, boss, rng){
  const c = heroCombat(bundle, cls);
  const ability = cls.ability || null;
  const healDebuff = (boss.mechanics.includes('schwaechung')) ? 0.5 : 1;
  const rnd = v => 1 + (rng()*2-1)*v;
  const has = k => mechanics.indexOf(k) >= 0;

  const mechanics = boss.mechanics.slice();
  const phases = (boss.phases||[]).map(p=>({...p, fired:false}));

  let heroMaxHp = c.maxHp, heroHp = c.maxHp;
  let heroArmor = c.armor, heroArmorBase = c.armor, heroBlock = c.block;
  let bossMaxHp = boss.maxHp, bossHp = boss.maxHp;
  let turn = 0, elapsed = 0, potions = POTIONS;
  let poison=0, burn=0, berserkMult=1, shieldTurns=0, curseTurns=0, invulnTurns=0,
      adds=0, teilungDone=false, enrageMult=1;
  // Buff-Fenster (Echtzeit in ms): { until, val }
  const buffs = { crit:{until:0,val:0}, dmgBoost:{until:0,val:0}, dmgReduce:{until:0,val:0}, lifesteal:{until:0,val:0} };
  let abilityCd = 0;

  function fireAbility(){
    if(!ability) return;
    if(elapsed < abilityCd) return;
    abilityCd = elapsed + (ability.cd||30000);
    if(ability.kind==='heal'){
      heroHp = Math.min(heroMaxHp, heroHp + Math.round(heroMaxHp*ability.healPct*healDebuff));
    } else if(ability.kind==='critBoost'){
      buffs.crit = { until: elapsed+ability.dur, val: ability.critBonus };
    } else if(ability.kind==='dmgBoost'){
      buffs.dmgBoost = { until: elapsed+ability.dur, val: ability.dmgBonus };
    } else if(ability.kind==='dmgReduce'){
      buffs.dmgReduce = { until: elapsed+ability.dur, val: ability.dmgReduce };
    } else if(ability.kind==='lifesteal'){
      buffs.lifesteal = { until: elapsed+ability.dur, val: ability.lifestealBonus };
    } else if(ability.kind==='burst' || ability.kind==='drain'){
      const dmg = Math.max(1, Math.round(c.atk * ability.burstMult));
      bossHp = Math.max(0, bossHp - dmg);
      if(ability.kind==='drain') heroHp = Math.min(heroMaxHp, heroHp + Math.round(dmg*healDebuff));
    }
  }

  while(turn < MAX_TURNS){
    turn++;
    elapsed += c.interval + COMBAT.bossReplyMs;

    // Phasenwechsel
    for(const p of phases){
      if(!p.fired && bossHp <= bossMaxHp * p.hp){
        p.fired = true;
        for(const m of p.add) if(mechanics.indexOf(m)<0) mechanics.push(m);
      }
    }

    // --- Held schlägt ---
    const stunned = has('betaeubung') && rng() < 0.12;
    if(stunned){
      /* ausgesetzt */
    } else if(invulnTurns > 0){
      /* Boss immun */
    } else {
      let effCrit = c.critChance * (curseTurns>0 ? 0.5 : 1);
      if(elapsed < buffs.crit.until) effCrit = Math.min(1, effCrit + buffs.crit.val);
      const heroCrit = rng() < effCrit;
      let dmg = Math.max(1, Math.round(c.atk * rnd(0.15) * (heroCrit ? c.critMult : 1)));
      if(elapsed < buffs.dmgBoost.until) dmg = Math.max(1, Math.round(dmg * (1 + buffs.dmgBoost.val)));
      if(shieldTurns > 0) dmg = Math.max(1, Math.round(dmg*0.4));
      bossHp = Math.max(0, bossHp - dmg);
      let ls = c.lifesteal;
      if(elapsed < buffs.lifesteal.until) ls += buffs.lifesteal.val;
      if(ls > 0) heroHp = Math.min(heroMaxHp, heroHp + Math.round(dmg*ls*healDebuff));
      if(has('dornen'))    heroHp = Math.max(0, heroHp - Math.max(1, Math.round(dmg*0.15)));
      if(has('reflexion')) heroHp = Math.max(0, heroHp - Math.max(1, Math.round(dmg*0.25)));
      if(c.thorns > 0)     bossHp = Math.max(0, bossHp - c.thorns);
    }
    if(curseTurns > 0) curseTurns--;
    if(invulnTurns > 0) invulnTurns--;
    if(bossHp <= 0) return true;

    // --- Boss schlägt zurück ---
    if(shieldTurns > 0) shieldTurns--;
    if(has('eispanzer') && turn % 5 === 0) shieldTurns = 2;
    if(has('schildphase') && turn % 6 === 0) invulnTurns = 2;
    if(has('regen') && turn % 3 === 0) bossHp = Math.min(bossMaxHp, bossHp + Math.round(bossMaxHp*0.04));
    if(has('berserk')) berserkMult *= 1.03;
    if(has('add_spawn') && turn % 6 === 0) adds++;
    if(has('fluch') && turn % 4 === 0) curseTurns = 3;
    if(has('teilung') && !teilungDone && bossHp < bossMaxHp*0.5){ teilungDone = true; berserkMult *= 1.5; }
    if(has('auszehrung') && turn % 3 === 0){
      heroMaxHp = Math.max(1, heroMaxHp - Math.max(1, Math.round(heroMaxHp*0.03)));
      heroHp = Math.min(heroHp, heroMaxHp);
    }

    let atk = boss.atk * berserkMult;
    if(has('wut') && bossHp < bossMaxHp*0.3) atk *= 1.5;
    if(has('hinrichtung') && heroHp < heroMaxHp*0.25) atk *= 2;
    if(has('eskalation')) atk *= 1 + (1 - bossHp/bossMaxHp)*0.8;
    if(adds > 0) atk *= 1 + adds*0.08;
    const enrageTurn = has('enrage') ? COMBAT.hardEnrageTurn : COMBAT.enrageTurn;
    const enrageRamp = has('enrage') ? COMBAT.hardEnrageRamp : COMBAT.enrageRamp;
    if(turn > enrageTurn) enrageMult *= enrageRamp;
    atk *= enrageMult;

    const bossCrit = rng() < COMBAT.bossCritChance;
    let mult = bossCrit ? 2 : 1, ignoreArmor = false;
    if(has('feueratem') && turn % 4 === 0){ mult *= 2.2; ignoreArmor = true; }

    if(rng() < c.dodge){
      /* ausgewichen */
    } else {
      const armorRed = ignoreArmor ? 0 : (heroArmor*COMBAT.armorReduction + heroBlock);
      let bd = Math.max(1, Math.round((atk * rnd(0.15) * mult) - armorRed));
      bd = Math.round(bd * (1 - c.versatility));
      if(elapsed < buffs.dmgReduce.until) bd = Math.max(1, Math.round(bd * (1 - buffs.dmgReduce.val)));
      heroHp = Math.max(0, heroHp - bd);
      if(has('lebensentzug')) bossHp = Math.min(bossMaxHp, bossHp + Math.round(bd*0.4));
    }
    if(has('ruestungsbruch') && heroArmor > 0) heroArmor = Math.max(0, heroArmor - Math.max(1, Math.round(heroArmorBase*0.05)));
    if(has('gift')){ poison++; heroHp = Math.max(0, heroHp - 2*poison); }
    if(has('verbrennung')){ burn++; heroHp = Math.max(0, heroHp - Math.max(1, Math.round(heroMaxHp*0.012*burn))); }

    if(heroHp <= 0) return false;

    // Reaktiver Heiltrank + Grundfähigkeit (greedy auf Cooldown)
    if(potions > 0 && heroHp < heroMaxHp*0.35){
      heroHp = Math.min(heroMaxHp, heroHp + Math.round(heroMaxHp*HEAL_PCT*healDebuff));
      potions--;
    }
    fireAbility();
    if(bossHp <= 0) return true;
  }
  return false; // Cap erreicht → als Niederlage werten (Enrage uneinholbar)
}

// ---- Boss-Objekt für die Simulation aufbereiten --------------------
function bossView(idx){
  const b = bossFor(idx);
  const mechanics = Array.isArray(b.mechanic) ? b.mechanic.slice() : (b.mechanic ? [b.mechanic] : []);
  return { name:b.name, maxHp:b.maxHp, atk:b.atk, recPower:b.recPower, mechanics,
           phases:(b.phases||[]).map(p=>({hp:p.hp, add:p.add.slice()})), idx };
}

// ---- Winrate einer Klasse bei gegebenem ilvl -----------------------
function winrateAt(cls, boss, ilvl, rarity, level, seed){
  const rng = mulberry32(seed);
  let wins = 0, powerSum = 0;
  for(let s=0;s<SAMPLES;s++){
    const bundle = buildGear(cls, ilvl, rarity, level, rng);
    powerSum += bundle.power;
    if(simulateFight(bundle, cls, boss, rng)) wins++;
  }
  return { wr: wins/SAMPLES, power: Math.round(powerSum/SAMPLES) };
}

// ---- Bisektion: kleinstes ilvl mit Winrate >= TARGET innerhalb der
//      realistischen ilvl-Obergrenze. Ist der Boss selbst dort nicht fair
//      besiegbar (Mauer), liefern wir die Kampfkraft an der Obergrenze als
//      „höchsten realistisch erreichbaren Bedarf" (capped=true). ----------
function calibrateClass(cls, boss, rarity, level, ceil, seed){
  const hiRes = winrateAt(cls, boss, ceil, rarity, level, seed+777);
  if(hiRes.wr < TARGET_WR){
    return { ilvl: ceil, power: hiRes.power, wr: hiRes.wr, capped: true };
  }
  let lo = 1, hi = ceil, res = hiRes;
  for(let i=0;i<BIS_ITERS;i++){
    const mid = (lo+hi)/2;
    const r = winrateAt(cls, boss, mid, rarity, level, seed + i*131);
    if(r.wr >= TARGET_WR){ hi = mid; res = r; } else { lo = mid; }
  }
  return { ilvl: hi, power: res.power, wr: res.wr, capped: false };
}

// Level-Annahme (konservativ, an Boss-Fortschritt gekoppelt).
function levelForBoss(idx){ return 1 + 4*idx; }

// ---- Hauptlauf ------------------------------------------------------
function fmt(n){
  if(n>=1e9) return (n/1e9).toFixed(2).replace(/\.?0+$/,'')+'Mrd';
  if(n>=1e6) return (n/1e6).toFixed(2).replace(/\.?0+$/,'')+'Mio';
  if(n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'')+'k';
  return ''+n;
}
const pad = (s,n)=> String(s).padStart(n);

console.log(`# recPower-Kalibrierung  (SAMPLES=${SAMPLES}, Kandidaten/Slot=${CANDIDATES_PER_SLOT}, Ziel-WR=${TARGET_WR}, Scout=${SCOUT_ZONES})`);
console.log('Idx | Boss                         |   alt rec |   roh bed | besiegbar? | schwächste | WR je Klasse');
console.log('-'.repeat(118));

// 1) Rohbedarf je Boss = Maximum über die Klassen (schwächste Klasse bestimmt).
const raw = [], cappedFlag = [];
for(let i=0;i<BOSS_DEFS.length;i++){
  const boss = bossView(i);
  const rarity = rarityByIndex(guaranteedRarityIndex(i));
  const level = levelForBoss(i);
  const ceil = ilvlCeil(i);
  let maxPower = 0, weakest = '', anyWinnable = false;
  const perClass = {};
  for(const cls of CLASSES){
    const r = calibrateClass(cls, boss, rarity, level, ceil, 1000 + i*97);
    perClass[cls.id] = r;
    if(!r.capped) anyWinnable = true;
    if(r.power > maxPower){ maxPower = r.power; weakest = cls.label; }
  }
  raw.push(Math.round(maxPower));
  cappedFlag.push(!anyWinnable);
  const wrTxt = CLASSES.map(cls=> cls.label[0] + ':' + Math.round(perClass[cls.id].wr*100) + '%').join(' ');
  console.log(
    pad(i,3)+' | '+ boss.name.padEnd(28).slice(0,28) +' | '+ pad(fmt(boss.recPower),9) +' | '+
    pad(fmt(raw[i]),9) +' | '+ pad(anyWinnable?'ja':'Mauer',10) +' | '+ weakest.padEnd(10) +' | '+ wrTxt
  );
}

// 2) Glatte Hochrechnung: monoton steigend, jeder Boss ≥ MIN_GROWTH über vorigem.
const newRec = [];
for(let i=0;i<raw.length;i++){
  const floor = i>0 ? Math.round(newRec[i-1]*MIN_GROWTH) : 0;
  newRec.push(Math.max(raw[i], floor));
}

console.log('\n# Geglättete Empfehlung (monoton, glatte Hochrechnung)');
console.log('Idx |   alt rec |   neu rec |  Faktor');
console.log('-'.repeat(44));
for(let i=0;i<newRec.length;i++){
  console.log(pad(i,3)+' | '+ pad(fmt(BOSS_DEFS[i].recPower),9) +' | '+ pad(fmt(newRec[i]),9) +' | '+
    pad((newRec[i]/BOSS_DEFS[i].recPower).toFixed(2)+'x',7) + (cappedFlag[i]?'   (Mauer)':''));
}

// ---- ENDLESS.powFactor fitten --------------------------------------
// Endlos-Stufen sind erst recht „Mauern"; ihr Rohbedarf = max. realistische
// Kampfkraft an der ilvl-Obergrenze (capped). Wir messen deren Wachstum pro
// Stufe gegenüber dem letzten Boss und nehmen mind. MIN_GROWTH (glatte Kurve).
console.log('\n# Endlos-Skalierung (powFactor-Fit)');
const last = BOSS_DEFS.length - 1;
const lastRec = newRec[last];
const stages = [1,2,3,5,8];
const ratios = [];
for(const over of stages){
  const idx = BOSS_DEFS.length - 1 + over;
  const boss = bossView(idx);
  const rarity = rarityByIndex(guaranteedRarityIndex(idx));
  const level = levelForBoss(idx);
  const ceil = ilvlCeil(idx);
  let maxPower = 0;
  for(const cls of CLASSES){
    const r = calibrateClass(cls, boss, rarity, level, ceil, 5000 + idx*97);
    if(r.power > maxPower) maxPower = r.power;
  }
  const perStage = Math.pow(Math.max(maxPower, lastRec) / lastRec, 1/over);
  ratios.push(perStage);
  console.log(`  +${over}: bedarf≈${fmt(Math.round(maxPower))}  → Wachstum^(1/${over}) = ${perStage.toFixed(4)}`);
}
const fittedRaw = ratios.reduce((a,b)=>a+b,0)/ratios.length;
const fittedPow = Math.max(MIN_GROWTH, fittedRaw);
console.log(`  → gemessenes Wachstum = ${fittedRaw.toFixed(3)} → powFactor = ${fittedPow.toFixed(3)} (mind. ${MIN_GROWTH}; aktuell ${ENDLESS.powFactor})`);

// ---- Rückschreiben (nur mit --write) -------------------------------
if(WRITE){
  const bossesPath = new URL('../js/data/bosses.js', import.meta.url);
  let src = readFileSync(bossesPath, 'utf8');
  let n = 0;
  // recPower je Boss-Zeile ersetzen: wir treffen das i-te Vorkommen von "recPower:<zahl>"
  src = src.replace(/recPower:\s*\d+/g, (m)=>{
    if(n < newRec.length){ const out = 'recPower:'+newRec[n]; n++; return out; }
    return m;
  });
  if(n !== BOSS_DEFS.length){
    console.error(`\n⚠️  Abbruch: ${n} recPower-Felder ersetzt, erwartet ${BOSS_DEFS.length}. bosses.js NICHT geschrieben.`);
    process.exit(1);
  }
  writeFileSync(bossesPath, src);
  console.log(`\n✅ ${n} recPower-Werte in bosses.js geschrieben.`);

  const tuningPath = new URL('../js/data/tuning.js', import.meta.url);
  let tsrc = readFileSync(tuningPath, 'utf8');
  const rounded = Math.round(fittedPow*100)/100;
  const before = tsrc;
  tsrc = tsrc.replace(/(powFactor:\s*)[\d.]+/, `$1${rounded}`);
  if(tsrc !== before){ writeFileSync(tuningPath, tsrc); console.log(`✅ ENDLESS.powFactor = ${rounded} in tuning.js geschrieben.`); }
  console.log('\nℹ️  Jetzt noch:  node adventure/tools/gen-bosse-doc.mjs');
} else {
  console.log('\n(Nur Bericht – mit  --write  schreibt das Tool recPower & powFactor zurück.)');
}
