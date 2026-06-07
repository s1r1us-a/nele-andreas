/* =====================================================================
   BOSS-KAMPF-ENGINE. Phase 1 (#7,#12,#13,#16,#17) + Phase 2 (#20,#22)
   + Phase 3 (#26 Kampflog/DPS-Meter).
   ===================================================================== */
import { COMBAT, HEAL_PCT, BASE_STAT, ILVL_K, FARM } from '../data/tuning.js';
import { RARITIES, rarityByIndex, rarityOf, rarityIndex } from '../data/rarities.js';
import { SLOTS } from '../data/slots.js';
import { rollAffixes } from '../core/items.js';
import { materialOf, typeOf } from '../data/itemTypes.js';
import { classOf, abilitiesOf } from '../data/classes.js';
import { bossFor, zoneBg, guaranteedRarityIndex, MECH_DEFS } from '../data/bosses.js';
import { state, saveState } from './state.js';
import { recomputeTotals, heroCombat, heroTier, gainXp } from './character.js';
import { heroSrc } from './avatar.js';
import { buildDemonSVG } from './demon-art.js';
import { rollItem, addLog, recordDrop, giveLoot } from './items.js';
import { $, toast, fmtBig } from '../ui/dom.js';
import { affixLinesHTML } from '../ui/tooltip.js';
import { renderAll } from '../ui/render.js';
import { awardCoins, spendCoins } from './coins.js';
import { checkAdventureBadges } from './badges.js';
import { expeditionActive } from './expedition.js';

let combatSpeed = 1, combatTimer = null;
export let currentFight = null;
const arenaOverlay = () => $('#arenaOverlay');

// Coin-Belohnung für den Erstkill eines Bosses, skaliert mit dem Boss-Index.
// Frühe Bosse ~100, späte mehrere Tausend; Endlos-Stufen wachsen weiter. Eine
// leicht justierbare Stellschraube. Farmkills geben hiervon 30 % (FARM.coinMult).
function bossCoinReward(i){ return Math.round(100 + i*50); }

// Beute-Karte für den Sieg-Bildschirm: zeigt das gedroppte Item klar mit Icon,
// Seltenheit, Slot, Primärwert und Affixen (statt nur dem Namen im Fließtext).
export function dropCardHTML(drop){
  if(!drop) return '';
  const r = rarityOf(drop.rarity);
  const sLbl = drop.statType==='armor' ? 'Rüstung' : 'Schaden';
  return '<div class="arena-drop-head">🎁 Beute erhalten:</div>'+
    '<div class="reward-card arena-drop" style="--rc:'+r.color+'">'+
      '<img src="'+drop.sprite+'" alt="'+(drop.name||'')+'">'+
      '<div class="rc-name" style="color:'+r.color+'">'+drop.name+'</div>'+
      '<div class="rc-slot">'+r.name+' · '+(SLOTS[drop.slotKey]?SLOTS[drop.slotKey].name:'')+
        ' · Gegenstandsstufe '+drop.ilvl+'</div>'+
      '<div class="tt-stat '+drop.statType+'">+'+drop.stat+' '+sLbl+'</div>'+
      affixLinesHTML(drop)+
    '</div>';
}

export function setCombatSpeed(v){ combatSpeed = v; }
export function getCombatSpeed(){ return combatSpeed; }

function rnd(v){ return 1 + (Math.random()*2-1)*v; }
const hasMech = (fight, key) => fight.mechanics.indexOf(key) >= 0;
function addMech(fight, key){ if(!hasMech(fight, key)){ fight.mechanics.push(key); } }

// ---- Kampflog & DPS-Meter (#26) ------------------------------------
function addCombatLog(fight, text, color){
  fight.log.unshift({ text, color: color||'#cfc6dd' });
  if(fight.log.length > 60) fight.log.pop();
  const box = $('#combatLog'); if(!box) return;
  box.innerHTML = fight.log.map(l => '<div class="cl-line" style="color:'+l.color+'">'+l.text+'</div>').join('');
}
function updateMeter(fight){
  const el = $('#dpsMeter'); if(!el) return;
  const sec = Math.max(0.5, (Date.now() - fight.startedAt)/1000);
  const dps = Math.round(fight.dmgDealt / sec);
  el.textContent = 'DPS '+fmtBig(dps)+' · Schaden '+fmtBig(fight.dmgDealt)+' · Runde '+fight.turn;
}

export function startBossFight(bossIndex){
  // Während eines laufenden Abenteuers ist der Held unterwegs – kein Bosskampf.
  if(expeditionActive()){ toast('🧭 Dein Held ist gerade auf Abenteuer – erst zurückkehren.'); return; }
  if(typeof bossIndex !== 'number') bossIndex = state.zone;
  const isFarm = bossIndex < state.zone;
  const t = recomputeTotals();
  const boss = bossFor(bossIndex);
  const stage = $('#arenaStage');
  stage.style.setProperty('--arena-bg', "url('"+zoneBg(bossIndex)+"')");
  $('#heroSprite').src = heroSrc(heroTier(t.power));
  $('#bossSprite').src = boss.sprite;
  $('#heroBarName').textContent = 'Held';
  $('#bossBarName').textContent = (isFarm ? '↻ ' : '') + boss.name;

  const c = heroCombat(t);
  const mechanics = Array.isArray(boss.mechanic) ? boss.mechanic.slice()
                   : (boss.mechanic ? [boss.mechanic] : []);
  // Procs aller angelegten Items sammeln (#22)
  const procs = Object.values(state.equipped).filter(it => it && it.proc).map(it => it.proc);

  const fight = {
    bossIndex, isFarm, boss,
    heroMaxHp: c.maxHp, heroHp: c.maxHp, heroAtk: c.atk,
    heroArmor: t.armor, heroArmorBase: t.armor, heroBlock: t.block||0,
    heroCritChance: c.critChance, heroCritMult: c.critMult, heroInterval: c.interval,
    lifesteal: c.lifesteal, dodge: c.dodge, versatility: c.versatility, thorns: c.thorns,
    procs,
    bossMaxHp: boss.maxHp, bossAtkBase: boss.atk, bossHp: boss.maxHp,
    turn:0, over:false, anchor:{},
    // Mechanik-Status
    mechanics, phases: (boss.phases||[]).map(p=>({...p, fired:false})),
    poison:0, burn:0, berserkMult:1, shieldTurns:0, frostTurns:0,
    curseTurns:0, zornTurns:0, invulnTurns:0, adds:0, teilungDone:false,
    // Neue Fähigkeiten-Status: Boss-Betäubung, Stealth-Fenster, beschworene Wache.
    bossStunUntil:0, stealthUntil:0, petEndUntil:0, petBonus:0,
    // Talent-Aktive: Absorb-Schild, Todesrettung, Gegner-Verwundbarkeit.
    heroShield:0, shieldUntil:0, deathSaveUntil:0, reviveHp:0, bossVulnUntil:0, bossVulnVal:0,
    healDebuff: mechanics.includes('schwaechung') ? 0.5 : 1,
    enrageMult:1,
    // Meter
    startedAt: Date.now(), dmgDealt:0, log:[],
    // Aktive Fähigkeiten: Grundfähigkeit + geskillte Talent-Aktive (max. 3).
    abilities: abilitiesOf(state),
    abilityCd: {},                 // ability.id → Timestamp (Cooldown-Ende)
    buffs: freshBuffs(),           // temporäre Buff-Fenster (Krit/Schaden/etc.)
  };
  currentFight = fight;
  updateHpBars(fight);
  $('#arenaResult').className = 'arena-result';
  $('#arenaResult').classList.remove('show');
  $('#arena').classList.remove('fight-over');   // Kampf-UI wieder einblenden
  // Während eines Boss-Kampfes ist „Verlassen" ausgeblendet (kein Abbrechen).
  $('#arenaCloseBtn').style.display = 'none';
  combatSpeed = 1;
  if($('#combatLog')) $('#combatLog').innerHTML = '';
  updatePotionBtn();
  resetAbilityVisuals();
  updateAbilityBtn();
  // Mechanik-Hinweis
  const mlist = mechanics.map(m => (MECH_DEFS[m]?MECH_DEFS[m].emoji+MECH_DEFS[m].label:m)).join(' · ');
  addCombatLog(fight, '⚔️ Kampf gegen '+boss.name+(mlist?' ('+mlist+')':''), '#ffd24a');
  updateMeter(fight);
  arenaOverlay().classList.add('show');

  requestAnimationFrame(()=> measureAnchors(fight));
  $('#heroSprite').onload = ()=> { if(currentFight===fight && !fight.over) measureAnchors(fight); };
  $('#bossSprite').onload = ()=> { if(currentFight===fight && !fight.over) measureAnchors(fight); };

  clearTimeout(combatTimer);
  scheduleExchange(fight);
}

function measureAnchors(fight){
  const stage = $('#arenaStage');
  const sr = stage.getBoundingClientRect();
  for(const id of ['heroSprite','bossSprite']){
    const el = $('#'+id); if(!el) continue;
    const r = el.getBoundingClientRect();
    fight.anchor[id] = { x: r.left - sr.left + r.width/2, y: r.top - sr.top + r.height/3 };
  }
}
window.addEventListener('resize', ()=>{
  if(currentFight && !currentFight.over && arenaOverlay().classList.contains('show'))
    measureAnchors(currentFight);
});

function scheduleExchange(fight){
  let interval = fight.heroInterval;
  if(fight.frostTurns > 0){ interval *= 1.4; fight.frostTurns--; }   // Frost verlangsamt
  if(fight.curseTurns > 0){ interval *= 1.3; }                       // Fluch verlangsamt
  if(fight.zornTurns  > 0){ interval *= 0.7; fight.zornTurns--; }    // Proc „Zorn" beschleunigt
  combatTimer = setTimeout(()=> exchange(fight), interval / combatSpeed);
}

function exchange(fight){
  if(fight.over) return;
  fight.turn++;

  // Phasenwechsel prüfen (#13)
  for(const p of fight.phases){
    if(!p.fired && fight.bossHp <= fight.bossMaxHp * p.hp){
      p.fired = true;
      for(const m of p.add) addMech(fight, m);
      const names = p.add.map(m => MECH_DEFS[m]?MECH_DEFS[m].label:m).join(', ');
      mechFloat('boss', '⚡ Phase: '+names, '#ffd24a');
      addCombatLog(fight, '⚡ Neue Phase! '+names+' aktiviert.', '#ffd24a');
    }
  }

  // --- Held schlägt ---
  const stunned = hasMech(fight,'betaeubung') && Math.random() < 0.12;
  if(stunned){
    mechFloat('hero', '😵 Betäubt', '#7fd0ff');
  } else if(Date.now() < (fight.stealthUntil||0)){
    // Nebelschritt: im Nebel verborgen – der Held greift nicht an (Überfall beim Auftauchen).
  } else if(fight.invulnTurns > 0){
    mechFloat('boss', '✨ Immun', '#9ec5ff');
  } else {
    const now = Date.now();
    let effCrit = fight.heroCritChance * (fight.curseTurns>0 ? 0.5 : 1);
    if(now < fight.buffs.crit.until){ effCrit = Math.min(1, effCrit + fight.buffs.crit.val); }
    const heroCrit = Math.random() < effCrit;
    let dmg = Math.max(1, Math.round(fight.heroAtk * rnd(0.15) * (heroCrit ? fight.heroCritMult : 1)));
    if(now < fight.buffs.dmgBoost.until) dmg = Math.max(1, Math.round(dmg * (1 + fight.buffs.dmgBoost.val)));
    if(now < (fight.petEndUntil||0)) dmg = Math.max(1, Math.round(dmg * (1 + (fight.petBonus||0))));   // Teufelswache
    if(now < (fight.bossVulnUntil||0)) dmg = Math.max(1, Math.round(dmg * (1 + (fight.bossVulnVal||0))));   // Schildwurf: Verwundbarkeit

    if(fight.shieldTurns > 0) dmg = Math.max(1, Math.round(dmg*0.4));  // Eispanzer
    fight.bossHp = Math.max(0, fight.bossHp - dmg);
    fight.dmgDealt += dmg;
    attackAnim('hero', dmg, heroCrit, ()=> updateHpBars(fight));
    // Lebensraub-Affix (#20) + temporärer Lebensraub-Buff
    let ls = fight.lifesteal;
    if(now < fight.buffs.lifesteal.until) ls += fight.buffs.lifesteal.val;
    if(ls > 0){
      const heal = Math.round(dmg * ls * fight.healDebuff);
      if(heal>0){ fight.heroHp = Math.min(fight.heroMaxHp, fight.heroHp + heal); }
    }
    // Procs (#22)
    for(const pr of fight.procs){
      if(Math.random() >= pr.chance) continue;
      if(pr.type==='blitz'){ const ed = Math.round(pr.value); fight.bossHp = Math.max(0, fight.bossHp-ed); fight.dmgDealt+=ed; mechFloat('boss','⚡-'+ed,'#7fd0ff'); }
      else if(pr.type==='lebensquell'){ const lq = Math.round(pr.value * fight.healDebuff); fight.heroHp = Math.min(fight.heroMaxHp, fight.heroHp + lq); mechFloat('hero','💚+'+lq,'#37d67a'); }
      else if(pr.type==='zorn'){ fight.zornTurns = Math.max(fight.zornTurns, pr.value); mechFloat('hero','🔆 Zorn','#ffd24a'); }
    }
    // Boss-Dornen reflektieren
    if(hasMech(fight,'dornen')){
      const refl = Math.max(1, Math.round(dmg*0.15));
      fight.heroHp = Math.max(0, fight.heroHp - refl);
      mechFloat('hero', '🌵 -'+refl, '#9acd32');
    }
    // Reflexion: stärkere Schadens-Spiegelung als Dornen.
    if(hasMech(fight,'reflexion')){
      const refl = Math.max(1, Math.round(dmg*0.25));
      fight.heroHp = Math.max(0, fight.heroHp - refl);
      mechFloat('hero', '🪞 -'+fmtBig(refl), '#b6d0ff');
    }
    // Helden-Dornen-Affix reflektiert an Boss
    if(fight.thorns > 0){ fight.bossHp = Math.max(0, fight.bossHp - fight.thorns); fight.dmgDealt += fight.thorns; }
  }
  if(fight.curseTurns > 0) fight.curseTurns--;
  if(fight.invulnTurns > 0) fight.invulnTurns--;
  updateMeter(fight);
  if(fight.bossHp <= 0){ return endFight(fight, true); }

  // --- Boss schlägt zurück ---
  setTimeout(()=>{
    if(fight.over) return;

    // Betäubung (Donnerknall / Nebelschritt): Der Boss setzt seinen Angriff aus.
    if(Date.now() < (fight.bossStunUntil||0)){
      mechFloat('boss', '😵 Betäubt', '#7fd0ff');
      updateHpBars(fight);
      if(fight.bossHp <= 0){ return endFight(fight, true); }
      scheduleExchange(fight);
      return;
    }

    if(fight.shieldTurns > 0) fight.shieldTurns--;
    if(hasMech(fight,'eispanzer') && fight.turn % 5 === 0){ fight.shieldTurns = 2; mechFloat('boss','🛡️ Eispanzer','#7fd0ff'); }
    if(hasMech(fight,'schildphase') && fight.turn % 6 === 0){ fight.invulnTurns = 2; mechFloat('boss','✨ Schildphase','#9ec5ff'); addCombatLog(fight,'✨ Boss wird unverwundbar!','#9ec5ff'); }
    if(hasMech(fight,'regen') && fight.turn % 3 === 0){
      const heal = Math.round(fight.bossMaxHp*0.04);
      fight.bossHp = Math.min(fight.bossMaxHp, fight.bossHp + heal);
      mechFloat('boss', '➕'+fmtBig(heal), '#37d67a'); updateHpBars(fight);
    }
    if(hasMech(fight,'berserk')) fight.berserkMult *= 1.03;
    if(hasMech(fight,'add_spawn') && fight.turn % 6 === 0){ fight.adds++; mechFloat('boss','👹 Diener +'+fight.adds,'#d28bff'); }
    if(hasMech(fight,'fluch') && fight.turn % 4 === 0){ fight.curseTurns = 3; mechFloat('hero','🟣 Fluch','#a335ee'); }
    if(hasMech(fight,'teilung') && !fight.teilungDone && fight.bossHp < fight.bossMaxHp*0.5){
      fight.teilungDone = true; fight.berserkMult *= 1.5; mechFloat('boss','➗ Teilung!','#ffd24a'); addCombatLog(fight,'➗ Der Boss teilt sich – Angriff stark erhöht!','#ffd24a');
    }
    // Auszehrung: senkt periodisch die maximale HP des Helden (zermürbt im langen Kampf).
    if(hasMech(fight,'auszehrung') && fight.turn % 3 === 0){
      const cut = Math.max(1, Math.round(fight.heroMaxHp*0.03));
      fight.heroMaxHp = Math.max(1, fight.heroMaxHp - cut);
      fight.heroHp = Math.min(fight.heroHp, fight.heroMaxHp);
      mechFloat('hero', '🦴 Auszehrung', '#c9b6a0');
    }

    // Boss-Angriff berechnen
    let atk = fight.bossAtkBase * fight.berserkMult;
    if(hasMech(fight,'wut') && fight.bossHp < fight.bossMaxHp*0.3) atk *= 1.5;
    if(hasMech(fight,'hinrichtung') && fight.heroHp < fight.heroMaxHp*0.25) atk *= 2;
    if(hasMech(fight,'eskalation')) atk *= 1 + (1 - fight.bossHp/fight.bossMaxHp)*0.8;
    if(fight.adds > 0) atk *= 1 + fight.adds*0.08;
    // Soft-Enrage (#7): erzwingt Mindest-DPS
    const enrageTurn = hasMech(fight,'enrage') ? COMBAT.hardEnrageTurn : COMBAT.enrageTurn;
    const enrageRamp = hasMech(fight,'enrage') ? COMBAT.hardEnrageRamp : COMBAT.enrageRamp;
    if(fight.turn > enrageTurn){
      fight.enrageMult *= enrageRamp;
      if(fight.turn === enrageTurn+1){ mechFloat('boss','⏱️ ENRAGE!','#ff3b3b'); addCombatLog(fight,'⏱️ ENRAGE! Der Boss wird mit jeder Runde tödlicher.','#ff3b3b'); }
    }
    atk *= fight.enrageMult;

    const bossCrit = Math.random() < COMBAT.bossCritChance;
    let mult = bossCrit ? 2 : 1, ignoreArmor = false, breath = false;
    if(hasMech(fight,'feueratem') && fight.turn % 4 === 0){ mult *= 2.2; ignoreArmor = true; breath = true; }

    // Ausweichen-Affix (#20)
    if(Math.random() < fight.dodge){
      mechFloat('hero','💨 Ausweichen','#9ec5ff');
    } else {
      const armorRed = ignoreArmor ? 0 : (fight.heroArmor*COMBAT.armorReduction + fight.heroBlock);
      let bd = Math.max(1, Math.round((atk * rnd(0.15) * mult) - armorRed));
      bd = Math.round(bd * (1 - fight.versatility));   // Vielseitigkeit senkt erlittenen Schaden
      // Schadensreduktions-Buff (Schildwall / Trotzschlag / Unbeugsam …).
      if(Date.now() < fight.buffs.dmgReduce.until){ bd = Math.max(1, Math.round(bd * (1 - fight.buffs.dmgReduce.val))); }
      if(Date.now() < (fight.bossVulnUntil||0)){ /* Verwundbarkeit betrifft nur Boss-Schaden, nicht Helden */ }
      // Avatar-Buff (dmgReduce-Anteil) läuft über buffs.dmgReduce → bereits abgedeckt.
      const dmgToHero = applyIncomingDamage(fight, bd);   // Absorb-Schild & Reflexion
      if(breath) mechFloat('boss', '🔥 Feueratem', '#ff8a3d');
      attackAnim('boss', dmgToHero, bossCrit, ()=> updateHpBars(fight));
      if(hasMech(fight,'lebensentzug')){
        const heal = Math.round(bd*0.4);
        fight.bossHp = Math.min(fight.bossMaxHp, fight.bossHp + heal);
        mechFloat('boss', '🩸+'+fmtBig(heal), '#37d67a');
      }
    }
    if(hasMech(fight,'ruestungsbruch') && fight.heroArmor > 0){
      fight.heroArmor = Math.max(0, fight.heroArmor - Math.max(1, Math.round(fight.heroArmorBase*0.05)));
      mechFloat('hero', '🔨 Rüstung', '#c0653a');
    }
    if(hasMech(fight,'gift')){
      fight.poison++;
      const dot = 2*fight.poison;
      fight.heroHp = Math.max(0, fight.heroHp - dot);
      mechFloat('hero', '☠️-'+dot, '#9b59b6');
    }
    if(hasMech(fight,'verbrennung')){
      fight.burn++;
      const dot = Math.max(1, Math.round(fight.heroMaxHp*0.012*fight.burn));
      fight.heroHp = Math.max(0, fight.heroHp - dot);
      mechFloat('hero', '🔥-'+fmtBig(dot), '#ff5a2a');
    }
    if(hasMech(fight,'frost') && fight.turn % 3 === 0){ fight.frostTurns = 2; mechFloat('boss','❄️ Frost','#7fd0ff'); }

    // Todesrettung (Engelsgeist / Letzter Wall / Seelenstein): einmaliger Rettungs-
    // anker, fängt jeden tödlichen Schaden im Fenster ab.
    if(fight.heroHp <= 0 && Date.now() < (fight.deathSaveUntil||0)){
      fight.heroHp = Math.max(1, fight.reviveHp||1);
      fight.deathSaveUntil = 0;
      mechFloat('hero', '✨ Gerettet!', '#ffe9a8');
      addCombatLog(fight, '✨ Eine schützende Macht bewahrt dich vor dem Tod!', '#ffe9a8');
      screenFlash('#ffe9a8', 200); vfxHeal('heroSprite');
    }
    updateHpBars(fight);
    if(fight.heroHp <= 0){ return endFight(fight, false); }
    scheduleExchange(fight);
  }, COMBAT.bossReplyMs / combatSpeed);
}

// Eingehenden Boss-Schaden verarbeiten: Reflexion zurück an den Boss, dann
// Absorb-Schild abtragen; gibt den tatsächlich an den Helden gehenden Schaden zurück.
function applyIncomingDamage(f, bd){
  const now = Date.now();
  if(now < f.buffs.reflect.until && f.buffs.reflect.val > 0){
    const refl = Math.max(1, Math.round(bd * f.buffs.reflect.val));
    f.bossHp = Math.max(0, f.bossHp - refl); f.dmgDealt += refl;
    mechFloat('boss', '🪞 -'+fmtBig(refl), '#b6d0ff');
  }
  let dmg = bd;
  if(now < (f.shieldUntil||0) && f.heroShield > 0){
    const soak = Math.min(f.heroShield, dmg);
    f.heroShield -= soak; dmg -= soak;
    if(soak > 0) mechFloat('hero', '🛡 -'+fmtBig(soak), '#bfe3ff');
    if(f.heroShield <= 0){ f.heroShield = 0; f.shieldUntil = 0; }
  }
  f.heroHp = Math.max(0, f.heroHp - dmg);
  return dmg;
}

export function updateHpBars(f){
  $('#heroHp').style.width = (f.heroHp / f.heroMaxHp * 100)+'%';
  $('#bossHp').style.width = (f.bossHp / f.bossMaxHp * 100)+'%';
  $('#heroHpText').textContent = fmtBig(Math.ceil(f.heroHp))+' / '+fmtBig(f.heroMaxHp)+' HP';
  $('#bossHpText').textContent = fmtBig(Math.ceil(f.bossHp))+' / '+fmtBig(f.bossMaxHp)+' HP';
}

// ---- Animationen ----------------------------------------------------
const HIT_DELAY=150, FLASH=240, SHAKE=240, FLOAT=1000;
function lunge(el, isBoss){
  const base = isBoss ? 'scaleX(-1) ' : '';
  // Deutlicher Schwung: Vorwärts-Stoß kombiniert mit einer Drehung der Figur.
  el.animate(
    [ { transform: base+'translateX(0) rotate(0deg)' },
      { transform: base+'translateX(58px) rotate(-18deg)', offset:0.35 },
      { transform: base+'translateX(64px) rotate(12deg)', offset:0.55 },
      { transform: base+'translateX(0) rotate(0deg)' } ],
    { duration: 220 / combatSpeed, easing:'ease-out' }
  );
}
// Stab-Cast: Held lehnt sich deutlich nach vorne und hält den Stab dem Boss entgegen.
function staffCast(el){
  el.animate(
    [ { transform:'translateX(0) rotate(0deg)' },
      { transform:'translateX(40px) rotate(-9deg)', offset:0.35 },
      { transform:'translateX(34px) rotate(-7deg)', offset:0.7 },
      { transform:'translateX(0) rotate(0deg)' } ],
    { duration: 340 / combatSpeed, easing:'ease-out' }
  );
}
function mechFloat(who, text, color){
  const targetId = who==='hero' ? 'heroSprite' : 'bossSprite';
  const stage = $('#arenaStage');
  const a = (currentFight && currentFight.anchor[targetId]) || { x: stage.clientWidth/2, y: stage.clientHeight/2 };
  const num = document.createElement('div');
  num.className = 'dmg-num'; num.style.color = color || '#fff'; num.style.fontSize = '15px';
  num.textContent = text;
  num.style.left = (a.x-24)+'px'; num.style.top = (a.y-34)+'px';
  $('#dmgLayer').appendChild(num);
  setTimeout(()=> num.remove(), FLOAT / combatSpeed);
}

// Prägnante Effekt-Beschreibung einer Fähigkeit (für Knopf + Floating-Text).
export function abilityEffectShort(a){
  if(!a) return '';
  const pct = v => Math.round((v||0)*100);
  const s = a.dur ? ' ('+Math.round(a.dur/1000)+'s)' : '';
  switch(a.kind){
    case 'heal':      return '+'+pct(a.healPct)+'% HP';
    case 'burst':     return pct(a.burstMult)+'% Schaden';
    case 'drain':     return a.dur ? pct(a.burstMult)+'% Schaden/s +Lebensraub'+s
                                   : pct(a.burstMult)+'% Schaden +Lebensraub';
    case 'critBoost': return '+'+pct(a.critBonus)+'% Krit'+s;
    case 'dmgBoost':  return '+'+pct(a.dmgBonus)+'% Schaden'+s;
    case 'dmgReduce': return '−'+pct(a.dmgReduce)+'% erlittener Schaden'+s;
    case 'lifesteal': return '+'+pct(a.lifestealBonus)+'% Lebensraub'+s;
    case 'healBurst': return '+'+pct(a.healPct)+'% HP · '+pct(a.burstMult)+'% Schaden';
    case 'stun':      return pct(a.burstMult)+'% Schaden · Betäubt '+Math.round((a.stunDur||4000)/1000)+'s';
    case 'vanish':    return 'Unsichtbar '+Math.round((a.dur||5000)/1000)+'s, dann Überfall '+pct(a.ambushMult)+'%';
    case 'summon':    return '+'+pct(a.petBonus)+'% Schaden ('+Math.round((a.petDur||10000)/1000)+'s)';
    case 'dot':       return pct(a.dotMult)+'% Schaden/s ('+Math.round((a.dur||0)/1000)+'s)';
    case 'hot':       return '+'+pct(a.hotPct)+'% HP/s ('+Math.round((a.dur||0)/1000)+'s)';
    case 'absorb':    return 'Schild '+pct(a.absorbPct)+'% HP ('+Math.round((a.dur||0)/1000)+'s)';
    case 'cleanse':   return 'Reinigt · +'+pct(a.healPct)+'% HP';
    case 'deathsave': return 'Überlebt Tod ('+Math.round((a.dur||0)/1000)+'s)';
    case 'reflect':   return 'Reflektiert '+pct(a.reflectPct)+'% ('+Math.round((a.dur||0)/1000)+'s)';
    case 'vulnerability': return 'Gegner +'+pct(a.vulnPct)+'% Schaden ('+Math.round((a.dur||0)/1000)+'s)';
    case 'avatar':    return '+'+pct(a.dmgBonus)+'% Schaden · −'+pct(a.dmgReduce)+'% erlitten';
  }
  return '';
}

// Beim Aktivieren kurz Name + Effekt als aufsteigender Text über dem Helden.
function abilityCastFloat(ab){
  if(!ab) return;
  const stage = $('#arenaStage'); if(!stage) return;
  const anc = (currentFight && currentFight.anchor.heroSprite) || { x: stage.clientWidth/4, y: stage.clientHeight/2 };
  const eff = abilityEffectShort(ab);
  const el = document.createElement('div');
  el.className = 'ability-cast-float';
  el.innerHTML = '<span class="acf-name">'+ab.icon+' '+ab.name+'</span>'+
                 (eff ? '<span class="acf-eff">'+eff+'</span>' : '');
  el.style.left = anc.x+'px';
  el.style.top  = (anc.y-58)+'px';
  const layer = $('#dmgLayer'); if(layer) layer.appendChild(el);
  setTimeout(()=> el.remove(), 1500);
}

function heroUsesStab(){
  const w = state.equipped && state.equipped.waffe;
  return !!(w && materialOf(w) === 'zauberstab');
}

function staffProjectileAnim(fromAnchor, toAnchor, layer, speed, orb, onArrive){
  const ball = document.createElement('div');
  ball.className = 'staff-projectile orb-' + (orb || 'rot');
  ball.style.left = fromAnchor.x + 'px';
  ball.style.top  = (fromAnchor.y - 10) + 'px';
  layer.appendChild(ball);
  const dx = toAnchor.x - fromAnchor.x;
  const dy = toAnchor.y - fromAnchor.y;
  const dur = Math.max(80, 220 / speed);
  ball.animate(
    [ { transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:`translate(${dx}px,${dy}px) scale(0.4)`, opacity:0.6 } ],
    { duration: dur, easing:'ease-in', fill:'forwards' }
  );
  setTimeout(()=>{ ball.remove(); if(onArrive) onArrive(); }, dur);
}

function attackAnim(who, dmg, crit, onHit){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isHero = who==='hero';
  const attacker = isHero ? $('#heroSprite') : $('#bossSprite');
  const target   = isHero ? $('#bossSprite') : $('#heroSprite');
  const targetId = isHero ? 'bossSprite' : 'heroSprite';
  const heroId   = isHero ? 'heroSprite' : 'bossSprite';
  const stage = $('#arenaStage');
  const layer = $('#dmgLayer');
  // Kampf-Animationen (Schwung, Stab-Cast, Projektil) laufen unabhängig von
  // prefers-reduced-motion – nur das ruckartige Screen-Shake respektiert die Einstellung.
  const useProjectile = isHero && heroUsesStab();

  if(!useProjectile){ lunge(attacker, !isHero); }
  else { staffCast(attacker); }

  const doHit = () => {
    if(onHit) onHit();
    target.classList.add('hit');
    setTimeout(()=> target.classList.remove('hit'), FLASH / combatSpeed);
    if(!reduce && (crit || Math.random()<.5)){ stage.classList.add('shake');
      setTimeout(()=> stage.classList.remove('shake'), SHAKE / combatSpeed); }
    const a = (currentFight && currentFight.anchor[targetId]) || { x: stage.clientWidth/2, y: stage.clientHeight/2 };
    const jitter = Math.round((Math.random()*2-1)*12);
    const x = a.x + jitter, y = a.y;
    if(!useProjectile){
      const slash = document.createElement('div');
      slash.className = 'slash'; slash.style.left=(x-45)+'px'; slash.style.top=(y-45)+'px';
      layer.appendChild(slash);
      setTimeout(()=> slash.remove(), FLOAT / combatSpeed);
    }
    const num = document.createElement('div');
    num.className = 'dmg-num' + (crit?' crit':'') + (isHero ? '' : ' incoming');
    num.textContent = '-'+fmtBig(dmg)+(crit?'!':'');
    num.style.left=(x-10)+'px'; num.style.top=y+'px';
    layer.appendChild(num);
    setTimeout(()=> num.remove(), FLOAT / combatSpeed);
  };

  if(useProjectile){
    const from = (currentFight && currentFight.anchor[heroId]) || { x: stage.clientWidth/4, y: stage.clientHeight/2 };
    const to   = (currentFight && currentFight.anchor[targetId]) || { x: stage.clientWidth*3/4, y: stage.clientHeight/2 };
    const orb  = (state.equipped && state.equipped.waffe && typeOf(state.equipped.waffe).orb) || 'rot';
    staffProjectileAnim(from, to, layer, combatSpeed, orb, doHit);
  } else {
    setTimeout(doHit, HIT_DELAY / combatSpeed);
  }
}

// ---- Heiltrank im Kampf --------------------------------------------
export function updatePotionBtn(){
  const btn = $('#potionBtn'); if(!btn) return;
  btn.style.display = '';   // im Duell ausgeblendet → für PvE-Bosskampf wieder zeigen
  const n = state.potions || 0;
  btn.textContent = '🧪 Heiltrank ('+n+')';
  btn.disabled = n <= 0 || !currentFight || currentFight.over;
  btn.style.opacity = btn.disabled ? '0.5' : '1';
}
export function usePotion(){
  const f = currentFight;
  if(f && f.isDuel) return;   // Heiltränke sind im Duell deaktiviert
  if(!f || f.over || (state.potions||0) <= 0) return;
  if(f.heroHp >= f.heroMaxHp){ toast('Bereits volle HP'); return; }
  const heal = Math.round(f.heroMaxHp * HEAL_PCT * f.healDebuff);
  f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
  state.potions--; saveState();
  updateHpBars(f);
  mechFloat('hero', '💚 +'+fmtBig(heal), '#37d67a');
  updatePotionBtn();
  // Inventar/Verbrauch sofort aktualisieren (Trank-Anzahl sinkt direkt sichtbar).
  renderAll();
}

// ---- Aktive Fähigkeiten (Grundfähigkeit + geskillte Talent-Aktive) -
// Buff-Fenster: jedes mit { until, val }. Eine Quelle für PvE + Duell.
function freshBuffs(){
  return { crit:{until:0,val:0}, dmgBoost:{until:0,val:0},
           dmgReduce:{until:0,val:0}, lifesteal:{until:0,val:0},
           reflect:{until:0,val:0} };
}
let _abilityTicker = null;
// Mehrere Fähigkeits-Knöpfe rendern/aktualisieren (eigener Cooldown je Knopf).
export function updateAbilityBtns(){
  const bar = $('#abilityBar'); if(!bar) return;
  const f = currentFight;
  // PvE-Bosskampf: Fähigkeitsliste live aus dem aktuellen Talent-Stand ableiten,
  // damit ein per Respec gelernter/verlernter Aktiv-Skill seinen Knopf sofort
  // bekommt bzw. verliert. Duell/Turm nutzen ihre eigene (gesyncte) Liste.
  if(f && !f.isDuel) f.abilities = abilitiesOf(state);
  const abilities = (f && f.abilities) || [];
  if(!abilities.length){ bar.innerHTML = ''; bar.dataset.ids = ''; bar.style.display = 'none'; return; }
  bar.style.display = '';
  const ids = abilities.map(a => a.id).join(',');
  if(bar.dataset.ids !== ids){
    bar.dataset.ids = ids;
    bar.innerHTML = abilities.map(a => {
      const eff = abilityEffectShort(a);
      const tip = ((a.desc||'') + (a.cd ? ' · CD '+Math.round(a.cd/1000)+'s' : '')).replace(/"/g,'&quot;');
      return '<button class="btn ghost ability-btn" data-ability-id="'+a.id+'" title="'+tip+'">'+
        '<span class="ab-head">'+a.icon+' '+a.name+'</span>'+
        (eff ? '<span class="ab-eff">'+eff+'</span>' : '')+
        '<span class="ab-cd"></span>'+
      '</button>';
    }).join('');
  }
  const now = Date.now();
  abilities.forEach(a => {
    const btn = bar.querySelector('[data-ability-id="'+a.id+'"]'); if(!btn) return;
    const cd = Math.max(0, Math.ceil(((f.abilityCd[a.id]||0) - now)/1000));
    const ready = !f.over && cd <= 0;
    btn.disabled = !ready;
    btn.style.opacity = ready ? '1' : '0.5';
    btn.classList.toggle('on-cd', cd>0);
    const cdEl = btn.querySelector('.ab-cd');
    if(cdEl) cdEl.textContent = cd>0 ? cd+'s' : '';
  });
}
// Alias für bestehende Aufrufstellen.
export function updateAbilityBtn(){ updateAbilityBtns(); }

// Persistente Buff-Signaturen am Helden je nach laufendem Buff-Fenster (PvE).
function refreshAuras(f){
  if(!f || !f.buffs) return;
  const now = Date.now();
  applyBuffAura('heroSprite', 'crit',      f.buffs.crit,      now);
  applyBuffAura('heroSprite', 'dmgBoost',  f.buffs.dmgBoost,  now);
  applyBuffAura('heroSprite', 'lifesteal', f.buffs.lifesteal, now);
  applyDefenseAura('heroSprite', f.buffs.dmgReduce, now);
  // Nebelschritt: solange das Fenster läuft, ist der Held vollständig unsichtbar.
  setSpriteClass('heroSprite', 'vanished', now < (f.stealthUntil||0));
  // Teufelswache: Dämon bleibt sichtbar, solange das Fenster läuft.
  applyDemonAura('heroSprite', now < (f.petEndUntil||0));
  // Talent-Aktive: Absorb-Schild-Kuppel, Reflexions-Glühen, Todesrettungs-Schein, Gegner-Verwundbarkeit.
  if(now < (f.shieldUntil||0) && f.heroShield > 0){ if(!$('#absorbDome')) spawnShieldDome('heroSprite', 'absorbDome', 1); }
  else removeShieldDome('absorbDome');
  setSpriteClass('heroSprite', 'reflect-glow', now < f.buffs.reflect.until);
  setSpriteClass('heroSprite', 'deathsave-glow', now < (f.deathSaveUntil||0));
  setSpriteClass('bossSprite', 'vuln-tint', now < (f.bossVulnUntil||0));
}
function startAbilityTicker(){
  if(_abilityTicker) return;
  _abilityTicker = setInterval(()=>{
    const f = currentFight;
    if(!f){ stopAbilityTicker(); return; }
    if(!f.isDuel) refreshAuras(f);
    updateAbilityBtns();
  }, 250);
}
function stopAbilityTicker(){ if(_abilityTicker){ clearInterval(_abilityTicker); _abilityTicker = null; } }
function resetAbilityVisuals(){
  const auraCls = ['ablaze','aura-crit','aura-fire','aura-blood','aura-shadow','aura-shield',
                   'aura-steel','aura-arcane','aura-blood-strong','stealth','vanished','freeze','desat',
                   'reflect-glow','deathsave-glow','vuln-tint'];
  ['heroSprite','bossSprite'].forEach(id => { const el = $('#'+id); if(el) el.classList.remove(...auraCls); });
  removeShieldDome();
  removeShieldDome('shieldDomeOpp');
  removeShieldDome('absorbDome');
  removeShieldDome('absorbDomeOpp');
  const layer = $('#dmgLayer');
  if(layer) layer.querySelectorAll('.vfx-orbit, .vfx-rune-ring, .vfx-demon').forEach(n => n.remove());
  stopDrainChannel();
  stopAbilityTicker();
}

// Fähigkeitsschaden: skaliert mit heroAtk (inkl. Schadens-/Magie-Stats & Vielseitigkeit)
// und kann mit der Krit-Chance/-Stärke des Helden kritten – bei Magiern zählt der Magie-Krit
// (z. B. von der Nebenhand-Kugel). Fluch halbiert die Krit-Chance, Krit-Buff erhöht sie.
function abilityDamage(f, mult){
  const now = Date.now();
  let crit = f.heroCritChance * (f.curseTurns>0 ? 0.5 : 1);
  if(now < f.buffs.crit.until) crit = Math.min(1, crit + f.buffs.crit.val);
  const isCrit = Math.random() < crit;
  let petMult = (now < (f.petEndUntil||0)) ? (1 + (f.petBonus||0)) : 1;   // Teufelswache verstärkt auch Fähigkeitsschaden
  let vulnMult = (now < (f.bossVulnUntil||0)) ? (1 + (f.bossVulnVal||0)) : 1;   // Schildwurf: Gegner verwundbar
  return { dmg: Math.max(1, Math.round(f.heroAtk * mult * petMult * vulnMult * (isCrit ? f.heroCritMult : 1))), crit:isCrit };
}

// Wendet den Effekt einer Fähigkeit lokal im PvE-Kampf an (Held → Boss).
function applyAbilityEffect(f, ab){
  const now = Date.now();
  const magic = classOf(state).damageSchool === 'magisch';
  const healMult = classOf(state).healMult || 1;
  if(ab.kind === 'heal'){
    // Heilkreis skaliert mit der Heilwirkung der Klasse (Heiler ×1,6 usw.).
    const heal = Math.round(f.heroMaxHp * ab.healPct * healMult * f.healDebuff);
    f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
    updateHpBars(f);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '➕ +'+fmtBig(heal), '#37d67a');
    addCombatLog(f, ab.icon+' '+ab.name+': +'+fmtBig(heal)+' HP', '#37d67a');
  } else if(ab.kind === 'burst' || ab.kind === 'drain'){
    // Kanalisierter Seelenraub (Hexer-Grundfähigkeit): Lebensentzug über mehrere
    // Sekunden statt eines Einzeltreffers. Talent-Drains (ohne `dur`) bleiben sofort.
    if(ab.kind === 'drain' && ab.dur){ startDrainChannel(f, ab); return; }
    const { dmg, crit } = abilityDamage(f, ab.burstMult);
    f.bossHp = Math.max(0, f.bossHp - dmg);
    f.dmgDealt += dmg;
    if(ab.kind === 'drain'){
      // Selbstheilung skaliert mit der Heilwirkung (Hexer ×1,5).
      const heal = Math.round(dmg * healMult * (f.healDebuff||1));
      f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
      mechFloat('hero', '🩸 +'+fmtBig(heal), '#e0466e');
    }
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('boss', (crit?'✸ ':'💥 ')+'-'+fmtBig(dmg), '#ffd24a');
    updateHpBars(f); updateMeter(f);
    addCombatLog(f, ab.icon+' '+ab.name+': '+(crit?'KRIT ':'')+fmtBig(dmg)+' Schaden'+(ab.kind==='drain'?' (+Heilung)':''), '#ffd24a');
    if(f.bossHp <= 0){ endFight(f, true); return; }
  } else if(ab.kind === 'critBoost'){
    f.buffs.crit = { until: now+ab.dur, val: ab.critBonus, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – +'+Math.round(ab.critBonus*100)+'% Krit für '+(ab.dur/1000)+'s!', '#ffd24a');
  } else if(ab.kind === 'dmgBoost'){
    f.buffs.dmgBoost = { until: now+ab.dur, val: ab.dmgBonus, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – +'+Math.round(ab.dmgBonus*100)+'% Schaden für '+(ab.dur/1000)+'s!', '#ff8a3d');
  } else if(ab.kind === 'dmgReduce'){
    f.buffs.dmgReduce = { until: now+ab.dur, val: ab.dmgReduce, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – '+Math.round(ab.dmgReduce*100)+'% weniger Schaden für '+(ab.dur/1000)+'s!', '#7fd0ff');
  } else if(ab.kind === 'lifesteal'){
    f.buffs.lifesteal = { until: now+ab.dur, val: ab.lifestealBonus, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – +'+Math.round(ab.lifestealBonus*100)+'% Lebensraub für '+(ab.dur/1000)+'s!', '#e0466e');
  } else if(ab.kind === 'healBurst'){
    // Lichtsäule (Heiler): heilt alle Helden UND verbrennt den Gegner.
    const heal = Math.round(f.heroMaxHp * ab.healPct * healMult * f.healDebuff);
    f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
    const { dmg, crit } = abilityDamage(f, ab.burstMult);
    f.bossHp = Math.max(0, f.bossHp - dmg); f.dmgDealt += dmg;
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '➕ +'+fmtBig(heal), '#37d67a');
    mechFloat('boss', (crit?'✸ ':'💥 ')+'-'+fmtBig(dmg), '#ffe9a8');
    updateHpBars(f); updateMeter(f);
    addCombatLog(f, ab.icon+' '+ab.name+': +'+fmtBig(heal)+' HP, '+(crit?'KRIT ':'')+fmtBig(dmg)+' Schaden', '#ffe9a8');
    if(f.bossHp <= 0){ endFight(f, true); return; }
  } else if(ab.kind === 'stun'){
    // Donnerknall (Verteidiger): Schaden + Betäubung des Gegners.
    const { dmg, crit } = abilityDamage(f, ab.burstMult);
    f.bossHp = Math.max(0, f.bossHp - dmg); f.dmgDealt += dmg;
    f.bossStunUntil = now + (ab.stunDur||4000);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('boss', (crit?'✸ ':'💥 ')+'-'+fmtBig(dmg), '#ffd24a');
    updateHpBars(f); updateMeter(f);
    addCombatLog(f, ab.icon+' '+ab.name+': '+(crit?'KRIT ':'')+fmtBig(dmg)+' Schaden – Boss '+(ab.stunDur/1000)+'s betäubt!', '#7fd0ff');
    if(f.bossHp <= 0){ endFight(f, true); return; }
  } else if(ab.kind === 'vanish'){
    // Nebelschritt (Schurke): vollständig unsichtbar – Gegner kann nicht sehen/angreifen,
    // der Held greift in der Zeit NICHT an. Beim Wiederauftauchen ein garantierter Krit-Überfall.
    f.bossStunUntil = now + ab.dur;
    f.stealthUntil  = now + ab.dur;
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);   // Rauchwolke / Verschwinden
    addCombatLog(f, ab.icon+' '+ab.name+' – du verschwindest im Nebel! Der Gegner ist '+(ab.dur/1000)+'s blind.', '#b6a0ff');
    scheduleNebelAmbush(f, ab);
  } else if(ab.kind === 'summon'){
    // Teufelswache (Hexer): beschworener Dämon erhöht den Schaden über die Dauer.
    f.petEndUntil = now + (ab.petDur||10000);
    f.petBonus    = ab.petBonus||0.25;
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '👹 Teufelswache!', '#9b30ff');
    addCombatLog(f, ab.icon+' '+ab.name+' – eine Teufelswache kämpft '+(ab.petDur/1000)+'s an deiner Seite (+'+Math.round((ab.petBonus||0.25)*100)+'% Schaden).', '#9b30ff');
  } else if(ab.kind === 'dot'){
    // Vergiftete Klingen / Aderlass: Schaden über Zeit am Gegner (keine Selbstheilung).
    startDotChannel(f, ab);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – '+Math.round(ab.dotMult*100)+'% Schaden/s für '+(ab.dur/1000)+'s.', '#9acd32');
  } else if(ab.kind === 'hot'){
    // Verjüngung: Heilung über Zeit.
    startHotChannel(f, ab);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – Heilung über '+(ab.dur/1000)+'s.', '#37d67a');
  } else if(ab.kind === 'absorb'){
    // Schutzschild: Absorb-Schild.
    f.heroShield = Math.round(f.heroMaxHp * (ab.absorbPct||0.4));
    f.shieldUntil = now + (ab.dur||10000);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '🛡 +'+fmtBig(f.heroShield), '#bfe3ff');
    addCombatLog(f, ab.icon+' '+ab.name+' – Schild absorbiert '+fmtBig(f.heroShield)+' Schaden.', '#bfe3ff');
  } else if(ab.kind === 'cleanse'){
    // Reinigung: entfernt einen Schwäche-Effekt + Heilung.
    cleanseDebuffs(f);
    const heal = Math.round(f.heroMaxHp * (ab.healPct||0.25) * healMult * f.healDebuff);
    f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
    updateHpBars(f);
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '💧 +'+fmtBig(heal), '#bfe3ff');
    addCombatLog(f, ab.icon+' '+ab.name+' – Schwäche entfernt, +'+fmtBig(heal)+' HP.', '#bfe3ff');
  } else if(ab.kind === 'deathsave'){
    // Engelsgeist / Letzter Wall / Seelenstein: Rettungsanker.
    f.deathSaveUntil = now + (ab.dur||10000);
    f.reviveHp = Math.round(f.heroMaxHp * (ab.revivePct||0.3));
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    mechFloat('hero', '✨ Schutz', '#ffe9a8');
    addCombatLog(f, ab.icon+' '+ab.name+' – überlebt '+(ab.dur/1000)+'s lang den Tod.', '#ffe9a8');
  } else if(ab.kind === 'reflect'){
    // Vergeltung: Schadensreflexion.
    f.buffs.reflect = { until: now + ab.dur, val: ab.reflectPct||0.4, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – reflektiert '+Math.round((ab.reflectPct||0.4)*100)+'% Schaden für '+(ab.dur/1000)+'s.', '#b6d0ff');
  } else if(ab.kind === 'vulnerability'){
    // Schildwurf: Gegner verwundbar + optionaler Sofortschaden.
    f.bossVulnUntil = now + ab.dur; f.bossVulnVal = ab.vulnPct||0.3;
    if(ab.burstMult){ const { dmg, crit } = abilityDamage(f, ab.burstMult); f.bossHp = Math.max(0, f.bossHp - dmg); f.dmgDealt += dmg; mechFloat('boss', (crit?'✸ ':'💥 ')+'-'+fmtBig(dmg), '#ffd24a'); }
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    updateHpBars(f); updateMeter(f);
    addCombatLog(f, ab.icon+' '+ab.name+' – Gegner erleidet +'+Math.round((ab.vulnPct||0.3)*100)+'% Schaden für '+(ab.dur/1000)+'s.', '#ff8a3d');
    if(f.bossHp <= 0){ endFight(f, true); return; }
  } else if(ab.kind === 'avatar'){
    // Avatar des Wächters: Schaden-Buff UND Schadensreduktion gleichzeitig.
    f.buffs.dmgBoost  = { until: now + ab.dur, val: ab.dmgBonus||0.4, src: ab.id };
    f.buffs.dmgReduce = { until: now + ab.dur, val: ab.dmgReduce||0.4, src: ab.id };
    playAbilityVfx(ab, 'heroSprite', 'bossSprite', magic);
    addCombatLog(f, ab.icon+' '+ab.name+' – +'+Math.round((ab.dmgBonus||0.4)*100)+'% Schaden & −'+Math.round((ab.dmgReduce||0.4)*100)+'% erlittener Schaden für '+(ab.dur/1000)+'s!', '#ffd24a');
  }
  refreshAuras(f);
}

// DoT am Boss (Gift/Blutung): tickt dotMult·Atk Schaden über die Dauer (keine Heilung).
function startDotChannel(f, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||5000) / tickMs));
  const glyph = ab.id && ab.id.indexOf('gift') >= 0 ? '☠️' : '🩸';
  const col   = glyph === '☠️' ? '#9acd32' : '#e0466e';
  let i = 0;
  const tick = () => {
    if(currentFight !== f || f.over) return;
    const { dmg } = abilityDamage(f, ab.dotMult);
    f.bossHp = Math.max(0, f.bossHp - dmg); f.dmgDealt += dmg;
    mechFloat('boss', glyph+' -'+fmtBig(dmg), col);
    spawnParticles('bossSprite', { count:5, glyph, color:col, spread:38, rise:18 });
    updateHpBars(f); updateMeter(f);
    if(f.bossHp <= 0){ endFight(f, true); return; }
    if(++i < ticks) setTimeout(tick, tickMs / combatSpeed);
  };
  setTimeout(tick, tickMs / combatSpeed);
}
// HoT am Helden (Verjüngung): tickt hotPct·maxHp Heilung über die Dauer.
function startHotChannel(f, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round((ab.dur||8000) / tickMs));
  const healMult = classOf(state).healMult || 1;
  let i = 0;
  const tick = () => {
    if(currentFight !== f || f.over) return;
    const heal = Math.round(f.heroMaxHp * (ab.hotPct||0.08) * healMult * (f.healDebuff||1));
    f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
    mechFloat('hero', '🍃 +'+fmtBig(heal), '#37d67a');
    spawnParticles('heroSprite', { count:4, glyph:'✦', color:'#9dffc4', spread:34, rise:24 });
    updateHpBars(f);
    if(++i < ticks) setTimeout(tick, tickMs / combatSpeed);
  };
  setTimeout(tick, tickMs / combatSpeed);
}
// Reinigung: entfernt die aktiven Schwäche-Effekte vom Helden.
function cleanseDebuffs(f){
  f.curseTurns = 0; f.frostTurns = 0; f.poison = 0; f.burn = 0;
  f.healDebuff = 1;
}

// Nebelschritt-Überfall: nach Ablauf des Unsichtbarkeits-Fensters taucht der Held
// aus der Rauchwolke auf und landet einen garantierten kritischen Treffer.
function scheduleNebelAmbush(f, ab){
  const dur = ab.dur || 5000;
  setTimeout(()=>{
    if(currentFight !== f || f.over) return;
    f.stealthUntil = 0;                       // wieder sichtbar
    const petMult = (Date.now() < (f.petEndUntil||0)) ? (1 + (f.petBonus||0)) : 1;
    const dmg = Math.max(1, Math.round(f.heroAtk * (ab.ambushMult||4) * f.heroCritMult * petMult));
    f.bossHp = Math.max(0, f.bossHp - dmg); f.dmgDealt += dmg;
    if(ABILITY_VFX.nebelschritt_ambush) ABILITY_VFX.nebelschritt_ambush('heroSprite', 'bossSprite');
    mechFloat('boss', '✸ -'+fmtBig(dmg), '#ffd24a');
    addCombatLog(f, '💨 Überfall aus dem Nebel: KRIT '+fmtBig(dmg)+' Schaden!', '#ffd24a');
    updateHpBars(f); updateMeter(f); refreshAuras(f);
    if(f.bossHp <= 0){ endFight(f, true); }
  }, dur);
}

export function useAbility(abilityId){
  const f = currentFight;
  if(f && f.isDuel){
    if(f.over) return;
    const ab = (f.abilities||[]).find(a => a.id === abilityId);
    if(ab && Date.now() >= (f.abilityCd[abilityId]||0)){ f.onAction('ability:'+abilityId); abilityCastFloat(ab); }
    return;
  }
  if(!f || f.over) return;
  const ab = (f.abilities||[]).find(a => a.id === abilityId);
  if(!ab) return;
  if(Date.now() < (f.abilityCd[abilityId]||0)) return;
  f.abilityCd[abilityId] = Date.now() + ab.cd;
  abilityCastFloat(ab);
  applyAbilityEffect(f, ab);
  updateAbilityBtns();
  startAbilityTicker();
}

// Heil-Effekt: Lichtkern + Ring + aufsteigende Funken + kurzes grünes Aufleuchten.
function spawnHealCircle(spriteId){
  const stage = $('#arenaStage');
  const a = (currentFight && currentFight.anchor[spriteId]) || { x: stage.clientWidth/4, y: stage.clientHeight/2 };
  const fx = document.createElement('div');
  fx.className = 'heal-fx';
  fx.style.left = a.x+'px'; fx.style.top = a.y+'px';
  const core = document.createElement('div'); core.className = 'heal-core';
  const ring = document.createElement('div'); ring.className = 'heal-ring';
  fx.appendChild(core); fx.appendChild(ring);
  for(let i = 0; i < 6; i++){
    const p = document.createElement('div'); p.className = 'heal-particle';
    p.textContent = (i % 2) ? '✦' : '+';
    p.style.setProperty('--dx', Math.round((Math.random()*2 - 1) * 28) + 'px');
    p.style.animationDelay = (i * 70) + 'ms';
    fx.appendChild(p);
  }
  $('#dmgLayer').appendChild(fx);
  const hero = $('#'+spriteId);
  if(hero){ hero.classList.add('heal-glow'); setTimeout(()=> hero.classList.remove('heal-glow'), 1150); }
  setTimeout(()=> fx.remove(), 1250);
}
// Große magische Energiebarriere VOR einem Helden (bleibt bis Buff endet).
// dir = +1: Barriere rechts vom Sprite (Held Richtung Boss), -1: links (Boss Richtung Held).
function spawnShieldDome(spriteId, domeId = 'shieldDome', dir = 1){
  removeShieldDome(domeId);
  const stage = $('#arenaStage');
  const a = (currentFight && currentFight.anchor[spriteId]) || { x: stage.clientWidth/4, y: stage.clientHeight/2 };
  const bar = document.createElement('div');
  bar.className = 'magic-barrier'; bar.id = domeId;
  // Vor dem Helden in Richtung Gegner versetzt.
  bar.style.left = (a.x + 70 * dir)+'px'; bar.style.top = a.y+'px';
  $('#dmgLayer').appendChild(bar);
}
function removeShieldDome(domeId = 'shieldDome'){ const d = $('#'+domeId); if(d) d.remove(); }

// ====================================================================
//  SPEKTAKULÄRE AKTIV-EFFEKTE (VFX) – reines CSS+DOM, im #dmgLayer.
// ====================================================================
function reducedMotion(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function anchorOf(spriteId){
  const stage = $('#arenaStage');
  return (currentFight && currentFight.anchor[spriteId]) ||
         { x: stage ? stage.clientWidth/2 : 0, y: stage ? stage.clientHeight/2 : 0 };
}
function setSpriteClass(spriteId, cls, on){ const el = $('#'+spriteId); if(el) el.classList.toggle(cls, !!on); }
function flashSpriteClass(spriteId, cls, ms){
  const el = $('#'+spriteId); if(!el) return;
  el.classList.add(cls); setTimeout(()=> el.classList.remove(cls), ms||700);
}
// Kurzes Vollbild-Aufleuchten in der Arena (z. B. bei Detonationen).
function screenFlash(color, ms){
  if(reducedMotion()) return;
  const el = $('#arenaFlash'); if(!el) return;
  el.style.setProperty('--flash-col', color || '#fff');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  setTimeout(()=> el.classList.remove('on'), ms || 320);
}
// Wuchtiger Screen-Shake (stärker als der normale Treffer-Shake).
function bigShake(){
  if(reducedMotion()) return;
  const stage = $('#arenaStage'); if(!stage) return;
  stage.classList.remove('shake-hard'); void stage.offsetWidth; stage.classList.add('shake-hard');
  setTimeout(()=> stage.classList.remove('shake-hard'), 460);
}
// Expandierende Druckwelle/Ring am Einschlagspunkt.
function spawnShockwave(spriteId, color){
  const a = anchorOf(spriteId);
  const w = document.createElement('div');
  w.className = 'vfx-shock';
  w.style.left = a.x+'px'; w.style.top = a.y+'px';
  w.style.setProperty('--shock-col', color || '#fff');
  $('#dmgLayer').appendChild(w);
  setTimeout(()=> w.remove(), 650);
}
// Partikel-Burst (Funken/Sterne/Blut/Seelen). rise>0 lässt sie aufsteigen.
function spawnParticles(spriteId, opts){
  opts = opts || {};
  const count = opts.count || 12, glyph = opts.glyph || '✦', color = opts.color || '#fff';
  const spread = opts.spread || 70, rise = opts.rise || 0;
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className = 'vfx-particle'; p.textContent = glyph; p.style.color = color;
    p.style.left = a.x+'px'; p.style.top = a.y+'px';
    const ang = Math.random()*Math.PI*2, dist = spread*(0.4+Math.random()*0.8);
    p.style.setProperty('--dx', Math.round(Math.cos(ang)*dist)+'px');
    p.style.setProperty('--dy', Math.round(Math.sin(ang)*dist - rise)+'px');
    p.style.animationDelay = Math.round(Math.random()*120)+'ms';
    layer.appendChild(p);
    setTimeout(()=> p.remove(), 1000);
  }
}
// Schnelle Mehrfach-Slashes mit Trail (physischer Burst).
function spawnSlashCombo(spriteId){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  for(let i=0;i<3;i++){
    setTimeout(()=>{
      const s = document.createElement('div');
      s.className = 'slash slash-big';
      const jx = Math.round((Math.random()*2-1)*22), jy = Math.round((Math.random()*2-1)*22);
      s.style.left = (a.x-55+jx)+'px'; s.style.top = (a.y-55+jy)+'px';
      s.style.transform = 'rotate('+Math.round(Math.random()*70-35)+'deg)';
      layer.appendChild(s);
      setTimeout(()=> s.remove(), 380);
    }, i*90);
  }
}
// Meteor stürzt von oben in die Arena + Explosion (magischer Burst).
function spawnMeteor(spriteId, color){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const m = document.createElement('div');
  m.className = 'vfx-meteor';
  m.style.left = a.x+'px'; m.style.top = a.y+'px';
  m.style.setProperty('--mcol', color || '#9be7ff');
  layer.appendChild(m);
  setTimeout(()=>{ m.remove(); spawnShockwave(spriteId, color); }, 470);
}
// Leuchtender Seelen-Strahl zwischen zwei Sprites mit fließenden Orbs.
function spawnBeam(fromId, toId, color){
  const f = anchorOf(fromId), t = anchorOf(toId);
  const dx = t.x - f.x, dy = t.y - f.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx) * 180/Math.PI;
  const b = document.createElement('div');
  b.className = 'vfx-beam';
  b.style.left = f.x+'px'; b.style.top = f.y+'px';
  b.style.width = len+'px'; b.style.transform = 'rotate('+ang+'deg)';
  b.style.setProperty('--beam-col', color || '#c0392b');
  for(let i=0;i<4;i++){
    const o = document.createElement('div'); o.className = 'vfx-beam-orb';
    o.style.animationDelay = (i*120)+'ms'; b.appendChild(o);
  }
  $('#dmgLayer').appendChild(b);
  setTimeout(()=> b.remove(), 820);
}
// Großer Heileffekt: Lichtsäule + Heilkreis + goldene Funken.
function vfxHeal(spriteId){
  spawnHealCircle(spriteId);
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const pillar = document.createElement('div');
  pillar.className = 'vfx-pillar';
  pillar.style.left = a.x+'px'; pillar.style.top = a.y+'px';
  layer.appendChild(pillar);
  setTimeout(()=> pillar.remove(), 900);
  spawnParticles(spriteId, { count:14, glyph:'✦', color:'#ffe9a8', spread:46, rise:74 });
}
// Burst-Einschlag: physisch = Slashes+Splitter, magisch = Meteor+Sterne.
function vfxBurst(targetId, magic, color){
  if(magic){
    spawnMeteor(targetId, color);
    screenFlash(color, 240);
    spawnParticles(targetId, { count:16, glyph:'✦', color, spread:80 });
  } else {
    spawnSlashCombo(targetId);
    spawnShockwave(targetId, '#ffffff');
    spawnParticles(targetId, { count:12, glyph:'✦', color:'#ffd24a', spread:70 });
  }
  flashSpriteClass(targetId, 'hit', 300);
  bigShake();
}
// Drain: Seelenstrahl vom Ziel zum Wirker + Blutfunken + kurzes Entsättigen.
function vfxDrain(fromId, toId){
  spawnBeam(fromId, toId, '#c0306b');
  flashSpriteClass(fromId, 'desat', 760);
  flashSpriteClass(toId, 'aura-blood', 760);
  spawnParticles(toId, { count:12, glyph:'🩸', color:'#e0466e', spread:40, rise:24 });
  bigShake();
}

// ====================================================================
//  SIGNATUR-EFFEKTE pro aktiver Fähigkeit (WoW-Style).
//  Wiederverwendbare Primitive + ID-basiertes Dispatch. Fehlt eine Signatur,
//  greift der kind-basierte Fallback (vfxBurst/vfxHeal/vfxDrain). Identisch
//  in Boss-Kampf und Duell; der Turm ist log-basiert (keine VFX).
// ====================================================================
function clearById(id){ const e = $('#'+id); if(e) e.remove(); }

// Rotierender Runen-/Sigil-Bodenkreis unter einem Sprite (WoW-Cast-Circle).
function spawnGroundRune(spriteId, opts){
  opts = opts || {};
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const r = document.createElement('div');
  r.className = 'vfx-rune-ring' + (opts.persistent ? ' persist' : '');
  if(opts.id) r.id = opts.id;
  r.style.left = a.x+'px'; r.style.top = (a.y + 36)+'px';
  r.style.setProperty('--rune-col', opts.color || '#9be7ff');
  layer.appendChild(r);
  if(!opts.persistent) setTimeout(()=> r.remove(), opts.dur || 950);
  return r;
}

// Um den Sprite kreisende Glüh-Orbs/Glyphen (Buff-Auren, Sterne, Klingen).
function makeOrbit(spriteId, opts){
  opts = opts || {};
  const a = anchorOf(spriteId);
  const c = document.createElement('div');
  c.className = 'vfx-orbit';
  c.style.left = a.x+'px'; c.style.top = (a.y - 6)+'px';
  const n = opts.count || 3, period = opts.period || 2600, R = opts.radius || 50;
  for(let i=0;i<n;i++){
    const g = document.createElement('div'); g.className = 'vfx-orbit-g';
    g.style.setProperty('--r', R+'px');
    g.style.setProperty('--period', period+'ms');
    g.style.animationDelay = (-(i*period/n))+'ms';
    g.style.setProperty('--orb-col', opts.color || '#fff');
    if(opts.glyph){
      const inner = document.createElement('span'); inner.className = 'vfx-orbit-i';
      inner.textContent = opts.glyph;
      inner.style.setProperty('--period', period+'ms');
      inner.style.setProperty('--orb-col', opts.color || '#fff');
      inner.style.animationDelay = (-(i*period/n))+'ms';
      g.appendChild(inner);
    } else g.classList.add('orb');
    c.appendChild(g);
  }
  return c;
}
function spawnOrbit(spriteId, opts){
  opts = opts || {};
  if(reducedMotion()) return null;
  const c = makeOrbit(spriteId, opts);
  $('#dmgLayer').appendChild(c);
  if(!opts.persistent) setTimeout(()=> c.remove(), opts.dur || 1300);
  return c;
}

// Gestaffelte Geschoss-Salve Caster→Ziel (Sternenregen, Klingen, Arkan).
function spawnProjectileVolley(fromId, toId, opts){
  opts = opts || {};
  const from = anchorOf(fromId), to = anchorOf(toId), layer = $('#dmgLayer');
  const n = opts.count || 5, stag = opts.stagger || 110, col = opts.color || '#9be7ff';
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      if(!currentFight) return;
      const jx = Math.round((Math.random()*2-1)*34), jy = Math.round((Math.random()*2-1)*26);
      const sx = opts.fromTop ? (to.x + jx) : from.x;
      const sy = opts.fromTop ? (to.y - 360) : from.y;
      const ex = to.x + (opts.fromTop ? 0 : jx), ey = to.y + (opts.fromTop ? 0 : jy);
      const p = document.createElement('div'); p.className = 'vfx-proj';
      if(opts.glyph) p.textContent = opts.glyph;
      p.style.left = sx+'px'; p.style.top = sy+'px';
      p.style.setProperty('--col', col);
      p.style.setProperty('--tx', (ex - sx)+'px');
      p.style.setProperty('--ty', (ey - sy)+'px');
      p.style.animationDuration = (0.42/combatSpeed)+'s';
      layer.appendChild(p);
      setTimeout(()=>{ p.remove(); spawnShockwave(toId, col); spawnParticles(toId, { count:5, glyph:'✦', color:col, spread:34 }); }, 440/combatSpeed);
    }, (i*stag)/combatSpeed);
  }
}

// Großer Crescent-/Sensen-Slash mit Glüh-Trail.
function spawnSlashArc(spriteId, opts){
  opts = opts || {};
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const s = document.createElement('div'); s.className = 'vfx-arc';
  s.style.left = a.x+'px'; s.style.top = a.y+'px';
  s.style.setProperty('--arc-col', opts.color || '#fff');
  s.style.setProperty('--arc-rot', (opts.angle != null ? opts.angle : -35)+'deg');
  layer.appendChild(s);
  setTimeout(()=> s.remove(), 460);
}

// Gefüllte, expandierende Detonation (stärker als der dünne Schock-Ring).
function spawnNova(spriteId, color){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const n = document.createElement('div'); n.className = 'vfx-nova';
  n.style.left = a.x+'px'; n.style.top = a.y+'px';
  n.style.setProperty('--nova-col', color || '#9b30ff');
  layer.appendChild(n);
  setTimeout(()=> n.remove(), 640);
}

// Einschlag mit Boden-Rissen + Schutt (Schildwucht, Komet).
function spawnImpact(spriteId, color){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const c = document.createElement('div'); c.className = 'vfx-crater';
  c.style.left = a.x+'px'; c.style.top = (a.y + 40)+'px';
  c.style.setProperty('--crater-col', color || '#bfe3ff');
  layer.appendChild(c);
  spawnShockwave(spriteId, color || '#fff');
  spawnParticles(spriteId, { count:12, glyph:'✦', color: color || '#cfd6e6', spread:90, rise:10 });
  setTimeout(()=> c.remove(), 720);
}

// Großes Emblem/Sigil blitzt über dem Sprite (Totenkopf, Wappen, Sternbild).
function spawnSigilFlash(spriteId, opts){
  opts = opts || {};
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const s = document.createElement('div'); s.className = 'vfx-sigil';
  s.textContent = opts.glyph || '💀';
  s.style.left = a.x+'px'; s.style.top = (a.y - 36)+'px';
  s.style.color = opts.color || '#fff';
  layer.appendChild(s);
  setTimeout(()=> s.remove(), 760);
}

// Einsaugender Spiral-Wirbel (Implosion vor der Detonation).
function spawnVortex(spriteId, color){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  const v = document.createElement('div'); v.className = 'vfx-vortex';
  v.style.left = a.x+'px'; v.style.top = a.y+'px';
  v.style.setProperty('--vtx-col', color || '#9b30ff');
  layer.appendChild(v);
  setTimeout(()=> v.remove(), 520);
}

// Rauchwolke (Stealth-Einstieg).
function spawnSmoke(spriteId){
  const a = anchorOf(spriteId), layer = $('#dmgLayer');
  for(let i=0;i<5;i++){
    const p = document.createElement('div'); p.className = 'vfx-smoke';
    const jx = Math.round((Math.random()*2-1)*40), jy = Math.round((Math.random()*2-1)*26);
    p.style.left = (a.x+jx)+'px'; p.style.top = (a.y+jy)+'px';
    p.style.animationDelay = (i*40)+'ms';
    layer.appendChild(p);
    setTimeout(()=> p.remove(), 900);
  }
}

// Vollbild-Rand-Vignette (Hinrichtung, Berserk, heiliger Schein).
function screenVignette(color, ms){
  if(reducedMotion()) return;
  const layer = $('#dmgLayer'); if(!layer) return;
  const v = document.createElement('div'); v.className = 'arena-vignette';
  v.style.setProperty('--vig-col', color || '#c0306b');
  layer.appendChild(v);
  setTimeout(()=> v.remove(), ms || 700);
}

// ---- Persistente Buff-Signaturen (per Fähigkeits-ID) --------------------
const DEFAULT_SIG = {
  crit:      { aura:'aura-crit' },
  dmgBoost:  { aura:'aura-fire' },
  lifesteal: { aura:'aura-blood' },
};
const BUFF_SIG = {
  // critBoost
  kaltblut:        { aura:'aura-steel',  orbit:{ glyph:'🗡️', color:'#bfe3ff', count:3, radius:52 } },
  heiler_a9_klar:  { aura:'aura-arcane', orbit:{ glyph:'✨',  color:'#cdeeff', count:4, radius:54 } },
  // dmgBoost
  schurke_a5_tanz: { aura:'aura-shadow', orbit:{ color:'#b06bff', count:3, radius:50 }, rune:'#9b30ff' },
  heiler_a5_inf:   { aura:'aura-arcane', orbit:{ glyph:'🔮', color:'#9be7ff', count:3, radius:52 } },
  hexer_a5_brand:  { aura:'aura-shadow', orbit:{ glyph:'🔥', color:'#b06bff', count:3, radius:50 } },
  // lifesteal
  schurke_a5_beute:   { aura:'aura-blood',        orbit:{ glyph:'🩸', color:'#ff6a8a', count:3, radius:50 } },
  schurke_a9_toetung: { aura:'aura-blood-strong', orbit:{ glyph:'🩸', color:'#ff5a7a', count:4, radius:54 } },
  hexer_a9_orgie:     { aura:'aura-blood-strong', orbit:{ glyph:'🩸', color:'#ff5a7a', count:4, radius:54 }, rune:'#c0306b' },
};

// Toggelt Aura-Klasse + persistente Deko (Orbit/Rune) eines Buffs an einem Sprite.
function applyBuffAura(spriteId, type, buff, now){
  const active = !!buff && now < (buff.until || 0);
  const sig = (active && buff && BUFF_SIG[buff.src]) || DEFAULT_SIG[type] || {};
  if(sig.aura) setSpriteClass(spriteId, sig.aura, active);
  const oid = 'sig-orbit-'+spriteId+'-'+type, rid = 'sig-rune-'+spriteId+'-'+type;
  if(active && sig.orbit && !reducedMotion()){
    if(!$('#'+oid)){ const c = makeOrbit(spriteId, sig.orbit); c.id = oid; $('#dmgLayer').appendChild(c); }
  } else clearById(oid);
  if(active && sig.rune){ if(!$('#'+rid)) spawnGroundRune(spriteId, { color: sig.rune, persistent:true, id:rid }); }
  else clearById(rid);
}

// Defensiver Buff (dmgReduce): Kuppel / Stealth je nach Fähigkeit.
function applyDefenseAura(spriteId, buff, now, domeId, domeDir){
  domeId = domeId || 'shieldDome'; domeDir = domeDir || 1;
  const active = !!buff && now < (buff.until || 0);
  const src = buff && buff.src;
  const runeId = 'sig-rune-'+spriteId+'-def';
  if(active && src === 'schurke_a9_versch'){
    setSpriteClass(spriteId, 'stealth', true);
    removeShieldDome(domeId); setSpriteClass(spriteId, 'aura-shield', false);
    clearById(runeId);
    return;
  }
  setSpriteClass(spriteId, 'stealth', false);
  if(active){
    if(!$('#'+domeId)) spawnShieldDome(spriteId, domeId, domeDir);
    const dome = $('#'+domeId);
    if(dome) dome.classList.toggle('dome-gold', src === 'verteidiger_a9_unbeug');
    setSpriteClass(spriteId, 'aura-shield', true);
    if(src === 'verteidiger_a9_unbeug'){ if(!$('#'+runeId)) spawnGroundRune(spriteId, { color:'#ffd24a', persistent:true, id:runeId }); }
    else clearById(runeId);
  } else {
    removeShieldDome(domeId); setSpriteClass(spriteId, 'aura-shield', false);
    clearById(runeId);
  }
}

// Fußpunkt eines Sprites (Boden, Mitte) + seitlicher Versatz Richtung Gegner –
// für bodenstehende Beschwörungen wie die Teufelswache. Misst live (resize-fest).
function groundAnchorOf(spriteId){
  const stage = $('#arenaStage'), el = $('#'+spriteId);
  if(!stage || !el) return null;
  const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - sr.left + r.width/2 + 92, y: r.top - sr.top + r.height - 6 };
}
// Erzeugt das große Teufelswache-Element (größer als der Held) im #dmgLayer.
function spawnDemon(spriteId, opts){
  opts = opts || {};
  const layer = $('#dmgLayer'); if(!layer) return null;
  const d = document.createElement('div');
  d.className = 'vfx-demon';
  if(opts.id) d.id = opts.id;
  const body = document.createElement('span'); body.className = 'vfx-demon-body';
  body.innerHTML = '<img class="vfx-demon-img" src="'+buildDemonSVG()+'" alt="Teufelswache">';
  const aura = document.createElement('span'); aura.className = 'vfx-demon-aura';
  d.appendChild(aura); d.appendChild(body);
  layer.appendChild(d);
  if(opts.dur){ setTimeout(()=> d.remove(), opts.dur); }
  return d;
}
// Hält die persistente Teufelswache neben dem Wirker und positioniert sie live nach.
function applyDemonAura(spriteId, active){
  const id = 'sig-demon-'+spriteId;
  let d = $('#'+id);
  if(active && !reducedMotion()){
    const p = groundAnchorOf(spriteId); if(!p) return;
    if(!d) d = spawnDemon(spriteId, { id, persistent:true });
    if(d){ d.style.left = p.x+'px'; d.style.top = p.y+'px'; }
  } else if(d){ d.remove(); }
}

// ---- Signatur-Renderer je Fähigkeit (Cast-Moment) -----------------------
// hero = Wirker-Sprite, boss = Ziel-Sprite (im Duell ggf. getauscht).
const ABILITY_VFX = {
  // ---- SCHURKE ----
  kaltblut(hero){ spawnGroundRune(hero, { color:'#bfe3ff' }); spawnParticles(hero, { count:10, glyph:'❄', color:'#bfe3ff', spread:46, rise:30 }); flashSpriteClass(hero, 'aura-steel', 700); },
  schurke_a5_ausweid(hero, boss){ spawnSlashArc(boss, { color:'#ff5a5a', angle:-32 }); setTimeout(()=> spawnSlashArc(boss, { color:'#ffffff', angle:34 }), 90); spawnParticles(boss, { count:10, glyph:'🩸', color:'#e0466e', spread:58 }); flashSpriteClass(boss, 'freeze', 280); flashSpriteClass(boss, 'hit', 300); bigShake(); },
  schurke_a5_beute(hero){ spawnGroundRune(hero, { color:'#ff6a8a' }); spawnParticles(hero, { count:10, glyph:'🩸', color:'#ff6a8a', spread:44, rise:30 }); },
  schurke_a5_tanz(hero){ spawnGroundRune(hero, { color:'#9b30ff' }); spawnSmoke(hero); spawnParticles(hero, { count:8, glyph:'🌑', color:'#b06bff', spread:46, rise:24 }); },
  schurke_a9_todes(hero, boss){ spawnSlashArc(boss, { color:'#ffffff', angle:-28 }); spawnSigilFlash(boss, { glyph:'💀', color:'#ff5a5a' }); flashSpriteClass(boss, 'freeze', 380); spawnParticles(boss, { count:14, glyph:'🩸', color:'#e0466e', spread:70 }); screenVignette('#c0306b', 700); screenFlash('#ffffff', 170); bigShake(); },
  schurke_a9_toetung(hero){ spawnGroundRune(hero, { color:'#ff5a7a' }); spawnParticles(hero, { count:12, glyph:'🩸', color:'#ff5a7a', spread:48, rise:30 }); screenVignette('#c0306b', 480); },
  schurke_a9_versch(hero){ spawnSmoke(hero); spawnParticles(hero, { count:8, glyph:'🌑', color:'#9b6bff', spread:50, rise:18 }); },
  nebelschritt(hero){ spawnSmoke(hero); spawnSmoke(hero); spawnGroundRune(hero, { color:'#6b4bff' }); spawnParticles(hero, { count:16, glyph:'🌫️', color:'#9b6bff', spread:70, rise:14 }); },
  nebelschritt_ambush(hero, boss){ spawnSmoke(hero); spawnParticles(hero, { count:8, glyph:'🌑', color:'#9b6bff', spread:46, rise:10 }); spawnSlashArc(boss, { color:'#b6a0ff', angle:-30 }); setTimeout(()=> spawnSlashArc(boss, { color:'#ffffff', angle:32 }), 90); spawnSigilFlash(boss, { glyph:'🗡️', color:'#cdbcff' }); spawnParticles(boss, { count:12, glyph:'✦', color:'#cdbcff', spread:58 }); flashSpriteClass(boss, 'hit', 300); screenFlash('#b6a0ff', 150); bigShake(); },
  // ---- VERTEIDIGER ----
  schildwall(hero){ spawnGroundRune(hero, { color:'#7fd0ff' }); spawnParticles(hero, { count:8, glyph:'🛡', color:'#7fd0ff', spread:42, rise:20 }); },
  verteidiger_a5_trotz(hero){ spawnSigilFlash(hero, { glyph:'🛡️', color:'#7fd0ff' }); spawnGroundRune(hero, { color:'#7fd0ff' }); },
  verteidiger_a5_schild(hero, boss){ spawnShockwave(boss, '#ffffff'); spawnSigilFlash(boss, { glyph:'🛡️', color:'#bfe3ff' }); spawnOrbit(boss, { glyph:'⭐', color:'#ffe066', count:4, radius:46, period:1400, dur:1300 }); spawnParticles(boss, { count:8, glyph:'✦', color:'#bfe3ff', spread:60 }); flashSpriteClass(boss, 'hit', 300); bigShake(); },
  verteidiger_a5_bastion(hero){ vfxHeal(hero); spawnGroundRune(hero, { color:'#7fd0ff' }); },
  verteidiger_a9_unbeug(hero){ spawnSigilFlash(hero, { glyph:'🛡️', color:'#ffd24a' }); spawnGroundRune(hero, { color:'#ffd24a' }); screenFlash('#bfe3ff', 150); },
  verteidiger_a9_wucht(hero, boss){ spawnImpact(boss, '#bfe3ff'); spawnNova(boss, '#7fd0ff'); spawnSigilFlash(boss, { glyph:'🛡️', color:'#bfe3ff' }); screenFlash('#ffffff', 180); bigShake(); },
  verteidiger_a9_halten(hero){ vfxHeal(hero); spawnGroundRune(hero, { color:'#ffd24a' }); spawnOrbit(hero, { glyph:'🛡', color:'#7fd0ff', count:4, radius:54, period:1600, dur:1400 }); },
  donnerknall(hero, boss){ spawnImpact(boss, '#bfe3ff'); spawnShockwave(boss, '#ffffff'); spawnNova(boss, '#7fd0ff'); spawnSigilFlash(boss, { glyph:'⚡', color:'#ffe066' }); flashSpriteClass(boss, 'freeze', 600); spawnOrbit(boss, { glyph:'💫', color:'#ffe066', count:4, radius:42, period:900, dur:1700 }); screenFlash('#ffffff', 160); bigShake(); setTimeout(bigShake, 130); },
  // ---- HEILER ----
  heilkreis(hero){ vfxHeal(hero); spawnGroundRune(hero, { color:'#9dffc4' }); },
  heiler_a5_blitz(hero){ vfxHeal(hero); screenFlash('#ffe9a8', 150); },
  heiler_a5_arkan(hero, boss){ spawnMeteor(boss, '#9be7ff'); spawnParticles(boss, { count:14, glyph:'✦', color:'#9be7ff', spread:78 }); screenFlash('#9be7ff', 200); bigShake(); },
  heiler_a5_inf(hero){ spawnGroundRune(hero, { color:'#9be7ff' }); spawnParticles(hero, { count:10, glyph:'🔮', color:'#9be7ff', spread:46, rise:26 }); },
  heiler_a9_segen(hero){ vfxHeal(hero); const a = anchorOf(hero), layer = $('#dmgLayer'); const pil = document.createElement('div'); pil.className = 'vfx-pillar'; pil.style.left = a.x+'px'; pil.style.top = a.y+'px'; pil.style.filter = 'hue-rotate(-12deg) brightness(1.15)'; layer.appendChild(pil); setTimeout(()=> pil.remove(), 900); spawnParticles(hero, { count:16, glyph:'✦', color:'#ffe9a8', spread:54, rise:80 }); screenVignette('#ffe9a8', 480); },
  heiler_a9_stern(hero, boss){ spawnProjectileVolley(hero, boss, { count:6, color:'#9be7ff', glyph:'⭐', stagger:120, fromTop:true }); setTimeout(()=>{ screenFlash('#9be7ff', 220); bigShake(); }, 360); },
  heiler_a9_klar(hero){ spawnGroundRune(hero, { color:'#cdeeff' }); spawnOrbit(hero, { glyph:'✨', color:'#cdeeff', count:4, radius:52, period:1500, dur:1400 }); spawnParticles(hero, { count:10, glyph:'✨', color:'#cdeeff', spread:44, rise:28 }); },
  lichtsaeule(hero, boss){ vfxHeal(hero); const a = anchorOf(hero), layer = $('#dmgLayer'); if(layer){ const pil = document.createElement('div'); pil.className = 'vfx-pillar vfx-pillar-gold'; pil.style.left = a.x+'px'; pil.style.top = a.y+'px'; layer.appendChild(pil); setTimeout(()=> pil.remove(), 950); } spawnGroundRune(hero, { color:'#ffe9a8' }); spawnProjectileVolley(hero, boss, { count:5, color:'#ffe9a8', glyph:'⭐', stagger:90, fromTop:true }); setTimeout(()=>{ spawnNova(boss, '#ffe9a8'); spawnParticles(boss, { count:14, glyph:'✦', color:'#ffe9a8', spread:80 }); screenFlash('#fff3c8', 200); bigShake(); }, 320); screenVignette('#ffe9a8', 600); },
  // ---- HEXER (Seelenraub-Strahl bleibt unverändert) ----
  hexer_a5_brand(hero){ spawnGroundRune(hero, { color:'#9b30ff' }); spawnParticles(hero, { count:10, glyph:'🔥', color:'#b06bff', spread:46, rise:26 }); },
  hexer_a5_rausch(hero, boss){ spawnBeam(hero, boss, '#9b30ff'); setTimeout(()=>{ spawnNova(boss, '#9b30ff'); spawnParticles(boss, { count:10, glyph:'🌑', color:'#b06bff', spread:60 }); }, 200); bigShake(); },
  hexer_a9_explo(hero, boss){ spawnVortex(boss, '#9b30ff'); setTimeout(()=>{ spawnNova(boss, '#9b30ff'); spawnShockwave(boss, '#b06bff'); spawnParticles(boss, { count:16, glyph:'🌑', color:'#b06bff', spread:90 }); screenFlash('#9b30ff', 220); bigShake(); }, 240); },
  hexer_a9_orgie(hero){ spawnGroundRune(hero, { color:'#c0306b' }); spawnParticles(hero, { count:12, glyph:'🩸', color:'#ff5a7a', spread:48, rise:30 }); },
  teufelswache(hero){ spawnGroundRune(hero, { color:'#7CFC00' }); spawnNova(hero, '#7CFC00'); spawnSigilFlash(hero, { glyph:'😈', color:'#9bff5a' }); spawnParticles(hero, { count:14, glyph:'🔥', color:'#9bff5a', spread:60, rise:20 }); applyDemonAura(hero, true); },
  // ---- NEUE TALENT-AKTIVE ----
  // Schurke
  schurke_a5_gift(hero, boss){ spawnSlashArc(boss, { color:'#9acd32', angle:-28 }); spawnParticles(boss, { count:12, glyph:'☠️', color:'#9acd32', spread:54, rise:8 }); flashSpriteClass(boss, 'desat', 500); },
  schurke_a5_wirbel(hero, boss){ for(let k=0;k<4;k++) setTimeout(()=> spawnSlashArc(boss, { color: k%2?'#ffffff':'#bfe3ff', angle:-40 + k*28 }), k*80); spawnOrbit(hero, { glyph:'🗡️', color:'#bfe3ff', count:4, radius:42, period:600, dur:900 }); spawnParticles(boss, { count:10, glyph:'✦', color:'#bfe3ff', spread:60 }); bigShake(); },
  schurke_a9_aderlass(hero, boss){ spawnSlashArc(boss, { color:'#e0466e', angle:-30 }); spawnParticles(boss, { count:12, glyph:'🩸', color:'#e0466e', spread:56, rise:6 }); screenVignette('#c0306b', 420); },
  schurke_a9_meuchel(hero, boss){ spawnSmoke(hero); spawnSlashArc(boss, { color:'#b6a0ff', angle:-32 }); setTimeout(()=> spawnSlashArc(boss, { color:'#ffffff', angle:30 }), 90); spawnSigilFlash(boss, { glyph:'🗡️', color:'#cdbcff' }); flashSpriteClass(boss, 'freeze', 380); spawnOrbit(boss, { glyph:'💫', color:'#ffe066', count:3, radius:34, period:900, dur:1500 }); screenFlash('#b6a0ff', 150); bigShake(); },
  // Verteidiger
  verteidiger_a5_wurf(hero, boss){ spawnProjectileVolley(hero, boss, { count:1, color:'#bfe3ff', glyph:'🛡️', stagger:0 }); setTimeout(()=>{ spawnShockwave(boss, '#ffffff'); spawnSigilFlash(boss, { glyph:'🛡️', color:'#bfe3ff' }); spawnParticles(boss, { count:10, glyph:'✦', color:'#ff8a3d', spread:60 }); flashSpriteClass(boss, 'hit', 280); bigShake(); }, 360); },
  verteidiger_a5_vergelt(hero){ spawnSigilFlash(hero, { glyph:'🪞', color:'#b6d0ff' }); spawnNova(hero, '#b6d0ff'); spawnGroundRune(hero, { color:'#b6d0ff' }); spawnOrbit(hero, { glyph:'🪞', color:'#b6d0ff', count:3, radius:48, period:1500, dur:1300 }); },
  verteidiger_a9_avatar(hero){ spawnSigilFlash(hero, { glyph:'🌟', color:'#ffd24a' }); spawnGroundRune(hero, { color:'#ffd24a' }); spawnNova(hero, '#ffd24a'); screenVignette('#ffe9a8', 480); screenFlash('#bfe3ff', 150); },
  verteidiger_a9_wall(hero){ spawnSigilFlash(hero, { glyph:'✨', color:'#ffe9a8' }); spawnGroundRune(hero, { color:'#ffd24a' }); spawnOrbit(hero, { glyph:'🛡', color:'#ffe9a8', count:4, radius:52, period:1500, dur:1400 }); screenVignette('#ffe9a8', 520); },
  // Heiler
  heiler_a5_verjueng(hero){ vfxHeal(hero); spawnGroundRune(hero, { color:'#9dffc4' }); spawnOrbit(hero, { glyph:'🍃', color:'#9dffc4', count:4, radius:50, period:1600, dur:1400 }); },
  heiler_a5_schild(hero){ spawnShieldDome(hero, 'absorbDome', 1); spawnSigilFlash(hero, { glyph:'🛡️', color:'#ffe9a8' }); spawnParticles(hero, { count:10, glyph:'✦', color:'#ffe9a8', spread:46, rise:20 }); },
  heiler_a9_engel(hero){ vfxHeal(hero); spawnSigilFlash(hero, { glyph:'😇', color:'#ffe9a8' }); spawnProjectileVolley(hero, hero, { count:8, color:'#ffe9a8', glyph:'✦', stagger:60, fromTop:true }); screenVignette('#ffe9a8', 560); },
  heiler_a9_rein(hero){ vfxHeal(hero); spawnNova(hero, '#cdeeff'); spawnParticles(hero, { count:12, glyph:'✦', color:'#cdeeff', spread:48, rise:26 }); screenFlash('#cdeeff', 140); },
  // Hexer
  hexer_a5_verderb(hero, boss){ spawnBeam(hero, boss, '#9b30ff'); spawnParticles(boss, { count:10, glyph:'🟣', color:'#b06bff', spread:54, rise:8 }); spawnGroundRune(boss, { color:'#9b30ff' }); },
  hexer_a5_furcht(hero, boss){ spawnSigilFlash(boss, { glyph:'💀', color:'#b06bff' }); spawnVortex(boss, '#9b30ff'); spawnOrbit(boss, { glyph:'💫', color:'#b06bff', count:3, radius:34, period:900, dur:1700 }); screenVignette('#6b4a8f', 560); flashSpriteClass(boss, 'freeze', 380); },
  hexer_a9_chaos(hero, boss){ spawnProjectileVolley(hero, boss, { count:6, color:'#7CFC00', glyph:'☄️', stagger:110, fromTop:true }); setTimeout(()=>{ spawnImpact(boss, '#7CFC00'); spawnNova(boss, '#9bff5a'); spawnParticles(boss, { count:16, glyph:'🔥', color:'#9bff5a', spread:90 }); screenFlash('#7CFC00', 200); bigShake(); }, 380); },
  hexer_a9_stein(hero){ spawnSigilFlash(hero, { glyph:'💜', color:'#b06bff' }); spawnGroundRune(hero, { color:'#9b30ff' }); spawnOrbit(hero, { glyph:'💜', color:'#b06bff', count:4, radius:50, period:1500, dur:1500 }); screenVignette('#6b4a8f', 480); },
};

// Spielt die Signatur einer Fähigkeit; fehlt sie, greift der kind-basierte Fallback.
function playAbilityVfx(ab, heroId, bossId, magic){
  if(ab && ABILITY_VFX[ab.id]){ ABILITY_VFX[ab.id](heroId, bossId); return; }
  if(!ab) return;
  if(ab.kind === 'heal') vfxHeal(heroId);
  else if(ab.kind === 'burst') vfxBurst(bossId, !!magic, magic ? '#9be7ff' : '#ffd24a');
  else if(ab.kind === 'drain') vfxDrain(bossId, heroId);
  else spawnParticles(heroId, { count:8, glyph:'✦', color:'#fff', spread:40, rise:20 });
}
// Wie playAbilityVfx, aber per ID (Duell-Sync kennt nur die ID + Art).
function playAbilityVfxById(id, heroId, bossId, magic, kind){
  if(ABILITY_VFX[id]){ ABILITY_VFX[id](heroId, bossId); return; }
  if(kind === 'heal') vfxHeal(heroId);
  else if(kind === 'drain') vfxDrain(bossId, heroId);
  else vfxBurst(bossId, !!magic, magic ? '#9be7ff' : '#ffd24a');
}

// Kanalisierter Seelenraub: pro Sekunde `burstMult` Schaden am Boss + Heilung
// in gleicher Höhe, über die gesamte `dur`. Der Seelenstrahl steht durchgehend,
// solange der Effekt läuft – Animation und Wirkung enden gemeinsam.
let _drainTimer = null, _drainBeamTimer = null;
function startDrainChannel(f, ab){
  const tickMs = ab.tickMs || 1000;
  const ticks  = Math.max(1, Math.round(ab.dur / tickMs));
  startDrainBeam('bossSprite', 'heroSprite', ab.dur, ab);
  if(ab.id === 'hexer_a9_fresser') spawnSigilFlash('bossSprite', { glyph:'💀', color:'#b06bff' });
  let i = 0;
  const healMult = classOf(state).healMult || 1;
  const tick = () => {
    _drainTimer = null;
    if(currentFight !== f || f.over){ stopDrainChannel(); return; }
    // Schaden skaliert mit Magie-Stats und kann kritten; Heilung mit der Heilwirkung.
    const { dmg, crit } = abilityDamage(f, ab.burstMult);
    f.bossHp = Math.max(0, f.bossHp - dmg);
    f.dmgDealt += dmg;
    const heal = Math.round(dmg * healMult * (f.healDebuff || 1));
    f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
    mechFloat('boss', (crit?'✸ ':'💥 ')+'-'+fmtBig(dmg), '#ffd24a');
    mechFloat('hero', '🩸 +'+fmtBig(heal), '#e0466e');
    spawnParticles('heroSprite', { count:6, glyph:'🩸', color:'#e0466e', spread:38, rise:22 });
    updateHpBars(f); updateMeter(f);
    addCombatLog(f, ab.icon+' '+ab.name+': '+(crit?'KRIT ':'')+fmtBig(dmg)+' Schaden (+Heilung)', '#ffd24a');
    if(f.bossHp <= 0){ stopDrainChannel(); endFight(f, true); return; }
    if(++i < ticks) _drainTimer = setTimeout(tick, tickMs / combatSpeed);
    else stopDrainChannel();
  };
  // Erster Tick am Ende der ersten Sekunde – so deckt sich das letzte Tick mit
  // dem Strahl-Ende (4 Ticks bei 4 s Dauer).
  _drainTimer = setTimeout(tick, tickMs / combatSpeed);
}
function stopDrainChannel(){
  if(_drainTimer){ clearTimeout(_drainTimer); _drainTimer = null; }
  stopDrainBeam();
}
// Stehender Seelenstrahl Boss→Held für die volle Kanal-Dauer (pulsierend).
function startDrainBeam(fromId, toId, dur, ab){
  stopDrainBeam();
  const a = anchorOf(fromId), t = anchorOf(toId);
  const dx = t.x - a.x, dy = t.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx) * 180/Math.PI;
  const real = dur / combatSpeed;
  const b = document.createElement('div');
  // Seelenraub (Grundfähigkeit) = Referenz-Strahl. Talent-Kanäle sind verwandte
  // Varianten: Aderlass-Ritual dünner, Seelenfresser dicker & dunkler.
  const id = ab && ab.id;
  let beamCol = '#c0306b';
  b.className = 'vfx-beam drain-beam' +
    (id === 'hexer_a5_ritual' ? ' drain-small' : id === 'hexer_a9_fresser' ? ' drain-big' : '');
  if(id === 'hexer_a9_fresser') beamCol = '#7a1fb0';
  b.id = 'drainBeam';
  b.style.left = a.x+'px'; b.style.top = a.y+'px';
  b.style.width = len+'px'; b.style.transform = 'rotate('+ang+'deg)';
  b.style.setProperty('--beam-col', beamCol);
  for(let k = 0; k < 4; k++){
    const o = document.createElement('div'); o.className = 'vfx-beam-orb';
    o.style.animationDelay = (k*220)+'ms'; b.appendChild(o);
  }
  $('#dmgLayer').appendChild(b);
  flashSpriteClass(fromId, 'desat', real);
  flashSpriteClass(toId, 'aura-blood', real);
  _drainBeamTimer = setTimeout(stopDrainBeam, real + 120);
}
function stopDrainBeam(){
  if(_drainBeamTimer){ clearTimeout(_drainBeamTimer); _drainBeamTimer = null; }
  const b = $('#drainBeam'); if(b) b.remove();
}

// Reiner DOM-Teardown der Arena – kein Duell-Wissen. Ruft erst NACH der
// Verrechnung das onClose() (→ cleanupDuel/leaveDuel) auf, damit ein
// terminaler Forfeit-Snapshot nicht vorzeitig gelöscht wird.
function hardCloseArena(f){
  if(f) f.over = true;
  clearTimeout(_forfeitTimer); _forfeitTimer = null;
  arenaOverlay().classList.remove('show');
  clearTimeout(combatTimer); combatTimer = null;
  resetAbilityVisuals();
  if(currentFight === f || !currentFight) currentFight = null;
  if(f && f.onClose) f.onClose();
  renderAll();
}

let _forfeitTimer = null;
export function closeArena(){
  const f = currentFight;
  // Unbeendetes Duell verlassen = Forfeit: Verlassender verliert den Einsatz,
  // der Gegner gewinnt. Host autoritativ informieren (terminaler Snapshot für
  // den Gegner), lokal sofort verrechnen, Ergebnis kurz zeigen, dann schließen.
  if(f && f.isDuel && !f.over && !f._ended && f.onForfeit){
    f._forfeiting = true;
    clearTimeout(combatTimer); combatTimer = null;
    try { f.onForfeit(); } catch(e){}
    f._ended = true;
    endDuel(f, f.role === 'host' ? 'guest' : 'host', f.role);
    clearTimeout(_forfeitTimer);
    _forfeitTimer = setTimeout(()=> hardCloseArena(f), 1200);
    return;
  }
  hardCloseArena(f);
}

// Gegner hat die Arena verlassen (Lobby beendet, kein Snapshot mehr) → dieser
// Client gewinnt. Safety-Net zum Snapshot-Pfad; durch _ended doppelt abgesichert.
export function resolveArenaOpponentLeft(){
  const f = currentFight;
  if(!f || !f.isDuel || f._ended) return;
  f._ended = true;
  endDuel(f, f.role, f.role);
  clearTimeout(_forfeitTimer);
  _forfeitTimer = setTimeout(()=> hardCloseArena(f), 1200);
}

// ---- Kampfende & Belohnung -----------------------------------------
function endFight(fight, win){
  fight.over = true;
  clearTimeout(combatTimer);
  updatePotionBtn();
  resetAbilityVisuals();
  updateAbilityBtn();
  const res = $('#arenaResult');
  const boss = fight.boss, bossIndex = fight.bossIndex, isFarm = fight.isFarm;

  if(win){
    state.killCounts[bossIndex] = (state.killCounts[bossIndex]||0) + 1;
    let xpBase = Math.round(boss.recPower * 3 + 200);  // XP stark erhöht (weniger grind-lastig)
    if(isFarm){ xpBase = Math.round(xpBase*FARM.xpMult); }
    const xpGain = gainXp(xpBase);

    // Garantierter Erstkill-Drop (#15): Seltenheit steigt mit Boss-Index.
    // Beim Abfarmen eine Stufe niedriger – der hohe (epische+) Drop bleibt dem
    // Erstkill vorbehalten (kein Episch-Mindestfloor mehr).
    let dropBlock = '';
    let rIdx = guaranteedRarityIndex(bossIndex);
    if(isFarm) rIdx = Math.max(0, rIdx - FARM.dropRarityDrop);
    {
      const rk = rarityByIndex(rIdx).key;
      const drop = rollItem(bossIndex, 0, { slots: boss.loot && boss.loot.slots, forceRarityKey: rk, minIlvl: bossIndex*5 });
      // Beute geht NIE verloren: passt sie nicht, wartet sie in der ausstehenden
      // Beute, bis Platz frei ist (kein Verlust trotz Boss-Kill).
      const added = giveLoot(state, drop); addLog(drop); recordDrop(drop);
      dropBlock = dropCardHTML(drop) + (added ? '' :
        '<div class="arena-drop-note">🎒 Inventar voll – der Gegenstand <b>wartet in der ausstehenden Beute</b>. '+
        'Mach Platz im Inventar, dann rückt er automatisch nach.</div>');
    }

    // Belohnungs-Bausteine für die aufgeräumte Sieg-Karte sammeln.
    let coinAmount = 0;     // Coins für den Coin-Chip (0 = kein Chip)
    let coinNote = '';      // kleiner Zusatz im Coin-Chip (z. B. Farm-Hinweis)
    let statusNote = '';    // Statuszeile (neuer Boss / Farm-Kampf)
    let statusKind = '';    // CSS-Variante der Statuszeile
    let bonusNote = '';     // Erstkill-Bonus-Hinweis
    if(!isFarm){
      state.stats.bossKills++;
      statusNote = 'Neuer Boss freigeschaltet!'; statusKind = 'unlock';
      if(bossIndex === state.zone){
        state.zone++;
        state.bossesBeaten++;
        if(!state.firstClears[bossIndex]){
          state.firstClears[bossIndex] = true;
          // Erstkill-Bonus (#16): volle Coins (global) + Heiltrank.
          // Nur beim ECHTEN Erstkill – Farmen erreicht diesen Zweig nie.
          const coins = bossCoinReward(bossIndex);
          awardCoins(coins).catch(()=>{}); state.stats.goldEarned += coins;
          state.potions = (state.potions||0) + 1;
          coinAmount = coins;
          bonusNote = '🏆 Erstkill-Bonus: 🪙 +'+fmtBig(coins)+' Coins + 🧪 Heiltrank!';
        }
      }
    } else {
      state.stats.farmKills++;
      statusNote = 'Farm-Kampf – reduzierte Belohnung'; statusKind = 'farm';
      // Wiederholungskämpfe geben 30 % der Erstkill-Münzen (kein Heiltrank).
      const coins = Math.round(bossCoinReward(bossIndex) * FARM.coinMult);
      if(coins > 0){
        awardCoins(coins).catch(()=>{}); state.stats.goldEarned += coins;
        coinAmount = coins; coinNote = 'Farm – 30 %';
      }
    }

    const chips = '<div class="ar-chips">'+
        '<span class="ar-chip xp">⭐ +'+fmtBig(xpGain)+' XP</span>'+
        (coinAmount>0 ? '<span class="ar-chip coin">🪙 +'+fmtBig(coinAmount)+
          (coinNote?' <small>'+coinNote+'</small>':'')+'</span>' : '')+
      '</div>';

    res.className = 'arena-result win show';
    res.innerHTML = '<div class="big">⚔️ Sieg!</div>'+
      '<div class="ar-boss">'+boss.name+' besiegt!</div>'+
      chips+
      (statusNote ? '<div class="ar-status '+statusKind+'">'+statusNote+'</div>' : '')+
      (bonusNote ? '<div class="ar-bonus">'+bonusNote+'</div>' : '')+
      dropBlock;
    saveState();
    checkAdventureBadges();   // Boss-/Zonen-/Sammel-Badges prüfen
  } else {
    gainXp(Math.round(boss.recPower * 3 * 0.15));  // Trost-XP bei Niederlage (an erhöhte Kampf-XP angepasst)
    saveState();
    res.className = 'arena-result lose show';
    res.innerHTML = '<div class="big">💀 Niederlage</div>'+
      '<div class="sub">'+boss.name+' war zu stark. Grinde bessere Items und versuch es erneut!</div>';
  }
  // Kampf-UI (HP-Balken, DPS-Meter, Log, Buffs, Heiltrank) ausblenden, damit
  // die Belohnung ungestört und fokussiert wirkt.
  $('#arena').classList.add('fight-over');
  $('#arenaCloseBtn').textContent = 'Schließen';
  $('#arenaCloseBtn').style.display = '';
}

// =====================================================================
//  LIVE-PvP-DUELL: exakt dieselbe Arena, der Gegner steht im Boss-Slot.
//  Der Host (siehe duel.js) simuliert autoritativ; BEIDE Clients rendern
//  ausschließlich aus dem Kampf-Snapshot via applyDuelSnapshot().
// =====================================================================
// cfg: { lobbyId, role, myName, oppName, oppSrc, myTier, ability, stake, onAction, onClose, onForfeit }
export function openDuelArena(cfg){
  clearTimeout(combatTimer); combatTimer = null;
  const t = recomputeTotals();
  const stage = $('#arenaStage');
  stage.style.setProperty('--arena-bg', "url('"+zoneBg(state.zone)+"')");
  $('#heroSprite').src = heroSrc(heroTier(t.power));
  $('#bossSprite').src = cfg.oppSrc;
  $('#heroBarName').textContent = cfg.myName || 'Du';
  $('#bossBarName').textContent = '🆚 ' + (cfg.oppName || 'Gegner');

  const fight = {
    isDuel: true, role: cfg.role, lobbyId: cfg.lobbyId, stake: cfg.stake|0,
    onAction: cfg.onAction, onClose: cfg.onClose, onForfeit: cfg.onForfeit,
    heroMaxHp: 1, heroHp: 1, bossMaxHp: 1, bossHp: 1,
    abilities: cfg.abilities || [], abilityCd: {}, buffs: freshBuffs(),
    over: false, anchor: {}, startedAt: Date.now(),
    _animTurn: -1, _lastHealTs: 0, _ended: false, _fxSeen: {},
  };
  currentFight = fight;
  $('#arenaResult').className = 'arena-result';
  $('#arenaResult').classList.remove('show');
  $('#arena').classList.remove('fight-over');   // Kampf-UI wieder einblenden
  $('#arenaCloseBtn').style.display = ''; $('#arenaCloseBtn').textContent = '🚪 Verlassen';
  combatSpeed = 1;
  if($('#combatLog')) $('#combatLog').innerHTML = '';
  resetAbilityVisuals();
  updateAbilityBtn();
  // Anzeige neutral starten, bis der erste Snapshot echte Werte liefert
  // (verhindert „1/1 HP" und „🧪 Heiltrank (?)" vor dem Kampfbeginn).
  $('#heroHp').style.width = '0%'; $('#bossHp').style.width = '0%';
  $('#heroHpText').textContent = ''; $('#bossHpText').textContent = '';
  const _pb = $('#potionBtn');
  if(_pb){ _pb.style.display = 'none'; }   // im Duell gibt es keine Heiltränke
  arenaOverlay().classList.add('show');

  requestAnimationFrame(()=> measureAnchors(fight));
  $('#heroSprite').onload = ()=> { if(currentFight===fight && !fight.over) measureAnchors(fight); };
  $('#bossSprite').onload = ()=> { if(currentFight===fight && !fight.over) measureAnchors(fight); };
  return fight;
}

// Wird bei jedem Kampf-Snapshot (duel/combat/<id>) auf BEIDEN Clients aufgerufen.
export function applyDuelSnapshot(snap){
  const f = currentFight;
  if(!f || !f.isDuel || !snap) return;
  const me = f.role, opp = me === 'host' ? 'guest' : 'host';

  f.heroMaxHp = snap[me+'MaxHp'] || 1; f.heroHp = snap[me+'Hp'] || 0;
  f.bossMaxHp = snap[opp+'MaxHp'] || 1; f.bossHp = snap[opp+'Hp'] || 0;
  updateHpBars(f);

  const sec = Math.max(0.5, (Date.now() - (snap.startedAt || Date.now()))/1000);
  $('#dpsMeter').textContent = 'DPS '+fmtBig(Math.round((snap.dmgDealt||0)/sec))+
    ' · Schaden '+fmtBig(snap.dmgDealt||0)+' · Runde '+(snap.turn||0);

  // Eigene Fähigkeits-Cooldowns (autoritativ als Restzeiten je Ability-Id).
  const cdMap = snap[me+'Cd'] || {};
  f.abilityCd = {};
  for(const id in cdMap) f.abilityCd[id] = Date.now() + cdMap[id];
  updateAbilityBtns();

  // Kampflog (Map vom Host → nach Index absteigend).
  if(snap.log){
    const box = $('#combatLog');
    if(box){
      box.innerHTML = Object.entries(snap.log).sort((a,b)=> +b[0]-+a[0]).slice(0,40)
        .map(([,e])=> '<div class="cl-line" style="color:'+(e.c||'#cfc6dd')+'">'+(e.t||'')+'</div>').join('');
    }
  }

  // Angriffs-Animationen einmal pro neuer Runde (Lunge/Treffer/Zahlen wie im SP).
  if(!f.over && snap.turn !== f._animTurn){
    f._animTurn = snap.turn;
    replayDuelEvents(snap.events || [], me);
  }

  // Skill-Effekt-Visuals (Auren restzeit-basiert, Einschläge per Timestamp).
  applyDuelFx(snap.fx || {}, me);

  if(snap.over && !f._ended){ f._ended = true; endDuel(f, snap.winner, me); }
}

function replayDuelEvents(events, me){
  events.forEach((e, i) => {
    setTimeout(()=>{
      if(!currentFight || currentFight.over) {/* Ergebnis kann schon da sein – Treffer trotzdem zeigen */}
      const attacker = e.s === me ? 'hero' : 'boss';
      const defender = e.t === me ? 'hero' : 'boss';
      if(e.o){ mechFloat(defender, '💨 Ausweichen', '#9ec5ff'); return; }
      if(e.h){ mechFloat(attacker, '💚 +'+fmtBig(e.d||0), '#37d67a'); return; }
      attackAnim(attacker, e.d||0, !!e.c, ()=>{});
    }, i * 240);
  });
}

function applyDuelFx(fx, me){
  const f = currentFight; if(!f) return;
  const opp = me === 'host' ? 'guest' : 'host';
  const mine = fx[me] || {}, theirs = fx[opp] || {};
  const seen = f._fxSeen || (f._fxSeen = {});
  const now = Date.now();

  // Persistente Buff-Signaturen: eigene am Helden, gegnerische am Boss. Die
  // Restzeiten (ms) werden in absolute `until` umgerechnet, die `*Src`-IDs
  // wählen dieselbe Signatur wie im PvE.
  applyBuffAura('heroSprite', 'crit',      { until: now + (mine.crit||0),    src: mine.critSrc  }, now);
  applyBuffAura('heroSprite', 'dmgBoost',  { until: now + (mine.fire||0),    src: mine.fireSrc  }, now);
  applyBuffAura('heroSprite', 'lifesteal', { until: now + (mine.blood||0),   src: mine.bloodSrc }, now);
  applyBuffAura('bossSprite', 'crit',      { until: now + (theirs.crit||0),  src: theirs.critSrc  }, now);
  applyBuffAura('bossSprite', 'dmgBoost',  { until: now + (theirs.fire||0),  src: theirs.fireSrc  }, now);
  applyBuffAura('bossSprite', 'lifesteal', { until: now + (theirs.blood||0), src: theirs.bloodSrc }, now);
  applyDefenseAura('heroSprite', { until: now + (mine.shield||0),  src: mine.shieldSrc  }, now, 'shieldDome',    1);
  applyDefenseAura('bossSprite', { until: now + (theirs.shield||0), src: theirs.shieldSrc }, now, 'shieldDomeOpp', -1);

  // Einmalige Einschläge (Timestamp-basiert, je Seite nur einmal auslösen).
  if(mine.burstTs && mine.burstTs !== seen.myBurst){
    seen.myBurst = mine.burstTs;
    playAbilityVfxById(mine.burstAb, 'heroSprite', 'bossSprite', !!mine.burstMagic, 'burst');
  }
  if(theirs.burstTs && theirs.burstTs !== seen.oppBurst){
    seen.oppBurst = theirs.burstTs;
    playAbilityVfxById(theirs.burstAb, 'bossSprite', 'heroSprite', !!theirs.burstMagic, 'burst');
  }
  if(mine.drainTs && mine.drainTs !== seen.myDrain){
    seen.myDrain = mine.drainTs; playAbilityVfxById(mine.drainAb, 'heroSprite', 'bossSprite', false, 'drain');
  }
  if(theirs.drainTs && theirs.drainTs !== seen.oppDrain){
    seen.oppDrain = theirs.drainTs; playAbilityVfxById(theirs.drainAb, 'bossSprite', 'heroSprite', false, 'drain');
  }
  if(mine.healTs && mine.healTs !== seen.myHeal){
    seen.myHeal = mine.healTs; playAbilityVfxById(mine.healAb, 'heroSprite', 'bossSprite', false, 'heal'); mechFloat('hero','💚 Heilung','#37d67a');
  }
  if(theirs.healTs && theirs.healTs !== seen.oppHeal){
    seen.oppHeal = theirs.healTs; playAbilityVfxById(theirs.healAb, 'bossSprite', 'heroSprite', false, 'heal'); mechFloat('boss','💚 Heilung','#37d67a');
  }

  // Persistente Zustände: Stealth (Nebelschritt), Betäubung (Donnerknall/Nebelschritt),
  // Teufelswache (Hexer) – je Seite anhand der Restzeiten.
  setSpriteClass('heroSprite', 'vanished', (mine.stealth||0) > 0);
  setSpriteClass('bossSprite', 'vanished', (theirs.stealth||0) > 0);
  applyStunAura('heroSprite', (mine.stun||0) > 0);
  applyStunAura('bossSprite', (theirs.stun||0) > 0);
  applyDemonAura('heroSprite', (mine.pet||0) > 0);
  applyDemonAura('bossSprite', (theirs.pet||0) > 0);

  // Talent-Aktive: Absorb-Schild-Kuppel, Reflexions-Glühen, Verwundbarkeit, Todesrettung.
  if((mine.absorb||0) > 0){ if(!$('#absorbDome')) spawnShieldDome('heroSprite', 'absorbDome', 1); } else removeShieldDome('absorbDome');
  if((theirs.absorb||0) > 0){ if(!$('#absorbDomeOpp')) spawnShieldDome('bossSprite', 'absorbDomeOpp', -1); } else removeShieldDome('absorbDomeOpp');
  setSpriteClass('heroSprite', 'reflect-glow',   (mine.reflect||0) > 0);
  setSpriteClass('bossSprite', 'reflect-glow',   (theirs.reflect||0) > 0);
  setSpriteClass('heroSprite', 'vuln-tint',      (mine.vuln||0) > 0);
  setSpriteClass('bossSprite', 'vuln-tint',      (theirs.vuln||0) > 0);
  setSpriteClass('heroSprite', 'deathsave-glow', (mine.deathsave||0) > 0);
  setSpriteClass('bossSprite', 'deathsave-glow', (theirs.deathsave||0) > 0);

  // Einmalige Cast-Signaturen (Buff/DoT/HoT ohne Sofortschaden) per Timestamp.
  if(mine.castTs && mine.castTs !== seen.myCast){ seen.myCast = mine.castTs; playAbilityVfxById(mine.castAb, 'heroSprite', 'bossSprite', false, ''); }
  if(theirs.castTs && theirs.castTs !== seen.oppCast){ seen.oppCast = theirs.castTs; playAbilityVfxById(theirs.castAb, 'bossSprite', 'heroSprite', false, ''); }
}

// Schwindel-Sterne über einem betäubten Sprite (persistent, id-verwaltet).
function applyStunAura(spriteId, active){
  const id = 'sig-stun-'+spriteId;
  if(active && !reducedMotion()){
    if(!$('#'+id)){ const c = makeOrbit(spriteId, { glyph:'💫', color:'#ffe066', count:3, radius:34, period:900 }); c.id = id; $('#dmgLayer').appendChild(c); }
  } else clearById(id);
}

function endDuel(f, winner, me){
  f.over = true;
  resetAbilityVisuals();
  updateAbilityBtn();
  const draw = winner === 'draw';
  const win = winner === me;
  const stake = f.stake|0;
  // Jeder Client verrechnet den Einsatz über das globale Coin-Wallet (Netto-Pott).
  if(!draw && stake > 0){
    if(win){ awardCoins(stake).catch(()=>{}); state.stats.goldEarned += stake; }
    else   { spendCoins(stake).catch(()=>{}); }
  }
  if(!f._statApplied){
    f._statApplied = true;
    if(!draw){ if(win) state.stats.duelWins = (state.stats.duelWins||0)+1;
               else    state.stats.duelLosses = (state.stats.duelLosses||0)+1; }
  }
  saveState();
  checkAdventureBadges();   // PvP-Badges prüfen

  const res = $('#arenaResult');
  if(draw){
    res.className = 'arena-result show';
    res.innerHTML = '<div class="big">🤝 Unentschieden</div><div class="sub">Beide Helden fallen gleichzeitig – kein Einsatz wechselt den Besitzer.</div>';
  } else if(win){
    res.className = 'arena-result win show';
    res.innerHTML = '<div class="big">🏆 Sieg!</div><div class="sub">Du gewinnst das Duell!'+(stake>0?' 🪙 +'+fmtBig(stake)+' Coins':'')+'</div>';
  } else {
    res.className = 'arena-result lose show';
    res.innerHTML = '<div class="big">💀 Niederlage</div><div class="sub">Dein Gegner war stärker.'+(stake>0?' 🪙 −'+fmtBig(stake)+' Coins':'')+'</div>';
  }
  $('#potionBtn').disabled = true; $('#potionBtn').style.opacity = '0.5';
  $('#arena').classList.add('fight-over');   // Kampf-UI ausblenden, Ergebnis fokussieren
  $('#arenaCloseBtn').textContent = 'Schließen';
  $('#arenaCloseBtn').style.display = '';
}
