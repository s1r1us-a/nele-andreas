/* =====================================================================
   BOSS-KAMPF-ENGINE. Phase 1 (#7,#12,#13,#16,#17) + Phase 2 (#20,#22)
   + Phase 3 (#26 Kampflog/DPS-Meter).
   ===================================================================== */
import { COMBAT, HEAL_PCT, BASE_STAT, ILVL_K, FARM } from '../data/tuning.js';
import { RARITIES, rarityByIndex, rarityOf, rarityIndex } from '../data/rarities.js';
import { SLOTS } from '../data/slots.js';
import { rollAffixes } from '../core/items.js';
import { bossFor, zoneBg, guaranteedRarityIndex, MECH_DEFS } from '../data/bosses.js';
import { state, saveState } from './state.js';
import { recomputeTotals, heroCombat, heroTier, gainXp } from './character.js';
import { heroSrc } from './avatar.js';
import { rollItem, inventoryFull, addLog, recordDrop } from './items.js';
import { $, toast, fmtBig } from '../ui/dom.js';
import { renderAll } from '../ui/render.js';

let combatSpeed = 1, combatTimer = null;
export let currentFight = null;
const arenaOverlay = () => $('#arenaOverlay');

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
    healDebuff: mechanics.includes('schwaechung') ? 0.5 : 1,
    enrageMult:1,
    // Meter
    startedAt: Date.now(), dmgDealt:0, log:[],
  };
  currentFight = fight;
  updateHpBars(fight);
  $('#arenaResult').className = 'arena-result';
  $('#arenaResult').classList.remove('show');
  $('#arenaCloseBtn').style.display = 'none';
  combatSpeed = 1; $('#speedBtn').textContent = '⏩ Tempo 1×';
  if($('#combatLog')) $('#combatLog').innerHTML = '';
  updatePotionBtn();
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
  } else if(fight.invulnTurns > 0){
    mechFloat('boss', '✨ Immun', '#9ec5ff');
  } else {
    const effCrit = fight.heroCritChance * (fight.curseTurns>0 ? 0.5 : 1);
    const heroCrit = Math.random() < effCrit;
    let dmg = Math.max(1, Math.round(fight.heroAtk * rnd(0.15) * (heroCrit ? fight.heroCritMult : 1)));
    if(fight.shieldTurns > 0) dmg = Math.max(1, Math.round(dmg*0.4));  // Eispanzer
    fight.bossHp = Math.max(0, fight.bossHp - dmg);
    fight.dmgDealt += dmg;
    attackAnim('hero', dmg, heroCrit, ()=> updateHpBars(fight));
    // Lebensraub-Affix (#20)
    if(fight.lifesteal > 0){
      const heal = Math.round(dmg * fight.lifesteal * fight.healDebuff);
      if(heal>0){ fight.heroHp = Math.min(fight.heroMaxHp, fight.heroHp + heal); }
    }
    // Procs (#22)
    for(const pr of fight.procs){
      if(Math.random() >= pr.chance) continue;
      if(pr.type==='blitz'){ const ed = Math.round(pr.value); fight.bossHp = Math.max(0, fight.bossHp-ed); fight.dmgDealt+=ed; mechFloat('boss','⚡-'+ed,'#7fd0ff'); }
      else if(pr.type==='lebensquell'){ fight.heroHp = Math.min(fight.heroMaxHp, fight.heroHp + pr.value); mechFloat('hero','💚+'+pr.value,'#37d67a'); }
      else if(pr.type==='zorn'){ fight.zornTurns = Math.max(fight.zornTurns, pr.value); mechFloat('hero','🔆 Zorn','#ffd24a'); }
    }
    // Boss-Dornen reflektieren
    if(hasMech(fight,'dornen')){
      const refl = Math.max(1, Math.round(dmg*0.15));
      fight.heroHp = Math.max(0, fight.heroHp - refl);
      mechFloat('hero', '🌵 -'+refl, '#9acd32');
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
      fight.heroHp = Math.max(0, fight.heroHp - bd);
      if(breath) mechFloat('boss', '🔥 Feueratem', '#ff8a3d');
      attackAnim('boss', bd, bossCrit, ()=> updateHpBars(fight));
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

    updateHpBars(fight);
    if(fight.heroHp <= 0){ return endFight(fight, false); }
    scheduleExchange(fight);
  }, COMBAT.bossReplyMs / combatSpeed);
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
  el.animate(
    [ { transform: base+'translateX(0)' },
      { transform: base+'translateX(60px)', offset:0.4 },
      { transform: base+'translateX(0)' } ],
    { duration: 180 / combatSpeed, easing:'ease-out' }
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
function attackAnim(who, dmg, crit, onHit){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isHero = who==='hero';
  const attacker = isHero ? $('#heroSprite') : $('#bossSprite');
  const target   = isHero ? $('#bossSprite') : $('#heroSprite');
  const targetId = isHero ? 'bossSprite' : 'heroSprite';
  const stage = $('#arenaStage');
  if(!reduce){ lunge(attacker, !isHero); }
  setTimeout(()=>{
    if(onHit) onHit();
    if(!reduce){
      target.classList.add('hit');
      setTimeout(()=> target.classList.remove('hit'), FLASH / combatSpeed);
      if(crit || Math.random()<.5){ stage.classList.add('shake');
        setTimeout(()=> stage.classList.remove('shake'), SHAKE / combatSpeed); }
    }
    const a = (currentFight && currentFight.anchor[targetId]) || { x: stage.clientWidth/2, y: stage.clientHeight/2 };
    const jitter = Math.round((Math.random()*2-1)*12);
    const x = a.x + jitter, y = a.y;
    const layer = $('#dmgLayer');
    if(!reduce){
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
  }, reduce ? 0 : HIT_DELAY / combatSpeed);
}

// ---- Heiltrank im Kampf --------------------------------------------
export function updatePotionBtn(){
  const btn = $('#potionBtn'); if(!btn) return;
  const n = state.potions || 0;
  btn.textContent = '🧪 Heiltrank ('+n+')';
  btn.disabled = n <= 0 || !currentFight || currentFight.over;
  btn.style.opacity = btn.disabled ? '0.5' : '1';
}
export function usePotion(){
  const f = currentFight;
  if(!f || f.over || (state.potions||0) <= 0) return;
  if(f.heroHp >= f.heroMaxHp){ toast('Bereits volle HP'); return; }
  const heal = Math.round(f.heroMaxHp * HEAL_PCT * f.healDebuff);
  f.heroHp = Math.min(f.heroMaxHp, f.heroHp + heal);
  state.potions--; saveState();
  updateHpBars(f);
  mechFloat('hero', '💚 +'+fmtBig(heal), '#37d67a');
  updatePotionBtn();
}

export function toggleSpeed(){
  combatSpeed = combatSpeed === 1 ? 2 : 1;
  $('#speedBtn').textContent = '⏩ Tempo '+combatSpeed+'×';
}
export function closeArena(){
  if(currentFight) currentFight.over = true;
  arenaOverlay().classList.remove('show');
  clearTimeout(combatTimer); combatTimer = null;
  renderAll();
}

// ---- Kampfende & Belohnung -----------------------------------------
function endFight(fight, win){
  fight.over = true;
  clearTimeout(combatTimer);
  updatePotionBtn();
  const res = $('#arenaResult');
  const boss = fight.boss, bossIndex = fight.bossIndex, isFarm = fight.isFarm;

  if(win){
    state.killCounts[bossIndex] = (state.killCounts[bossIndex]||0) + 1;
    let reward = Math.round(boss.recPower * 1.5 + 40);
    let xpBase = Math.round(boss.recPower * 0.6 + 30);  // XP reduziert (Teil 3b)
    if(isFarm){ reward = Math.round(reward*FARM.goldMult); xpBase = Math.round(xpBase*FARM.xpMult); }
    const xpGain = gainXp(xpBase);
    state.gold += reward; state.stats.goldEarned += reward;

    // Garantierter Drop (#15): Seltenheit steigt mit Boss-Index
    let bonusTxt = '';
    let rIdx = guaranteedRarityIndex(bossIndex);
    if(isFarm) rIdx = Math.max(3, rIdx - FARM.dropRarityDrop);
    if(!inventoryFull()){
      const rk = rarityByIndex(rIdx).key;
      const drop = rollItem(bossIndex, 0, { slots: boss.loot && boss.loot.slots, forceRarityKey: rk, minIlvl: bossIndex*5 });
      state.inventory.push(drop); addLog(drop); recordDrop(drop);
      bonusTxt = ' + '+rarityOf(rk).name+' Beute: '+drop.name;
    }

    let firstTxt = '';
    if(!isFarm){
      state.stats.bossKills++;
      if(bossIndex === state.zone){
        state.zone++;
        state.bossesBeaten++;
        if(!state.firstClears[bossIndex]){
          state.firstClears[bossIndex] = true;
          // Erstkill-Bonus (#16): extra Gold + Heiltrank
          const fcGold = Math.round(reward*0.5);
          state.gold += fcGold; state.stats.goldEarned += fcGold;
          state.potions = (state.potions||0) + 1;
          firstTxt = '<br>🏆 Erstkill-Bonus: 💰 '+fmtBig(fcGold)+' Gold + 🧪 Heiltrank!';
        }
      }
    } else { state.stats.farmKills++; }

    res.className = 'arena-result win show';
    res.innerHTML = '<div class="big">⚔️ Sieg!</div>'+
      '<div class="sub">'+boss.name+' besiegt! 💰 '+fmtBig(reward)+' Gold · ⭐ '+fmtBig(xpGain)+' XP'+bonusTxt+
      (isFarm ? '<br>(Farm-Kampf – reduzierte Belohnung)' : '<br>Neuer Boss freigeschaltet!')+firstTxt+'</div>';
    saveState();
  } else {
    gainXp(Math.round(boss.recPower * 0.6 * 0.15));
    saveState();
    res.className = 'arena-result lose show';
    res.innerHTML = '<div class="big">💀 Niederlage</div>'+
      '<div class="sub">'+boss.name+' war zu stark. Grinde bessere Items und versuch es erneut!</div>';
  }
  $('#arenaCloseBtn').style.display = '';
}
