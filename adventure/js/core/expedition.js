/* =====================================================================
   EXPEDITION (Abenteuer auf Zeit). Items werden beim Start gewürfelt
   (offline-sicher) und beim Abholen ins Inventar gelegt.
   ===================================================================== */
import { ITEMS_PER_EXPEDITION, POTION_BASE_CHANCE } from '../data/tuning.js';
import { rarityIndex } from '../data/rarities.js';
import { expeditionOf } from '../data/expeditions.js';
import { rollDyeDrop, DYE_BY_KEY } from '../data/dyes.js';
import { state, saveState } from './state.js';
import { rollItem, freeSlots, addLog, recordDrop } from './items.js';
import { EXPEDITION_MIN_CAP } from './loot.js';
import { gainXp } from './character.js';
import { awardCoins } from './coins.js';
import { toast } from '../ui/dom.js';
import { popFind } from '../ui/tooltip.js';
import { renderAll, flashFullBanner } from '../ui/render.js';
import { showRewardModal } from '../ui/modals.js';

export let findProgress = 0;
export function setFindProgress(v){ findProgress = v; }

export const expeditionActive = () => !!state.expedition;
export const expeditionReady  = () => !!state.expedition && Date.now() >= state.expedition.endsAt;

export function startExpedition(durKey){
  if(state.expedition) return;
  const exp = expeditionOf(durKey); if(!exp) return;
  const now = Date.now();
  const items = [];
  // Anzahl Items steigt mit der Dauer (siehe expeditions.js); Fallback auf 2.
  const count = exp.items || ITEMS_PER_EXPEDITION;
  // Abenteuer schalten mind. „Episch" frei (auch in frühen Zonen).
  for(let i=0;i<count;i++) items.push(rollItem(state.zone, exp.boost, { minRarityCap: EXPEDITION_MIN_CAP }));
  state.expedition = { durKey, startedAt:now, endsAt:now + exp.ms, items };
  saveState(); renderAll();
}
export function cancelExpedition(){
  state.expedition = null;
  saveState(); renderAll();
}
export function collectExpedition(){
  if(!expeditionReady()) return;
  const items = state.expedition.items || [];
  if(freeSlots() < items.length){ flashFullBanner(); return; }
  const exp = expeditionOf(state.expedition.durKey);
  let xpGain = exp ? Math.round(120 + exp.boost*120) : 120;  // XP stark erhöht (weniger grind-lastig)
  // Farbstoff-Drops (Färberei): je mitgebrachtem Fund eine Chance auf Farbstoff.
  const dyesFound = {};
  for(const it of items){
    state.inventory.push(it);
    addLog(it); recordDrop(it); popFind(it);
    state.totalFinds = (state.totalFinds||0) + 1;
    xpGain += rarityIndex(it.rarity)*24 + 16;
    const dyeKey = rollDyeDrop(state.zone);
    if(dyeKey){
      state.dyes[dyeKey] = (state.dyes[dyeKey] || 0) + 1;
      dyesFound[dyeKey] = (dyesFound[dyeKey] || 0) + 1;
    }
  }
  gainXp(xpGain);
  for(const k of Object.keys(dyesFound)){
    toast('🎨 Farbstoff: '+DYE_BY_KEY[k].name+(dyesFound[k]>1?' ×'+dyesFound[k]:''));
  }
  const potionChance = Math.min(0.6, POTION_BASE_CHANCE + (exp ? exp.boost*0.1 : 0));
  let potionGained = false;
  if(Math.random() < potionChance){ state.potions = (state.potions||0) + 1; potionGained = true; toast('🧪 Heiltrank gefunden!'); }
  // Kuratierte Coins für lange Expeditionen (≥ 1 Std): 1h→1, 3h→2, 8h→3.
  if(exp && exp.ms >= 60*60*1000){
    const coins = exp.ms >= 480*60*1000 ? 3 : exp.ms >= 180*60*1000 ? 2 : 1;
    awardCoins(coins).catch(()=>{}); state.stats.goldEarned += coins;
  }
  state.zoneFinds = (state.zoneFinds||0) + items.length;
  state.stats.expeditionsDone++;
  const collected = items.slice();
  state.expedition = null;
  saveState(); renderAll();
  showRewardModal(collected, potionGained);
}
